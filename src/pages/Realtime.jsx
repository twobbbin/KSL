import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';
import {
  Header,
  CameraViewport,
  TranslationPanel,
  SettingsModal,
  StatsBar
} from '../components/index.js';
import { GESTURE_PRESETS, INITIAL_LOGS } from '../data/signData.js';

// 인식 속도/버퍼 진단 로그 (확인이 끝나면 false로 변경)
const DEBUG_PREDICTION = true;

export default function Realtime() {
  const [mode, setMode] = useState('KSL_TO_KO');
  const [settings, setSettings] = useState({
    showLandmarks: true,
    showSkeleton: true,
    showGuideOverlay: true,
    mirrorMode: true,
    activeCamera: false,
    sensitivity: 'medium',
    ttsAutoPlay: false,
    ttsSpeed: 1.0,
    fontSize: 'medium',
    pinkTheme: 'cherry',
    sentenceAutoCompletion: true
  });

  const [currentSentence, setCurrentSentence] = useState('');
  const [recognizedWords, setRecognizedWords] = useState([]);
  const [recentLogs, setRecentLogs] = useState(INITIAL_LOGS);
  const [activeGesture, setActiveGesture] = useState(null);
  const [isRecognizing, setIsRecognizing] = useState(true);
  const [isAiRefining, setIsAiRefining] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Connection state for local Python WebSocket server
  const [isLocalServerConnected, setIsLocalServerConnected] = useState(false);

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Keep references to avoid reconnecting WebSocket when state updates
  const socketRef = useRef(null);
  const ignorePredictionsUntilResetReadyRef = useRef(false);
  const aiTranslatedRef = useRef(false);

  // 실시간 인식 결과 HUD 표시 제어
  const recognitionHideTimerRef = useRef(null);
  const lastDisplayedLabelRef = useRef('');

  const isRecognizingRef = useRef(isRecognizing);
  useEffect(() => {
    isRecognizingRef.current = isRecognizing;
  }, [isRecognizing]);

  const clearRecognitionDisplay = () => {
    if (recognitionHideTimerRef.current) {
      clearTimeout(recognitionHideTimerRef.current);
      recognitionHideTimerRef.current = null;
    }

    lastDisplayedLabelRef.current = '';
    setActiveGesture(null);
  };

  const showRecognitionForThreeSeconds = (gestureObj, label) => {
    if (!label) return;

    const isNewLabel = lastDisplayedLabelRef.current !== label;

    if (isNewLabel) {
      if (recognitionHideTimerRef.current) {
        clearTimeout(recognitionHideTimerRef.current);
      }

      lastDisplayedLabelRef.current = label;
      setActiveGesture(gestureObj);

      recognitionHideTimerRef.current = setTimeout(() => {
        setActiveGesture(null);
        recognitionHideTimerRef.current = null;
      }, 3000);

      return;
    }

    // 같은 라벨이면 값이 바뀐 경우에만 상태 갱신 (불필요한 리렌더링 방지)
    setActiveGesture((prev) => {
      if (!prev) return null;
      if (prev.confidence === gestureObj.confidence) return prev;
      return {
        ...prev,
        ...gestureObj
      };
    });
  };


  // WebSocket Connection Effect
  useEffect(() => {
    let reconnectTimeout = null;
    let isMounted = true;

    const connectWebSocket = () => {
      if (!isMounted) return;

      if (
        socketRef.current &&
        (socketRef.current.readyState === WebSocket.OPEN ||
          socketRef.current.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      console.log('Connecting to local Python model server...');

      // const socket = new WebSocket('ws://localhost:8765');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

      const WS_URL = `${protocol}//${window.location.host}/ws`;

      const socket = new WebSocket(WS_URL);
      socketRef.current = socket;

      socket.onopen = () => {
        if (!isMounted) return;

        console.log('✅ Python AI 서버 연결 성공');
        setIsLocalServerConnected(true);
        showToast('로컬 Python AI 모델 서버와 연동되었습니다 🤖');
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'reset') {
            setCurrentSentence('');
            setRecognizedWords([]);
            aiTranslatedRef.current = false;
            setIsAiRefining(false);
            clearRecognitionDisplay();
            return;
          }

          if (data.type === 'paused') {
            clearRecognitionDisplay();
            return;
          }

          if (data.type === 'reset_ready') {
            // Python confirmed that the old held sign has fully ended.
            // From this point, predictions may be accepted again.
            ignorePredictionsUntilResetReadyRef.current = false;
            setCurrentSentence('');
            setRecognizedWords([]);
            aiTranslatedRef.current = false;
            setIsAiRefining(false);
            clearRecognitionDisplay();
            return;
          }

          if (data.type === 'translated_sentence') {
            const translatedText = String(data.text || '').trim();
            setIsAiRefining(false);

            if (!translatedText) {
              showToast('AI 번역 결과가 비어 있습니다.');
              return;
            }

            aiTranslatedRef.current = true;
            setCurrentSentence(translatedText);

            if (data.source === 'gemini') {
              showToast('AI 번역이 완료되었습니다 ✨');
            } else {
              showToast('AI 연결 문제로 규칙 기반 문장으로 변환했습니다.');
            }
            return;
          }

          if (data.type === 'translation_error') {
            setIsAiRefining(false);
            showToast(data.message || 'AI 번역 중 오류가 발생했습니다.');
            return;
          }

          if (data.type !== 'prediction') return;

          // ▼ 진단용 로그 (DEBUG_PREDICTION = false 로 끄기)
          if (DEBUG_PREDICTION) {
            const nowMs = performance.now();
            const gapMs = nowMs - (window.__lastPredAt ?? nowMs);
            window.__lastPredAt = nowMs;
            console.log(
              `응답간격 ${gapMs.toFixed(0)}ms (≈${gapMs ? (1000 / gapMs).toFixed(1) : '-'}fps)` +
              ` | 서버처리 ${data.processingMs}ms | 모델추론 ${data.inferenceMs}ms` +
              ` | buffer ${data.buffer} | ${data.label || '-'} ${(Number(data.confidence ?? 0) * 100).toFixed(0)}%` +
              ` | added=${data.added}`
            );
          }
          // ▲ 진단용 로그

          // Trash/reset was pressed. Ignore every queued/late prediction
          // until Python confirms hand release with reset_ready.
          if (ignorePredictionsUntilResetReadyRef.current) {
            return;
          }
          if (!isRecognizingRef.current) return;

          // 현재 모델 예측값을 카메라 HUD에 표시
          if (data.label) {
            const matchedPreset = GESTURE_PRESETS.find(
              (g) => g.nameKr === data.label || g.id === data.englishLabel
            );

            const gestureObj = matchedPreset
              ? {
                ...matchedPreset,
                confidence: Number(data.confidence ?? matchedPreset.confidence ?? 0)
              }
              : {
                id: data.englishLabel || `dynamic-${data.label}`,
                nameKr: data.label,
                nameEn: data.englishLabel || data.label,
                category: 'AI 모델',
                meaning: '학습 모델 실시간 예측 수어',
                description: '',
                emoji: '🤖',
                confidence: Number(data.confidence ?? 0),
                tags: ['AI', '실시간'],
                tips: ''
              };

            showRecognitionForThreeSeconds(
              gestureObj,
              data.label
            );
          } else {
            // 손이 사라졌거나 현재 예측 라벨이 비어 있으면
            // 다음에 같은 단어를 다시 했을 때 새 인식으로 표시할 수 있게 준비.
            lastDisplayedLabelRef.current = '';
          }

          // 원본 인식 단어열은 AI 번역 결과와 별도로 보관한다.
          // AI 번역 직후에는 동일한 prediction 패킷이 번역 문장을 덮지 않게 하고,
          // 새 단어가 추가되면 다시 원본 인식 문장 표시로 전환한다.
          if (Array.isArray(data.sentence)) {
            // 내용이 같으면 기존 상태를 유지해 불필요한 리렌더링을 막는다.
            setRecognizedWords((prev) =>
              prev.length === data.sentence.length &&
                prev.every((w, i) => w === data.sentence[i])
                ? prev
                : data.sentence
            );

            if (data.added) {
              aiTranslatedRef.current = false;
              setCurrentSentence(data.sentence.join(' '));
            } else if (!aiTranslatedRef.current) {
              setCurrentSentence(data.sentence.join(' '));
            }
          }

          // 새 단어가 실제 문장에 추가된 순간에만 로그 추가
          if (data.added && data.label) {
            const now = new Date();
            const timeStr = now.toTimeString().split(' ')[0];

            const newLog = {
              id: `log-${Date.now()}`,
              text: data.label,
              timestamp: timeStr,
              confidence: Number(data.confidence ?? 0),
              category: 'AI 모델',
              gestureId: data.englishLabel || data.label
            };

            setRecentLogs((prev) => [newLog, ...prev.slice(0, 29)]);
            showToast(`'${data.label}' 수어가 인식되었습니다 ✨`);
          }
        } catch (err) {
          console.error('Error handling WebSocket message:', err);
        }
      };

      socket.onclose = () => {
        console.log('❌ Python AI 서버 연결 종료');

        if (!isMounted) return;

        setIsLocalServerConnected(false);
        setIsAiRefining(false);
        socketRef.current = null;

        reconnectTimeout = setTimeout(connectWebSocket, 4000);
      };

      socket.onerror = (error) => {
        console.error('Python WebSocket error:', error);
      };
    };

    connectWebSocket();

    return () => {
      isMounted = false;

      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }

      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }

      if (recognitionHideTimerRef.current) {
        clearTimeout(recognitionHideTimerRef.current);
        recognitionHideTimerRef.current = null;
      }
    };
  }, []);

  // Show temporary toast
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Update Settings Partial
  const handleUpdateSettings = (newPartial) => {
    setSettings((prev) => ({ ...prev, ...newPartial }));
  };

  // Handle Gesture Trigger (from camera or dictionary)
  const handleSimulateGesture = (gesture) => {
    setActiveGesture(gesture);

    // Format new timestamp
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    // 시뮬레이션 입력도 실제 인식과 동일하게 원본 단어열로 관리
    aiTranslatedRef.current = false;
    setRecognizedWords((prev) => {
      const next = [...prev, gesture.nameKr];
      setCurrentSentence(next.join(' '));
      return next;
    });

    // Add log
    const newLog = {
      id: `log-${Date.now()}`,
      text: gesture.nameKr,
      timestamp: timeStr,
      confidence: gesture.confidence,
      category: gesture.category,
      gestureId: gesture.id
    };

    setRecentLogs((prev) => [newLog, ...prev.slice(0, 29)]);
    showToast(`'${gesture.nameKr}' 수어가 실시간 인식되었습니다 ✨`);
  };

  // 실시간 번역 문장만 초기화
  // 타임라인(recentLogs)은 절대 건드리지 않는다.
  const handleResetSentence = () => {
    // Immediately block all in-flight / queued prediction responses.
    // Otherwise an old server response can briefly restore the sentence.
    ignorePredictionsUntilResetReadyRef.current = true;

    setCurrentSentence('');
    setRecognizedWords([]);
    aiTranslatedRef.current = false;
    setIsAiRefining(false);
    clearRecognitionDisplay();

    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'reset' }));
    } else {
      // No server acknowledgement will arrive in this case.
      ignorePredictionsUntilResetReadyRef.current = false;
    }

    showToast('실시간 번역 문장이 비워졌습니다.');
  };

  // Pause recognition without clearing translated sentence
  const handleToggleRecognizing = () => {
    const nextRecognizing = !isRecognizing;

    // Going from active -> paused:
    // clear only Python's in-progress frame buffer.
    if (!nextRecognizing) {
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'pause' }));
      }
      setActiveGesture(null);
    }

    setIsRecognizing(nextRecognizing);
  };

  // Handle AI Sentence Refinement
  // 인식된 원본 단어열을 Python 서버로 보내 Gemini가 문장으로 재구성한다.
  const handleRefineWithAI = () => {
    const words = recognizedWords.length > 0
      ? recognizedWords
      : currentSentence.trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      showToast('먼저 수어를 인식해주세요.');
      return;
    }

    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      showToast('Python AI 서버가 연결되어 있지 않습니다.');
      return;
    }

    setIsAiRefining(true);
    socket.send(JSON.stringify({
      type: 'translate',
      words
    }));
    showToast('AI가 문장을 번역하고 있습니다.');
  };

  // Handle History Log Selection
  const handleSelectLog = (log) => {
    setRecognizedWords([log.text]);
    aiTranslatedRef.current = false;
    setCurrentSentence(log.text);
    showToast(`'${log.text}' 문장을 불러왔습니다.`);
  };

  // 번역 기록 타임라인만 초기화
  // currentSentence / Python sentence는 절대 건드리지 않는다.
  const handleClearLogs = () => {
    setRecentLogs([]);
    showToast('번역 기록 타임라인이 비워졌습니다.');
  };

  // Toggle Fullscreen View
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => { });
      }
    }
  };

  // Dynamic Theme Styling Root
  const getThemeContainerClass = () => {
    switch (settings.pinkTheme) {
      case 'rose':
        return 'bg-[#FFF6F7]';
      case 'bubblegum':
        return 'bg-[#FFF0F5]';
      case 'coral':
        return 'bg-[#FFF7F5]';
      case 'cherry':
      default:
        return 'bg-[#FFF5F7]';
    }
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-500 ${getThemeContainerClass()}`}>
      {/* 1. Header & Navigation */}
      <Header
        mode={mode}
        onModeChange={setMode}
        pinkTheme={settings.pinkTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleFullscreen={handleToggleFullscreen}
        isRecognizing={isRecognizing}
        isLocalServerConnected={isLocalServerConnected}
      />

      {/* 2. Main Content Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-5">

        {/* Core Workspace: Focused Split Screen Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch flex-1">

          {/* Left: AI Camera & Hand Landmark Tracking Viewport */}
          <div className="lg:col-span-7 flex flex-col">
            <CameraViewport
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              activeGesture={activeGesture}
              onSimulateGesture={handleSimulateGesture}
              isRecognizing={isRecognizing}
              onToggleRecognizing={handleToggleRecognizing}
              isLocalServerConnected={isLocalServerConnected}
              socketRef={socketRef}
            />
          </div>

          {/* Right: Live Sentence Translation & History Feed */}
          <div className="lg:col-span-5 flex flex-col">
            <TranslationPanel
              currentSentence={currentSentence}
              onSentenceChange={setCurrentSentence}
              onResetSentence={handleResetSentence}
              recentLogs={recentLogs}
              onClearLogs={handleClearLogs}
              onSelectLog={handleSelectLog}
              activeGesture={activeGesture}
              settings={settings}
              onRefineWithAI={handleRefineWithAI}
              isAiRefining={isAiRefining}
            />
          </div>

        </div>

      </main>

      {/* 3. Stats & Engine Status Bar */}
      <StatsBar
        totalWords={recentLogs.length + 12}
        isRecognizing={isRecognizing}
      />

      {/* Modals */}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="bg-slate-900/90 text-white px-4 py-2.5 rounded-2xl shadow-xl backdrop-blur-md border border-pink-400/40 text-xs font-bold flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-pink-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
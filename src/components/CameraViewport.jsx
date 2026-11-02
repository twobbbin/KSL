import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  CameraOff,
  FlipHorizontal,
  Sparkles,
  Activity,
  Scan,
  Play,
  Square
} from 'lucide-react';

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],          // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],          // Index
  [0, 9], [9, 10], [10, 11], [11, 12],     // Middle
  [0, 13], [13, 14], [14, 15], [15, 16],   // Ring
  [0, 17], [17, 18], [18, 19], [19, 20],   // Pinky
  [5, 9], [9, 13], [13, 17]                // Palm base
];

const FINGERTIPS = [4, 8, 12, 16, 20];

export const CameraViewport = ({
  settings,
  onUpdateSettings,
  activeGesture,
  isRecognizing,
  onToggleRecognizing,
  isLocalServerConnected,
  socketRef
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [hasCameraError, setHasCameraError] = useState(false);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isCameraManuallyOff, setIsCameraManuallyOff] = useState(false);
  const [fps, setFps] = useState(30);

  const handsRef = useRef(null);
  const latestResultsRef = useRef(null);

  // 그리기 루프에서 최신 settings를 읽기 위한 ref (effect 재생성 방지)
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // FPS calculation references
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(performance.now());

  const streamRef = useRef(null);

  // Keep at most one AI frame in flight to avoid stale-frame buildup.
  const aiFrameInFlightRef = useRef(false);
  const aiFrameTimeoutRef = useRef(null);

  // Initialize and handle camera stream
  const startCamera = async () => {
    try {
      setHasCameraError(false);
      setIsCameraManuallyOff(false);

      if (!navigator.mediaDevices?.getUserMedia) {
        console.error('getUserMedia를 사용할 수 없는 환경입니다.');
        setHasCameraError(true);
        return;
      }

      // 기존 스트림 종료
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      console.log('카메라 요청 시작');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 960 },
          height: { ideal: 540 },
          frameRate: { ideal: 30 },
          facingMode: 'user'
        },
        audio: false
      });

      console.log('카메라 연결 성공:', stream);

      streamRef.current = stream;

      setCameraStream(stream);
      setIsWebcamActive(true);

    } catch (err) {
      console.error('===== CAMERA ERROR =====');
      console.error('name:', err.name);
      console.error('message:', err.message);
      console.error(err);

      setHasCameraError(true);
      setIsWebcamActive(false);
    }
  };

  // Turn camera off intentionally.
  // The translated sentence is preserved; only recognition buffer is cleared.
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraStream(null);
    setIsWebcamActive(false);
    setIsCameraManuallyOff(true);
    latestResultsRef.current = null;

    const overlayCanvas = canvasRef.current;
    const overlayCtx = overlayCanvas?.getContext('2d');
    if (overlayCanvas && overlayCtx) {
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }

    const socket = socketRef?.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'pause' }));
    }
  };

  // Automatically start camera on mount
  useEffect(() => {
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Sync stream to video element when cameraStream state updates
  useEffect(() => {
    const video = videoRef.current;

    if (!video || !cameraStream) return;

    if (video.srcObject !== cameraStream) {
      video.srcObject = cameraStream;
    }

    const handleLoadedMetadata = async () => {
      try {
        await video.play();
        console.log('웹캠 영상 재생 시작');
      } catch (err) {
        // AbortError는 React 개발환경에서 발생할 수 있으므로 무시
        if (err.name !== 'AbortError') {
          console.error('Video play error:', err);
        }
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [cameraStream]);


  // Initialize MediaPipe, run inference on new video frames,
  // and draw the hand skeleton immediately when results arrive.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!isWebcamActive || !videoRef.current) {
      if (handsRef.current) {
        try {
          handsRef.current.close();
        } catch (e) {
          console.error("Error closing hands", e);
        }
        handsRef.current = null;
      }
      latestResultsRef.current = null;
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const ENABLE_BROWSER_HANDS = true; // 실험 후 true로 되돌리기
    if (!ENABLE_BROWSER_HANDS) return;

    if (!window.Hands) {
      console.warn("MediaPipe Hands SDK is not loaded. Ensure scripts in index.html are correct.");
      return;
    }

    const videoEl = videoRef.current;

    // ------------------------------------------------------------
    // Landmark drawing (called directly from onResults)
    // 실제 단어 인식은 Python 모델이 담당합니다.
    // ------------------------------------------------------------
    const drawHands = (results) => {
      if (!canvas || !ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const { showLandmarks, showGuideOverlay } = settingsRef.current;
      if (!showLandmarks) return;
      if (!results?.multiHandLandmarks?.length) return;

      const t = performance.now() / 1000;

      results.multiHandLandmarks.forEach((landmarks, handIdx) => {
        const handLabel = results.multiHandedness?.[handIdx]?.label ?? '';
        const isRightHand = handLabel.toLowerCase() === 'right';

        // Map normalized coordinates (0..1) to canvas size
        const pts = landmarks.map((lm) => ({
          x: lm.x * width,
          y: lm.y * height
        }));

        ctx.save();

        // Draw bone links
        ctx.lineWidth = 3;
        ctx.strokeStyle = isRightHand ? 'rgba(244, 63, 94, 0.8)' : 'rgba(59, 130, 246, 0.8)';
        ctx.shadowColor = isRightHand ? 'rgba(236, 72, 153, 0.9)' : 'rgba(96, 165, 250, 0.9)';
        ctx.shadowBlur = 4;

        ctx.beginPath();
        HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
          const start = pts[startIdx];
          const end = pts[endIdx];
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
        });
        ctx.stroke();

        // Palm webbing mesh (no shadow)
        ctx.shadowBlur = 0;
        ctx.fillStyle = isRightHand ? 'rgba(251, 113, 133, 0.12)' : 'rgba(191, 219, 254, 0.12)';
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[5].x, pts[5].y);
        ctx.lineTo(pts[9].x, pts[9].y);
        ctx.lineTo(pts[13].x, pts[13].y);
        ctx.lineTo(pts[17].x, pts[17].y);
        ctx.closePath();
        ctx.fill();

        // 21 landmark nodes (shadow only on fingertips)
        pts.forEach((pt, idx) => {
          const isFingertip = FINGERTIPS.includes(idx);
          const isWrist = idx === 0;

          ctx.shadowBlur = isFingertip ? 4 : 0;
          ctx.shadowColor = '#F43F5E';

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, isFingertip ? 5 : isWrist ? 6 : 3.5, 0, 2 * Math.PI);
          ctx.fillStyle = isFingertip ? '#FFF1F2' : '#EFF6FF';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = isFingertip ? '#E11D48' : '#2563EB';
          ctx.stroke();

          // Pulsing fingertip ring
          if (isFingertip) {
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 7 + Math.sin(t * 8 + idx) * 2, 0, 2 * Math.PI);
            ctx.strokeStyle = isRightHand ? 'rgba(244, 63, 94, 0.5)' : 'rgba(59, 130, 246, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        });

        // Bounding box & HUD tag around the hand
        if (showGuideOverlay) {
          const xs = pts.map((p) => p.x);
          const ys = pts.map((p) => p.y);
          const minX = Math.min(...xs) - 20;
          const maxX = Math.max(...xs) + 20;
          const minY = Math.min(...ys) - 20;
          const maxY = Math.max(...ys) + 12;

          const bracketLen = 12;
          ctx.shadowBlur = 0;
          ctx.strokeStyle = isRightHand ? '#F43F5E' : '#3B82F6';
          ctx.lineWidth = 2.5;

          // Top Left
          ctx.beginPath(); ctx.moveTo(minX, minY + bracketLen); ctx.lineTo(minX, minY); ctx.lineTo(minX + bracketLen, minY); ctx.stroke();
          // Top Right
          ctx.beginPath(); ctx.moveTo(maxX - bracketLen, minY); ctx.lineTo(maxX, minY); ctx.lineTo(maxX, minY + bracketLen); ctx.stroke();
          // Bottom Left
          ctx.beginPath(); ctx.moveTo(minX, maxY - bracketLen); ctx.lineTo(minX, maxY); ctx.lineTo(minX + bracketLen, maxY); ctx.stroke();
          // Bottom Right
          ctx.beginPath(); ctx.moveTo(maxX - bracketLen, maxY); ctx.lineTo(maxX, maxY); ctx.lineTo(maxX, maxY - bracketLen); ctx.stroke();

          // Hand tracker ID tag
          // (mirrorMode에서 캔버스가 CSS로 뒤집히므로 글자는 반전될 수 있음 - 기존 동작과 동일)
          ctx.fillStyle = isRightHand ? 'rgba(225, 29, 72, 0.85)' : 'rgba(37, 99, 235, 0.85)';
          ctx.fillRect(minX, minY - 20, 90, 16);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '10px Pretendard, sans-serif';
          ctx.fillText(`${handLabel.toUpperCase()}_HAND`, minX + 6, minY - 8);
        }

        ctx.restore();
      });
    };

    const hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    // 브라우저 쪽은 화면 표시용이므로 가벼운 모델 사용
    // (단어 인식은 Python 서버가 별도로 처리)
    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 0,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    hands.onResults((results) => {
      latestResultsRef.current = results;
      drawHands(results);
    });

    handsRef.current = hands;

    let active = true;
    let animId = null;
    let vfcId = null;

    const scheduleNext = () => {
      if (!active) return;

      if (typeof videoEl.requestVideoFrameCallback === 'function') {
        vfcId = videoEl.requestVideoFrameCallback(processVideoFrame);
      } else {
        animId = requestAnimationFrame(processVideoFrame);
      }
    };

    const processVideoFrame = async () => {
      if (!active) return;

      if (videoEl.srcObject && videoEl.readyState >= 2) {
        try {
          await hands.send({ image: videoEl });

          frameCountRef.current += 1;
          const now = performance.now();
          if (now - lastFpsUpdateRef.current >= 1000) {
            setFps(Math.round((frameCountRef.current * 1000) / (now - lastFpsUpdateRef.current)));
            frameCountRef.current = 0;
            lastFpsUpdateRef.current = now;
          }
        } catch (e) {
          console.error("Error sending frame to MediaPipe", e);
        }
      }

      // 추론이 끝난 뒤 "그 다음 새 프레임"을 기다린다 (밀린 프레임은 건너뜀)
      scheduleNext();
    };

    scheduleNext();

    return () => {
      active = false;

      if (animId) {
        cancelAnimationFrame(animId);
      }
      if (vfcId && typeof videoEl.cancelVideoFrameCallback === 'function') {
        videoEl.cancelVideoFrameCallback(vfcId);
      }
      if (handsRef.current) {
        try {
          handsRef.current.close();
        } catch (e) {
          console.error("Error closing hands in cleanup", e);
        }
        handsRef.current = null;
      }
      latestResultsRef.current = null;
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [isWebcamActive]);


  // Unlock AI frame sending whenever Python replies.
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;

    const handleAiReply = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (
          data.type === 'prediction' ||
          data.type === 'paused' ||
          data.type === 'reset_ready'
        ) {
          aiFrameInFlightRef.current = false;

          if (aiFrameTimeoutRef.current) {
            clearTimeout(aiFrameTimeoutRef.current);
            aiFrameTimeoutRef.current = null;
          }
        }
      } catch {
        // Ignore non-JSON messages.
      }
    };

    socket.addEventListener('message', handleAiReply);

    return () => {
      socket.removeEventListener('message', handleAiReply);
      aiFrameInFlightRef.current = false;

      if (aiFrameTimeoutRef.current) {
        clearTimeout(aiFrameTimeoutRef.current);
        aiFrameTimeoutRef.current = null;
      }
    };
  }, [isLocalServerConnected, socketRef]);


  // Send webcam frames to the local Python AI server.
  // The hidden canvas is intentionally separate from the visible landmark canvas.
  useEffect(() => {
    if (!isWebcamActive || !isRecognizing || !isLocalServerConnected) {
      return;
    }

    const intervalId = setInterval(() => {
      const video = videoRef.current;
      const canvas = captureCanvasRef.current;
      const socket = socketRef?.current;

      if (!video || !canvas || !socket) return;
      if (socket.readyState !== WebSocket.OPEN) return;
      if (video.readyState < 2) return;

      // If Python is still processing the previous frame, skip this tick.
      // This ensures the next frame sent is the newest camera frame.
      if (aiFrameInFlightRef.current) return;

      // Keep the browser WebSocket buffer very small.
      if (socket.bufferedAmount > 64_000) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const image = canvas.toDataURL('image/jpeg', 0.65);

      aiFrameInFlightRef.current = true;

      socket.send(
        JSON.stringify({
          type: 'frame',
          image
        })
      );

      // Safety unlock if a reply is lost.
      if (aiFrameTimeoutRef.current) {
        clearTimeout(aiFrameTimeoutRef.current);
      }

      aiFrameTimeoutRef.current = setTimeout(() => {
        aiFrameInFlightRef.current = false;
        aiFrameTimeoutRef.current = null;
      }, 500);
    }, 33);

    return () => {
      clearInterval(intervalId);
    };
  }, [
    isWebcamActive,
    isRecognizing,
    isLocalServerConnected,
    socketRef
  ]);


  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Video Viewport Container */}
      <div
        id="camera-viewport-card"
        className="relative w-full aspect-[3/4] sm:aspect-video bg-gradient-to-b from-pink-950 via-slate-900 to-pink-950 rounded-3xl overflow-hidden border-2 border-pink-300/80 shadow-xl shadow-pink-200/50 group"
      >
        {/* Subtle Cyber Pink Grid Background */}
        <div className="absolute inset-0 bg-[radial-gradient(#ec4899_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

        {/* Video Element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${settings.mirrorMode ? 'scale-x-[-1]' : ''
            }`}
        />

        {/* Hidden canvas used only for sending compressed webcam frames to Python */}
        <canvas
          ref={captureCanvasRef}
          width={640}
          height={360}
          className="hidden"
        />


        {/* Camera OFF / Connection fallback */}
        {!isWebcamActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-pink-950/90 via-slate-950/95 to-rose-950/90 p-6 text-center z-10">
            <div className="absolute w-72 h-72 rounded-full bg-pink-500/20 blur-3xl animate-pulse pointer-events-none" />

            <div className="z-10 flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-center max-w-[85%] sm:max-w-md shadow-lg">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300">
                {isCameraManuallyOff ? (
                  <CameraOff className="w-6 h-6" />
                ) : (
                  <Camera className="w-6 h-6" />
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-white tracking-wide">
                  {isCameraManuallyOff
                    ? '카메라가 꺼져 있습니다'
                    : hasCameraError
                      ? '카메라 연결 실패 또는 권한 필요'
                      : '웹캠 연결 중...'}
                </h4>
                <p className="text-xs text-pink-200/80 mt-1 leading-relaxed">
                  {isCameraManuallyOff
                    ? '카메라와 수어 인식이 중지되었습니다. 기존 번역 문장은 유지됩니다.'
                    : hasCameraError
                      ? '브라우저 주소창 왼쪽의 카메라 권한을 허용한 후 아래 버튼을 눌러주세요.'
                      : '브라우저 카메라 접근 권한을 확인하고 있습니다.'}
                </p>
              </div>

              <button
                onClick={startCamera}
                className="mt-1 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                {isCameraManuallyOff ? '카메라 켜기' : '웹캠 다시 시도 / 연결'}
              </button>
            </div>
          </div>
        )}


        {/* Hand Skeleton & Landmark Canvas Layer */}
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
          className={`absolute inset-0 w-full h-full pointer-events-none z-10 ${settings.mirrorMode ? 'scale-x-[-1]' : ''
            }`}
        />

        {/* Cyber Pink Scanline Bar Animation */}
        {isRecognizing && isWebcamActive && (
          <motion.div
            animate={{ y: ['0%', '1000%'] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-pink-400 to-transparent opacity-60 pointer-events-none z-10"
          />
        )}

        {/* HUD Top Bar: Status, FPS, Sensitivity */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 backdrop-blur-md border ${isRecognizing
              ? (isLocalServerConnected ? 'bg-emerald-600/85 text-white border-emerald-400 shadow-md shadow-emerald-500/30' : 'bg-rose-500/80 text-white border-rose-300 shadow-md shadow-rose-500/30 animate-pulse')
              : 'bg-slate-800/80 text-pink-200 border-slate-700'
              }`}>
              <Activity className="w-3.5 h-3.5" />
              {isRecognizing ? (isLocalServerConnected ? 'PYTHON AI ACTIVE' : 'LIVE RECOGNITION') : 'PAUSED'}
            </span>

            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono text-pink-200 bg-pink-950/70 backdrop-blur-md border border-pink-500/30">
              {fps} FPS
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-pink-100 bg-pink-900/80 backdrop-blur-md border border-pink-400/40">
              감도: {settings.sensitivity?.toUpperCase() || 'MEDIUM'}
            </span>
          </div>
        </div>


        {/* Real-time Recognition Spotlight HUD Banner */}
        <AnimatePresence>
          {activeGesture && isRecognizing && isWebcamActive && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none"
            >
              <div className="bg-gradient-to-r from-pink-900/90 via-rose-900/90 to-pink-950/90 backdrop-blur-lg p-3.5 rounded-2xl border border-pink-400/60 shadow-xl shadow-pink-950/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl filter drop-shadow-md">{activeGesture.emoji}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-pink-300 uppercase tracking-wider">
                        실시간 인식 결과
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-pink-500/30 text-pink-200 text-[10px] font-semibold">
                        {activeGesture.category}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-extrabold text-white tracking-wide">
                      {activeGesture.nameKr}
                    </h3>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <div className="flex items-center gap-1 text-xs font-mono font-bold text-pink-300">
                    <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                    <span>정확도 {Math.round(activeGesture.confidence * 100)}%</span>
                  </div>
                  <div className="w-24 h-1.5 bg-pink-950/80 rounded-full mt-1 overflow-hidden border border-pink-700/50">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(activeGesture.confidence * 100)}%` }}
                      className="h-full bg-gradient-to-r from-pink-400 to-rose-400 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Camera Control Toolbar */}
      <div
        id="camera-control-toolbar"
        className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white/90 backdrop-blur-md rounded-2xl border border-pink-200/80 shadow-sm shadow-pink-100/50"
      >
        {/* Left Toggle Group: Recognition & Camera */}
        <div className="flex items-center gap-2">
          {/* Pause / Resume Recognition */}
          <button
            id="btn-toggle-recognition"
            onClick={onToggleRecognizing}
            disabled={!isWebcamActive}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${!isWebcamActive
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : isRecognizing
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-gradient-to-r from-pink-500 to-rose-400 text-white shadow-md shadow-pink-300/40'
              }`}
          >
            {isRecognizing ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>인식 일시정지</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>인식 재개</span>
              </>
            )}
          </button>

          {/* Camera ON / OFF */}
          <button
            id="btn-toggle-camera"
            onClick={isWebcamActive ? stopCamera : startCamera}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${isWebcamActive
              ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
              : 'bg-gradient-to-r from-pink-500 to-rose-400 text-white shadow-md shadow-pink-300/40'
              }`}
          >
            {isWebcamActive ? (
              <>
                <CameraOff className="w-3.5 h-3.5" />
                <span>카메라 끄기</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5" />
                <span>카메라 켜기</span>
              </>
            )}
          </button>
        </div>

        {/* Right Feature Toggles: Guides, Mirror */}
        <div className="flex items-center gap-1.5">

          {/* Guide Silhouette Overlay Toggle */}
          <button
            id="btn-toggle-guide"
            onClick={() => onUpdateSettings({ showGuideOverlay: !settings.showGuideOverlay })}
            className={`p-2 rounded-xl text-xs font-medium flex items-center gap-1 transition-all ${settings.showGuideOverlay
              ? 'bg-pink-100 text-pink-800 border border-pink-300'
              : 'bg-slate-50 text-slate-500 hover:bg-pink-50'
              }`}
            title="손동작 가이드 영역 표시"
          >
            <Scan className="w-4 h-4 text-pink-600" />
            <span className="hidden sm:inline text-xs">가이드</span>
          </button>

          {/* Mirror Flip Mode */}
          <button
            id="btn-toggle-mirror"
            onClick={() => onUpdateSettings({ mirrorMode: !settings.mirrorMode })}
            className={`p-2 rounded-xl text-xs font-medium flex items-center gap-1 transition-all ${settings.mirrorMode
              ? 'bg-pink-100 text-pink-800 border border-pink-300'
              : 'bg-slate-50 text-slate-500 hover:bg-pink-50'
              }`}
            title="좌우 반전 (미러 모드)"
          >
            <FlipHorizontal className="w-4 h-4 text-pink-600" />
            <span className="hidden sm:inline text-xs">미러</span>
          </button>
        </div>
      </div>
    </div>
  );
};
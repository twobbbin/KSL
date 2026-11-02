import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Volume2,
  Copy,
  Check,
  Trash2,
  Sparkles,
  History,
  MessageSquare,
  Clock
} from 'lucide-react';

export const TranslationPanel = ({
  currentSentence,
  onSentenceChange,
  onResetSentence,
  recentLogs,
  onClearLogs,
  onSelectLog,
  activeGesture,
  settings,
  onRefineWithAI,
  isAiRefining
}) => {
  const [copied, setCopied] = useState(false);
  const [isPlayingTts, setIsPlayingTts] = useState(false);

  // Handle TTS playback
  const handlePlayTTS = () => {
    if (!currentSentence.trim()) return;
    setIsPlayingTts(true);

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentSentence);
      utterance.lang = 'ko-KR';
      utterance.rate = settings?.ttsSpeed || 1.0;
      utterance.onend = () => setIsPlayingTts(false);
      utterance.onerror = () => setIsPlayingTts(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setIsPlayingTts(false), 2000);
    }
  };

  // Handle clipboard copy
  const handleCopy = () => {
    if (!currentSentence) return;
    navigator.clipboard.writeText(currentSentence);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 실시간 번역 문장 휴지통
  // 타임라인 기록은 건드리지 않는다.
  const handleClear = () => {
    if (onResetSentence) {
      onResetSentence();
      return;
    }

    // Fallback: 부모에서 reset handler가 없을 때만
    // 현재 문장 텍스트만 비운다.
    onSentenceChange('');
  };

  // Font size classes
  const getFontSizeClass = () => {
    switch (settings?.fontSize) {
      case 'small':
        return 'text-lg sm:text-xl';
      case 'large':
        return 'text-2xl sm:text-3xl';
      case 'medium':
      default:
        return 'text-xl sm:text-2xl';
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* 1. Main Live Translation Stream Card */}
      <div
        id="translation-main-box"
        className="bg-white/95 backdrop-blur-md rounded-3xl p-5 border-2 border-pink-200/90 shadow-xl shadow-pink-100/60 relative overflow-hidden flex flex-col justify-between min-h-[220px]"
      >
        {/* Soft Background Tint */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-pink-100/60 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-rose-100/50 rounded-full blur-2xl pointer-events-none" />

        {/* Card Header & Status */}
        <div className="flex items-center justify-between gap-2 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center font-bold text-sm">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-pink-950 flex items-center gap-1.5">
                <span>실시간 번역 문장</span>
                {isPlayingTts && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                    음성 출력 중
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-pink-700/70 font-medium">수어 모션을 실시간 한글 문장으로 합성합니다</p>
            </div>
          </div>

          {/* AI Refine Button */}
          <button
            id="btn-ai-refine"
            onClick={onRefineWithAI}
            disabled={isAiRefining || !currentSentence.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-pink-500 to-rose-400 text-white shadow-sm shadow-pink-300/50 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
            title="인식된 수어 단어를 자연스러운 한국어 문장으로 AI 번역"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAiRefining ? 'animate-spin' : ''}`} />
            <span>{isAiRefining ? 'AI 번역 중...' : 'AI 번역'}</span>
          </button>
        </div>

        {/* Main Translated Text Display Area */}
        <div className="my-4 z-10">
          {currentSentence.trim() ? (
            <motion.div
              key={currentSentence}
              initial={{ opacity: 0.7, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              className={`font-extrabold tracking-tight text-slate-800 leading-relaxed ${getFontSizeClass()}`}
            >
              {currentSentence}
              <span className="inline-block w-2 h-6 ml-1.5 bg-pink-500 rounded-sm animate-pulse align-middle" />
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center text-pink-300">
              <div className="w-12 h-12 rounded-full bg-pink-50 border border-pink-100 flex items-center justify-center mb-2">
                <span className="text-xl">👐</span>
              </div>
              <p className="text-sm font-semibold text-pink-400">카메라 앞에서 수어 동작을 취해보세요</p>
              <p className="text-xs text-pink-300/80 mt-0.5">인식된 수어는 실시간으로 텍스트 및 음성으로 변환됩니다</p>
            </div>
          )}
        </div>

        {/* Translation Action Toolbar */}
        <div className="flex items-center justify-between pt-3 border-t border-pink-100 z-10">
          <div className="flex items-center gap-1.5">
            {/* Play TTS Voice Button */}
            <button
              id="btn-play-tts"
              onClick={handlePlayTTS}
              disabled={!currentSentence.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-pink-700 bg-pink-50 hover:bg-pink-100 border border-pink-200 disabled:opacity-40 transition-all cursor-pointer"
            >
              <Volume2 className="w-4 h-4 text-pink-600" />
              <span>음성 듣기</span>
            </button>

            {/* Copy Button */}
            <button
              id="btn-copy-translation"
              onClick={handleCopy}
              disabled={!currentSentence.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-pink-50 border border-slate-200 disabled:opacity-40 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? '복사 완료!' : '복사'}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Clear Button */}
            <button
              id="btn-clear-translation"
              onClick={handleClear}
              disabled={!currentSentence.trim()}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all disabled:opacity-30"
              title="문장 지우기"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Recent Translation History & Timeline List */}
      <div
        id="translation-history-panel"
        className="bg-white/90 backdrop-blur-md rounded-3xl p-5 border border-pink-200/80 shadow-md shadow-pink-100/40 flex-1 flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-pink-600" />
            <h3 className="text-sm font-extrabold text-pink-950">번역 기록 타임라인</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 text-pink-700">
              {recentLogs.length}건
            </span>
          </div>

          {recentLogs.length > 0 && (
            <button
              id="btn-clear-all-logs"
              onClick={onClearLogs}
              className="text-[11px] font-semibold text-pink-600 hover:text-rose-600 transition-colors"
            >
              기록 비우기
            </button>
          )}
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[260px] sm:max-h-[300px]">
          <AnimatePresence initial={false}>
            {recentLogs.length > 0 ? (
              recentLogs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => onSelectLog(log)}
                  className="p-3 rounded-2xl bg-gradient-to-r from-pink-50/50 to-white hover:from-pink-100/60 hover:to-pink-50/80 border border-pink-100/80 transition-all cursor-pointer group flex items-center justify-between gap-3 shadow-sm hover:shadow-md hover:border-pink-300"
                >
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center text-xs shrink-0 mt-0.5">
                      💬
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-bold text-slate-800 truncate group-hover:text-pink-900">
                        {log.text}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono text-pink-600/70 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {log.timestamp}
                        </span>
                        {log.category && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-pink-100/80 text-pink-700 font-medium">
                            {log.category}
                          </span>
                        )}
                        {log.isAiRefined && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-bold flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> AI 교정됨
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[11px] font-mono font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-lg border border-pink-200/60">
                      {Math.round(log.confidence * 100)}%
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if ('speechSynthesis' in window) {
                          const u = new SpeechSynthesisUtterance(log.text);
                          u.lang = 'ko-KR';
                          window.speechSynthesis.speak(u);
                        }
                      }}
                      className="p-1.5 rounded-lg text-pink-500 hover:text-pink-700 hover:bg-pink-100 transition-colors"
                      title="이 문장 음성 듣기"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="py-8 text-center text-pink-300 text-xs font-medium">
                아직 저장된 번역 기록이 없습니다
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { motion } from 'motion/react';
import {
  Settings as SettingsIcon,
  Mic,
  Maximize2
} from 'lucide-react';

export const Header = ({
  mode,
  onModeChange,
  onOpenVoiceToSign,
  onOpenSettings,
  onToggleFullscreen,
  isRecognizing,
  isLocalServerConnected
}) => {
  return (
    <header className="w-full bg-white/80 backdrop-blur-md border-b border-pink-100 sticky top-0 z-30 transition-all duration-300 shadow-sm shadow-pink-100/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

        {/* Brand Logo & Live Engine Status */}
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-400 to-pink-300 flex items-center justify-center text-white shadow-md shadow-pink-300/50 cursor-pointer"
          >
            <span className="text-xl">🤟</span>
          </motion.div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg sm:text-xl tracking-tight text-[#121a2b]">
                KS<span className="text-[#f04b8a]">Lens</span>
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-pink-100/80 text-pink-700 border border-pink-200">
                수어 실시간 번역
              </span>
              {isLocalServerConnected ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-sm flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Python AI 연동 완료
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 border border-slate-200/60 shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                  Python AI 대기 중
                </span>
              )}
            </div>
            <p className="text-[11px] text-pink-800/70 font-medium hidden sm:flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${isRecognizing ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`}></span>
              {isRecognizing ? (isLocalServerConnected ? '로컬 Python AI 수신 중' : '수어 실시간 감지 (30 FPS)') : '대기 상태'}
            </p>
          </div>
        </div>

        {/* Translation Mode Pill Switch */}
        <div className="hidden md:flex items-center bg-pink-50/80 p-1 rounded-xl border border-pink-200/60 shadow-inner">
          <button
            id="btn-mode-ksl-ko"
            onClick={() => onModeChange('KSL_TO_KO')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${mode === 'KSL_TO_KO'
              ? 'bg-gradient-to-r from-pink-500 to-rose-400 text-white shadow-sm shadow-pink-300/50'
              : 'text-pink-700 hover:text-pink-900 hover:bg-pink-100/50'
              }`}
          >
            <span>👐 한국수어 (KSL)</span>
            <span>➔</span>
            <span>🗣️ 한국어 (음성/텍스트)</span>
          </button>
        </div>

        {/* Action Controls & Navigation Icons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Voice to Sign Reverse Translator */}
          <button
            id="btn-open-voice-to-sign"
            onClick={onOpenVoiceToSign}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/70 transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="음성/텍스트로 수어 배우기"
          >
            <Mic className="w-3.5 h-3.5 text-rose-500" />
            <span className="hidden sm:inline">음성 ➔ 수어</span>
          </button>

          {/* Settings Modal Button */}
          <button
            id="btn-open-settings"
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-pink-600 hover:text-pink-800 hover:bg-pink-100/70 border border-transparent hover:border-pink-200 transition-all"
            title="환경 설정"
            aria-label="설정"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          {/* Presentation Fullscreen */}
          <button
            id="btn-fullscreen-view"
            onClick={onToggleFullscreen}
            className="p-2 rounded-xl text-pink-600 hover:text-pink-800 hover:bg-pink-100/70 border border-transparent hover:border-pink-200 transition-all hidden sm:block"
            title="전체화면 프레젠테이션"
            aria-label="전체화면"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
};

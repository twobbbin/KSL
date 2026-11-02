import React from 'react';
import { motion } from 'motion/react';
import { X, Palette, Eye, Volume2, Type, Sliders, Check } from 'lucide-react';

export const SettingsModal = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings
}) => {
  if (!isOpen) return null;

  const pinkPalettes = [
    { id: 'cherry', name: '체리 블라썸 (Cherry Blossom)', color: 'bg-pink-400', desc: '화사하고 부드러운 벚꽃 핑크' },
    { id: 'rose', name: '로즈 골드 (Rose Quartz)', color: 'bg-rose-400', desc: '차분하고 고급스러운 장미빛 톤' },
    { id: 'bubblegum', name: '버블검 팝 (Bubblegum)', color: 'bg-pink-500', desc: '선명하고 활기찬 네온 핑크' },
    { id: 'coral', name: '선셋 코랄 (Sunset Coral)', color: 'bg-rose-300', desc: '따뜻한 감성의 코랄 핑크' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pink-950/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden border-2 border-pink-200 shadow-2xl shadow-pink-300/40 flex flex-col"
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-pink-500 via-rose-400 to-pink-400 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl">
              ⚙️
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">수어 번역기 환경 설정</h2>
              <p className="text-xs text-pink-100 font-medium">핑크 테마, AI 인식 감도 및 음성 출력을 설정합니다</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* 1. Pink Theme Mode */}
          <div>
            <label className="text-xs font-extrabold text-pink-950 flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4 text-pink-500" />
              <span>핑크 무드 & 테마 팔레트</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {pinkPalettes.map((item) => {
                const isSelected = settings.pinkTheme === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onUpdateSettings({ pinkTheme: item.id })}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-pink-50 border-pink-400 ring-2 ring-pink-300'
                        : 'bg-white border-pink-100 hover:border-pink-200 hover:bg-pink-50/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-5 h-5 rounded-full ${item.color} shadow-sm shrink-0`} />
                      <div>
                        <p className="text-xs font-bold text-slate-900">{item.name}</p>
                        <p className="text-[11px] text-pink-600/80 font-medium">{item.desc}</p>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-pink-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Recognition Sensitivity */}
          <div>
            <label className="text-xs font-extrabold text-pink-950 flex items-center gap-2 mb-3">
              <Sliders className="w-4 h-4 text-pink-500" />
              <span>AI 제스처 인식 감도 (Sensitivity)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['low', 'medium', 'high'].map((sens) => {
                const isSelected = settings.sensitivity === sens;
                const labels = { low: '낮음 (안정적)', medium: '보통 (권장)', high: '높음 (민감)' };
                return (
                  <button
                    key={sens}
                    onClick={() => onUpdateSettings({ sensitivity: sens })}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all border text-center cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-pink-500 to-rose-400 text-white border-pink-400 shadow-sm'
                        : 'bg-white text-slate-700 border-pink-100 hover:bg-pink-50'
                    }`}
                  >
                    {labels[sens]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Visual Overlays */}
          <div>
            <label className="text-xs font-extrabold text-pink-950 flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-pink-500" />
              <span>화면 표시 및 가이드 설정</span>
            </label>
            <div className="space-y-2">
              <label className="flex items-center justify-between p-3 rounded-2xl bg-pink-50/50 border border-pink-100 cursor-pointer">
                <span className="text-xs font-bold text-slate-800">손가락 21개 랜드마크 스켈레톤 표시</span>
                <input
                  type="checkbox"
                  checked={settings.showLandmarks}
                  onChange={(e) => onUpdateSettings({ showLandmarks: e.target.checked })}
                  className="w-4 h-4 text-pink-600 rounded focus:ring-pink-400 accent-pink-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-pink-50/50 border border-pink-100 cursor-pointer">
                <span className="text-xs font-bold text-slate-800">손동작 영역 가이드 실루엣 표시</span>
                <input
                  type="checkbox"
                  checked={settings.showGuideOverlay}
                  onChange={(e) => onUpdateSettings({ showGuideOverlay: e.target.checked })}
                  className="w-4 h-4 text-pink-600 rounded focus:ring-pink-400 accent-pink-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-pink-50/50 border border-pink-100 cursor-pointer">
                <span className="text-xs font-bold text-slate-800">카메라 좌우 반전 (미러 모드)</span>
                <input
                  type="checkbox"
                  checked={settings.mirrorMode}
                  onChange={(e) => onUpdateSettings({ mirrorMode: e.target.checked })}
                  className="w-4 h-4 text-pink-600 rounded focus:ring-pink-400 accent-pink-500"
                />
              </label>
            </div>
          </div>

          {/* 4. TTS Voice & Font Size */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-extrabold text-pink-950 flex items-center gap-2 mb-2">
                <Volume2 className="w-4 h-4 text-pink-500" />
                <span>음성 출력 속도 ({settings.ttsSpeed}x)</span>
              </label>
              <input
                type="range"
                min="0.8"
                max="1.4"
                step="0.1"
                value={settings.ttsSpeed}
                onChange={(e) => onUpdateSettings({ ttsSpeed: parseFloat(e.target.value) })}
                className="w-full accent-pink-500"
              />
              <div className="flex justify-between text-[10px] text-pink-600 font-bold mt-1">
                <span>느리게</span>
                <span>보통</span>
                <span>빠르게</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-extrabold text-pink-950 flex items-center gap-2 mb-2">
                <Type className="w-4 h-4 text-pink-500" />
                <span>번역 텍스트 글자 크기</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {['small', 'medium', 'large'].map((size) => (
                  <button
                    key={size}
                    onClick={() => onUpdateSettings({ fontSize: size })}
                    className={`py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      settings.fontSize === size
                        ? 'bg-pink-500 text-white border-pink-400'
                        : 'bg-white text-slate-700 border-pink-100 hover:bg-pink-50'
                    }`}
                  >
                    {size === 'small' ? '보통' : size === 'medium' ? '크게' : '아주 크게'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-pink-50/60 border-t border-pink-100 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-pink-500 hover:bg-pink-600 text-white transition-all shadow-sm"
          >
            설정 완료
          </button>
        </div>
      </motion.div>
    </div>
  );
};

import React from 'react';
import { Activity, Cpu, Sparkles, ShieldCheck, Heart } from 'lucide-react';

export const StatsBar = ({ totalWords, isRecognizing }) => {
  return (
    <footer className="w-full bg-white/70 backdrop-blur-md border-t border-pink-100 py-2.5 px-4 sm:px-6 lg:px-8 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">

        {/* Left Engine Health */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-pink-900 font-semibold">
            <span className={`w-2 h-2 rounded-full ${isRecognizing ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span>KSL Vision AI 엔진 3.4</span>
          </div>

          <span className="text-pink-200 hidden sm:inline">|</span>

          <div className="hidden sm:flex items-center gap-1 text-pink-700/80 font-medium">
            <Cpu className="w-3.5 h-3.5 text-pink-500" />
            <span>추론 지연시간: <strong className="font-mono text-pink-900">22ms</strong></span>
          </div>
        </div>
      </div>
    </footer>
  );
};

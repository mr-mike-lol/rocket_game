/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowUp, ArrowDown, ShieldAlert, Crosshair } from 'lucide-react';

interface VirtualControlsProps {
  onDirectionPress: (direction: 'up' | 'down' | null) => void;
  onShoot: () => void;
  onBoost: () => void;
  boostAvailable: boolean;
  boostCooldowned: boolean;
  cooldownLeft: number;
}

export default function VirtualControls({
  onDirectionPress,
  onShoot,
  onBoost,
  boostAvailable,
  boostCooldowned,
  cooldownLeft,
}: VirtualControlsProps) {
  return (
    <div
      className="absolute bottom-3 left-0 right-0 z-50 flex justify-between px-6 pb-[env(safe-area-inset-bottom,4px)] pointer-events-none select-none transition-all duration-300"
      id="mobile-touch-controller"
    >
      {/* Left side: Navigation Joypad */}
      <div className="flex flex-col gap-2.5 landscape:gap-1.5 pointer-events-auto">
        <button
          onTouchStart={(e) => { e.preventDefault(); onDirectionPress('up'); }}
          onTouchEnd={(e) => { e.preventDefault(); onDirectionPress(null); }}
          onMouseDown={(e) => { e.preventDefault(); onDirectionPress('up'); }}
          onMouseUp={(e) => { e.preventDefault(); onDirectionPress(null); }}
          onMouseLeave={() => onDirectionPress(null)}
          className="w-12 h-12 landscape:w-11 landscape:h-11 rounded-full bg-slate-900/85 border border-slate-705/80 hover:bg-slate-800 active:scale-90 flex items-center justify-center text-cyan-400 shadow-[0_4px_12px_rgba(0,0,0,0.6)] cursor-pointer select-none touch-none border-cyan-500/20 active:border-cyan-400"
          title="Вгору"
        >
          <ArrowUp className="w-5.5 h-5.5" />
        </button>

        <button
          onTouchStart={(e) => { e.preventDefault(); onDirectionPress('down'); }}
          onTouchEnd={(e) => { e.preventDefault(); onDirectionPress(null); }}
          onMouseDown={(e) => { e.preventDefault(); onDirectionPress('down'); }}
          onMouseUp={(e) => { e.preventDefault(); onDirectionPress(null); }}
          onMouseLeave={() => onDirectionPress(null)}
          className="w-12 h-12 landscape:w-11 landscape:h-11 rounded-full bg-slate-900/85 border border-slate-705/80 hover:bg-slate-800 active:scale-90 flex items-center justify-center text-cyan-400 shadow-[0_4px_12px_rgba(0,0,0,0.6)] cursor-pointer select-none touch-none border-cyan-500/20 active:border-cyan-400"
          title="Вниз"
        >
          <ArrowDown className="w-5.5 h-5.5" />
        </button>
      </div>

      {/* Right side: Action Triggers */}
      <div className="flex gap-4 landscape:gap-3 items-end pointer-events-auto">
        {/* Boost Button */}
        <button
          onTouchStart={(e) => { e.preventDefault(); onBoost(); }}
          onClick={(e) => { e.preventDefault(); onBoost(); }}
          disabled={boostCooldowned}
          className={`w-12 h-12 landscape:w-11 landscape:h-11 rounded-full flex flex-col items-center justify-center shadow-lg active:scale-90 select-none cursor-pointer transition touch-none ${
            boostCooldowned
              ? 'bg-slate-950/70 border border-slate-900 text-slate-500 opacity-50'
              : 'bg-rose-950/85 border border-rose-500/60 text-rose-400 font-bold active:border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
          }`}
          title="Прискорення форсажу"
        >
          <ShieldAlert className="w-4.5 h-4.5 text-rose-400" />
          <span className="text-[7px] font-mono mt-0.5 tracking-tight">
            {boostCooldowned ? `${cooldownLeft}с` : 'ФОРСАЖ'}
          </span>
        </button>

        {/* Shoot Button */}
        <button
          onTouchStart={(e) => { e.preventDefault(); onShoot(); }}
          onMouseDown={(e) => { e.preventDefault(); onShoot(); }}
          className="w-16 h-16 landscape:w-13 landscape:h-13 rounded-full bg-cyan-950/90 border-2 border-cyan-400 text-cyan-300 hover:bg-cyan-900/50 flex flex-col items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.4)] active:scale-90 select-none cursor-pointer touch-none"
          title="Вогонь з гармати"
        >
          <Crosshair className="w-6.5 h-6.5 landscape:w-5.5 landscape:h-5.5 text-cyan-300 animate-pulse" />
          <span className="text-[8px] font-mono mt-0.5 font-bold uppercase tracking-wider">Вогонь</span>
        </button>
      </div>
    </div>
  );
}

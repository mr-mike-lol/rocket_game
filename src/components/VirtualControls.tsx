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
      className="absolute bottom-4 left-0 right-0 z-30 flex justify-between px-6 pointer-events-none sm:hidden"
      id="mobile-touch-controller"
    >
      {/* Left side: Navigation Joypad */}
      <div className="flex flex-col gap-3 pointer-events-auto">
        <button
          onTouchStart={(e) => { e.preventDefault(); onDirectionPress('up'); }}
          onTouchEnd={(e) => { e.preventDefault(); onDirectionPress(null); }}
          onMouseDown={() => onDirectionPress('up')}
          onMouseUp={() => onDirectionPress(null)}
          onMouseLeave={() => onDirectionPress(null)}
          className="w-14 h-14 rounded-full bg-slate-900/80 border border-slate-700 hover:bg-slate-800 active:scale-95 flex items-center justify-center text-slate-300 shadow-[0_0_10px_rgba(0,0,0,0.5)] cursor-pointer select-none"
          title="Move Up"
        >
          <ArrowUp className="w-6 h-6" />
        </button>

        <button
          onTouchStart={(e) => { e.preventDefault(); onDirectionPress('down'); }}
          onTouchEnd={(e) => { e.preventDefault(); onDirectionPress(null); }}
          onMouseDown={() => onDirectionPress('down')}
          onMouseUp={() => onDirectionPress(null)}
          onMouseLeave={() => onDirectionPress(null)}
          className="w-14 h-14 rounded-full bg-slate-900/80 border border-slate-700 hover:bg-slate-800 active:scale-95 flex items-center justify-center text-slate-300 shadow-[0_0_10px_rgba(0,0,0,0.5)] cursor-pointer select-none"
          title="Move Down"
        >
          <ArrowDown className="w-6 h-6" />
        </button>
      </div>

      {/* Right side: Action Triggers */}
      <div className="flex gap-4 items-end pointer-events-auto">
        {/* Boost Button */}
        <button
          onTouchStart={(e) => { e.preventDefault(); onBoost(); }}
          onClick={onBoost}
          disabled={boostCooldowned}
          className={`w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-lg active:scale-90 select-none cursor-pointer transition ${
            boostCooldowned
              ? 'bg-slate-950/60 border border-slate-900 text-slate-500 opacity-50'
              : 'bg-rose-950/85 border border-rose-500/60 text-rose-400 font-bold'
          }`}
          title="Прискорення форсажу"
        >
          <ShieldAlert className="w-5 h-5" />
          <span className="text-[8px] font-mono mt-0.5">
            {boostCooldowned ? `${cooldownLeft}с` : 'ФОРСАЖ'}
          </span>
        </button>

        {/* Shoot Button */}
        <button
          onTouchStart={(e) => { e.preventDefault(); onShoot(); }}
          onClick={onShoot}
          className="w-18 h-18 rounded-full bg-cyan-950/85 border-2 border-cyan-400 text-cyan-300 hover:bg-cyan-900/50 flex flex-col items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.3)] active:scale-90 select-none cursor-pointer"
          title="Вогонь з гармати"
        >
          <Crosshair className="w-7 h-7" />
          <span className="text-[9px] font-mono mt-0.5 font-bold uppercase tracking-wider">Вогонь</span>
        </button>
      </div>
    </div>
  );
}

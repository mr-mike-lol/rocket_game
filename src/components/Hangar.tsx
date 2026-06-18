/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ROCKET_SKINS, RocketSkin, PlayerStats } from '../types';
import { motion } from 'motion/react';
import { Lock, Check, Zap, Flame, Shield, Target } from 'lucide-react';
import { isSkinUnlocked } from '../utils/cache';

interface HangarProps {
  stats: PlayerStats;
  selectedSkinId: string;
  onSelectSkin: (id: string) => void;
}

export default function Hangar({ stats, selectedSkinId, onSelectSkin }: HangarProps) {
  return (
    <div className="w-full flex flex-col gap-6" id="hangar-panel">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold font-sans text-cyan-400 flex items-center gap-2">
          <Shield className="w-5 h-5 text-cyan-400" />
          Ангар Кораблів
        </h2>
        <p className="text-sm text-slate-400">
          Налаштуйте свій бойовий винищувач. Вищі рекорди та додаткові вильоти дають змогу розблокувати унікальні судна з потужною обшивкою та експериментальною зброєю.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ROCKET_SKINS.map((skin) => {
          const isUnlocked = isSkinUnlocked(skin.id, stats);
          const isSelected = selectedSkinId === skin.id;

          return (
            <motion.div
              key={skin.id}
              whileHover={{ y: isUnlocked ? -2 : 0 }}
              onClick={() => isUnlocked && onSelectSkin(skin.id)}
              className={`relative overflow-hidden p-4 rounded-xl border flex flex-col justify-between transition-all duration-300 ${
                isSelected
                  ? 'bg-cyan-950/40 border-cyan-400/80 shadow-[0_0_15px_rgba(34,211,238,0.15)]'
                  : isUnlocked
                  ? 'bg-slate-900/60 border-slate-700/60 hover:bg-slate-800/80 hover:border-slate-600 cursor-pointer'
                  : 'bg-slate-950/80 border-slate-900 opacity-60'
              }`}
              id={`skin-card-${skin.id}`}
            >
              {/* Outer status glows */}
              {isSelected && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 blur-xl pointer-events-none rounded-full" />
              )}

              {/* Head / Info */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex flex-col">
                  <span className="text-md font-bold font-sans tracking-wide text-slate-100 flex items-center gap-2">
                    {skin.name}
                    {isSelected && (
                      <span className="inline-flex items-center justify-center p-1 rounded-full bg-cyan-400 text-slate-950">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-slate-400 font-sans mt-0.5 leading-relaxed">
                    {skin.description}
                  </span>
                </div>

                <div className="flex flex-col items-end">
                  {!isUnlocked ? (
                    <div className="flex items-center gap-1 text-xs text-amber-500 font-mono font-bold px-2 py-1 rounded bg-amber-950/40 border border-amber-500/30 whitespace-nowrap">
                      <Lock className="w-3.5 h-3.5 text-amber-500" />
                      {skin.unlockScore} бал.
                    </div>
                  ) : (
                    <span className="text-[10px] font-mono tracking-wider text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20 font-semibold uppercase whitespace-nowrap">
                      Готовий
                    </span>
                  )}
                </div>
              </div>

              {/* Graphical Mini Preview of Rocket */}
              <div className="my-3 py-3 px-6 h-16 bg-slate-950/50 rounded-lg flex items-center justify-center border border-slate-800/60">
                <div className="relative flex items-center gap-3">
                  {/* Rocket body rendering */}
                  <div className="flex items-center">
                    {/* Flame */}
                    <div
                      className="w-8 h-4 rounded-full filter blur-[1px] animate-pulse"
                      style={{
                        background: `linear-gradient(to right, transparent, ${skin.flameColor})`,
                        boxShadow: `0 0 10px ${skin.flameColor}`,
                      }}
                    />
                    {/* Fuselage */}
                    <div
                      className="w-12 h-6 rounded-r-full flex items-center justify-end px-2"
                      style={{ backgroundColor: skin.bodyColor }}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-950/60 border border-slate-200/20" />
                    </div>
                    {/* Nose cone */}
                    <div
                      className="w-0 h-0 border-y-[12px] border-y-transparent border-l-[18px]"
                      style={{ borderLeftColor: skin.bodyColor }}
                    />
                  </div>

                  {/* Satellite Mini Rockets indicators */}
                  <div className="flex flex-col gap-3">
                    <div
                      className="w-4 h-2 rounded-r-sm"
                      style={{ backgroundColor: skin.miniRocketColor }}
                    />
                    <div
                      className="w-4 h-2 rounded-r-sm"
                      style={{ backgroundColor: skin.miniRocketColor }}
                    />
                  </div>
                </div>
              </div>

              {/* Tech Specs */}
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 mt-2">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-cyan-400/80" />
                  <span>Гармата:</span>
                  <span
                    className="font-bold font-sans"
                    style={{ color: skin.projectileColor }}
                  >
                    {skin.id === 'classic'
                      ? 'Одиночне Ядро'
                      : skin.id === 'plasma'
                      ? 'Іонізаційний Промінь'
                      : skin.id === 'phoenix'
                      ? 'Надгаряче Термоядро'
                      : skin.id === 'cyber'
                      ? 'Важкий Заряд'
                      : skin.id === 'void'
                      ? 'Спалах Безодні'
                      : 'Астральний Лазер'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-orange-400/80" />
                  <span>Ядро Форсажу:</span>
                  <span className="font-bold text-slate-200">
                    {skin.id === 'classic'
                      ? 'x1.5 Стандарт'
                      : skin.id === 'plasma'
                      ? 'x1.6 Синтез'
                      : skin.id === 'phoenix'
                      ? 'x1.8 Запалення'
                      : skin.id === 'cyber'
                      ? 'x1.7 Кінетик'
                      : skin.id === 'void'
                      ? 'x2.0 Гіперпорожнеча'
                      : 'x2.5 Тахіонний'}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

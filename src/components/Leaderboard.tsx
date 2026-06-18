/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LeaderboardEntry, PlayerStats, ROCKET_SKINS } from '../types';
import { Trophy, Calendar, Medal, Skull, Target, Zap, RotateCcw, User, Eye } from 'lucide-react';

interface LeaderboardProps {
  stats: PlayerStats;
  leaderboard: LeaderboardEntry[];
  onClearCache: () => void;
  onUpdatePlayerName: (name: string) => void;
  currentPlayerName: string;
}

export default function Leaderboard({
  stats,
  leaderboard,
  onClearCache,
  onUpdatePlayerName,
  currentPlayerName,
}: LeaderboardProps) {
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(currentPlayerName);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      onUpdatePlayerName(tempName.trim());
      setEditingName(false);
    }
  };

  const formattedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}хв ${secs}с`;
  };

  return (
    <div className="w-full flex flex-col gap-6" id="stats-leaderboard-panel">
      {/* Pilot Credentials */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-cyan-950/50 border border-cyan-500/30 text-cyan-400">
            <User className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">Активний Пілот</p>
            {editingName ? (
              <form onSubmit={handleSaveName} className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  maxLength={12}
                  className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100 focus:outline-none focus:border-cyan-400 font-sans"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  autoFocus
                />
                <button
                  type="submit"
                  className="bg-cyan-400 hover:bg-cyan-500 text-slate-950 font-bold px-3 py-1 rounded text-xs transition px-2.5 py-1 text-[11px] uppercase cursor-pointer"
                >
                  Зберегти
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-md font-sans font-bold text-slate-100">{currentPlayerName}</span>
                <button
                  onClick={() => setEditingName(true)}
                  className="text-xs text-cyan-400 hover:underline hover:text-cyan-300 font-mono cursor-pointer"
                >
                  [Змінити ім'я]
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col text-right">
            <span className="text-xs font-mono font-bold text-slate-400">Особистий Рекорд</span>
            <span className="text-lg font-mono font-bold text-cyan-400">{stats.highScore} бал.</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Statistics Grid */}
        <div className="lg:col-span-1 bg-slate-900/40 p-5 rounded-xl border border-slate-800/80 flex flex-col gap-4">
          <h3 className="text-sm font-bold font-mono text-slate-300 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
            <Target className="w-4 h-4 text-cyan-400" />
            Бортовий Журнал
          </h3>

          <div className="grid grid-cols-1 gap-3 font-mono text-xs text-slate-300">
            <div className="flex justify-between py-1.5 border-b border-slate-800/50">
              <span className="text-slate-400">Час у польоті</span>
              <span className="font-bold text-slate-100">{formattedTime(stats.secondsPlayed)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/50">
              <span className="text-slate-400">Вильоти (Ігри)</span>
              <span className="font-bold text-slate-100">{stats.totalPlays}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/50">
              <span className="text-slate-400">Знищено Босів</span>
              <span className="font-bold text-rose-400 flex items-center gap-1">
                <Skull className="w-3.5 h-3.5 text-rose-500" />
                {stats.bossesDefeated}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/50">
              <span className="text-slate-400">Зібрано Зірок</span>
              <span className="font-bold text-amber-400">{stats.powerUpsCollected}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/50">
              <span className="text-slate-400">Випущено Снарядів</span>
              <span className="font-bold text-cyan-300">{stats.projectilesFired}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Загальний Рахунок</span>
              <span className="font-bold text-emerald-400">{stats.totalScore}</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between">
            <button
              onClick={() => {
                if (confirm('Очистити всю статистику, куплені кораблі та рекорди? Цю дію неможливо скасувати.')) {
                  onClearCache();
                }
              }}
              className="text-[10px] font-mono text-red-400/80 hover:text-red-300 flex items-center gap-1 transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Очистити весь Кеш
            </button>
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="lg:col-span-2 bg-slate-900/40 p-5 rounded-xl border border-slate-800/80 flex flex-col gap-4">
          <h3 className="text-sm font-bold font-mono text-slate-300 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
            <Trophy className="w-4 h-4 text-cyan-400" />
            Рейтинг Найкращих Пілотів
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                  <th className="py-2.5 px-3 w-12 text-center">Ранг</th>
                  <th className="py-2.5 px-3">Пілот</th>
                  <th className="py-2.5 px-3">Клас Винищувача</th>
                  <th className="py-2.5 px-3 text-right">Рахунок</th>
                  <th className="py-2.5 px-3 text-right hidden sm:table-cell">Дата</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 text-xs font-mono">
                      Записів не виявлено. Здійсніть перший виліт, щоб увійти в історію!
                    </td>
                  </tr>
                ) : (
                  leaderboard.map((entry, index) => {
                    const skin = ROCKET_SKINS.find((s) => s.id === entry.skinId);
                    const isSelf = entry.playerName === currentPlayerName;

                    return (
                      <tr
                        key={entry.id}
                        className={`border-b text-xs border-slate-850/60 transition-colors ${
                          isSelf ? 'bg-cyan-950/20 text-cyan-150' : 'text-slate-300 hover:bg-slate-900/20'
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          {index === 0 ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400/95 text-slate-950 font-bold text-[10px]">
                              1
                            </span>
                          ) : index === 1 ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-300 text-slate-950 font-bold text-[10px]">
                              2
                            </span>
                          ) : index === 2 ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-700/80 text-amber-50 font-bold text-[10px]">
                              3
                            </span>
                          ) : (
                            <span className="font-mono text-slate-400">{index + 1}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-semibold">
                          <span className={`${isSelf ? 'text-cyan-400' : 'text-slate-200'}`}>
                            {entry.playerName}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                          {skin ? skin.name : 'Невідомо'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-100">
                          {entry.score}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[10px] text-slate-500 hidden sm:table-cell">
                          <span className="inline-flex items-center gap-1 justify-end">
                            <Calendar className="w-3 h-3 opacity-60" />
                            {entry.date}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

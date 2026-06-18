/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PlayerStats, ROCKET_SKINS, RocketSkin } from '../types';
import { Shield, Flame, Zap, Award, Check, ShoppingBag, Coins, ArrowUp, Lock } from 'lucide-react';
import { isSkinUnlocked } from '../utils/cache';

interface StorePageProps {
  stats: PlayerStats;
  onUpdateStats: (updates: Partial<PlayerStats>) => void;
  onAddNotification: (msg: string, type: 'achievement' | 'boss' | 'powerup' | 'season' | 'boost' | 'info') => void;
}

export default function StorePage({ stats, onUpdateStats, onAddNotification }: StorePageProps) {
  // Define component upgrade details
  const COMPONENT_UPGRADES = [
    {
      id: 'shield',
      name: 'Ядро дефлекторного щита',
      description: 'Генерує кінетичне силове поле. Дозволяє винищувачу уникнути руйнування при зіткненнях.',
      icon: <Shield className="w-5 h-5 text-emerald-400" />,
      maxLevel: 3,
      currentLevel: stats.shieldCoreLevel || 0,
      costs: [300, 750, 1600], // cumulative Level 1, 2, 3
      benefits: [
        'Поглинає 1 удар за політ',
        'Поглинає до 2 ударів за політ',
        'Поглинає до 3 ударів з авто-відбиттям зіткнення',
      ],
    },
    {
      id: 'thrust',
      name: 'Іонно-термоядерний двигун',
      description: 'Модернізує камери згоряння винищувача, подовжуючи час форсажу та прискорюючи його перезапуск.',
      icon: <Flame className="w-5 h-5 text-cyan-400" />,
      maxLevel: 3,
      currentLevel: stats.thrustCoreLevel || 0,
      costs: [250, 600, 1300],
      benefits: [
        'Дія форсажу: 7с, відновлення: 9с',
        'Дія форсажу: 9с, відновлення: 7с',
        'Дія форсажу: 11с, відновлення: 5с',
      ],
    },
    {
      id: 'energy',
      name: 'Плазмовий прискорювач снарядів',
      description: 'Розіганяє тактичні енергетичні масиви корабельних гармат. Снаряди летять швидше та б\'ють потужніше.',
      icon: <Zap className="w-5 h-5 text-amber-400" />,
      maxLevel: 3,
      currentLevel: stats.energyCoreLevel || 0,
      costs: [350, 800, 1800],
      benefits: [
        '+15% швидкість польоту та шкода снаряда',
        '+30% швидкість та розширений плазмовий імпульс',
        'Подвійний потік розбіжних тактичних плазмоїдів!',
      ],
    },
    {
      id: 'radar',
      name: 'Радар стратегічної телеметрії',
      description: 'Збільшує чутливість космічних датчиків, примножуючи отримані бали за знищення кремлівських руїн.',
      icon: <Award className="w-5 h-5 text-indigo-400" />,
      maxLevel: 3,
      currentLevel: stats.radarAntennaLevel || 0,
      costs: [200, 500, 1100],
      benefits: [
        '+15% балів за кожну зруйновану вежу',
        '+30% балів за кожну зруйновану вежу',
        'Подвійний вихід балів (+50% додаткової премії!)',
      ],
    },
  ];

  // Price schema for ships if they lack achievement highscore requirements
  const SHIP_CREDIT_PRICES: Record<string, number> = {
    classic: 0,
    plasma: 200,
    phoenix: 500,
    cyber: 1200,
    void: 2500,
    orion: 5000,
  };

  const handleBuyComponent = (componentId: string, level: number, cost: number) => {
    if (stats.credits < cost) {
      onAddNotification('Недостатньо кредитів для підтвердження покращення', 'info');
      return;
    }

    const updates: Partial<PlayerStats> = {
      credits: stats.credits - cost,
    };

    if (componentId === 'shield') updates.shieldCoreLevel = level;
    if (componentId === 'thrust') updates.thrustCoreLevel = level;
    if (componentId === 'energy') updates.energyCoreLevel = level;
    if (componentId === 'radar') updates.radarAntennaLevel = level;

    onUpdateStats(updates);
    onAddNotification(`Покращено ${componentId.toUpperCase()} до рівня ${level}!`, 'achievement');
  };

  const handleBuyShip = (skin: RocketSkin, price: number) => {
    if (stats.credits < price) {
      onAddNotification('Недостатньо кредитів для купівлі даної моделі винищувача', 'info');
      return;
    }

    const currentUnlocked = stats.unlockedSkinIds || ['classic'];
    if (currentUnlocked.includes(skin.id)) return;

    onUpdateStats({
      credits: stats.credits - price,
      unlockedSkinIds: [...currentUnlocked, skin.id],
    });
    onAddNotification(`Судно нового класу "${skin.name}" успішно придбано!`, 'achievement');
  };

  return (
    <div className="w-full flex flex-col gap-6" id="cosmic-store-component">
      {/* Wallet Balance Board */}
      <div className="bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-400 p-3 flex items-center justify-center border border-amber-500/20">
            <Coins className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Баланс рахунку</span>
            <span className="text-2xl font-black font-mono text-amber-400 flex items-center gap-2">
              {stats.credits || 0}
              <span className="text-xs font-semibold text-slate-400">КРЕДИТІВ</span>
            </span>
          </div>
        </div>

        <div className="text-right flex flex-col justify-center">
          <span className="text-[10px] font-mono text-slate-400 uppercase block">Всього в кар'єрі</span>
          <span className="text-sm font-bold font-mono text-slate-200 mt-1">
            {stats.totalScore || 0} балів
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Panel A: Spacecraft Ship Yard */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-black font-mono text-cyan-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <ShoppingBag className="w-4 h-4" />
            Зоряна верф винищувачів
          </h3>

          <div className="flex flex-col gap-3">
            {ROCKET_SKINS.map((skin) => {
              const isUnlockedAlready = isSkinUnlocked(skin.id, stats);
              const isEquipped = stats.selectedSkinId === skin.id;
              const price = SHIP_CREDIT_PRICES[skin.id] || 0;

              return (
                <div
                  key={skin.id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
                    isEquipped
                      ? 'bg-cyan-950/20 border-cyan-400/80'
                      : isUnlockedAlready
                      ? 'bg-slate-900/50 border-slate-805 hover:bg-slate-900/80'
                      : 'bg-slate-950/80 border-slate-950/50'
                  }`}
                  id={`store-ship-${skin.id}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Visual colored icon */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center p-1 border border-slate-800"
                      style={{ backgroundColor: `${skin.bodyColor}15` }}
                    >
                      <div className="relative flex items-center">
                        <div
                          className="w-3 h-1.5 rounded-l-full"
                          style={{ backgroundColor: skin.flameColor }}
                        />
                        <div
                          className="w-5.5 h-3 rounded-r-lg"
                          style={{ backgroundColor: skin.bodyColor }}
                        />
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        {skin.name}
                        {isEquipped && (
                          <span className="inline-flex items-center justify-center h-4 px-1.5 rounded bg-cyan-400 text-slate-950 font-mono text-[9px] font-bold">
                            Екіпіровано
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-sans mt-0.5 leading-relaxed">
                        {skin.description}
                      </p>
                    </div>
                  </div>

                  {/* Actions purchase/equip */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {isUnlockedAlready ? (
                      isEquipped ? (
                        <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase px-2.5 py-1 bg-cyan-950/50 border border-cyan-500/20 rounded-lg">
                          Змонтовано
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            onUpdateStats({ selectedSkinId: skin.id });
                            onAddNotification(`Активовано корабель "${skin.name}"!`, 'info');
                          }}
                          className="text-[10px] font-mono font-bold text-slate-200 hover:text-cyan-400 hover:bg-slate-800 transition px-3 py-1 bg-slate-900 border border-slate-700 rounded-lg cursor-pointer"
                        >
                          Активувати
                        </button>
                      )
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-0.5" title="Потрібен рекорд">
                          <Lock className="w-3 h-3" /> {skin.unlockScore} балів
                        </span>
                        <button
                          onClick={() => handleBuyShip(skin, price)}
                          disabled={stats.credits < price}
                          className={`text-[10px] font-mono font-bold text-slate-950 px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                            stats.credits >= price
                              ? 'bg-amber-400 hover:bg-amber-300'
                              : 'bg-slate-800 text-slate-500 opacity-50 cursor-not-allowed'
                          }`}
                        >
                          Купити за {price} кр.
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel B: Tech System Components */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-black font-mono text-emerald-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <Zap className="w-4 h-4" />
            Лабораторія покращення модулів
          </h3>

          <div className="flex flex-col gap-4">
            {COMPONENT_UPGRADES.map((upgrade) => {
              const currentLevel = upgrade.currentLevel;
              const hasNextLevel = currentLevel < upgrade.maxLevel;
              const nextLevelCost = hasNextLevel ? upgrade.costs[currentLevel] : 0;
              const isAffordable = stats.credits >= nextLevelCost;

              return (
                <div
                  key={upgrade.id}
                  className="bg-slate-900/30 p-4 rounded-xl border border-slate-800/80 flex flex-col gap-3"
                  id={`store-upgrade-${upgrade.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-2.5">
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        {upgrade.icon}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">{upgrade.name}</h4>
                        <p className="text-[10.5px] text-slate-400 mt-0.5 leading-relaxed font-sans font-normal">
                          {upgrade.description}
                        </p>
                      </div>
                    </div>

                    {/* Level Indicators */}
                    <div className="flex items-center gap-1.5 text-right flex-col">
                      <span className="text-[10px] font-mono font-bold text-slate-400 tracking-wider font-sans">РІВЕНЬ</span>
                      <div className="flex gap-1">
                        {[1, 2, 3].map((l) => (
                          <div
                            key={l}
                            className={`w-4 h-1.5 rounded-sm ${
                              l <= currentLevel
                                ? 'bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,0.5)]'
                                : 'bg-slate-800'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bullet Benefits and Buy Trigger */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-800/40">
                    <div className="font-mono text-[10px] text-slate-400">
                      {hasNextLevel ? (
                        <div className="flex items-center gap-1 text-slate-300">
                          <ArrowUp className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
                          <span>Далі: {upgrade.benefits[currentLevel]}</span>
                        </div>
                      ) : (
                        <span className="text-emerald-400 font-bold tracking-wider">МАКСИМАЛЬНИЙ РІВЕНЬ ВСТАНОВЛЕНО</span>
                      )}
                    </div>

                    {hasNextLevel ? (
                      <button
                        onClick={() => handleBuyComponent(upgrade.id, currentLevel + 1, nextLevelCost)}
                        disabled={!isAffordable}
                        className={`font-mono text-[10px] font-bold py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer ${
                          isAffordable
                            ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold shadow-md'
                            : 'bg-slate-800 text-slate-500 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        Купити Рівень {currentLevel + 1} ({nextLevelCost} кр.)
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-extrabold text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded border border-emerald-500/25">
                        <Check className="w-3.5 h-3.5 stroke-[3]" /> Модуль оптимізовано
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

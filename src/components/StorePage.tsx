/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PlayerStats, ROCKET_SKINS, RocketSkin, CosmicWeapon, COSMIC_WEAPONS } from '../types';
import { Shield, Flame, Zap, Award, Check, ShoppingBag, Coins, ArrowUp, Lock, Target, Sparkles, Heart, Rocket } from 'lucide-react';
import { isSkinUnlocked, isWeaponUnlocked, getDonationDetails } from '../utils/cache';

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

  const handleBuyWeapon = (weapon: CosmicWeapon) => {
    if (stats.credits < weapon.price) {
      onAddNotification('Недостатньо кредитів для купівлі цього модуля озброєння', 'info');
      return;
    }

    const currentUnlocked = stats.unlockedWeaponIds || ['laser_alpha'];
    if (currentUnlocked.includes(weapon.id)) return;

    onUpdateStats({
      credits: stats.credits - weapon.price,
      unlockedWeaponIds: [...currentUnlocked, weapon.id],
    });
    onAddNotification(`Модуль зброї нового класу "${weapon.name}" успішно придбано! Його можна встановити в Ангарі.`, 'achievement');
  };

  const handleDonate = (amount: number) => {
    if (stats.credits < amount) {
      onAddNotification('Недостатньо кредитів у бюджеті для цього внеску', 'info');
      return;
    }
    const currentDonated = stats.donationsCredits || 0;
    const nextDonated = currentDonated + amount;
    
    onUpdateStats({
      credits: stats.credits - amount,
      donationsCredits: nextDonated
    });

    const prevDetails = getDonationDetails(currentDonated);
    const nextDetails = getDonationDetails(nextDonated);
    
    if (nextDetails && (!prevDetails || prevDetails.title !== nextDetails.title)) {
      onAddNotification(`🎉 НОВИЙ РАНГ ОТРИМАНО: ${nextDetails.title}! Вашу бойову ауру покращено.`, 'achievement');
    } else {
      onAddNotification(`Дякуємо за внесок у ${amount} кр. на Космічні Дрони! Разом до перемоги! 🇺🇦`, 'achievement');
    }
  };

  const handleBuyConsumable = (type: 'shield' | 'bonus' | 'overdrive', price: number) => {
    if (stats.credits < price) {
      onAddNotification('Недостатньо кредитів для придбання тактичного завантаження', 'info');
      return;
    }

    const updates: Partial<PlayerStats> = {
      credits: stats.credits - price
    };

    if (type === 'shield') {
      if (stats.starterShieldActive) return;
      updates.starterShieldActive = true;
      onAddNotification('Тактичний модуль "+1 Shield" встановлено на наступний виліт!', 'achievement');
    } else if (type === 'bonus') {
      if (stats.creditBonusActive) return;
      updates.creditBonusActive = true;
      onAddNotification('Кредитний дешифратор "+50% Credits" інтегровано на наступний виліт!', 'achievement');
    } else if (type === 'overdrive') {
      if (stats.overdriveActive) return;
      updates.overdriveActive = true;
      onAddNotification('Гіпер-прискорювач реактальних тактик "Overdrive" активовано на наступний виліт!', 'achievement');
    }

    onUpdateStats(updates);
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
        {/* Panel A: Armory & Weapons Yard */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-black font-mono text-emerald-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <Target className="w-4 h-4" />
            Магазин зброї та гармат
          </h3>

          <div className="flex flex-col gap-3">
            {COSMIC_WEAPONS.map((weapon) => {
              const isUnlockedAlready = isWeaponUnlocked(weapon.id, stats);
              const isEquipped = stats.selectedWeaponId === weapon.id;

              return (
                <div
                  key={weapon.id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
                    isEquipped
                      ? 'bg-emerald-950/20 border-emerald-500/80'
                      : isUnlockedAlready
                      ? 'bg-slate-900/50 border-slate-705 hover:bg-slate-900/80'
                      : 'bg-slate-950/80 border-slate-950/50'
                  }`}
                  id={`store-weapon-${weapon.id}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Color glow preview */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center p-1 border border-slate-800"
                      style={{ backgroundColor: `${weapon.projectileColor}15` }}
                    >
                      <div className="w-6 h-1.5 rounded-full" style={{ backgroundColor: weapon.projectileColor, boxShadow: `0 0 6px ${weapon.projectileColor}` }} />
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        {weapon.name}
                        {isEquipped && (
                          <span className="inline-flex items-center justify-center h-4 px-1.5 rounded bg-emerald-500 text-slate-950 font-mono text-[9px] font-bold">
                            Встановлено
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-sans mt-0.5 leading-relaxed">
                        {weapon.description}
                      </p>
                    </div>
                  </div>

                  {/* Actions purchase */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {isUnlockedAlready ? (
                      <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase px-2.5 py-1 bg-emerald-950/30 border border-emerald-500/20 rounded-lg">
                        Придбано
                      </span>
                    ) : (
                      <button
                        onClick={() => handleBuyWeapon(weapon)}
                        disabled={stats.credits < weapon.price}
                        className={`text-[10px] font-mono font-bold text-slate-950 px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                          stats.credits >= weapon.price
                            ? 'bg-amber-400 hover:bg-amber-300 shadow-md'
                            : 'bg-slate-800 text-slate-500 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        Придбати за {weapon.price} кр.
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-slate-950/40 border border-slate-900/90 rounded-xl p-3 sm:p-4 text-xs text-slate-400 leading-relaxed font-sans">
            🚀 <strong className="text-cyan-400">Примітки щодо Кораблів:</strong> Відтепер кораблі винищувачі не можна купувати за кредити! Вони автоматично розблоковуються в <strong className="text-slate-100">Ангарі</strong> досягненням відповідного рекорду (балів) за <strong className="text-amber-400">один окремий політ</strong>.
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

      {/* Special Endgame section for repeatable sinks */}
      <div className="border-t border-slate-800/80 pt-6 mt-4 flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-md font-black font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4.5 h-4.5 text-cyan-400" />
            Спеціальне тактичне забезпечення та донати
          </h2>
          <p className="text-xs text-slate-400 font-sans">
            Розділ для елітних пілотів: витрачайте накопичені кредити на разові бойові модулі або підтримайте фонд ЗСУ (Зоряних Сил України) для отримання унікальних аурових ефектів!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Column 1: Consumables */}
          <div className="flex flex-col gap-4 bg-slate-900/10 p-5 rounded-2xl border border-slate-900/80">
            <h3 className="text-xs font-black font-mono text-amber-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-800/60 pb-2">
              <Rocket className="w-4 h-4 text-amber-400" />
              Одноразові підсилювачі на наступний виліт
            </h3>

            <div className="flex flex-col gap-3">
              {/* Shield Booster */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-850/70 flex items-center justify-between gap-4">
                <div className="flex gap-2.5 flex-1 p-0.5 animate-fade-in">
                  <div className="p-2 h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/15">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 block">Тактичний Стартовий Щит (+1)</h4>
                    <p className="text-[10px] text-slate-400 font-sans mt-0.5 leading-relaxed">Встановлює додатковий заряд щитового ядра на наступний політ.</p>
                  </div>
                </div>
                <div>
                  {stats.starterShieldActive ? (
                    <span className="text-[9px] font-mono font-black text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg whitespace-nowrap">
                      АКТИВОВАНО
                    </span>
                  ) : (
                    <button
                      onClick={() => handleBuyConsumable('shield', 200)}
                      disabled={stats.credits < 200}
                      className={`text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
                        stats.credits >= 200
                          ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                          : 'bg-slate-800/85 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      Купити: 200 кр.
                    </button>
                  )}
                </div>
              </div>

              {/* Credit Booster */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-850/70 flex items-center justify-between gap-4">
                <div className="flex gap-2.5 flex-1 p-0.5">
                  <div className="p-2 h-9 w-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/15">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 block">Аналізатор Сигналів (+50% кр.)</h4>
                    <p className="text-[10px] text-slate-400 font-sans mt-0.5 leading-relaxed">Множить усі кредити, здобуті в наступному польоті на х1.5.</p>
                  </div>
                </div>
                <div>
                  {stats.creditBonusActive ? (
                    <span className="text-[9px] font-mono font-black text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg whitespace-nowrap">
                      АКТИВОВАНО
                    </span>
                  ) : (
                    <button
                      onClick={() => handleBuyConsumable('bonus', 350)}
                      disabled={stats.credits < 350}
                      className={`text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
                        stats.credits >= 350
                          ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                          : 'bg-slate-800/85 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      Купити: 350 кр.
                    </button>
                  )}
                </div>
              </div>

              {/* Overdrive Booster */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-850/70 flex items-center justify-between gap-4">
                <div className="flex gap-2.5 flex-1 p-0.5">
                  <div className="p-2 h-9 w-9 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/15">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 block">Реакторний Овердрайв</h4>
                    <p className="text-[10px] text-slate-400 font-sans mt-0.5 leading-relaxed">Тимчасово модернізує плазмові снаряди та додає +1 рівень усім гарматам.</p>
                  </div>
                </div>
                <div>
                  {stats.overdriveActive ? (
                    <span className="text-[9px] font-mono font-black text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg whitespace-nowrap">
                      АКТИВОВАНО
                    </span>
                  ) : (
                    <button
                      onClick={() => handleBuyConsumable('overdrive', 500)}
                      disabled={stats.credits < 500}
                      className={`text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
                        stats.credits >= 500
                          ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                          : 'bg-slate-800/85 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      Купити: 500 кр.
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Charity / Donations */}
          <div className="flex flex-col gap-4 bg-slate-900/10 p-5 rounded-2xl border border-slate-900/80">
            <h3 className="text-xs font-black font-mono text-emerald-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-800/60 pb-2">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500 animate-pulse" />
              Космічний фонд допомоги ЗФКО (Бойові Дрони)
            </h3>

            {/* Current Rank Panel */}
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
              <div>
                <span className="text-[10px] font-mono text-slate-400 block uppercase">Загальний обсяг донатів</span>
                <span className="text-sm font-bold font-mono text-emerald-400">{stats.donationsCredits || 0} кр.</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-slate-400 block uppercase">Поточне звання</span>
                <span className={`text-xs font-bold ${getDonationDetails(stats.donationsCredits || 0)?.color || 'text-slate-400'}`}>
                  {getDonationDetails(stats.donationsCredits || 0)?.title || 'Новобранець-Донатер'}
                </span>
              </div>
            </div>

            {/* Aura Progress Map */}
            <div className="flex flex-col gap-1 text-[10px] font-sans text-slate-400">
              <span className="font-mono text-slate-300 font-bold uppercase tracking-wider block mb-1">Рівні бойових аур за внески:</span>
              <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                <div className="p-2 rounded bg-slate-950/40 border border-slate-850 flex items-center justify-between">
                  <span>🟣 500 кр. — Спонсор Кремлепаду</span>
                  <span className={stats.donationsCredits && stats.donationsCredits >= 500 ? 'text-emerald-400 font-bold' : 'text-slate-600'}>
                    {stats.donationsCredits && stats.donationsCredits >= 500 ? 'активно' : 'закрито'}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950/40 border border-slate-850 flex items-center justify-between">
                  <span>🔵 2000 кр. — Зоряний Волонтер</span>
                  <span className={stats.donationsCredits && stats.donationsCredits >= 2000 ? 'text-cyan-400 font-bold' : 'text-slate-600'}>
                    {stats.donationsCredits && stats.donationsCredits >= 2000 ? 'активно' : 'закрито'}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950/40 border border-slate-850 flex items-center justify-between">
                  <span>🟡 10к кр. — General Drones</span>
                  <span className={stats.donationsCredits && stats.donationsCredits >= 10000 ? 'text-yellow-400 font-bold' : 'text-slate-600'}>
                    {stats.donationsCredits && stats.donationsCredits >= 10000 ? 'активно' : 'закрито'}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950/40 border border-slate-850 flex items-center justify-between">
                  <span>🌈 50к кр. — Герой Сектора</span>
                  <span className={stats.donationsCredits && stats.donationsCredits >= 50000 ? 'text-pink-400 font-bold animate-pulse' : 'text-slate-600'}>
                    {stats.donationsCredits && stats.donationsCredits >= 50000 ? 'активно' : 'закрито'}
                  </span>
                </div>
              </div>
            </div>

            {/* Interaction Buttons */}
            <div className="flex flex-col gap-2 mt-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">Обрати суму підтримки:</span>
              <div className="grid grid-cols-4 gap-2">
                {[100, 500, 2000, 10000].map((amt) => {
                  const canDonate = stats.credits >= amt;
                  return (
                    <button
                      key={amt}
                      onClick={() => handleDonate(amt)}
                      disabled={!canDonate}
                      className={`py-2 text-[10.5px] font-mono font-bold rounded-lg transition flex flex-col items-center justify-center cursor-pointer ${
                        canDonate
                          ? 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950'
                          : 'bg-slate-950 border border-slate-900 text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      <span>+{amt}</span>
                      <span className="text-[8px] font-sans opacity-70">кр.</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

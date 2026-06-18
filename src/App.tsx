/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import CosmicField from './components/CosmicField';
import Hangar from './components/Hangar';
import Leaderboard from './components/Leaderboard';
import StorePage from './components/StorePage';
import NotificationToast from './components/NotificationToast';
import VirtualControls from './components/VirtualControls';
import { GameNotification, PlayerStats, LeaderboardEntry } from './types';
import {
  loadPlayerStats,
  updateStats,
  loadLeaderboard,
  addLeaderboardEntry,
} from './utils/cache';
import { Rocket, Cpu, Wifi, Circle, Gamepad2, ShoppingBag, Trophy, Wrench } from 'lucide-react';

export default function App() {
  // Navigation tabs state
  const [activeTab, setActiveTab] = useState<'flight' | 'store' | 'hangar' | 'ranks'>('flight');

  // Pilot and Cache states
  const [stats, setStats] = useState<PlayerStats>({
    highScore: 0,
    totalScore: 0,
    totalPlays: 0,
    bossesDefeated: 0,
    secondsPlayed: 0,
    powerUpsCollected: 0,
    projectilesFired: 0,
    selectedSkinId: 'classic',
    credits: 0,
    shieldCoreLevel: 0,
    thrustCoreLevel: 0,
    energyCoreLevel: 0,
    radarAntennaLevel: 0,
    unlockedSkinIds: ['classic'],
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerName, setPlayerName] = useState<string>('COSMIC_PILOT_01');
  const [gameState, setGameState] = useState<'start' | 'playing' | 'paused' | 'gameOver'>('start');

  // Real-time notification lists (maximum 3 concurrent active to fit Chrome mobile beautifully)
  const [notifications, setNotifications] = useState<GameNotification[]>([]);

  // Mobile Controller Actions Triggers
  const [mobilePress, setMobilePress] = useState<'up' | 'down' | null>(null);
  const [mobileShootCount, setMobileShootCount] = useState<number>(0);
  const [mobileBoostCount, setMobileBoostCount] = useState<number>(0);

  // Load all cache configurations on pilot sign-on
  useEffect(() => {
    const loadedStats = loadPlayerStats();
    setStats(loadedStats);

    const loadedLeaderboard = loadLeaderboard();
    setLeaderboard(loadedLeaderboard);

    const cachedPilotName = localStorage.getItem('rocket_cosmic_pilot_name');
    if (cachedPilotName) {
      setPlayerName(cachedPilotName);
    }
  }, []);

  // Force active tab to flight simulator if gameplay initiates
  useEffect(() => {
    if (gameState === 'playing') {
      setActiveTab('flight');
    }
  }, [gameState]);

  // Set pilot name helper
  const handleUpdatePlayerName = (name: string) => {
    setPlayerName(name);
    localStorage.setItem('rocket_cosmic_pilot_name', name);
    addNotification(`Дані пілота оновлено: вітаємо, ${name}`, 'info');
  };

  // Add modular real-time in-game events with duplicate suppression
  const addNotification = (
    message: string,
    type: 'achievement' | 'boss' | 'powerup' | 'season' | 'boost' | 'info'
  ) => {
    // Prevent duplicate toast spam inside a short window of 3.5 seconds
    const timeNow = Date.now();
    const isDuplicate = notifications.some(
      (n) => n.message === message && timeNow - n.timestamp < 3500
    );
    if (isDuplicate) return;

    const newNotif: GameNotification = {
      id: Math.random().toString(36).substring(2, 9),
      message,
      type,
      timestamp: timeNow,
    };
    setNotifications((prev) => [newNotif, ...prev].slice(0, 3)); // Keep only recent 3 UI toast layers on mobile
  };

  const handleDismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Callback on finishing match criteria
  const handleGameFinished = (finalScore: number, bossesDefeated: number) => {
    const currentHighScore = Math.max(stats.highScore, finalScore);
    
    // Earn 50% score as credits plus a clean 100 credits bonus per defeated boss!
    const creditsEarned = Math.floor(finalScore * 0.5) + (bossesDefeated * 100);
    
    const updated = updateStats({
      highScore: currentHighScore,
      totalScore: stats.totalScore + finalScore,
      totalPlays: stats.totalPlays + 1,
      bossesDefeated: stats.bossesDefeated + bossesDefeated,
      powerUpsCollected: stats.powerUpsCollected + Math.floor(finalScore * 0.005), 
      projectilesFired: stats.projectilesFired + Math.floor(finalScore * 0.15), 
      credits: (stats.credits || 0) + creditsEarned,
    });
    setStats(updated);

    // Save score entry to leaderboard cache
    const freshLeaderboard = addLeaderboardEntry({
      playerName,
      score: finalScore,
      skinId: stats.selectedSkinId,
    });
    setLeaderboard(freshLeaderboard);
    
    addNotification(`Виліт завершено. Зароблено +${creditsEarned} кр. для покращення космічного судна!`, 'achievement');
  };

  // Skin switch trigger
  const handleSelectSkin = (id: string) => {
    const next = updateStats({ selectedSkinId: id });
    setStats(next);
    addNotification(`Ядро зоряного винищувача змінено на: ${id.toUpperCase()}`, 'info');
  };

  const handleUpdateStats = (updates: Partial<PlayerStats>) => {
    const next = updateStats(updates);
    setStats(next);
  };

  // Clear data logs
  const handleClearCache = () => {
    localStorage.clear();
    const defaults: PlayerStats = {
      highScore: 0,
      totalScore: 0,
      totalPlays: 0,
      bossesDefeated: 0,
      secondsPlayed: 0,
      powerUpsCollected: 0,
      projectilesFired: 0,
      selectedSkinId: 'classic',
      credits: 0,
      shieldCoreLevel: 0,
      thrustCoreLevel: 0,
      energyCoreLevel: 0,
      radarAntennaLevel: 0,
      unlockedSkinIds: ['classic'],
    };
    setStats(defaults);
    setLeaderboard([]);
    addNotification('Бортові записи та локальний кеш очищено', 'info');
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col relative overflow-x-hidden antialiased font-sans">
      {/* Glow ambient background spots */}
      <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[50%] bg-cyan-950/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-indigo-950/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Floating System-Wide Notifications Service */}
      <NotificationToast
        notifications={notifications}
        onDismiss={handleDismissNotification}
      />

      {/* TOP DECK HEADERS (Command Center Deck) */}
      <header className="border-b border-slate-900/95 bg-slate-950/70 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 z-40">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-505 bg-cyan-500 fill-slate-950 p-2.5 flex items-center justify-center text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
            <Rocket className="w-5 h-5 font-bold animate-pulse" />
          </div>
          <div>
            <h1 className="text-md font-black tracking-wide font-sans text-slate-100 uppercase sm:text-lg">
              Космічна Бортова Станція
            </h1>
            <p className="text-xs text-cyan-400/80 font-mono flex items-center gap-1.5 mt-0.5">
              <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500 animate-pulse" />
              СИСТЕМА АКТИВНА // ПІЛОТ: {playerName}
            </p>
          </div>
        </div>

        {/* Console stats */}
        <div className="flex items-center gap-3 md:gap-5 self-end md:self-auto font-mono text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span className="uppercase">{stats.credits || 0} КРЕДИТІВ</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <Wifi className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span>ЗВ'ЯЗОК: СТАБІЛЬНИЙ</span>
          </div>
        </div>
      </header>

      {/* Command Center Sci-Fi Navigation Tabs (Hidden inside active flight level to prevent touch overlaps) */}
      {gameState !== 'playing' && (
        <div className="px-4 sm:px-6 py-2 bg-slate-950/60 border-b border-slate-900/65 flex flex-wrap justify-start gap-1 sm:gap-2 z-30 select-none">
          <button
            onClick={() => setActiveTab('flight')}
            className={`px-3 py-1.5 font-mono text-[11px] font-extrabold uppercase rounded-lg transition-all flex items-center gap-1.5 cursor-pointer border ${
              activeTab === 'flight'
                ? 'bg-cyan-950/40 text-cyan-400 border-cyan-500/30 shadow-md'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/40 border-transparent'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            Симулятор Бою
          </button>
          
          <button
            onClick={() => setActiveTab('store')}
            className={`px-3 py-1.5 font-mono text-[11px] font-extrabold uppercase rounded-lg transition-all flex items-center gap-1.5 cursor-pointer border ${
              activeTab === 'store'
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-505 border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/40 border-transparent'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Покращення та Магазин
          </button>

          <button
            onClick={() => setActiveTab('hangar')}
            className={`px-3 py-1.5 font-mono text-[11px] font-extrabold uppercase rounded-lg transition-all flex items-center gap-1.5 cursor-pointer border ${
              activeTab === 'hangar'
                ? 'bg-cyan-950/40 text-cyan-45 border-cyan-500/20'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/40 border-transparent'
            }`}
          >
            <Rocket className="w-3.5 h-3.5" />
            Ангар Кораблів
          </button>

          <button
            onClick={() => setActiveTab('ranks')}
            className={`px-3 py-1.5 font-mono text-[11px] font-extrabold uppercase rounded-lg transition-all flex items-center gap-1.5 cursor-pointer border ${
              activeTab === 'ranks'
                ? 'bg-indigo-950/40 text-indigo-400 border-indigo-500/20'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/40 border-transparent'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Рекорди Пілота
          </button>
        </div>
      )}

      {/* PRIMARY COMMAND CENTER SYSTEM CONTENT LAYOUT */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6 z-10" id="main-cockpit-layout">
        
        {/* VIEWPORT PANEL 1: FLIGHT GRAPHICAL SIMULATOR */}
        {(activeTab === 'flight' || gameState === 'playing') && (
          <div className="w-full relative flex flex-col gap-4">
            <div className="w-full relative" style={{ borderRadius: '12px', overflow: 'hidden' }}>
              <CosmicField
                selectedSkinId={stats.selectedSkinId}
                gameState={gameState}
                setGameState={setGameState}
                onGameFinished={handleGameFinished}
                onAddNotification={addNotification}
                mobileDirectPress={mobilePress}
                mobileShootTrigger={mobileShootCount}
                mobileBoostTrigger={mobileBoostCount}
                stats={stats}
              />

              {/* Mobile Gamepad Touch Action Overlays (strictly displayed on phone screen widths) */}
              <VirtualControls
                onDirectionPress={setMobilePress}
                onShoot={() => setMobileShootCount((prev) => prev + 1)}
                onBoost={() => setMobileBoostCount((prev) => prev + 1)}
                boostAvailable={true}
                boostCooldowned={false}
                cooldownLeft={0}
              />
            </div>

            {gameState !== 'playing' && (
              <div className="bg-slate-950/30 p-4 rounded-xl border border-slate-900/80 text-center font-mono text-[10.5px] text-slate-400 tracking-wide">
                🕹️ Керування: <span className="text-cyan-400">Стрілки ВГОРУ/ВНИЗ</span> або <span className="text-cyan-400">W/S</span> для маневрування, <span className="text-cyan-400">ПРОБІЛ</span> для вогню, <span className="text-cyan-400">SHIFT</span> для запуску форсажу. 
              </div>
            )}
          </div>
        )}

        {/* VIEWPORT PANEL 2: COMPONENT TECH UPGRADES LAB */}
        {activeTab === 'store' && gameState !== 'playing' && (
          <StorePage
            stats={stats}
            onUpdateStats={handleUpdateStats}
            onAddNotification={addNotification}
          />
        )}

        {/* VIEWPORT PANEL 3: STARFIGHTER SPACESHIP HANGAR */}
        {activeTab === 'hangar' && gameState !== 'playing' && (
          <div className="bg-slate-950/40 p-5 sm:p-6 rounded-2xl border border-slate-900/90 shadow-lg select-none">
            <Hangar
              stats={stats}
              selectedSkinId={stats.selectedSkinId}
              onSelectSkin={handleSelectSkin}
            />
          </div>
        )}

        {/* VIEWPORT PANEL 4: LEADERBOARD RECORDS & PILOT COCKPIT CREDENTIALS */}
        {activeTab === 'ranks' && gameState !== 'playing' && (
          <div className="bg-slate-950/40 p-5 sm:p-6 rounded-2xl border border-slate-900/90 shadow-lg">
            <Leaderboard
              stats={stats}
              leaderboard={leaderboard}
              onClearCache={handleClearCache}
              onUpdatePlayerName={handleUpdatePlayerName}
              currentPlayerName={playerName}
            />
          </div>
        )}
      </main>

      {/* FOOTER STATS PANEL */}
      <footer className="border-t border-slate-900 bg-slate-950/40 py-4 px-6 text-center text-[10px] font-mono text-slate-500 z-10 mt-auto flex flex-col md:flex-row justify-between items-center gap-2">
        <span className="uppercase">🚀 БОРТОВИЙ ІНТЕРНЕТ v5.28 // ДЛЯ МОБІЛЬНИХ ПРИСТРОЇВ (CHROME MOBILE) // БЕЗ СПАМУ</span>
        <span>Естетична висококонтрастна графіка та глибокий космічний простір</span>
      </footer>
    </div>
  );
}

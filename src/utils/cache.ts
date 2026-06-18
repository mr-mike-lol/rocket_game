/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PlayerStats, LeaderboardEntry, ROCKET_SKINS } from '../types';

const STATS_KEY = 'rocket_cosmic_stats';
const LEADERBOARD_KEY = 'rocket_cosmic_leaderboard';

const DEFAULT_STATS: PlayerStats = {
  highScore: 0,
  totalScore: 0,
  totalPlays: 0,
  bossesDefeated: 0,
  secondsPlayed: 0,
  powerUpsCollected: 0,
  projectilesFired: 0,
  selectedSkinId: 'classic',
  selectedWeaponId: 'laser_alpha',
  credits: 0,
  shieldCoreLevel: 0,
  thrustCoreLevel: 0,
  energyCoreLevel: 0,
  radarAntennaLevel: 0,
  unlockedSkinIds: ['classic'],
  unlockedWeaponIds: ['laser_alpha'],
  donationsCredits: 0,
  starterShieldActive: false,
  creditBonusActive: false,
  overdriveActive: false,
};

export function getDonationDetails(donated: number) {
  if (donated >= 50000) return { title: 'Герой Сектора 🇺🇦', color: 'text-amber-400 font-extrabold animate-pulse' };
  if (donated >= 10000) return { title: 'Генерал Дронів 🦅', color: 'text-rose-400 font-bold' };
  if (donated >= 2000) return { title: 'Зоряний Волонтер 🛡️', color: 'text-cyan-400 font-semibold' };
  if (donated >= 500) return { title: 'Спонсор Кремлепаду 💣', color: 'text-purple-400 font-medium' };
  return null;
}

const SEED_LEADERBOARD: LeaderboardEntry[] = [
  { id: '1', playerName: 'Alex_ZeroG', score: 3820, skinId: 'cyber', date: '2026-06-12' },
  { id: '2', playerName: 'Sputnik_Lover', score: 2450, skinId: 'phoenix', date: '2026-06-14' },
  { id: '3', playerName: 'Yuri_G', score: 1200, skinId: 'plasma', date: '2026-06-15' },
  { id: '4', playerName: 'CosmoCadet', score: 650, skinId: 'classic', date: '2026-06-16' }
];

export function loadPlayerStats(): PlayerStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return DEFAULT_STATS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATS, ...parsed };
  } catch (err) {
    console.error('Failed to load player stats cache:', err);
    return DEFAULT_STATS;
  }
}

export function savePlayerStats(stats: PlayerStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (err) {
    console.error('Failed to save player stats cache:', err);
  }
}

export function updateStats(updates: Partial<PlayerStats>): PlayerStats {
  const current = loadPlayerStats();
  const next = { ...current, ...updates };
  // Check skin locks automatically
  savePlayerStats(next);
  return next;
}

export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) {
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(SEED_LEADERBOARD));
      return SEED_LEADERBOARD;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load leaderboard cache:', err);
    return SEED_LEADERBOARD;
  }
}

export function saveLeaderboard(leaderboard: LeaderboardEntry[]): void {
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard));
  } catch (err) {
    console.error('Failed to save leaderboard cache:', err);
  }
}

export function addLeaderboardEntry(entry: Omit<LeaderboardEntry, 'id' | 'date'>): LeaderboardEntry[] {
  const current = loadLeaderboard();
  const newEntry: LeaderboardEntry = {
    ...entry,
    id: Math.random().toString(36).substring(2, 9),
    date: new Date().toISOString().split('T')[0],
  };

  const next = [...current, newEntry]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10); // keep top 10

  saveLeaderboard(next);
  return next;
}

export function isSkinUnlocked(skinId: string, stats: PlayerStats): boolean {
  const skin = ROCKET_SKINS.find(s => s.id === skinId);
  if (!skin) return false;
  if (skinId === 'classic') return true;
  const inUnlockedList = stats.unlockedSkinIds && stats.unlockedSkinIds.includes(skinId);
  return stats.highScore >= skin.unlockScore || inUnlockedList;
}

export function isWeaponUnlocked(weaponId: string, stats: PlayerStats): boolean {
  if (weaponId === 'laser_alpha') return true;
  return !!(stats.unlockedWeaponIds && stats.unlockedWeaponIds.includes(weaponId));
}

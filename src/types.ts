/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameState = 'start' | 'playing' | 'paused' | 'gameOver';

export interface RocketSkin {
  id: string;
  name: string;
  description: string;
  bodyColor: string;
  miniRocketColor: string;
  flameColor: string;
  projectileColor: string;
  unlockScore: number;
}

export interface PlayerStats {
  highScore: number;
  totalScore: number;
  totalPlays: number;
  bossesDefeated: number;
  secondsPlayed: number;
  powerUpsCollected: number;
  projectilesFired: number;
  selectedSkinId: string;
  credits: number;
  shieldCoreLevel: number;
  thrustCoreLevel: number;
  energyCoreLevel: number;
  radarAntennaLevel: number;
  unlockedSkinIds: string[];
}

export interface GameNotification {
  id: string;
  message: string;
  type: 'achievement' | 'boss' | 'powerup' | 'season' | 'boost' | 'info';
  timestamp: number;
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  score: number;
  skinId: string;
  date: string;
}

export const ROCKET_SKINS: RocketSkin[] = [
  {
    id: 'classic',
    name: 'Класична Ракета',
    description: 'Надійний перевірений часом ретро-корабель. Стандартна маневреність.',
    bodyColor: '#CCD6F6',
    miniRocketColor: '#A8B2D1',
    flameColor: '#FF6347',
    projectileColor: '#64FFDA',
    unlockScore: 0,
  },
  {
    id: 'plasma',
    name: 'Плазмовий Осколок',
    description: 'Використовує суперрозігріті неонові іонні потоки для швидкого маневру.',
    bodyColor: '#A78BFA',
    miniRocketColor: '#C084FC',
    flameColor: '#F43F5E',
    projectileColor: '#38BDF8',
    unlockScore: 250,
  },
  {
    id: 'phoenix',
    name: 'Спалах Фенікса',
    description: 'Заряджений пальними сонячними спалахами. Має надзвичайно яскравий та гарячий слід!',
    bodyColor: '#F59E0B',
    miniRocketColor: '#FBBF24',
    flameColor: '#EF4444',
    projectileColor: '#FACE15',
    unlockScore: 750,
  },
  {
    id: 'cyber',
    name: 'Кібер-Вартовий',
    description: 'Високозахищений сплав титану, створений для прориву найважчих червоних кордонів.',
    bodyColor: '#10B981',
    miniRocketColor: '#34D399',
    flameColor: '#06B6D4',
    projectileColor: '#10B981',
    unlockScore: 1500,
  },
  {
    id: 'void',
    name: 'Володар Порожнечі',
    description: 'Побудований на основі полів антиречовини. Абсолютний повелитель космічної темряви.',
    bodyColor: '#EC4899',
    miniRocketColor: '#F472B6',
    flameColor: '#8B5CF6',
    projectileColor: '#E9D5FF',
    unlockScore: 3000,
  },
  {
    id: 'orion',
    name: 'Астральний Оріон',
    description: 'Легендарний бойовий крейсер, що живиться енергією темної матерії та астральних просторів.',
    bodyColor: '#0EA5E9',
    miniRocketColor: '#38BDF8',
    flameColor: '#F43F5E',
    projectileColor: '#F43F5E',
    unlockScore: 4500,
  }
];

export const SEASONS = [
  { name: 'Глибокий Космос', description: 'Deep space stars and nebulas', bgColor: '#060B14', starColor: '#CCD6F6', starCount: 75, speedMultiplier: 1.0 },
  { name: 'Кібер-Рубіж', description: 'Neon grid space', bgColor: '#0B0A1A', starColor: '#818CF8', starCount: 95, speedMultiplier: 1.15 },
  { name: 'Червоний Гігант', description: 'Combustive solar flare region', bgColor: '#1A0705', starColor: '#FCA5A5', starCount: 80, speedMultiplier: 1.3 },
  { name: 'Крижаний Спектр', description: 'Glacial freeze horizon', bgColor: '#020C1F', starColor: '#93C5FD', starCount: 110, speedMultiplier: 1.45 }
];

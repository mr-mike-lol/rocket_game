/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { PlayerStats, RocketSkin, ROCKET_SKINS, SEASONS, COSMIC_WEAPONS } from '../types';
import { Play, Pause, RotateCcw, Volume2, VolumeX, ShieldAlert, Zap, Maximize, Minimize } from 'lucide-react';
import VirtualControls from './VirtualControls';

interface CosmicFieldProps {
  selectedSkinId: string;
  gameState: 'start' | 'playing' | 'paused' | 'gameOver';
  setGameState: (state: 'start' | 'playing' | 'paused' | 'gameOver') => void;
  onGameFinished: (finalScore: number, bossesDefeated: number, kremlinsDestroyed: number, boostsPerformed: number) => void;
  onAddNotification: (message: string, type: 'achievement' | 'boss' | 'powerup' | 'season' | 'boost' | 'info') => void;
  // External triggers for touch buttons
  mobileDirectPress: 'up' | 'down' | null;
  mobileShootTrigger: number;
  mobileBoostTrigger: number;
  stats: PlayerStats;
}

// Particle type for explosion effects
interface PoolParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
}

// Cached AudioContext to avoid massive resource leaking at high score/high shooting rate
let sharedAudioCtx: AudioContext | null = null;

export const DIFFICULTY_CONFIGS = {
  easy: {
    multiplier: 0.6,
    amplitudeCoeff: 0.04,
    frequency: 0.02,
    baseSpeed: 2.4,
    label: 'Легкий (Екіпаж)',
    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/40',
    activeColor: 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.35)]',
  },
  medium: {
    multiplier: 1.0,
    amplitudeCoeff: 0.08,
    frequency: 0.038,
    baseSpeed: 3.2,
    label: 'Середній (Пілот)',
    color: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/20 hover:bg-cyan-950/40',
    activeColor: 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.35)]',
  },
  hard: {
    multiplier: 1.6,
    amplitudeCoeff: 0.13,
    frequency: 0.06,
    baseSpeed: 4.0,
    label: 'Складний (Ас)',
    color: 'text-rose-400 border-rose-500/30 bg-rose-950/20 hover:bg-rose-950/40',
    activeColor: 'bg-rose-500 text-slate-950 shadow-[0_0_12px_rgba(244,63,94,0.35)]',
  },
};

export default function CosmicField({
  selectedSkinId,
  gameState,
  setGameState,
  onGameFinished,
  onAddNotification,
  mobileDirectPress,
  mobileShootTrigger,
  mobileBoostTrigger,
  stats,
}: CosmicFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [boostCooldownTick, setBoostCooldownTick] = useState(0);

  // Load difficulty on mount
  useEffect(() => {
    const cachedDiff = localStorage.getItem('rocket_cosmic_difficulty');
    if (cachedDiff === 'easy' || cachedDiff === 'medium' || cachedDiff === 'hard') {
      setDifficulty(cachedDiff);
    }
  }, []);

  const handleSelectDifficulty = (diff: 'easy' | 'medium' | 'hard') => {
    setDifficulty(diff);
    localStorage.setItem('rocket_cosmic_difficulty', diff);
  };

  // Sync state with HTML5 native fullscreen events
  useEffect(() => {
    const onFullscreenChange = () => {
      const activeFullscreen = !!document.fullscreenElement;
      setIsTheaterMode(activeFullscreen);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = () => {
    const element = containerRef.current;
    if (!element) return;

    if (!isTheaterMode) {
      if (element.requestFullscreen) {
        element.requestFullscreen().catch(() => {
          // Fallback if sandboxed iframe denies request
          setIsTheaterMode(true);
        });
      } else if ((element as any).webkitRequestFullscreen) {
        try {
          (element as any).webkitRequestFullscreen();
        } catch {
          setIsTheaterMode(true);
        }
      } else {
        setIsTheaterMode(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        try {
          (document as any).webkitExitFullscreen();
        } catch {}
      }
      setIsTheaterMode(false);
    }
  };

  // Logical coordinate space baseline
  const BASE_WIDTH = 1200;
  const BASE_HEIGHT = 675;

  // Real-time canvas states kept in refs for high performance loop
  const stateRef = useRef({
    gameState,
    selectedSkinId,
    gameTime: 0,
    score: 0,
    baseGameSpeed: 3.2,
    currentSeasonIdx: 0,
    screenShakeActive: false,
    screenShakeEndTime: 0,
    screenShakeMagnitude: 6,

    // Timing stats
    startTimeMs: 0,
    lastFiredTime: 0,
    bossesSlayed: 0,
    kremlinsSlayed: 0,
    boostsPerformed: 0,

    // Spawning metrics
    kremlinSpawnTimer: 0,
    powerUpSpawnTimer: 0,

    // Waves mechanics
    waveTimer: 0,
    waveActive: false,
    waveSpawnCount: 0,
    waveSpawnMax: 0,
    waveNextSpawnTimer: 0,
    wavePattern: 'staggered',

    // Boost attributes
    isAccelerating: false,
    accelerationEndTime: 0,
    boostCooldownEndTime: 0,
    cooldownPeriod: 5000,
    boostDuration: 6000,

    // Navigation inputs
    dyInput: 0,

    // Entities lists
    stars: [] as Array<{ x: number; y: number; r: number; speed: number; color: string; depth?: number }>,
    projectiles: Array.from({ length: 300 }, () => ({
      active: false,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      speed: 0,
      damage: 0,
      color: '',
    })),
    bossProjectiles: Array.from({ length: 250 }, () => ({
      active: false,
      x: 0,
      y: 0,
      r: 0,
      speed: 0,
      isHeavy: false,
    })),
    kremlins: Array.from({ length: 120 }, () => ({
      active: false,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      type: '',
      isWaveObstacle: false,
    })),
    powerUpStars: [] as any[],
    particles: Array.from({ length: 1500 }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 0,
      color: '',
      alpha: 0,
      decay: 0,
    })),

    // Boss attributes
    isBossActive: false,
    bosses: [] as any[],
    nextBossSpawnScore: 3000,
    bossInterval: 3000,

    // Upgraded Pilot Inventory attributes
    shieldChargesLeft: 0,
    maxShieldCharges: 0,
    invulnerableEndTime: 0,
  });

  const skinRef = useRef<RocketSkin>(ROCKET_SKINS[0]);

  // Object pooling circular indices for constant timing and zero allocation
  const pIdxRef = useRef(0);
  const bpIdxRef = useRef(0);
  const kIdxRef = useRef(0);
  const partIdxRef = useRef(0);

  const spawnParticle = (x: number, y: number, color: string) => {
    const s = stateRef.current;
    const pool = s.particles;
    const len = pool.length;
    for (let i = 0; i < len; i++) {
      const idx = (partIdxRef.current + i) % len;
      if (!pool[idx].active) {
        const p = pool[idx];
        p.active = true;
        p.x = x;
        p.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.radius = Math.random() * 3 + 1.5;
        p.color = color;
        p.alpha = 1;
        p.decay = Math.random() * 0.02 + 0.015;
        partIdxRef.current = (idx + 1) % len;
        return;
      }
    }
    // Fallback circular override
    const idx = partIdxRef.current;
    const p = pool[idx];
    p.active = true;
    p.x = x;
    p.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 5 + 2;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.radius = Math.random() * 3 + 1.5;
    p.color = color;
    p.alpha = 1;
    p.decay = Math.random() * 0.02 + 0.015;
    partIdxRef.current = (idx + 1) % len;
  };

  const spawnProjectile = (x: number, y: number, w: number, h: number, speed: number, damage: number, color: string) => {
    const s = stateRef.current;
    const pool = s.projectiles;
    const len = pool.length;
    for (let i = 0; i < len; i++) {
      const idx = (pIdxRef.current + i) % len;
      if (!pool[idx].active) {
        const p = pool[idx];
        p.active = true;
        p.x = x;
        p.y = y;
        p.w = w;
        p.h = h;
        p.speed = speed;
        p.damage = damage;
        p.color = color;
        pIdxRef.current = (idx + 1) % len;
        return;
      }
    }
    // Fallback Circular Override
    const idx = pIdxRef.current;
    const p = pool[idx];
    p.active = true;
    p.x = x;
    p.y = y;
    p.w = w;
    p.h = h;
    p.speed = speed;
    p.damage = damage;
    p.color = color;
    pIdxRef.current = (idx + 1) % len;
  };

  const spawnBossProjectile = (x: number, y: number, r: number, speed: number, isHeavy: boolean) => {
    const s = stateRef.current;
    const pool = s.bossProjectiles;
    const len = pool.length;
    for (let i = 0; i < len; i++) {
      const idx = (bpIdxRef.current + i) % len;
      if (!pool[idx].active) {
        const bp = pool[idx];
        bp.active = true;
        bp.x = x;
        bp.y = y;
        bp.r = r;
        bp.speed = speed;
        bp.isHeavy = isHeavy;
        bpIdxRef.current = (idx + 1) % len;
        return;
      }
    }
    // Fallback override oldest
    const idx = bpIdxRef.current;
    const bp = pool[idx];
    bp.active = true;
    bp.x = x;
    bp.y = y;
    bp.r = r;
    bp.speed = speed;
    bp.isHeavy = isHeavy;
    bpIdxRef.current = (idx + 1) % len;
  };

  const spawnKremlin = (x: number, y: number, w: number, h: number, type: string, isWaveObstacle: boolean) => {
    const s = stateRef.current;
    const pool = s.kremlins;
    const len = pool.length;
    for (let i = 0; i < len; i++) {
      const idx = (kIdxRef.current + i) % len;
      if (!pool[idx].active) {
        const k = pool[idx];
        k.active = true;
        k.x = x;
        k.y = y;
        k.w = w;
        k.h = h;
        k.type = type;
        k.isWaveObstacle = isWaveObstacle;
        kIdxRef.current = (idx + 1) % len;
        return;
      }
    }
    // Fallback override oldest
    const idx = kIdxRef.current;
    const k = pool[idx];
    k.active = true;
    k.x = x;
    k.y = y;
    k.w = w;
    k.h = h;
    k.type = type;
    k.isWaveObstacle = isWaveObstacle;
    kIdxRef.current = (idx + 1) % len;
  };

  // Audio synths for zero-dependency sounds
  const playSound = (type: 'shoot' | 'explosion' | 'star' | 'bossSpawn' | 'bossHit' | 'gameover' | 'boost') => {
    if (!soundEnabled) return;
    try {
      if (!sharedAudioCtx) {
        sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const audioCtx = sharedAudioCtx;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'shoot') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } else if (type === 'boost') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(450, audioCtx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } else if (type === 'explosion') {
        // Noise synthesis
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(15, audioCtx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.42);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.42);
      } else if (type === 'star') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(620, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.26);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.26);
      } else if (type === 'bossSpawn') {
        // Dramatic low hazard drone
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(110, audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
      } else if (type === 'bossHit') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      } else if (type === 'gameover') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(30, audioCtx.currentTime + 0.95);
        gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 1.0);
        osc.start();
        osc.stop(audioCtx.currentTime + 1.0);
      }
    } catch (e) {
      // AudioContext compatibility safeguard
    }
  };

  // Sync state triggers
  useEffect(() => {
    stateRef.current.gameState = gameState;
    setIsPlaying(gameState === 'playing');
    if (gameState === 'playing' && stateRef.current.startTimeMs === 0) {
      stateRef.current.startTimeMs = Date.now();
    }
  }, [gameState]);

  // Sync customized cosmetic properties
  useEffect(() => {
    stateRef.current.selectedSkinId = selectedSkinId;
    const skin = ROCKET_SKINS.find((s) => s.id === selectedSkinId);
    if (skin) {
      skinRef.current = skin;
    }
  }, [selectedSkinId]);

  // Handle external mobile control gestures
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (!mobileDirectPress) return; // Guard: do not override local touch inputs with 0 when idle
    const verticalVelocity = BASE_HEIGHT * 0.013;
    if (mobileDirectPress === 'up') {
      stateRef.current.dyInput = -verticalVelocity;
    } else if (mobileDirectPress === 'down') {
      stateRef.current.dyInput = verticalVelocity;
    } else {
      stateRef.current.dyInput = 0;
    }
  }, [mobileDirectPress, gameState]);

  // Trigger weapon shot from mobile button tap
  useEffect(() => {
    if (mobileShootTrigger > 0 && gameState === 'playing') {
      triggerWeaponFire();
    }
  }, [mobileShootTrigger]);

  // Trigger speed boost from mobile button tap
  useEffect(() => {
    if (mobileBoostTrigger > 0 && gameState === 'playing') {
      triggerEngineBoost();
    }
  }, [mobileBoostTrigger]);

  // Player shoot action core handler
  const triggerWeaponFire = () => {
    const s = stateRef.current;
    if (gameState !== 'playing') return;

    // Rate limiting to preserve frame times and avoid duplicate key spams
    const now = Date.now();
    if (now - (s.lastFiredTime || 0) < 110) {
      return;
    }
    s.lastFiredTime = now;

    const miniOffsetTop = 15;
    const miniOffsetBottom = -15;

    // Upgrades modifiers
    const energyLvl = (stats.energyCoreLevel || 0) + (stats.overdriveActive ? 1 : 0);
    const pSpeed = 12.5 + energyLvl * 1.5;
    const pDamage = 1 + energyLvl * 0.2;
    const pWidth = 16 + (energyLvl >= 2 ? 6 : 0);

    // Get active weapon's color
    const activeWeapon = COSMIC_WEAPONS.find((w) => w.id === (stats.selectedWeaponId || 'laser_alpha')) || COSMIC_WEAPONS[0];
    const weaponColor = activeWeapon.projectileColor;

    if (energyLvl >= 3) {
      // Dual parallel streams!
      spawnProjectile(
        180 + 35,
        (s.rocketY || BASE_HEIGHT / 2) - 8,
        pWidth,
        6,
        pSpeed,
        pDamage,
        weaponColor
      );
      spawnProjectile(
        180 + 35,
        (s.rocketY || BASE_HEIGHT / 2) + 8,
        pWidth,
        6,
        pSpeed,
        pDamage,
        weaponColor
      );
    } else {
      // Standard projectile
      spawnProjectile(
        180 + 35,
        s.rocketY || BASE_HEIGHT / 2,
        pWidth,
        6,
        pSpeed,
        pDamage,
        weaponColor
      );
    }

    // Spawn satellite weapons if power-up is ticking
    if (s.miniRocketsActive) {
      spawnProjectile(
        180 + 20,
        (s.rocketY || BASE_HEIGHT / 2) + miniOffsetTop,
        10,
        4,
        pSpeed + 1,
        1,
        weaponColor
      );

      spawnProjectile(
        180 + 20,
        (s.rocketY || BASE_HEIGHT / 2) + miniOffsetBottom,
        10,
        4,
        pSpeed + 1,
        1,
        weaponColor
      );
    }

    playSound('shoot');
  };

  // Speed boost action trigger
  const triggerEngineBoost = () => {
    const s = stateRef.current;
    if (Date.now() > s.boostCooldownEndTime) {
      s.isAccelerating = true;
      s.accelerationEndTime = Date.now() + s.boostDuration;
      s.boostCooldownEndTime = s.accelerationEndTime + s.cooldownPeriod;
      s.boostsPerformed++;
      onAddNotification('ФОРСАЖ ДВИГУНА АКТИВОВАНО!', 'boost');
      playSound('boost');
    }
  };

  // Event handlers for Desktop gameplay controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (s.gameState !== 'playing') {
        if (e.key === 'Enter') {
          e.preventDefault();
          setGameState('playing');
        }
        return;
      }

      const vertVelocity = BASE_HEIGHT * 0.013;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        s.dyInput = -vertVelocity;
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        s.dyInput = vertVelocity;
      }
      if (e.key === ' ') {
        e.preventDefault();
        triggerWeaponFire();
      }
      if (e.key === 'x' || e.key === 'X' || e.key === 'Shift') {
        e.preventDefault();
        triggerEngineBoost();
      }
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setGameState('paused');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        s.dyInput = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  // Start rendering and physics calculations
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    // Rescale support for modern screens
    const handleResize = () => {
      if (!containerRef.current || !canvas) return;
      const rect = containerRef.current.getBoundingClientRect();
      const parentWidth = Math.floor(rect.width);
      const parentHeight = Math.floor(rect.height || rect.width * (9 / 16));
      
      let w = parentWidth;
      let h = Math.floor(parentWidth * (9 / 16));
      
      // If calculated 16:9 height overflows parents' bounding vertical box, clamp height!
      if (h > parentHeight && parentHeight > 50) {
        h = parentHeight;
        w = Math.floor(parentHeight * (16 / 9));
      }
      
      canvas.width = w;
      canvas.height = h;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    const s = stateRef.current;

    const config = DIFFICULTY_CONFIGS[difficulty] || DIFFICULTY_CONFIGS.medium;
    s.baseGameSpeed = config.baseSpeed;

    // Sync upgrades initially
    s.maxShieldCharges = (stats.shieldCoreLevel || 0) + (stats.starterShieldActive ? 1 : 0);
    // Keep current charge context intact or recharge if starting playing state
    if (s.gameState === 'start' || s.gameState === 'playing' && s.gameTime === 0) {
      s.shieldChargesLeft = (stats.shieldCoreLevel || 0) + (stats.starterShieldActive ? 1 : 0);
    }
    s.boostDuration = 6000 + (stats.thrustCoreLevel || 0) * 1500;
    s.cooldownPeriod = 5000 - (stats.thrustCoreLevel || 0) * 1000;

    // Seed background elements initially
    const activeSeason = SEASONS[s.currentSeasonIdx];
    s.stars = [];
    for (let i = 0; i < activeSeason.starCount; i++) {
      const rand = Math.random();
      let depth = 1; // 1 = far (slow, small), 2 = mid (neutral), 3 = close (fast, large)
      let r = Math.random() * 0.7 + 0.3; // small
      let starSpeed = Math.random() * 0.15 + 0.1; // slow

      if (rand > 0.50 && rand <= 0.85) {
        depth = 2;
        r = Math.random() * 0.9 + 1.1; // medium
        starSpeed = Math.random() * 0.3 + 0.35; // medium
      } else if (rand > 0.85) {
        depth = 3;
        r = Math.random() * 1.0 + 2.2; // large
        starSpeed = Math.random() * 0.6 + 0.90; // fast
      }

      s.stars.push({
        x: Math.random() * BASE_WIDTH,
        y: Math.random() * BASE_HEIGHT,
        r,
        speed: starSpeed,
        color: activeSeason.starColor,
        depth,
      });
    }

    // Baseline rocket initialization
    s.rocketY = BASE_HEIGHT / 2;
    s.rocketBaseY = BASE_HEIGHT / 2;

    const frame = () => {
      if (!canvas || !ctx) return;

      const flexScale = canvas.width / BASE_WIDTH;
      const currentSeason = SEASONS[s.currentSeasonIdx];

      // Standardize responsive canvas dimensions
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Render star base background
      ctx.fillStyle = currentSeason.bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render Screen Shake offset shifts
      ctx.save();

      if (s.screenShakeActive && Date.now() < s.screenShakeEndTime) {
        const dx = (Math.random() - 0.5) * 2 * s.screenShakeMagnitude * flexScale;
        const dy = (Math.random() - 0.5) * 2 * s.screenShakeMagnitude * flexScale;
        ctx.translate(dx, dy);
      } else {
        s.screenShakeActive = false;
      }

      // Parallax starfield render
      const calculatedGameSpeed = s.isAccelerating ? s.baseGameSpeed * 2.2 : s.baseGameSpeed;

      s.stars.forEach((star) => {
        // Star movement speed shifts based on selected speed bounds
        star.x -= star.speed * (calculatedGameSpeed * 0.55);
        if (star.x < 0) {
          star.x = BASE_WIDTH;
          star.y = Math.random() * BASE_HEIGHT;
        }

        ctx.beginPath();
        const d = star.depth || 1;
        if (d === 1) {
          // Far stars: dimmer and bluish/softer
          ctx.fillStyle = star.color === '#ffffff' ? 'rgba(255, 255, 255, 0.35)' : `${star.color}55`;
          ctx.arc(star.x * flexScale, star.y * flexScale, star.r * flexScale, 0, Math.PI * 2);
          ctx.fill();
        } else if (d === 2) {
          // Mid level standard stars: fully opaque
          ctx.fillStyle = star.color;
          ctx.arc(star.x * flexScale, star.y * flexScale, star.r * flexScale, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Near stars: bright white, speed lines shape (especially on engine boosts)
          ctx.fillStyle = '#ffffff';
          const speedMultiplier = s.isAccelerating ? 4.0 : 1.3;
          const starWidth = star.r * speedMultiplier;
          ctx.rect((star.x - starWidth) * flexScale, star.y * flexScale, starWidth * flexScale, star.r * 1.1 * flexScale);
          ctx.fill();
        }
      });

      // Render glowing particle debris explosions (pure aesthetic enhancement!)
      for (let i = 0; i < s.particles.length; i++) {
        const p = s.particles[i];
        if (p.active) {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= p.decay;
          if (p.alpha <= 0) {
            p.active = false;
          } else {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x * flexScale, p.y * flexScale, p.radius * flexScale, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }

      if (s.gameState === 'playing') {
        s.gameTime++;

        // Decay boost timer if active
        if (s.isAccelerating && Date.now() > s.accelerationEndTime) {
          s.isAccelerating = false;
          onAddNotification('Увага: Форсаж почав перезаряджання...', 'info');
        }

        // Apply input physics with oscillation mechanics (amplitude & frequency based on selected difficulty)
        const amplitude = BASE_HEIGHT * config.amplitudeCoeff;
        const frequency = config.frequency;
        s.rocketBaseY += s.dyInput;

        // Barrier checks for fluid maneuvers
        if (s.rocketBaseY < 30) s.rocketBaseY = 30;
        if (s.rocketBaseY > BASE_HEIGHT - 30) s.rocketBaseY = BASE_HEIGHT - 30;

        // Wave formula offset
        s.rocketY = s.rocketBaseY + amplitude * Math.sin(frequency * s.gameTime);

        // Power-up duration check
        if (s.miniRocketsActive && Date.now() > s.miniRocketsEndTime) {
          s.miniRocketsActive = false;
          onAddNotification('Дія міні-ракетного озброєння закінчилась', 'info');
        }

        // ---------------- ENTITY COLLISION PHYSICS ----------------

        // Waves of Enemies Spawning Logic
        if (!s.isBossActive) {
          s.waveTimer++;
          // Trigger a sudden, structured wave every 900 frames (approx 15 seconds) if offline
          if (s.waveTimer >= 900 && !s.waveActive) {
            s.waveActive = true;
            s.waveSpawnCount = 0;
            s.waveSpawnMax = 4 + Math.floor(Math.random() * 3); // 4 to 6 wave enemies
            s.waveNextSpawnTimer = 0;

            const patterns = ['staggered', 'escalating', 'bunker_wall'];
            s.wavePattern = patterns[Math.floor(Math.random() * patterns.length)];

            const uPatternName = s.wavePattern === 'staggered'
              ? 'Шаховий'
              : s.wavePattern === 'escalating'
              ? 'Східчастий'
              : 'Загороджувальний';

            onAddNotification(`⚠️ УВАГА: ШТУРМОВА ХВИЛЯ СУДЕН-ДРОНІВ (Паттерн: ${uPatternName})!`, 'boss');
            playSound('bossSpawn');
          }
        } else {
          s.waveActive = false;
          s.waveTimer = 0;
        }

        if (s.waveActive) {
          s.waveNextSpawnTimer++;
          // Wave spires spawn much faster (interval depends on difficulty)
          const waveInterval = difficulty === 'hard' ? 22 : difficulty === 'easy' ? 38 : 30;
          if (s.waveNextSpawnTimer >= waveInterval) {
            s.waveNextSpawnTimer = 0;

            let y = BASE_HEIGHT / 2;
            let height = 140;
            let width = 50;
            const step = s.waveSpawnCount;

            if (s.wavePattern === 'staggered') {
              height = 130 + Math.random() * 40;
              y = (step % 2 === 0) ? (height / 2 + 35) : (BASE_HEIGHT - height / 2 - 35);
            } else if (s.wavePattern === 'escalating') {
              height = 120 + (step * 25);
              y = 90 + (step * 80);
              if (y > BASE_HEIGHT - height / 2 - 40) {
                y = BASE_HEIGHT / 2;
              }
            } else { // bunker_wall
              height = 170;
              width = 70;
              y = (step === 0 || step === 2 || step === 4) ? (height / 2 + 20) : (BASE_HEIGHT - height / 2 - 20);
            }

            const waveTowerTypes = ['spire', 'telecom', 'lubyanka', 'skyscraper', 'bunker'];
            const chosenType = waveTowerTypes[Math.floor(Math.random() * waveTowerTypes.length)];

            spawnKremlin(BASE_WIDTH + 80, y, width, height, chosenType, true);

            s.waveSpawnCount++;
            if (s.waveSpawnCount >= s.waveSpawnMax) {
              s.waveActive = false;
              s.waveTimer = 0; // reset
            }
          }
        } else {
          // Regular spire spawning flow
          s.kremlinSpawnTimer++;
          const dynamicInterval = Math.max(50, 140 - Math.floor(s.score * 0.05));
          if (s.kremlinSpawnTimer >= dynamicInterval) {
            s.kremlinSpawnTimer = 0;
            
            // Randomize tower types related to Russian institutions
            const types = ['spire', 'telecom', 'lubyanka', 'skyscraper', 'bunker'];
            const chosenType = types[Math.floor(Math.random() * types.length)];
            
            let dynamicWidth = 55;
            let dynamicHeight = Math.random() * 80 + 120;
            
            if (chosenType === 'spire') { // Spasskaya Spire
              dynamicWidth = Math.floor(Math.random() * 20 + 45); // 45 to 65
              dynamicHeight = Math.floor(Math.random() * 110 + 120); // 120 to 230
            } else if (chosenType === 'telecom') { // Ostankino Tower
              dynamicWidth = Math.floor(Math.random() * 10 + 35); // 35 to 45
              dynamicHeight = Math.floor(Math.random() * 120 + 170); // 170 to 290
            } else if (chosenType === 'lubyanka') { // Lubyanka Citadel
              dynamicWidth = Math.floor(Math.random() * 30 + 75); // 75 to 105
              dynamicHeight = Math.floor(Math.random() * 60 + 100); // 100 to 160
            } else if (chosenType === 'skyscraper') { // Gazprom Lakhta / Moscow City
              dynamicWidth = Math.floor(Math.random() * 20 + 45); // 45 to 65
              dynamicHeight = Math.floor(Math.random() * 110 + 160); // 160 to 270
            } else if (chosenType === 'bunker') { // Stepped Bunker Mausoleum
              dynamicWidth = Math.floor(Math.random() * 35 + 80); // 80 to 115
              dynamicHeight = Math.floor(Math.random() * 40 + 85); // 85 to 125
            }
            
            spawnKremlin(
              BASE_WIDTH + 80,
              Math.random() * (BASE_HEIGHT - dynamicHeight) + dynamicHeight / 2,
              dynamicWidth,
              dynamicHeight,
              chosenType,
              false
            );
          }
        }

        // Star powerup spawning checks
        s.powerUpSpawnTimer++;
        if (s.powerUpSpawnTimer >= 480) {
          s.powerUpSpawnTimer = 0;
          s.powerUpStars.push({
            x: BASE_WIDTH + 40,
            y: Math.random() * (BASE_HEIGHT - 60) + 30,
            r: 16,
          });
        }

        // Check weapon fires and bullet updates
        for (let i = 0; i < s.projectiles.length; i++) {
          const p = s.projectiles[i];
          if (p.active) {
            p.x += p.speed;

            // Out of screen delete
            if (p.x > BASE_WIDTH + 50) {
              p.active = false;
              continue;
            }

            // Bullet draw
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8 * flexScale;
            ctx.fillRect(
              (p.x - p.w / 2) * flexScale,
              (p.y - p.h / 2) * flexScale,
              p.w * flexScale,
              p.h * flexScale
            );
            ctx.shadowBlur = 0; // Clear shadow
          }
        }

        // Move gold buff stars
        for (let i = s.powerUpStars.length - 1; i >= 0; i--) {
          const star = s.powerUpStars[i];
          star.x -= calculatedGameSpeed * 0.75;

          // Render star
          ctx.save();
          ctx.translate(star.x * flexScale, star.y * flexScale);
          ctx.rotate(s.gameTime * 0.04);
          ctx.fillStyle = '#FFEB3B';
          ctx.beginPath();
          for (let j = 0; j < 5; j++) {
            ctx.lineTo(
              star.r * flexScale * Math.cos(((18 + j * 72) * Math.PI) / 180),
              star.r * flexScale * Math.sin(((18 + j * 72) * Math.PI) / 180)
            );
            ctx.lineTo(
              (star.r / 2) * flexScale * Math.cos(((54 + j * 72) * Math.PI) / 180),
              (star.r / 2) * flexScale * Math.sin(((54 + j * 72) * Math.PI) / 180)
            );
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          // Check hit
          const dx = star.x - 180;
          const dy = star.y - s.rocketY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < star.r + 25) {
            // Picked up! Set buff active
            s.miniRocketsActive = true;
            s.miniRocketsEndTime = Date.now() + 7500; // 7.5 seconds
            s.powerUpStars.splice(i, 1);
            
            const pointsEarned = Math.round(80 * (1 + (stats.radarAntennaLevel || 0) * 0.15) * config.multiplier);
            s.score += pointsEarned;
            playSound('star');
            onAddNotification(`+${pointsEarned} БАЛІВ! ЗОЛОТИЙ ДРОН АКТИВОВАНИЙ!`, 'powerup');

            // Spawn sparkly gold particles
            for (let k = 0; k < 15; k++) {
              spawnParticle(star.x, star.y, '#FFD700');
            }
          } else if (star.x < -30) {
            s.powerUpStars.splice(i, 1);
          }
        }

        // ---------------- BOSS ENGAGEMENTS ----------------
        if (!s.isBossActive && s.score >= s.nextBossSpawnScore) {
          s.isBossActive = true;
          // Set dynamic next spawn threshold that is strictly greater than the current score with a 3000 point interval!
          s.nextBossSpawnScore = Math.floor(s.score / 3000) * 3000 + 3000;
          s.screenShakeActive = true;
          s.screenShakeEndTime = Date.now() + 7000; // Drone shakes
          playSound('bossSpawn');
          onAddNotification('⚠️ ОКУПАЦІЙНЕ КОМАНДУВАННЯ РФ НАБЛИЖАЄТЬСЯ!', 'boss');

          const bossTypes: Array<'commander' | 'tank' | 'air_defense'> = ['commander', 'tank', 'air_defense'];
          s.bosses = [];

          // Spawns 2 bosses at once on High/Hard difficulty!
          const spawnCount = difficulty === 'hard' ? 2 : 1;

          for (let bIdx = 0; bIdx < spawnCount; bIdx++) {
            const bType = bossTypes[Math.floor(Math.random() * bossTypes.length)];
            let name = 'Окупаційний Офіцер';
            let w = 120;
            let h = 190;
            // HP with a 40% globally mandated increase
            let baseHp = Math.round((22 + s.bossesSlayed * 6) * 1.4);
            let speed = 2.2;
            let xOffset = bIdx * 85;

            if (bType === 'commander') {
              name = 'Генерал-Полковник Окупантів';
              w = 120;
              h = 190;
              speed = 2.2;
            } else if (bType === 'tank') {
              name = 'Важкий Танк Т-90М «Прорив» РФ';
              w = 150;
              h = 140;
              baseHp = Math.round(baseHp * 1.35); // 1.35x armored multiplier
              speed = 1.25;
            } else if (bType === 'air_defense') {
              name = 'Комплекс ППО «Панцир-С1» РФ';
              w = 110;
              h = 130;
              baseHp = Math.round(baseHp * 0.9); // 0.9x lighter multiplier but higher rate of fire
              speed = 2.7;
            }

            s.bosses.push({
              id: `${bType}_${Date.now()}_${bIdx}`,
              type: bType,
              name,
              x: BASE_WIDTH - 150 - xOffset,
              y: spawnCount === 2 ? (bIdx === 0 ? BASE_HEIGHT * 0.28 : BASE_HEIGHT * 0.72) : BASE_HEIGHT / 2,
              w,
              h,
              health: baseHp,
              maxHealth: baseHp,
              dir: bIdx === 1 ? -1 : 1,
              shootTimer: Math.floor(Math.random() * 35),
              speed,
            });
          }
        }

        if (s.isBossActive && s.bosses && s.bosses.length > 0) {
          for (let bIdx = s.bosses.length - 1; bIdx >= 0; bIdx--) {
            const b = s.bosses[bIdx];

            // Hover movement mechanics
            b.y += b.speed * b.dir;
            if (b.y > BASE_HEIGHT - b.h / 2 - 35 || b.y < b.h / 2 + 35) {
              b.dir *= -1;
            }

            // Shoots projectile
            b.shootTimer++;
            const bossLimit = Math.max(80, 160 - s.bossesSlayed * 15);
            if (b.shootTimer >= bossLimit) {
              b.shootTimer = 0;
              
              if (b.type === 'tank') {
                // Heavy slow blaster shell with larger radius, dealing massive damage
                spawnBossProjectile(b.x - 55, b.y, 19, 5.6, true);
                playSound('shoot');
              } else if (b.type === 'air_defense') {
                // Sector defense spawns rapid dual bursts!
                spawnBossProjectile(b.x - 45, b.y - 14, 8, 8.5, false);
                spawnBossProjectile(b.x - 45, b.y + 14, 8, 8.5, false);
                playSound('shoot');
              } else {
                // Commander
                spawnBossProjectile(b.x - 45, b.y, 12, 7.2, false);
                playSound('shoot');
              }
            }

            // Render Boss
            ctx.save();
            // Draw simple health bar
            const hbW = 140 * flexScale;
            const hbH = 7 * flexScale;
            const hbX = (b.x - 70) * flexScale;
            const hbY = (b.y - b.h / 2 - 25) * flexScale;
            ctx.fillStyle = '#333333';
            ctx.fillRect(hbX, hbY, hbW, hbH);
            const ratio = Math.max(0, b.health / b.maxHealth);
            ctx.fillStyle = ratio > 0.55 ? '#10B981' : ratio > 0.25 ? '#F59E0B' : '#EF4444';
            ctx.fillRect(hbX, hbY, hbW * ratio, hbH);
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 0.5 * flexScale;
            ctx.strokeRect(hbX, hbY, hbW, hbH);

            // Print boss name over health bar
            ctx.fillStyle = '#E2E8F0';
            ctx.font = `bold ${9 * flexScale}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(b.name.toUpperCase(), b.x * flexScale, hbY - 4 * flexScale);

            if (b.type === 'commander') {
              // Head (Helmet)
              ctx.fillStyle = '#556B2F'; // Uniform green
              ctx.beginPath();
              ctx.arc(b.x * flexScale, (b.y - 60) * flexScale, 24 * flexScale, 0, Math.PI * 2);
              ctx.fill();

              // Red Star on military cap/helmet
              ctx.fillStyle = '#EF4444';
              ctx.beginPath();
              const starSz = 8;
              const hY = b.y - 60;
              for (let k = 0; k < 5; k++) {
                ctx.lineTo(
                  (b.x + starSz * Math.cos(((18 + k * 72 - 90) * Math.PI) / 180)) * flexScale,
                  (hY + starSz * Math.sin(((18 + k * 72 - 90) * Math.PI) / 180)) * flexScale
                );
              }
              ctx.closePath();
              ctx.fill();

              // Body (Military tunic)
              ctx.fillStyle = '#3F4E2E';
              ctx.fillRect(
                (b.x - 40) * flexScale,
                (b.y - 36) * flexScale,
                80 * flexScale,
                85 * flexScale
              );

              // Red Russian shoulder boards / epaulets
              ctx.fillStyle = '#D97706'; // Gold/orange trim
              ctx.fillRect((b.x - 42) * flexScale, (b.y - 36) * flexScale, 18 * flexScale, 6 * flexScale);
              ctx.fillRect((b.x + 24) * flexScale, (b.y - 36) * flexScale, 18 * flexScale, 6 * flexScale);

              // Drawing a white "Z" symbol painted on the officer's uniform chest
              ctx.strokeStyle = '#FFFFFF';
              ctx.lineWidth = 4 * flexScale;
              ctx.beginPath();
              ctx.moveTo((b.x - 14) * flexScale, (b.y - 12) * flexScale);
              ctx.lineTo((b.x + 14) * flexScale, (b.y - 12) * flexScale);
              ctx.lineTo((b.x - 14) * flexScale, (b.y + 12) * flexScale);
              ctx.lineTo((b.x + 14) * flexScale, (b.y + 12) * flexScale);
              ctx.stroke();

              // Russian tricolor patch on left arm sleeve
              const patchX = (b.x + 30) * flexScale;
              const patchY = (b.y - 15) * flexScale;
              const patchW = 12 * flexScale;
              const patchH = 10 * flexScale;
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(patchX, patchY, patchW, patchH / 3);
              ctx.fillStyle = '#011F82';
              ctx.fillRect(patchX, patchY + patchH / 3, patchW, patchH / 3);
              ctx.fillStyle = '#C20404';
              ctx.fillRect(patchX, patchY + (patchH * 2) / 3, patchW, patchH / 3);

              // Arm/Rifle
              ctx.fillStyle = '#111111';
              ctx.fillRect(
                (b.x - 75) * flexScale,
                (b.y - 10) * flexScale,
                70 * flexScale,
                12 * flexScale
              );

              // Legs/Trousers
              ctx.fillStyle = '#2F3C22';
              ctx.fillRect(
                (b.x - 30) * flexScale,
                (b.y + 49) * flexScale,
                24 * flexScale,
                42 * flexScale
              );
              ctx.fillRect(
                (b.x + 6) * flexScale,
                (b.y + 49) * flexScale,
                24 * flexScale,
                42 * flexScale
              );
            } else if (b.type === 'tank') {
              // Russian Military Green Camouflage Chassis
              ctx.fillStyle = '#3A4B29';
              ctx.fillRect(
                (b.x - 65) * flexScale,
                (b.y - 50) * flexScale,
                130 * flexScale,
                100 * flexScale
              );

              // Forest camo organic blotches
              ctx.fillStyle = '#1D2A11';
              ctx.beginPath();
              ctx.arc((b.x + 25) * flexScale, (b.y - 25) * flexScale, 20 * flexScale, 0, Math.PI * 2);
              ctx.fill();
              ctx.beginPath();
              ctx.arc((b.x - 35) * flexScale, (b.y + 15) * flexScale, 18 * flexScale, 0, Math.PI * 2);
              ctx.fill();

              // Mud brown spots
              ctx.fillStyle = '#5A4625';
              ctx.beginPath();
              ctx.arc((b.x - 20) * flexScale, (b.y - 20) * flexScale, 14 * flexScale, 0, Math.PI * 2);
              ctx.fill();

              // Big white "Z" occupant decal painted on armor plate side face
              ctx.strokeStyle = '#FFFFFF';
              ctx.lineWidth = 5.5 * flexScale;
              ctx.beginPath();
              ctx.moveTo((b.x - 25) * flexScale, (b.y - 25) * flexScale);
              ctx.lineTo((b.x + 15) * flexScale, (b.y - 25) * flexScale);
              ctx.lineTo((b.x - 25) * flexScale, (b.y + 15) * flexScale);
              ctx.lineTo((b.x + 15) * flexScale, (b.y + 15) * flexScale);
              ctx.stroke();

              // Red star insignias on the front hazard warning side panels
              ctx.fillStyle = '#EF4444';
              ctx.fillRect((b.x - 65) * flexScale, (b.y - 50) * flexScale, 15 * flexScale, 100 * flexScale);
              ctx.fillRect((b.x + 50) * flexScale, (b.y - 50) * flexScale, 15 * flexScale, 100 * flexScale);

              // White Z icon on left warning panel
              ctx.fillStyle = '#FFFFFF';
              ctx.font = `bold ${10 * flexScale}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.fillText('Z', (b.x - 57) * flexScale, b.y * flexScale);
              ctx.fillText('Z', (b.x + 58) * flexScale, b.y * flexScale);

              // Russian tricolor ribbon decal on top hull plate
              const rX = (b.x - 45) * flexScale;
              const rY = (b.y - 45) * flexScale;
              const rW = 35 * flexScale;
              const rH = 8 * flexScale;
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(rX, rY, rW, rH / 3);
              ctx.fillStyle = '#011F82';
              ctx.fillRect(rX, rY + rH / 3, rW, rH / 3);
              ctx.fillStyle = '#C20404';
              ctx.fillRect(rX, rY + (rH * 2) / 3, rW, rH / 3);

              // Armor plate steel borders
              ctx.strokeStyle = '#223014';
              ctx.lineWidth = 1 * flexScale;
              ctx.strokeRect((b.x - 50) * flexScale, (b.y - 40) * flexScale, 100 * flexScale, 80 * flexScale);

              // Large heavy dual blasters
              ctx.fillStyle = '#151C0F';
              ctx.fillRect((b.x - 92) * flexScale, (b.y - 20) * flexScale, 68 * flexScale, 15 * flexScale);
              ctx.fillRect((b.x - 92) * flexScale, (b.y + 5) * flexScale, 68 * flexScale, 15 * flexScale);

              // Power core light (glowing red central shield generator typical for soviet designs)
              ctx.fillStyle = '#EF4444';
              ctx.beginPath();
              ctx.arc(b.x * flexScale, b.y * flexScale, 16 * flexScale, 0, Math.PI * 2);
              ctx.fill();
            } else if (b.type === 'air_defense') {
              // Military AA pedestal base (dark green camouflage)
              ctx.fillStyle = '#1A3323';
              ctx.beginPath();
              ctx.moveTo((b.x - 45) * flexScale, (b.y + 45) * flexScale);
              ctx.lineTo((b.x + 45) * flexScale, (b.y + 45) * flexScale);
              ctx.lineTo((b.x + 30) * flexScale, (b.y - 45) * flexScale);
              ctx.lineTo((b.x - 30) * flexScale, (b.y - 45) * flexScale);
              ctx.closePath();
              ctx.fill();

              // Radar detector display (Cyan line detail)
              ctx.fillStyle = '#06B6D4';
              ctx.fillRect((b.x - 22) * flexScale, (b.y - 25) * flexScale, 44 * flexScale, 6 * flexScale);

              // Four Camo Rocket pod arrays (Left and Right pairs)
              ctx.fillStyle = '#134E24';
              ctx.fillRect((b.x - 55) * flexScale, (b.y - 40) * flexScale, 20 * flexScale, 25 * flexScale);
              ctx.fillRect((b.x + 35) * flexScale, (b.y - 40) * flexScale, 20 * flexScale, 25 * flexScale);
              ctx.fillRect((b.x - 55) * flexScale, (b.y + 15) * flexScale, 20 * flexScale, 25 * flexScale);
              ctx.fillRect((b.x + 35) * flexScale, (b.y + 15) * flexScale, 20 * flexScale, 25 * flexScale);

              // Draw white 'V' decals on military missile launch arrays
              ctx.strokeStyle = '#FFFFFF';
              ctx.lineWidth = 3 * flexScale;
              // Left pods V decal
              ctx.beginPath();
              ctx.moveTo((b.x - 50) * flexScale, (b.y - 35) * flexScale);
              ctx.lineTo((b.x - 45) * flexScale, (b.y - 20) * flexScale);
              ctx.lineTo((b.x - 40) * flexScale, (b.y - 35) * flexScale);
              ctx.stroke();

              // Right pods V decal
              ctx.beginPath();
              ctx.moveTo((b.x + 40) * flexScale, (b.y - 35) * flexScale);
              ctx.lineTo((b.x + 45) * flexScale, (b.y - 20) * flexScale);
              ctx.lineTo((b.x + 50) * flexScale, (b.y - 35) * flexScale);
              ctx.stroke();

              // Tricolor stripe ribbon across the defense pedestal base
              const ribbonX = (b.x - 22) * flexScale;
              const ribbonY = (b.y + 20) * flexScale;
              const ribbonW = 44 * flexScale;
              const ribbonH = 8 * flexScale;
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(ribbonX, ribbonY, ribbonW, ribbonH / 3);
              ctx.fillStyle = '#011F82';
              ctx.fillRect(ribbonX, ribbonY + ribbonH / 3, ribbonW, ribbonH / 3);
              ctx.fillStyle = '#C20404';
              ctx.fillRect(ribbonX, ribbonY + (ribbonH * 2) / 3, ribbonW, ribbonH / 3);

              // Cyber-tracking sensor eye ball
              ctx.fillStyle = '#0891B2';
              ctx.beginPath();
              ctx.arc(b.x * flexScale, b.y * flexScale, 20 * flexScale, 0, Math.PI * 2);
              ctx.fill();
              
              // Secondary highlight
              ctx.fillStyle = '#FFFFFF';
              ctx.beginPath();
              ctx.arc((b.x - 5) * flexScale, (b.y - 5) * flexScale, 6 * flexScale, 0, Math.PI * 2);
              ctx.fill();
            }

            ctx.restore();

            // Collision check: player bullets hit Boss
            for (let i = 0; i < s.projectiles.length; i++) {
              const p = s.projectiles[i];
              if (p.active) {
                const bossL = b.x - b.w / 2;
                const bossR = b.x + b.w / 2;
                const bossT = b.y - b.h / 2;
                const bossB = b.y + b.h / 2;

                if (p.x > bossL && p.x < bossR && p.y > bossT && p.y < bossB) {
                  // Plated damage!
                  b.health -= p.damage;
                  p.active = false;
                  
                  const hitPoints = Math.round(20 * (1 + (stats.radarAntennaLevel || 0) * 0.15) * config.multiplier);
                  s.score += hitPoints;
                  // Spark effects
                  for (let k = 0; k < 6; k++) {
                    spawnParticle(p.x, p.y, '#F59E0B');
                  }
                  playSound('bossHit');

                  // Defeated!
                  if (b.health <= 0) {
                    const killPoints = Math.round(150 * (1 + (stats.radarAntennaLevel || 0) * 0.15) * config.multiplier);
                    s.score += killPoints;
                    s.bossesSlayed++;
                    playSound('explosion');

                    // Major debris splash
                    for (let k = 0; k < 35; k++) {
                      spawnParticle(b.x, b.y, '#FFFF00');
                      spawnParticle(b.x, b.y, '#FF4500');
                    }

                  onAddNotification(`🏆 ПЕРЕМОГА: ЗНИЩЕНО "${b.name.toUpperCase()}"! +${killPoints} балів зафіксовано`, 'achievement');
                  
                  // Delete dead boss
                  s.bosses.splice(bIdx, 1);

                  // Update boss mode active when all bosses are fully dead!
                  if (s.bosses.length === 0) {
                    s.isBossActive = false;
                    s.screenShakeActive = true;
                    s.screenShakeEndTime = Date.now() + 600;
                  }
                }
                break;
              }
            }
          }

            // Collision check: player collides with boss directly
            const bLeft = b.x - b.w / 2 - 5;
            const bRight = b.x + b.w / 2 + 5;
            const bTop = b.y - b.h / 2 - 5;
            const bBottom = b.y + b.h / 2 + 5;
            if (180 + 30 > bLeft && 180 - 30 < bRight && s.rocketY + 16 > bTop && s.rocketY - 16 < bBottom) {
               handlePlayerDeath();
            }
          }
        }

        // Move boss bullets
        for (let i = 0; i < s.bossProjectiles.length; i++) {
          const bp = s.bossProjectiles[i];
          if (bp.active) {
            bp.x -= bp.speed;

            // Render boss bullets
            ctx.save();
            if (bp.isHeavy) {
              // Draw heavy fire charge with rotating safety line
              ctx.fillStyle = '#EF4444';
              ctx.shadowColor = '#FF0000';
              ctx.shadowBlur = 12 * flexScale;
              ctx.beginPath();
              ctx.arc(bp.x * flexScale, bp.y * flexScale, bp.r * flexScale, 0, Math.PI * 2);
              ctx.fill();
              
              // Core
              ctx.fillStyle = '#FFFFFF';
              ctx.beginPath();
              ctx.arc(bp.x * flexScale, bp.y * flexScale, (bp.r / 2) * flexScale, 0, Math.PI * 2);
              ctx.fill();
            } else {
              // Standard red plasma bullet with glowing core
              ctx.fillStyle = '#EF4444';
              ctx.beginPath();
              ctx.arc(bp.x * flexScale, bp.y * flexScale, bp.r * flexScale, 0, Math.PI * 2);
              ctx.fill();
              
              // Add yellow core
              ctx.fillStyle = '#FBBF24';
              ctx.beginPath();
              ctx.arc(bp.x * flexScale, bp.y * flexScale, (bp.r * 0.45) * flexScale, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();

            // Check hit
            const dx = bp.x - 180;
            const dy = bp.y - s.rocketY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bp.r + 20) {
              bp.active = false;
              handlePlayerDeath();
              continue;
            }

            if (bp.x < -20) {
              bp.active = false;
            }
          }
        }

        // Manage Kremlin obstacles
        for (let i = 0; i < s.kremlins.length; i++) {
          const k = s.kremlins[i];
          if (k.active) {
            k.x -= calculatedGameSpeed;

            // Drawing Kremlin
            ctx.save();
            const kX = k.x * flexScale;
            const kW = k.w * flexScale;
            const kH = k.h * flexScale;
            const kY = k.y * flexScale;

            const kType = k.type || 'spire';
          
          if (kType === 'spire') {
            // SPASSKAYA KREMLIN SPIRE (Red classic Kremlin)
            // Main brick base
            ctx.fillStyle = '#991B1B'; // Rich imperial red
            ctx.fillRect(kX - kW / 2, kY - kH / 2 + kH * 0.25, kW, kH * 0.75);

            // Archways/Gates cutouts
            ctx.fillStyle = '#111827'; // Dark inside gate
            ctx.fillRect(kX - kW * 0.15, kY + kH * 0.2, kW * 0.3, kH * 0.25);
            ctx.fillStyle = '#F3F4F6'; // White decorative arches
            ctx.fillRect(kX - kW * 0.35, kY - kH * 0.1, kW * 0.7, 6 * flexScale);

            // Symmetrical clock on the tower!
            ctx.fillStyle = '#111827'; // Black clockface
            ctx.beginPath();
            ctx.arc(kX, kY + kH * 0.05, kW * 0.22, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#F59E0B'; // Gold hands & border
            ctx.beginPath();
            ctx.arc(kX, kY + kH * 0.05, kW * 0.18, 0, Math.PI * 2);
            ctx.stroke();

            // Top spire deck
            ctx.fillStyle = '#7F1D1D';
            ctx.fillRect(kX - (kW * 0.7) / 2, kY - kH / 2, kW * 0.7, kH * 0.25);

            // Golden dome cone
            ctx.fillStyle = '#F59E0B';
            ctx.beginPath();
            ctx.moveTo(kX, kY - kH / 2 - 18 * flexScale);
            ctx.lineTo(kX - kW * 0.22, kY - kH / 2);
            ctx.lineTo(kX + kW * 0.22, kY - kH / 2);
            ctx.fill();

            // Red Kremlin Star above tip
            ctx.fillStyle = '#EF4444';
            ctx.beginPath();
            const starY = kY - kH / 2 - 25 * flexScale;
            const sz = 7 * flexScale;
            for (let sIdx = 0; sIdx < 5; sIdx++) {
              ctx.lineTo(
                kX + sz * Math.cos(((18 + sIdx * 72 - 90) * Math.PI) / 180),
                starY + sz * Math.sin(((18 + sIdx * 72 - 90) * Math.PI) / 180)
              );
            }
            ctx.closePath();
            ctx.fill();
            
          } else if (kType === 'telecom') {
            // OSTANKINO TELECOM TOWER (High gray concrete needle)
            // Concrete trunk
            ctx.fillStyle = '#4B5563'; // Concrete gray
            ctx.fillRect(kX - kW * 0.22, kY - kH / 2 + kH * 0.3, kW * 0.44, kH * 0.7);

            // Wide concrete base support
            ctx.fillStyle = '#374151';
            ctx.beginPath();
            ctx.moveTo(kX - kW * 0.22, kY + kH * 0.3);
            ctx.lineTo(kX - kW * 0.5, kY + kH * 0.5);
            ctx.lineTo(kX + kW * 0.5, kY + kH * 0.5);
            ctx.lineTo(kX + kW * 0.22, kY + kH * 0.3);
            ctx.fill();

            // Cylindrical observation ring deck
            ctx.fillStyle = '#1F2937';
            ctx.fillRect(kX - kW * 0.5, kY - kH * 0.1, kW, kH * 0.12);
            // Window cyan glow slits
            ctx.fillStyle = '#06B6D4';
            ctx.fillRect(kX - kW * 0.4, kY - kH * 0.08, kW * 0.8, 4 * flexScale);

            // Intermediate platform ring
            ctx.fillStyle = '#1F2937';
            ctx.fillRect(kX - kW * 0.35, kY - kH * 0.32, kW * 0.7, kH * 0.05);

            // Ultra thin upper metal spire antenna
            ctx.fillStyle = '#9CA3AF';
            ctx.fillRect(kX - 2 * flexScale, kY - kH / 2, 4 * flexScale, kH * 0.4);

            // Blinking red beacon warn light at antenna tip
            const isLit = (s.gameTime % 40) < 20;
            ctx.fillStyle = isLit ? '#EF4444' : '#7F1D1D';
            ctx.beginPath();
            ctx.arc(kX, kY - kH / 2, 6 * flexScale, 0, Math.PI * 2);
            ctx.fill();

          } else if (kType === 'lubyanka') {
            // LUBYANKA CITADEL (Dirty sandstone beige fortress)
            // Boxy mass
            ctx.fillStyle = '#D97706'; // Terracotta ochre brick
            ctx.fillRect(kX - kW / 2, kY - kH / 2, kW, kH);

            // Columns and borders
            ctx.fillStyle = '#B45309';
            ctx.fillRect(kX - kW * 0.45, kY - kH / 2, kW * 0.08, kH);
            ctx.fillRect(kX + kW * 0.37, kY - kH / 2, kW * 0.08, kH);
            ctx.fillRect(kX - kW / 2, kY - kH / 2, kW, 8 * flexScale);

            // Rows of prison cells windows
            ctx.fillStyle = '#111827';
            const cols = 4;
            const rows = 4;
            const winW = (kW * 0.5) / cols;
            const winH = (kH * 0.5) / rows;
            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < cols; c++) {
                ctx.fillRect(
                  kX - kW * 0.35 + c * (winW + kW * 0.08),
                  kY - kH * 0.3 + r * (winH + kH * 0.08),
                  winW,
                  winH
                );
              }
            }

            // Central heavy iron gates
            ctx.fillStyle = '#1F2937';
            ctx.fillRect(kX - kW * 0.18, kY + kH * 0.2, kW * 0.36, kH * 0.3);

            // USSR coat of arms yellow star on building top face
            ctx.fillStyle = '#EF4444';
            ctx.beginPath();
            ctx.arc(kX, kY - kH * 0.36, 10 * flexScale, 0, Math.PI * 2);
            ctx.fill();

          } else if (kType === 'skyscraper') {
            // GAZPROM / LAKHTA SCI-FI BLUE CYLINDER (Tower of corporate oligarchs)
            // Tapered glass prism
            ctx.fillStyle = '#0F172A'; // Dark obsidian base
            ctx.fillRect(kX - kW / 2, kY - kH / 2, kW, kH);

            // Sparkling sky-blue glass panels
            ctx.fillStyle = '#0284C7';
            ctx.beginPath();
            ctx.moveTo(kX - kW * 0.4, kY + kH / 2);
            ctx.lineTo(kX - kW * 0.05, kY - kH / 2);
            ctx.lineTo(kX + kW * 0.05, kY - kH / 2);
            ctx.lineTo(kX + kW * 0.4, kY + kH / 2);
            ctx.fill();

            // Diagonal high-reflective neon corporate stripes
            ctx.strokeStyle = '#38BDF8';
            ctx.lineWidth = 2 * flexScale;
            ctx.beginPath();
            ctx.moveTo(kX - kW * 0.3, kY + kH * 0.3);
            ctx.lineTo(kX + kW * 0.2, kY - kH * 0.2);
            ctx.moveTo(kX - kW * 0.2, kY + kH * 0.4);
            ctx.lineTo(kX + kW * 0.3, kY - kH * 0.1);
            ctx.stroke();

            // Gazprom peak logo circle
            ctx.fillStyle = '#0EA5E9';
            ctx.shadowColor = '#0EA5E9';
            ctx.shadowBlur = 12 * flexScale;
            ctx.beginPath();
            ctx.arc(kX, kY - kH * 0.38, 8 * flexScale, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

          } else if (kType === 'bunker') {
            // STEPPED GRANITE MAUSOLEUM FORTRESS
            // Bottom step
            ctx.fillStyle = '#1F2937'; // Dark granite block
            ctx.fillRect(kX - kW / 2, kY + kH * 0.1, kW, kH * 0.4);

            // Middle step
            ctx.fillStyle = '#7F1D1D'; // Maroon red granite
            ctx.fillRect(kX - kW * 0.38, kY - kH * 0.2, kW * 0.76, kH * 0.3);

            // Top cube
            ctx.fillStyle = '#450A0A'; // Blackened crimson brick
            ctx.fillRect(kX - kW * 0.22, kY - kH * 0.5, kW * 0.44, kH * 0.3);

            // Cold bronze emblem (Hammer & sickle representation)
            ctx.fillStyle = '#FBBF24';
            ctx.fillRect(kX - kW * 0.08, kY - kH * 0.12, kW * 0.16, 4 * flexScale);
            ctx.fillRect(kX - 2 * flexScale, kY - kH * 0.16, 4 * flexScale, 10 * flexScale);
          }

          ctx.restore();

          // Bullet hits Kremlin checks
          let kremlinDestroyed = false;
          for (let j = 0; j < s.projectiles.length; j++) {
            const p = s.projectiles[j];
            if (p.active) {
              const kL = k.x - k.w / 2;
              const kR = k.x + k.w / 2;
              const kT = k.y - k.h / 2 - 20;
              const kB = k.y + k.h / 2;

              if (p.x > kL && p.x < kR && p.y > kT && p.y < kB) {
                p.active = false;
                k.active = false;
                s.kremlinsSlayed++;
                
                const pointsEarned = Math.round(15 * (1 + (stats.radarAntennaLevel || 0) * 0.15) * config.multiplier);
                s.score += pointsEarned;

                // Debris splatter particles
                for (let d = 0; d < 12; d++) {
                  spawnParticle(p.x, p.y, '#EF4444');
                  spawnParticle(p.x, p.y, '#FBBF24');
                }
                playSound('explosion');

                // Season transitions dynamically triggered
                const nextSeasonIdx = Math.floor(s.score / 600) % SEASONS.length;
                if (nextSeasonIdx !== s.currentSeasonIdx) {
                  s.currentSeasonIdx = nextSeasonIdx;
                  onAddNotification(`СЕКТОР ЗАЧИЩЕНО! ЛАСКАВО ПРОСИМО ДО СЕКТОРА "${SEASONS[nextSeasonIdx].name}"`, 'season');
                }
                kremlinDestroyed = true;
                break;
              }
            }
          }

          if (kremlinDestroyed) {
            continue; // Avoid player crash check and duplicate clean off-screen splice for this already-spliced kremlin!
          }

          // Player hits Kremlin check (Deadwards!)
          const rX = 180;
          const rY = s.rocketY;
          const kLeft = k.x - k.w / 2;
          const kRight = k.x + k.w / 2;
          const kTop = k.y - k.h / 2 - 20;
          const kBottom = k.y + k.h / 2;

          if (rX + 22 > kLeft && rX - 30 < kRight && rY + 14 > kTop && rY - 14 < kBottom) {
            handlePlayerDeath();
            break;
          }

          // Clean off-screen spires
          if (k.x < -80) {
            k.active = false;
          }
          }
        }
      }

      // ---------------- RENDER COSMETIC FIGHTER ----------------

      const isInvul = Date.now() < s.invulnerableEndTime;
      const shouldFlickerHide = isInvul && Math.floor(s.gameTime / 4) % 2 === 0;

      if (!shouldFlickerHide) {
        // Draw exhaust flame first
        ctx.save();
        const rY = s.rocketY;
        const flSz = s.isAccelerating ? 55 : 35;
        const flameGrad = ctx.createLinearGradient((180 - 45) * flexScale, rY * flexScale, (180 - 45 - flSz) * flexScale, rY * flexScale);
        flameGrad.addColorStop(0, skinRef.current.flameColor);
        flameGrad.addColorStop(0.5, '#F59E0B');
        flameGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = flameGrad;
        ctx.shadowColor = skinRef.current.flameColor;
        ctx.shadowBlur = s.isAccelerating ? 15 * flexScale : 4 * flexScale;
        ctx.beginPath();
        ctx.moveTo((180 - 32) * flexScale, (rY - 10) * flexScale);
        ctx.lineTo((180 - 32) * flexScale, (rY + 10) * flexScale);
        ctx.lineTo((180 - 32 - flSz - Math.random() * 12) * flexScale, rY * flexScale);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore(); // Balance the exhaust flame ctx.save()

        // Draw Main ship chassis hull
        ctx.fillStyle = skinRef.current.bodyColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo((180 + 35) * flexScale, rY * flexScale); // Nose cone
        ctx.lineTo((180 - 32) * flexScale, (rY - 15) * flexScale); // Wing top
        ctx.lineTo((180 - 20) * flexScale, (rY - 4) * flexScale); // Fuselage mid
        ctx.lineTo((180 - 32) * flexScale, (rY + 15) * flexScale); // Wing bottom
        ctx.closePath();
        ctx.fill();

        // Cockpit window glow
        ctx.fillStyle = '#06B6D4';
        ctx.beginPath();
        ctx.moveTo((180 + 15) * flexScale, rY * flexScale);
        ctx.lineTo((180 + 2) * flexScale, (rY - 5) * flexScale);
        ctx.lineTo((180 - 3) * flexScale, rY * flexScale);
        ctx.closePath();
        ctx.fill();

        // Satellite Mini Guns rendering
        if (s.miniRocketsActive) {
          ctx.fillStyle = skinRef.current.miniRocketColor;
          ctx.fillRect((180 - 15) * flexScale, (rY - 26) * flexScale, 20 * flexScale, 6 * flexScale);
          ctx.fillRect((180 - 15) * flexScale, (rY + 20) * flexScale, 20 * flexScale, 6 * flexScale);
        }
      }

      const rY = s.rocketY;

      // Draw Donation Combat Aura if donationsCredits is high!
      const donationT = stats.donationsCredits || 0;
      if (donationT >= 500) {
        ctx.save();
        let auraColor = '#EC4899'; // magenta
        let shadowColor = '#F472B6';
        if (donationT >= 50000) {
          // Rainbow
          const hue = (s.gameTime * 2.5) % 360;
          auraColor = `hsla(${hue}, 90%, 65%, 0.85)`;
          shadowColor = `hsla(${hue}, 90%, 65%, 1)`;
        } else if (donationT >= 10000) {
          // Gold
          auraColor = 'rgba(245, 158, 11, 0.8)';
          shadowColor = '#FBBF24';
        } else if (donationT >= 2000) {
          // Cyan
          auraColor = 'rgba(6, 182, 212, 0.8)';
          shadowColor = '#22D3EE';
        }

        ctx.strokeStyle = auraColor;
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = (8 + Math.sin(s.gameTime * 0.2) * 5) * flexScale;
        ctx.lineWidth = 1.8 * flexScale;
        
        ctx.beginPath();
        ctx.ellipse(180 * flexScale, rY * flexScale, 30 * flexScale, 20 * flexScale, (s.gameTime * 0.03), 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(180 * flexScale, rY * flexScale, 20 * flexScale, 30 * flexScale, -(s.gameTime * 0.03), 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      }

      // Draw Glowing Shield Aura if pilot has shield charges left
      if (s.shieldChargesLeft > 0) {
        ctx.strokeStyle = '#10B981';
        ctx.shadowColor = '#10B981';
        ctx.shadowBlur = (10 + Math.sin(s.gameTime * 0.15) * 4) * flexScale;
        ctx.lineWidth = 2 * flexScale;
        ctx.beginPath();
        ctx.arc(180 * flexScale, rY * flexScale, 45 * flexScale, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(16, 185, 129, 0.05)';
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.restore();

      // Synchronize in-game DOM HUD details without taxing React reconciliation tree at 60fps
      const scoreDom = document.getElementById('hud-score-val');
      if (scoreDom) scoreDom.textContent = String(s.score);
      const seasonDom = document.getElementById('hud-season-val');
      if (seasonDom) seasonDom.textContent = SEASONS[s.currentSeasonIdx].name;
      const shieldDom = document.getElementById('hud-shield-val');
      if (shieldDom) {
        shieldDom.textContent = `${s.shieldChargesLeft} / ${s.maxShieldCharges}`;
      }

      // Force virtual controls to redraw cooldown countdowns gracefully at ~6fps
      if ((s.isAccelerating || Date.now() < s.boostCooldownEndTime) && s.gameTime % 10 === 0) {
        setBoostCooldownTick((prev) => prev + 1);
      }

      // Standardize game loops
      if (s.gameState === 'playing' || s.gameState === 'paused') {
        animId = requestAnimationFrame(frame);
      }
    };

    const handlePlayerDeath = () => {
      // Check invulnerability phase (i-frames)
      if (Date.now() < s.invulnerableEndTime) {
        return; // Currently invulnerable from a previous hit
      }

      // Check Deflector Shield Core charge availability
      if (s.shieldChargesLeft > 0) {
        s.shieldChargesLeft--;
        s.invulnerableEndTime = Date.now() + 1500; // 1.5s invulnerability window
        s.screenShakeActive = true;
        s.screenShakeEndTime = Date.now() + 400; // brief impact vibration
        playSound('bossHit'); // shield deflect sound
        onAddNotification(`🛡️ ДЕФЛЕКТОРНИЙ ЩИТ КУПІРУВАВ ЗІТКНЕННЯ! (Залишилось зарядів: ${s.shieldChargesLeft})`, 'powerup');
        
        // Push a circular blast of shield energy particles
        for (let k = 0; k < 20; k++) {
          spawnParticle(180, s.rocketY, '#10B981'); // emerald green shockwave
        }
        return; // Survives!!
      }

      s.gameState = 'gameOver';
      setGameState('gameOver');
      playSound('gameover');

      // Blow cockpit to absolute shreds
      for (let k = 0; k < 45; k++) {
        spawnParticle(180, s.rocketY, skinRef.current.bodyColor);
        spawnParticle(180, s.rocketY, '#FF6347');
      }

      onGameFinished(s.score, s.bossesSlayed, s.kremlinsSlayed, s.boostsPerformed);
    };

    // Begin looping
    animId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [gameState, soundEnabled, setGameState, isTheaterMode, difficulty]);

  // Restart trigger
  const handleRestart = () => {
    const s = stateRef.current;
    s.score = 0;
    s.gameTime = 0;
    s.bossesSlayed = 0;
    s.kremlinsSlayed = 0;
    s.boostsPerformed = 0;
    s.isBossActive = false;
    s.bosses = [];
    s.nextBossSpawnScore = 3000;
    s.maxShieldCharges = (stats.shieldCoreLevel || 0) + (stats.starterShieldActive ? 1 : 0);
    s.shieldChargesLeft = (stats.shieldCoreLevel || 0) + (stats.starterShieldActive ? 1 : 0);
    s.boostDuration = 6000 + (stats.thrustCoreLevel || 0) * 1500;
    s.cooldownPeriod = 5000 - (stats.thrustCoreLevel || 0) * 1000;
    s.kremlins.forEach((k: any) => { k.active = false; });
    s.projectiles.forEach((p: any) => { p.active = false; });
    s.bossProjectiles.forEach((bp: any) => { bp.active = false; });
    s.powerUpStars = [];
    s.particles.forEach((p: any) => { p.active = false; });
    s.miniRocketsActive = false;
    s.isAccelerating = false;
    s.rocketBaseY = BASE_HEIGHT / 2;
    s.startTimeMs = Date.now();

    // Wave resets
    s.waveTimer = 0;
    s.waveActive = false;
    s.waveSpawnCount = 0;
    s.waveSpawnMax = 0;
    s.waveNextSpawnTimer = 0;
    s.kremlinSpawnTimer = 0;

    setGameState('playing');
  };

  const currentBoostCooldowned = Date.now() < stateRef.current.boostCooldownEndTime;
  const currentCooldownLeft = Math.ceil((stateRef.current.boostCooldownEndTime - Date.now()) / 1000);

  return (
    <div
      ref={containerRef}
      className={
        isTheaterMode
          ? "fixed inset-0 z-50 w-screen h-screen bg-black flex items-center justify-center font-sans overflow-hidden"
          : "relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-[0_10px_40px_rgba(0,0,0,0.6)] flex items-center justify-center font-sans"
      }
      id="game-canvas-area"
    >
      <canvas
        ref={canvasRef}
        className={isTheaterMode ? "block shadow-inner" : "block w-full h-full rounded-2xl shadow-inner"}
        style={isTheaterMode ? { width: 'auto', height: 'auto', maxWidth: '100vw', maxHeight: '100vh', aspectRatio: '16/9' } : undefined}
        id="game-canvas"
      />

      {/* Floating HUD controls on upper canvas */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <button
          onClick={handleToggleFullscreen}
          className="p-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50 transition cursor-pointer flex items-center justify-center"
          title={isTheaterMode ? "Згорнути на весь екран" : "Розгорнути на весь екран"}
          id="fullscreen-toggle-btn"
        >
          {isTheaterMode ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50 transition cursor-pointer"
          title="Ввімкнути/Вимкнути звук"
          id="sound-toggle-btn"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {gameState === 'playing' ? (
          <button
            onClick={() => setGameState('paused')}
            className="px-3 py-1 text-xs font-mono font-bold uppercase rounded-lg bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50 transition flex items-center gap-1 cursor-pointer"
            id="pause-game-btn"
          >
            <Pause className="w-3.5 h-3.5" />
            Пауза
          </button>
        ) : gameState === 'paused' ? (
          <button
            onClick={() => setGameState('playing')}
            className="px-3 py-1 text-xs font-mono font-bold uppercase rounded-lg bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50 transition flex items-center gap-1 cursor-pointer"
            id="resume-game-btn"
          >
            <Play className="w-3.5 h-3.5" />
            Продовжити
          </button>
        ) : null}
      </div>

      {/* Floating Stats on HUD */}
      {gameState === 'playing' && (
        <div className="absolute bottom-4 left-4 z-20 pointer-events-none font-mono">
          <div className="flex gap-4 bg-slate-955/85 border border-slate-800/80 px-4 py-2 rounded-xl backdrop-blur-sm shadow-md">
            <div>
              <p className="text-[10px] uppercase text-slate-400/80 tracking-wide font-extrabold font-sans">Бойові бали</p>
              <p className="text-xl font-bold text-cyan-400" id="hud-score-val">{stateRef.current.score}</p>
            </div>
            <div className="border-l border-slate-800/80 pl-4">
              <p className="text-[10px] uppercase text-slate-400/80 tracking-wide font-extrabold font-sans">Сектор загрози</p>
              <p className="text-sm font-bold text-slate-200 mt-1 uppercase" id="hud-season-val">
                {SEASONS[stateRef.current.currentSeasonIdx].name}
              </p>
            </div>
            {stateRef.current.maxShieldCharges > 0 && (
              <div className="border-l border-slate-800/80 pl-4 flex flex-col justify-center">
                <p className="text-[10px] uppercase text-slate-400/80 tracking-wide font-extrabold font-sans">Дефлектор</p>
                <p className="text-sm font-bold text-emerald-400 mt-1 uppercase flex items-center gap-1.5 font-mono">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span id="hud-shield-val">{stateRef.current.shieldChargesLeft} / {stateRef.current.maxShieldCharges}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Persistent Mobile Gamepad Overlays (Always sit safely on top in both Theater/Fullscreen and standard viewports) */}
      {gameState === 'playing' && (
        <VirtualControls
          onDirectionPress={(dir) => {
            const verticalVelocity = BASE_HEIGHT * 0.013;
            if (dir === 'up') {
              stateRef.current.dyInput = -verticalVelocity;
            } else if (dir === 'down') {
              stateRef.current.dyInput = verticalVelocity;
            } else {
              stateRef.current.dyInput = 0;
            }
          }}
          onShoot={triggerWeaponFire}
          onBoost={triggerEngineBoost}
          boostAvailable={true}
          boostCooldowned={currentBoostCooldowned}
          cooldownLeft={currentCooldownLeft}
        />
      )}

      {/* Start screen layout overlay */}
      {gameState === 'start' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-slate-955/75 backdrop-blur-sm text-center">
          <div className="max-w-md bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-cyan-950/50 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Zap className="w-8 h-8 animate-pulse" />
            </div>

            <h1 className="text-2xl font-black font-sans text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 tracking-wide">
              КОСМІЧНИЙ ВИНИЩУВАЧ
            </h1>

            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Здійсніть виліт проти стародавніх кремлівських споруд у глибинах неонового космосу. Накопичуйте боєприпаси, викликайте орбітальних дронів та знищуйте ворожих лідерів сектора!
            </p>

            {/* Difficulty selection section */}
            <div className="w-full flex flex-col gap-2 my-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono text-left">
                Рівень Складності:
              </span>
              <div className="grid grid-cols-3 gap-2 w-full">
                {(['easy', 'medium', 'hard'] as const).map((d) => {
                  const cfg = DIFFICULTY_CONFIGS[d];
                  const isActive = difficulty === d;
                  return (
                    <button
                      key={d}
                      onClick={() => handleSelectDifficulty(d)}
                      className={`text-xs font-semibold py-2 px-1 rounded-lg border transition-all cursor-pointer ${
                        isActive
                          ? cfg.activeColor
                          : `${cfg.color} hover:border-slate-600`
                      }`}
                      id={`diff-select-${d}`}
                    >
                      <div className="font-extrabold text-[11px]">{cfg.label.split(' ')[0]}</div>
                      <div className="text-[9px] opacity-80 mt-0.5">x{cfg.multiplier} очки</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => setGameState('playing')}
              className="w-full bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl transition shadow-[0_4px_20px_rgba(34,211,238,0.25)] flex items-center justify-center gap-2 cursor-pointer"
              id="start-match-btn"
            >
              <Play className="w-4.5 h-4.5 text-slate-950 fill-slate-950" />
              Розпочати Виліт
            </button>
          </div>
        </div>
      )}

      {/* Pause menu overlay */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-64 flex flex-col gap-3 text-center shadow-2xl">
            <h2 className="text-lg font-bold text-slate-200">Політ призупинено</h2>
            <p className="text-xs text-slate-400">Траєкторія гармат та фізичні обчислення на паузі.</p>
            <button
              onClick={() => setGameState('playing')}
              className="w-full bg-cyan-400 hover:bg-cyan-500 text-slate-950 font-bold py-2 rounded-xl transition cursor-pointer"
            >
              Продовжити політ
            </button>
            <button
              onClick={handleRestart}
              className="w-full border border-slate-700 text-slate-350 hover:bg-slate-800 py-2 rounded-xl text-xs transition cursor-pointer"
            >
              Скинути матч
            </button>
          </div>
        </div>
      )}

      {/* Game Over screen overlay */}
      {gameState === 'gameOver' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-slate-950/85 backdrop-blur-md text-center">
          <div className="max-w-sm bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center gap-4 shadow-3xl">
            <div className="w-12 h-12 rounded-full bg-red-950/40 border border-red-500/30 flex items-center justify-center text-red-500">
              <ShieldAlert className="w-6 h-6 animate-bounce" />
            </div>

            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-red-500">Корпус Знищено!</h2>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Політ завершено. Бортові системи критично пошкоджені внаслідок лобового зіткнення.
              </p>
            </div>

            <div className="w-full bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 grid grid-cols-2 gap-4 font-mono text-center">
              <div>
                <p className="text-[10px] text-slate-400/80 font-bold uppercase font-sans">Бойові бали</p>
                <p className="text-lg font-black text-cyan-400">{stateRef.current.score}</p>
              </div>
              <div className="border-l border-slate-800/65">
                <p className="text-[10px] text-slate-400/80 font-bold uppercase font-sans">Знищено босів</p>
                <p className="text-lg font-black text-rose-400">{stateRef.current.bossesSlayed}</p>
              </div>
            </div>

            <button
              onClick={handleRestart}
              className="w-full bg-cyan-400 hover:bg-cyan-500 text-slate-950 font-bold px-6 py-2.5 rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              id="retry-sortie-btn"
            >
              <RotateCcw className="w-4 h-4" />
              Здійснити новий виліт
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

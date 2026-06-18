/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { PlayerStats, RocketSkin, ROCKET_SKINS, SEASONS, COSMIC_WEAPONS } from '../types';
import { Play, Pause, RotateCcw, Volume2, VolumeX, ShieldAlert, Zap, Maximize, Minimize } from 'lucide-react';

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

// Particle class for explosion effects
class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 5 + 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = Math.random() * 3 + 1.5;
    this.color = color;
    this.alpha = 1;
    this.decay = Math.random() * 0.02 + 0.015;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.decay;
  }

  draw(ctx: CanvasRenderingContext2D, flexScale: number) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x * flexScale, this.y * flexScale, this.radius * flexScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

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
    bossesSlayed: 0,
    kremlinsSlayed: 0,
    boostsPerformed: 0,

    // Spawning metrics
    kremlinSpawnTimer: 0,
    powerUpSpawnTimer: 0,

    // Boost attributes
    isAccelerating: false,
    accelerationEndTime: 0,
    boostCooldownEndTime: 0,
    cooldownPeriod: 5000,
    boostDuration: 6000,

    // Navigation inputs
    dyInput: 0,

    // Entities lists
    stars: [] as Array<{ x: number; y: number; r: number; speed: number; color: string }>,
    projectiles: [] as any[],
    bossProjectiles: [] as any[],
    kremlins: [] as any[],
    powerUpStars: [] as any[],
    particles: [] as Particle[],

    // Boss attributes
    isBossActive: false,
    boss: null as any,
    nextBossSpawnScore: 1000,
    bossInterval: 1000,

    // Upgraded Pilot Inventory attributes
    shieldChargesLeft: 0,
    maxShieldCharges: 0,
    invulnerableEndTime: 0,
  });

  const skinRef = useRef<RocketSkin>(ROCKET_SKINS[0]);

  // Audio synths for zero-dependency sounds
  const playSound = (type: 'shoot' | 'explosion' | 'star' | 'bossSpawn' | 'bossHit' | 'gameover' | 'boost') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
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

    const miniOffsetTop = 15;
    const miniOffsetBottom = -15;

    // Upgrades modifiers
    const energyLvl = stats.energyCoreLevel || 0;
    const pSpeed = 12.5 + energyLvl * 1.5;
    const pDamage = 1 + energyLvl * 0.2;
    const pWidth = 16 + (energyLvl >= 2 ? 6 : 0);

    // Get active weapon's color
    const activeWeapon = COSMIC_WEAPONS.find((w) => w.id === (stats.selectedWeaponId || 'laser_alpha')) || COSMIC_WEAPONS[0];
    const weaponColor = activeWeapon.projectileColor;

    if (energyLvl >= 3) {
      // Dual parallel streams!
      s.projectiles.push({
        x: 180 + 35,
        y: (s.rocketY || BASE_HEIGHT / 2) - 8,
        w: pWidth,
        h: 6,
        speed: pSpeed,
        damage: pDamage,
        color: weaponColor,
      });
      s.projectiles.push({
        x: 180 + 35,
        y: (s.rocketY || BASE_HEIGHT / 2) + 8,
        w: pWidth,
        h: 6,
        speed: pSpeed,
        damage: pDamage,
        color: weaponColor,
      });
    } else {
      // Standard projectile
      s.projectiles.push({
        x: 180 + 35,
        y: s.rocketY || BASE_HEIGHT / 2,
        w: pWidth,
        h: 6,
        speed: pSpeed,
        damage: pDamage,
        color: weaponColor,
      });
    }

    // Spawn satellite weapons if power-up is ticking
    if (s.miniRocketsActive) {
      s.projectiles.push({
        x: 180 + 20,
        y: (s.rocketY || BASE_HEIGHT / 2) + miniOffsetTop,
        w: 10,
        h: 4,
        speed: pSpeed + 1,
        damage: 1,
        color: weaponColor,
      });

      s.projectiles.push({
        x: 180 + 20,
        y: (s.rocketY || BASE_HEIGHT / 2) + miniOffsetBottom,
        w: 10,
        h: 4,
        speed: pSpeed + 1,
        damage: 1,
        color: weaponColor,
      });
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
          setGameState('playing');
        }
        return;
      }

      const vertVelocity = BASE_HEIGHT * 0.013;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        s.dyInput = -vertVelocity;
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        s.dyInput = vertVelocity;
      }
      if (e.key === ' ') {
        triggerWeaponFire();
      }
      if (e.key === 'x' || e.key === 'X' || e.key === 'Shift') {
        triggerEngineBoost();
      }
      if (e.key === 'p' || e.key === 'P') {
        setGameState('paused');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
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

    // Sync upgrades initially
    s.maxShieldCharges = stats.shieldCoreLevel || 0;
    // Keep current charge context intact or recharge if starting playing state
    if (s.gameState === 'start' || s.gameState === 'playing' && s.gameTime === 0) {
      s.shieldChargesLeft = stats.shieldCoreLevel || 0;
    }
    s.boostDuration = 6000 + (stats.thrustCoreLevel || 0) * 1500;
    s.cooldownPeriod = 5000 - (stats.thrustCoreLevel || 0) * 1000;

    // Seed background elements initially
    const activeSeason = SEASONS[s.currentSeasonIdx];
    s.stars = [];
    for (let i = 0; i < activeSeason.starCount; i++) {
      s.stars.push({
        x: Math.random() * BASE_WIDTH,
        y: Math.random() * BASE_HEIGHT,
        r: Math.random() * 2 + 0.4,
        speed: Math.random() * 0.6 + 0.15,
        color: activeSeason.starColor,
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
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(star.x * flexScale, star.y * flexScale, star.r * flexScale, 0, Math.PI * 2);
        ctx.fill();
      });

      // Render glowing particle debris explosions (pure aesthetic enhancement!)
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.update();
        if (p.alpha <= 0) {
          s.particles.splice(i, 1);
        } else {
          p.draw(ctx, flexScale);
        }
      }

      if (s.gameState === 'playing') {
        s.gameTime++;

        // Decay boost timer if active
        if (s.isAccelerating && Date.now() > s.accelerationEndTime) {
          s.isAccelerating = false;
          onAddNotification('Увага: Форсаж почав перезаряджання...', 'info');
        }

        // Apply input physics with oscillation mechanics
        const amplitude = BASE_HEIGHT * 0.08;
        const frequency = 0.038;
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

        // Spawning timer updates
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
          
          s.kremlins.push({
            x: BASE_WIDTH + 80,
            y: Math.random() * (BASE_HEIGHT - dynamicHeight) + dynamicHeight / 2,
            w: dynamicWidth,
            h: dynamicHeight,
            type: chosenType,
          });
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
        for (let i = s.projectiles.length - 1; i >= 0; i--) {
          const p = s.projectiles[i];
          p.x += p.speed;

          // Out of screen delete
          if (p.x > BASE_WIDTH + 50) {
            s.projectiles.splice(i, 1);
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
            
            const pointsEarned = Math.round(80 * (1 + (stats.radarAntennaLevel || 0) * 0.15));
            s.score += pointsEarned;
            playSound('star');
            onAddNotification(`+${pointsEarned} БАЛІВ! ЗОЛОТИЙ ДРОН АКТИВОВАНИЙ!`, 'powerup');

            // Spawn sparkly gold particles
            for (let k = 0; k < 15; k++) {
              s.particles.push(new Particle(star.x, star.y, '#FFD700'));
            }
          } else if (star.x < -30) {
            s.powerUpStars.splice(i, 1);
          }
        }

        // ---------------- BOSS ENGAGEMENTS ----------------
        if (!s.isBossActive && s.score >= s.nextBossSpawnScore) {
          s.isBossActive = true;
          // Set dynamic next spawn threshold that is strictly greater than the current score!
          s.nextBossSpawnScore = Math.floor(s.score / 1000) * 1000 + 1000;
          s.screenShakeActive = true;
          s.screenShakeEndTime = Date.now() + 7000; // Drone shakes
          playSound('bossSpawn');
          onAddNotification('⚠️ НЕЗДОЛАННИЙ ЛІДЕР СЕКТОРА НАБЛИЖАЄТЬСЯ!', 'boss');

          s.boss = {
            x: BASE_WIDTH - 150,
            y: BASE_HEIGHT / 2,
            w: 120,
            h: 190,
            health: 22 + s.bossesSlayed * 6,
            maxHealth: 22 + s.bossesSlayed * 6,
            dir: 1,
            shootTimer: 0,
            speed: 2.2,
          };
        }

        if (s.isBossActive && s.boss) {
          const b = s.boss;
          // Hover movement mechanics
          b.y += b.speed * b.dir;
          if (b.y > BASE_HEIGHT - 130 || b.y < 130) {
            b.dir *= -1;
          }

          // Shoots projectile
          b.shootTimer++;
          const bossLimit = Math.max(90, 160 - s.bossesSlayed * 15);
          if (b.shootTimer >= bossLimit) {
            b.shootTimer = 0;
            s.bossProjectiles.push({
              x: b.x - 45,
              y: b.y,
              r: 12,
              speed: 7.2,
            });
            playSound('shoot');
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
          const ratio = b.health / b.maxHealth;
          ctx.fillStyle = ratio > 0.55 ? '#10B981' : ratio > 0.25 ? '#F59E0B' : '#EF4444';
          ctx.fillRect(hbX, hbY, hbW * ratio, hbH);
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 0.5 * flexScale;
          ctx.strokeRect(hbX, hbY, hbW, hbH);

          // Head (Helmet)
          ctx.fillStyle = '#556B2F'; // Uniform green
          ctx.beginPath();
          ctx.arc(b.x * flexScale, (b.y - 60) * flexScale, 24 * flexScale, 0, Math.PI * 2);
          ctx.fill();

          // Star badge on helmet
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

          // Body
          ctx.fillStyle = '#3F4E2E';
          ctx.fillRect(
            (b.x - 40) * flexScale,
            (b.y - 36) * flexScale,
            80 * flexScale,
            85 * flexScale
          );

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

          ctx.restore();

          // Collision check: player bullets hit Boss
          for (let i = s.projectiles.length - 1; i >= 0; i--) {
            if (!s.boss) break;
            const p = s.projectiles[i];
            const bossL = b.x - 40;
            const bossR = b.x + 40;
            const bossT = b.y - b.h / 2;
            const bossB = b.y + b.h / 2;

            if (p.x > bossL && p.x < bossR && p.y > bossT && p.y < bossB) {
              // Plated damage!
              b.health -= p.damage;
              s.projectiles.splice(i, 1);
              
              const hitPoints = Math.round(20 * (1 + (stats.radarAntennaLevel || 0) * 0.15));
              s.score += hitPoints;
              // Spark effects
              for (let k = 0; k < 6; k++) {
                s.particles.push(new Particle(p.x, p.y, '#F59E0B'));
              }
              playSound('bossHit');

              // Defeated!
              if (b.health <= 0) {
                const killPoints = Math.round(100 * (1 + (stats.radarAntennaLevel || 0) * 0.15));
                s.score += killPoints;
                s.bossesSlayed++;
                playSound('explosion');

                // Major debris splash
                for (let k = 0; k < 35; k++) {
                  s.particles.push(new Particle(b.x, b.y, '#FFFF00'));
                  s.particles.push(new Particle(b.x, b.y, '#FF4500'));
                }

                s.isBossActive = false;
                s.boss = null;
                onAddNotification(`🏆 ПЕРЕМОГА НАД БОСОМ! +${killPoints} балів зафіксовано`, 'achievement');
                s.screenShakeActive = true;
                s.screenShakeEndTime = Date.now() + 600;
              }
              break;
            }
          }

          // Collision check: player collides with boss directly
          const bLeft = b.x - 45;
          const bRight = b.x + 45;
          const bTop = b.y - b.h / 2;
          const bBottom = b.y + b.h/2;
          if (180 + 30 > bLeft && 180 - 30 < bRight && s.rocketY + 16 > bTop && s.rocketY - 16 < bBottom) {
             handlePlayerDeath();
          }
        }

        // Move boss bullets
        for (let i = s.bossProjectiles.length - 1; i >= 0; i--) {
          const bp = s.bossProjectiles[i];
          bp.x -= bp.speed;

          // Render boss bullets
          ctx.fillStyle = '#EF4444';
          ctx.beginPath();
          ctx.arc(bp.x * flexScale, bp.y * flexScale, bp.r * flexScale, 0, Math.PI * 2);
          ctx.fill();

          // Check hit
          const dx = bp.x - 180;
          const dy = bp.y - s.rocketY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < bp.r + 20) {
            handlePlayerDeath();
            break;
          }

          if (bp.x < -20) {
            s.bossProjectiles.splice(i, 1);
          }
        }

        // Manage Kremlin obstacles
        for (let i = s.kremlins.length - 1; i >= 0; i--) {
          const k = s.kremlins[i];
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
          for (let j = s.projectiles.length - 1; j >= 0; j--) {
            const p = s.projectiles[j];
            const kL = k.x - k.w / 2;
            const kR = k.x + k.w / 2;
            const kT = k.y - k.h / 2 - 20;
            const kB = k.y + k.h / 2;

            if (p.x > kL && p.x < kR && p.y > kT && p.y < kB) {
              s.projectiles.splice(j, 1);
              s.kremlins.splice(i, 1);
              s.kremlinsSlayed++;
              
              const pointsEarned = Math.round(15 * (1 + (stats.radarAntennaLevel || 0) * 0.15));
              s.score += pointsEarned;

              // Debris splatter particles
              for (let d = 0; d < 12; d++) {
                s.particles.push(new Particle(p.x, p.y, '#EF4444'));
                s.particles.push(new Particle(p.x, p.y, '#FBBF24'));
              }
              playSound('explosion');

              // Season transitions dynamically triggered
              const nextSeasonIdx = Math.floor(s.score / 600) % SEASONS.length;
              if (nextSeasonIdx !== s.currentSeasonIdx) {
                s.currentSeasonIdx = nextSeasonIdx;
                onAddNotification(`СЕКТОР ЗАЧИЩЕНО! ЛАСКАВО ПРОСИМО ДО СЕКТОРА "${SEASONS[nextSeasonIdx].name}"`, 'season');
              }
              break;
            }
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
            s.kremlins.splice(i, 1);
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
          s.particles.push(new Particle(180, s.rocketY, '#10B981')); // emerald green shockwave
        }
        return; // Survives!!
      }

      s.gameState = 'gameOver';
      setGameState('gameOver');
      playSound('gameover');

      // Blow cockpit to absolute shreds
      for (let k = 0; k < 45; k++) {
        s.particles.push(new Particle(180, s.rocketY, skinRef.current.bodyColor));
        s.particles.push(new Particle(180, s.rocketY, '#FF6347'));
      }

      onGameFinished(s.score, s.bossesSlayed, s.kremlinsSlayed, s.boostsPerformed);
    };

    // Begin looping
    animId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [gameState, soundEnabled, setGameState, isTheaterMode]);

  // Restart trigger
  const handleRestart = () => {
    const s = stateRef.current;
    s.score = 0;
    s.gameTime = 0;
    s.bossesSlayed = 0;
    s.kremlinsSlayed = 0;
    s.boostsPerformed = 0;
    s.isBossActive = false;
    s.boss = null;
    s.nextBossSpawnScore = 1000;
    s.maxShieldCharges = stats.shieldCoreLevel || 0;
    s.shieldChargesLeft = stats.shieldCoreLevel || 0;
    s.boostDuration = 6000 + (stats.thrustCoreLevel || 0) * 1500;
    s.cooldownPeriod = 5000 - (stats.thrustCoreLevel || 0) * 1000;
    s.kremlins = [];
    s.projectiles = [];
    s.bossProjectiles = [];
    s.powerUpStars = [];
    s.particles = [];
    s.miniRocketsActive = false;
    s.isAccelerating = false;
    s.rocketBaseY = BASE_HEIGHT / 2;
    s.startTimeMs = Date.now();
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
              <p className="text-xl font-bold text-cyan-400">{stateRef.current.score}</p>
            </div>
            <div className="border-l border-slate-800/80 pl-4">
              <p className="text-[10px] uppercase text-slate-400/80 tracking-wide font-extrabold font-sans">Сектор загрози</p>
              <p className="text-sm font-bold text-slate-200 mt-1 uppercase">
                {SEASONS[stateRef.current.currentSeasonIdx].name}
              </p>
            </div>
            {stateRef.current.maxShieldCharges > 0 && (
              <div className="border-l border-slate-800/80 pl-4 flex flex-col justify-center">
                <p className="text-[10px] uppercase text-slate-400/80 tracking-wide font-extrabold font-sans">Дефлектор</p>
                <p className="text-sm font-bold text-emerald-400 mt-1 uppercase flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  {stateRef.current.shieldChargesLeft} / {stateRef.current.maxShieldCharges}
                </p>
              </div>
            )}
          </div>
        </div>
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

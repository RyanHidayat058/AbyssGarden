export type WeatherType = 'clear' | 'rainy' | 'snowy' | 'storm' | 'bloodmoon';
export type CropMutation = 'wet' | 'frozen' | 'thunderbolt' | 'bloodmoon';

export const MUTATION_DETAILS: Record<CropMutation, { prefix: string; color: string; multiplier: number }> = {
  wet: { prefix: 'Wet', color: '#38bdf8', multiplier: 1.5 },
  frozen: { prefix: 'Frozen', color: '#bae6fd', multiplier: 2.0 },
  thunderbolt: { prefix: 'Thunderbolt', color: '#facc15', multiplier: 3.0 },
  bloodmoon: { prefix: 'Bloodmoon', color: '#f43f5e', multiplier: 5.0 }
};

/**
 * Calculates combined multiplier when mutations are stacked:
 * The individual multipliers are summed first:
 * e.g., wet (1.5) + thunderbolt (3.0) = 4.5x total multiplier!
 * All 4 stacked: 1.5 + 2.0 + 3.0 + 5.0 = 11.5x total multiplier!
 */
export function calculateMutationMultiplier(mutations?: CropMutation[] | CropMutation | null): number {
  if (!mutations) return 1.0;
  const list = Array.isArray(mutations) ? mutations : [mutations];
  if (list.length === 0) return 1.0;

  let sum = 0;
  for (const m of list) {
    if (MUTATION_DETAILS[m]) {
      sum += MUTATION_DETAILS[m].multiplier;
    }
  }
  return sum > 0 ? sum : 1.0;
}

export function getMutationPrefixAndIcons(mutations?: CropMutation[] | CropMutation | null): { prefix: string; icons: string; color: string } {
  if (!mutations) return { prefix: '', icons: '', color: '#38bdf8' };
  const list = Array.isArray(mutations) ? mutations : [mutations];
  if (list.length === 0) return { prefix: '', icons: '', color: '#38bdf8' };

  const prefixes: string[] = [];
  const icons: string[] = [];
  let dominantColor = '#38bdf8';

  for (const m of list) {
    const detail = MUTATION_DETAILS[m];
    if (detail) {
      prefixes.push(detail.prefix);
      if (m === 'wet') icons.push('💧');
      else if (m === 'frozen') icons.push('❄️');
      else if (m === 'thunderbolt') icons.push('⚡');
      else if (m === 'bloodmoon') icons.push('🩸');
      dominantColor = detail.color;
    }
  }

  return {
    prefix: prefixes.join(' ') + (prefixes.length > 0 ? ' ' : ''),
    icons: icons.join(''),
    color: dominantColor
  };
}

export interface WeatherConfig {
  id: WeatherType;
  name: string;
  icon: string;
  mutationType: CropMutation | null;
  multiplier: number;
  bannerColor: string;
  announcement: string;
}

export const WEATHER_CONFIGS: Record<WeatherType, WeatherConfig> = {
  clear: {
    id: 'clear',
    name: 'Tranquil Deep',
    icon: '🌊',
    mutationType: null,
    multiplier: 1.0,
    bannerColor: '#38bdf8',
    announcement: 'Calm ocean currents prevail across the seabed.'
  },
  rainy: {
    id: 'rainy',
    name: 'Torrential Ocean Rain',
    icon: '🌧️',
    mutationType: 'wet',
    multiplier: 1.5,
    bannerColor: '#38bdf8',
    announcement: 'Torrential underwater currents surge! Crops may mutate into Wet (1.5x Value)!'
  },
  snowy: {
    id: 'snowy',
    name: 'Abyssal Marine Snow',
    icon: '❄️',
    mutationType: 'frozen',
    multiplier: 2.0,
    bannerColor: '#e0f2fe',
    announcement: 'Frigid marine snow hazes the water! Crops may mutate into Frozen (2.0x Value)!'
  },
  storm: {
    id: 'storm',
    name: 'Electrified Tempest',
    icon: '⚡',
    mutationType: 'thunderbolt',
    multiplier: 3.0,
    bannerColor: '#facc15',
    announcement: 'Severe tempest with lightning surges! Crops may mutate into Thunderbolt (3.0x Value)!'
  },
  bloodmoon: {
    id: 'bloodmoon',
    name: 'Crimson Bloodmoon',
    icon: '🩸',
    mutationType: 'bloodmoon',
    multiplier: 5.0,
    bannerColor: '#f43f5e',
    announcement: 'THE BLOODMOON ASCENDS! The abyssal depths turn crimson! Rare Bloodmoon Mutation (5.0x Value)!'
  }
};

interface WeatherParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  rot?: number;
  vRot?: number;
}

export class WeatherSystem {
  public currentWeather: WeatherType = 'clear';
  public weatherCycleTimer: number = 0; // Counts to 600s (10 min)
  public readonly CYCLE_DURATION_SEC: number = 600; // 10 minutes
  public activeWeatherTimer: number = 0; // Counts down active duration
  public readonly ACTIVE_DURATION_SEC: number = 120; // 2 minutes event

  private particles: WeatherParticle[] = [];
  private lightningTimer: number = 0;
  private lightningFlashAlpha: number = 0;
  private mutationCheckTimer: number = 0;

  public onWeatherChanged?: (weather: WeatherType, config: WeatherConfig) => void;
  public onLightningStrike?: () => void;

  constructor() {
    this.initParticles();
  }

  private initParticles() {
    this.particles = [];
    for (let i = 0; i < 160; i++) {
      this.particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: 0,
        vy: 100,
        size: 2,
        alpha: 0.5,
        color: '#ffffff'
      });
    }
  }

  public setWeather(weather: WeatherType, remainingDuration: number = this.ACTIVE_DURATION_SEC) {
    this.currentWeather = weather;
    this.activeWeatherTimer = weather === 'clear' ? 0 : remainingDuration;
    this.onWeatherChanged?.(weather, WEATHER_CONFIGS[weather]);
  }

  public update(dtSec: number, viewportWidth: number = window.innerWidth, viewportHeight: number = window.innerHeight) {
    // 1. Advance 10-minute cycle timer
    this.weatherCycleTimer += dtSec;
    if (this.weatherCycleTimer >= this.CYCLE_DURATION_SEC) {
      this.weatherCycleTimer = 0;
      this.rollNextWeather();
    }

    // 2. Active weather duration countdown
    if (this.currentWeather !== 'clear') {
      this.activeWeatherTimer -= dtSec;
      if (this.activeWeatherTimer <= 0) {
        this.setWeather('clear');
      }
    }

    // 3. Lightning flash decay & trigger during storm
    if (this.currentWeather === 'storm') {
      this.lightningTimer += dtSec;
      if (this.lightningTimer > 3.5 + Math.random() * 4.5) {
        this.lightningTimer = 0;
        this.lightningFlashAlpha = 0.85;
        this.onLightningStrike?.();
      }
    }
    if (this.lightningFlashAlpha > 0) {
      this.lightningFlashAlpha = Math.max(0, this.lightningFlashAlpha - dtSec * 3.5);
    }

    // 4. Update weather particles
    this.updateParticles(dtSec, viewportWidth, viewportHeight);
  }

  public rollCropMutation(): { id: CropMutation; prefix: string; color: string; multiplier: number } | null {
    if (this.currentWeather === 'clear') return null;
    const cfg = WEATHER_CONFIGS[this.currentWeather];
    if (!cfg || !cfg.mutationType) return null;

    const mutMap: Record<CropMutation, { prefix: string; color: string; multiplier: number }> = {
      wet: { prefix: 'Wet', color: '#38bdf8', multiplier: 1.5 },
      frozen: { prefix: 'Frozen', color: '#bae6fd', multiplier: 2.0 },
      thunderbolt: { prefix: 'Thunderbolt', color: '#facc15', multiplier: 3.0 },
      bloodmoon: { prefix: 'Bloodmoon', color: '#f43f5e', multiplier: 5.0 }
    };
    return {
      id: cfg.mutationType,
      ...mutMap[cfg.mutationType]
    };
  }

  private rollNextWeather() {
    // Roll with user specified probabilities:
    // Rainy = 50%, Snowy = 25%, Storm = 10%, Bloodmoon = 1%, Clear = 14%
    const rand = Math.random() * 100; // 0 to 100
    let next: WeatherType = 'clear';

    if (rand < 1) {
      next = 'bloodmoon'; // 1%
    } else if (rand < 11) {
      next = 'storm';     // 10%
    } else if (rand < 36) {
      next = 'snowy';     // 25%
    } else if (rand < 86) {
      next = 'rainy';     // 50%
    } else {
      next = 'clear';     // 14%
    }

    this.setWeather(next, this.ACTIVE_DURATION_SEC);
  }

  private updateParticles(dtSec: number, w: number, h: number) {
    if (this.currentWeather === 'clear') return;

    for (const p of this.particles) {
      if (this.currentWeather === 'rainy') {
        p.vx = -40;
        p.vy = 280;
        p.size = 2;
        p.color = '#38bdf8';
        p.alpha = 0.45;
      } else if (this.currentWeather === 'snowy') {
        p.vx = Math.sin(p.y * 0.02) * 20;
        p.vy = 65;
        p.size = 3 + (p.x % 3);
        p.color = '#e0f2fe';
        p.alpha = 0.65;
      } else if (this.currentWeather === 'storm') {
        p.vx = -120;
        p.vy = 420;
        p.size = 2.5;
        p.color = Math.random() < 0.15 ? '#fde047' : '#93c5fd';
        p.alpha = 0.65;
      } else if (this.currentWeather === 'bloodmoon') {
        p.vx = Math.cos(p.y * 0.03) * 35;
        p.vy = 85;
        p.size = 3 + (p.x % 2);
        p.color = Math.random() < 0.3 ? '#f43f5e' : '#fda4af';
        p.alpha = 0.75;
      }

      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;

      if (p.y > h + 10) {
        p.y = -10;
        p.x = Math.random() * (w + 100);
      }
      if (p.x < -20) {
        p.x = w + 20;
      }
    }
  }

  public shouldCheckMutation(dtSec: number): boolean {
    if (this.currentWeather === 'clear') return false;
    this.mutationCheckTimer += dtSec;
    if (this.mutationCheckTimer >= 4.0) { // Every 4 seconds during weather
      this.mutationCheckTimer = 0;
      return true;
    }
    return false;
  }

  public getActiveMutationType(): CropMutation | null {
    return WEATHER_CONFIGS[this.currentWeather].mutationType;
  }

  public getRemainingTimeFormatted(): string {
    if (this.currentWeather !== 'clear') {
      const mins = Math.floor(this.activeWeatherTimer / 60);
      const secs = Math.floor(this.activeWeatherTimer % 60);
      return `${WEATHER_CONFIGS[this.currentWeather].name} (${mins}:${secs < 10 ? '0' : ''}${secs})`;
    }
    const nextIn = Math.max(0, this.CYCLE_DURATION_SEC - this.weatherCycleTimer);
    const mins = Math.floor(nextIn / 60);
    const secs = Math.floor(nextIn % 60);
    return `Next Shift in ${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  public render(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (this.currentWeather === 'clear' && this.lightningFlashAlpha <= 0) return;

    ctx.save();

    // 1. Atmospheric Screen Overlays
    if (this.currentWeather === 'snowy') {
      // White hazy screen overlay without altering spotlight vision distance
      ctx.fillStyle = 'rgba(235, 245, 255, 0.22)';
      ctx.fillRect(0, 0, w, h);
    } else if (this.currentWeather === 'bloodmoon') {
      // Blood red eerie atmosphere
      ctx.fillStyle = 'rgba(160, 10, 25, 0.38)';
      ctx.fillRect(0, 0, w, h);

      // Deep dark bloodmoon vignette
      const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(1, 'rgba(120, 0, 10, 0.45)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (this.currentWeather === 'storm') {
      // Storm dark overlay
      ctx.fillStyle = 'rgba(2, 6, 23, 0.28)';
      ctx.fillRect(0, 0, w, h);
    } else if (this.currentWeather === 'rainy') {
      ctx.fillStyle = 'rgba(8, 47, 73, 0.18)';
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Lightning Flash across screen
    if (this.lightningFlashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.lightningFlashAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    // 3. Render Particles
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;

      if (this.currentWeather === 'rainy' || this.currentWeather === 'storm') {
        // Streaks
        ctx.fillRect(p.x, p.y, p.size, p.size * 5);
      } else {
        // Flakes or Orbs
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

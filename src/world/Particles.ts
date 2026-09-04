export interface Bubble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  wobbleSpeed: number;
  wobbleAmp: number;
  age: number;
  maxAge: number;
}

export interface MarineSnow {
  x: number;
  y: number;
  vy: number;
  vx: number;
  radius: number;
  alpha: number;
}

export interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  public bubbles: Bubble[] = [];
  public snow: MarineSnow[] = [];
  public sparkles: Sparkle[] = [];
  public floatingTexts: FloatingText[] = [];

  constructor(private worldWidth: number, private worldHeight: number) {
    this.initMarineSnow();
  }

  private initMarineSnow() {
    for (let i = 0; i < 90; i++) {
      this.snow.push({
        x: Math.random() * this.worldWidth,
        y: Math.random() * this.worldHeight,
        vx: (Math.random() - 0.5) * 6,
        vy: 12 + Math.random() * 15,
        radius: 0.8 + Math.random() * 1.6,
        alpha: 0.2 + Math.random() * 0.4
      });
    }
  }

  public emitBubble(x: number, y: number, vx: number = 0, vy: number = -40, radius: number = 2.5) {
    this.bubbles.push({
      x,
      y,
      vx: vx + (Math.random() - 0.5) * 12,
      vy: vy - Math.random() * 25,
      radius: radius + Math.random() * 2,
      alpha: 0.7 + Math.random() * 0.3,
      wobbleSpeed: 4 + Math.random() * 6,
      wobbleAmp: 8 + Math.random() * 12,
      age: 0,
      maxAge: 3.5 + Math.random() * 2.5
    });
  }

  public emitSparkles(x: number, y: number, color: string, count: number = 14) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 25 + Math.random() * 60;
      this.sparkles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 15,
        color,
        size: 2 + Math.random() * 3.5,
        alpha: 1,
        life: 0,
        maxLife: 0.7 + Math.random() * 0.5
      });
    }
  }

  public addFloatingText(x: number, y: number, text: string, color: string = '#ffd166') {
    this.floatingTexts.push({
      x,
      y,
      vy: -24,
      text,
      color,
      alpha: 1,
      life: 0,
      maxLife: 1.4
    });
  }

  public update(dtSec: number) {
    // Update bubbles
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.age += dtSec;
      if (b.age >= b.maxAge || b.y < -20) {
        this.bubbles.splice(i, 1);
        continue;
      }
      b.y += b.vy * dtSec;
      b.x += (b.vx + Math.sin(b.age * b.wobbleSpeed) * b.wobbleAmp) * dtSec;
      b.alpha = Math.max(0, 1 - b.age / b.maxAge);
    }

    // Update marine snow (drifting oceanic organic particles)
    for (const s of this.snow) {
      s.y += s.vy * dtSec;
      s.x += s.vx * dtSec;
      if (s.y > this.worldHeight) {
        s.y = 0;
        s.x = Math.random() * this.worldWidth;
      }
      if (s.x > this.worldWidth) s.x = 0;
      if (s.x < 0) s.x = this.worldWidth;
    }

    // Update sparkles
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const s = this.sparkles[i];
      s.life += dtSec;
      if (s.life >= s.maxLife) {
        this.sparkles.splice(i, 1);
        continue;
      }
      s.x += s.vx * dtSec;
      s.y += s.vy * dtSec;
      s.vy += 25 * dtSec; // soft buoyancy / drag
      s.alpha = Math.max(0, 1 - s.life / s.maxLife);
    }

    // Update floating text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.life += dtSec;
      if (t.life >= t.maxLife) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      t.y += t.vy * dtSec;
      t.alpha = Math.max(0, 1 - Math.pow(t.life / t.maxLife, 2));
    }
  }

  public draw(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    ctx.save();
    ctx.translate(-camX, -camY);

    // Draw marine snow
    for (const s of this.snow) {
      ctx.fillStyle = `rgba(180, 240, 255, ${s.alpha * 0.4})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw bubbles
    for (const b of this.bubbles) {
      ctx.strokeStyle = `rgba(165, 243, 252, ${b.alpha * 0.7})`;
      ctx.fillStyle = `rgba(165, 243, 252, ${b.alpha * 0.15})`;
      ctx.lineWidth = 1.2;

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Specular shine on bubble
      ctx.fillStyle = `rgba(255, 255, 255, ${b.alpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(b.x - b.radius * 0.35, b.y - b.radius * 0.35, b.radius * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw sparkles
    for (const s of this.sparkles) {
      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw floating texts
    for (const t of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = t.alpha;
      ctx.font = 'bold 13px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 3;
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }

    ctx.restore();
  }
}

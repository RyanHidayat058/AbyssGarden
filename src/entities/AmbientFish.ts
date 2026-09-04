export interface Fish {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'lantern' | 'ray';
  size: number;
  color: string;
  glowColor: string;
  wiggleSpeed: number;
  animTimer: number;
}

export class AmbientFauna {
  public fishList: Fish[] = [];

  constructor(private worldWidth: number, private worldHeight: number) {
    this.spawnFauna();
  }

  private spawnFauna() {
    const lanternColors = [
      { body: '#0284c7', glow: '#38bdf8' },
      { body: '#059669', glow: '#34d399' },
      { body: '#7c3aed', glow: '#c084fc' }
    ];

    // Spawn 14 lantern fishes
    for (let i = 0; i < 14; i++) {
      const col = lanternColors[Math.floor(Math.random() * lanternColors.length)];
      const dir = Math.random() > 0.5 ? 1 : -1;
      this.fishList.push({
        x: Math.random() * this.worldWidth,
        y: Math.random() * this.worldHeight,
        vx: dir * (30 + Math.random() * 35),
        vy: (Math.random() - 0.5) * 10,
        type: 'lantern',
        size: 8 + Math.random() * 5,
        color: col.body,
        glowColor: col.glow,
        wiggleSpeed: 6 + Math.random() * 4,
        animTimer: Math.random() * 10
      });
    }

    // Spawn 3 majestic mini manta-rays
    for (let i = 0; i < 3; i++) {
      this.fishList.push({
        x: Math.random() * this.worldWidth,
        y: Math.random() * this.worldHeight,
        vx: 22 + Math.random() * 15,
        vy: (Math.random() - 0.5) * 8,
        type: 'ray',
        size: 24 + Math.random() * 10,
        color: '#1e293b',
        glowColor: '#4cf3d8',
        wiggleSpeed: 2 + Math.random() * 1.5,
        animTimer: Math.random() * 10
      });
    }
  }

  public update(dtSec: number) {
    for (const f of this.fishList) {
      f.animTimer += dtSec * f.wiggleSpeed;
      f.x += f.vx * dtSec;
      f.y += f.vy * dtSec + Math.sin(f.animTimer * 0.5) * 4 * dtSec;

      // Wrap around world edges
      if (f.vx > 0 && f.x > this.worldWidth + 60) {
        f.x = -50;
        f.y = Math.random() * this.worldHeight;
      } else if (f.vx < 0 && f.x < -60) {
        f.x = this.worldWidth + 50;
        f.y = Math.random() * this.worldHeight;
      }

      if (f.y < 30) f.vy = Math.abs(f.vy);
      if (f.y > this.worldHeight - 30) f.vy = -Math.abs(f.vy);
    }
  }

  public draw(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    ctx.save();
    ctx.translate(-camX, -camY);

    for (const f of this.fishList) {
      const facing = f.vx > 0 ? 1 : -1;
      const wiggle = Math.sin(f.animTimer) * 3;

      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(facing, 1);

      if (f.type === 'lantern') {
        // Small deep sea fish
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, f.size, f.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tail fin
        ctx.beginPath();
        ctx.moveTo(-f.size, 0);
        ctx.lineTo(-f.size - 6, -5 + wiggle);
        ctx.lineTo(-f.size - 6, 5 + wiggle);
        ctx.closePath();
        ctx.fill();

        // Lure / Lantern stalk
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(f.size * 0.4, -f.size * 0.3);
        ctx.quadraticCurveTo(f.size * 0.8, -f.size * 1.2, f.size * 1.1, -f.size * 0.7);
        ctx.stroke();

        // Bioluminescent bulb
        ctx.fillStyle = f.glowColor;
        ctx.shadowColor = f.glowColor;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(f.size * 1.1, -f.size * 0.7, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        // Manta Ray
        const wingFlap = Math.sin(f.animTimer) * 0.35;

        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.moveTo(f.size * 0.7, 0);
        ctx.quadraticCurveTo(0, -f.size * 0.9 * (1 + wingFlap), -f.size * 0.6, 0);
        ctx.quadraticCurveTo(0, f.size * 0.9 * (1 + wingFlap), f.size * 0.7, 0);
        ctx.fill();

        // Glowing dorsal spots
        ctx.fillStyle = f.glowColor;
        ctx.beginPath();
        ctx.arc(0, -f.size * 0.2, 1.5, 0, Math.PI * 2);
        ctx.arc(0, f.size * 0.2, 1.5, 0, Math.PI * 2);
        ctx.arc(-f.size * 0.2, 0, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Long whip tail
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-f.size * 0.6, 0);
        ctx.quadraticCurveTo(-f.size * 1.2, wiggle, -f.size * 1.8, wiggle * 1.5);
        ctx.stroke();
      }

      ctx.restore();
    }

    ctx.restore();
  }
}

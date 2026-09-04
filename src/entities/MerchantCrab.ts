export class MerchantCrab {
  public x: number;
  public y: number;
  public isPlayerNear: boolean = false;
  private animTimer: number = 0;
  private eyeAngle: number = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  public update(dtSec: number, playerX: number, playerY: number) {
    this.animTimer += dtSec * 3;

    // Check distance to player
    const dist = Math.hypot(playerX - this.x, playerY - this.y);
    this.isPlayerNear = dist < 75;

    // Eye stalks track player
    this.eyeAngle = Math.atan2(playerY - this.y, playerX - this.x);
  }

  public draw(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    const scX = this.x - camX;
    const scY = this.y - camY;

    ctx.save();
    ctx.translate(scX, scY);

    const clawWiggle = Math.sin(this.animTimer) * 0.15;

    // 1. Great Nautilus Shell
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.ellipse(0, -6, 22, 18, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Shell Spiral ridges
    ctx.strokeStyle = '#c2410c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -6, 14, 0, Math.PI * 1.6);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-2, -6, 7, 0, Math.PI * 1.5);
    ctx.stroke();

    // Embedded luminous gems on shell
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(-8, -14, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.arc(8, -16, 3, 0, Math.PI * 2);
    ctx.fill();

    // 2. Crab Body
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.ellipse(0, 8, 16, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Walking Legs
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2.5;
    for (let i = -1; i <= 1; i += 2) {
      // Leg 1
      ctx.beginPath();
      ctx.moveTo(i * 12, 10);
      ctx.lineTo(i * 22, 16 + Math.sin(this.animTimer + i) * 2);
      ctx.lineTo(i * 24, 22);
      ctx.stroke();

      // Leg 2
      ctx.beginPath();
      ctx.moveTo(i * 10, 14);
      ctx.lineTo(i * 18, 20 + Math.cos(this.animTimer + i) * 2);
      ctx.lineTo(i * 20, 26);
      ctx.stroke();
    }

    // 4. Claws / Pincers
    for (let i = -1; i <= 1; i += 2) {
      ctx.save();
      ctx.translate(i * 14, 4);
      ctx.rotate(i * (0.3 + clawWiggle));

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.ellipse(i * 6, -6, 8, 5, i * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Pincer jaw
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.arc(i * 10, -9, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5. Eye Stalks
    for (let i = -1; i <= 1; i += 2) {
      const stalkX = i * 6;
      const stalkY = 2;

      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(stalkX, stalkY);
      ctx.lineTo(stalkX, stalkY - 8);
      ctx.stroke();

      // Eye eyeball
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(stalkX, stalkY - 9, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Pupil tracking player
      const pupilX = stalkX + Math.cos(this.eyeAngle) * 1.5;
      const pupilY = stalkY - 9 + Math.sin(this.eyeAngle) * 1.5;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(pupilX, pupilY, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Name tag over Barnaby
    ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde047';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText('Barnaby the Merchant', 0, -28);

    ctx.restore();
  }
}

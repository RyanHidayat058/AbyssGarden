import { SUITS_CATALOG } from './Suits';

export class RemotePlayer {
  public userId: string;
  public callsign: string;
  public avatar: string;
  public suitId: string = 'emerald';

  public x: number;
  public y: number;
  public targetX: number;
  public targetY: number;

  public facingAngle: number = 0;
  public isMoving: boolean = false;
  public currentMap: 'seabed' | 'grotto' = 'seabed';
  private swimAnimTimer: number = 0;

  constructor(userId: string, callsign: string, x: number = 0, y: number = 0, avatar: string = '🤿', facingAngle: number = 0, suitId: string = 'emerald') {
    this.userId = userId;
    this.callsign = callsign;
    this.avatar = avatar;
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.facingAngle = facingAngle;
    this.suitId = suitId;
  }

  public updateTarget(x: number, y: number, facingAngle: number, isMoving: boolean, map?: 'seabed' | 'grotto') {
    this.targetX = x;
    this.targetY = y;
    this.facingAngle = facingAngle;
    this.isMoving = isMoving;
    if (map) this.currentMap = map;
  }

  public updateFromNetwork(x: number, y: number, _vx: number, _vy: number, facingAngle: number, isMoving: boolean, map?: 'seabed' | 'grotto', suitId?: string) {
    this.updateTarget(x, y, facingAngle, isMoving, map);
    if (suitId) this.suitId = suitId;
  }

  public update(dtSec: number) {
    // Smooth lerp to target position
    const lerpFactor = 0.25;
    this.x += (this.targetX - this.x) * lerpFactor;
    this.y += (this.targetY - this.y) * lerpFactor;

    if (this.isMoving) {
      this.swimAnimTimer += dtSec * 8;
    }
  }

  public draw(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    const scX = this.x - camX;
    const scY = this.y - camY;
    const suit = SUITS_CATALOG[this.suitId] || SUITS_CATALOG.emerald;

    ctx.save();
    ctx.translate(scX, scY);

    // Name tag above head
    ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = suit.visorColor;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(`${this.avatar} ${this.callsign}`, 0, -26);
    ctx.shadowBlur = 0;

    // Rotate body
    ctx.rotate(this.facingAngle);

    const finKick = Math.sin(this.swimAnimTimer) * 5;

    // Flippers
    ctx.fillStyle = suit.trimColor;
    ctx.beginPath();
    ctx.ellipse(-16, -8 + finKick, 8, 4, -0.3, 0, Math.PI * 2);
    ctx.ellipse(-16, 8 - finKick, 8, 4, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Oxygen Tank
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.roundRect(-14, -6, 8, 12, 3);
    ctx.fill();

    ctx.fillStyle = suit.trimColor;
    ctx.fillRect(-12, -4, 4, 8);

    // Suit Body
    ctx.fillStyle = suit.bodyColor;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 13, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = suit.trimColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Limbs
    ctx.fillStyle = suit.trimColor;
    ctx.beginPath();
    ctx.arc(4, -10, 4, 0, Math.PI * 2);
    ctx.arc(4, 10, 4, 0, Math.PI * 2);
    ctx.fill();

    // Helmet Dome
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(4, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glowing Visor
    ctx.fillStyle = suit.visorColor;
    ctx.shadowColor = suit.glowColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(6, 0, 6, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  }
}

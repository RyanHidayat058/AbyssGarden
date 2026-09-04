import { TILE_SIZE } from '../world/WorldMap';
import { ParticleSystem } from '../world/Particles';
import { Inventory } from '../farming/Inventory';
import { SUITS_CATALOG } from './Suits';

export class Aquanaut {
  public x: number;
  public y: number;
  public vx: number = 0;
  public vy: number = 0;
  public radius: number = 16;
  public facingAngle: number = 0;
  public swimAnimTimer: number = 0;
  public isMoving: boolean = false;
  public suitId: string = 'cyan';
  private bubbleTimer: number = 0;

  constructor(startX: number, startY: number) {
    this.x = startX;
    this.y = startY;
  }

  public update(
    dtSec: number,
    moveInput: { x: number; y: number },
    aimWorldPos: { x: number; y: number },
    world: { isSolid: (x: number, y: number) => boolean; ventLocations?: { x: number; y: number }[] },
    particles: ParticleSystem,
    inventory: Inventory
  ) {
    const targetSpeed = inventory.getSwimSpeed();
    const accel = 800; // Water acceleration
    const drag = 5.0;  // Viscous water resistance

    this.isMoving = moveInput.x !== 0 || moveInput.y !== 0;

    // Apply input acceleration
    if (this.isMoving) {
      this.vx += moveInput.x * accel * dtSec;
      this.vy += moveInput.y * accel * dtSec;

      // Clamp max velocity
      const currentSpeed = Math.hypot(this.vx, this.vy);
      if (currentSpeed > targetSpeed) {
        this.vx = (this.vx / currentSpeed) * targetSpeed;
        this.vy = (this.vy / currentSpeed) * targetSpeed;
      }

      this.swimAnimTimer += dtSec * 8;

      // Emit bubbles from oxygen tank while swimming
      this.bubbleTimer += dtSec;
      if (this.bubbleTimer > 0.16) {
        this.bubbleTimer = 0;
        const tankX = this.x - Math.cos(this.facingAngle) * 14;
        const tankY = this.y - Math.sin(this.facingAngle) * 14;
        particles.emitBubble(tankX, tankY, -this.vx * 0.2, -30);
      }
    } else {
      // Idle water drag deceleration
      this.vx -= this.vx * drag * dtSec;
      this.vy -= this.vy * drag * dtSec;
      if (Math.abs(this.vx) < 2) this.vx = 0;
      if (Math.abs(this.vy) < 2) this.vy = 0;

      // Occasional idle breath bubble
      this.bubbleTimer += dtSec;
      if (this.bubbleTimer > 2.5) {
        this.bubbleTimer = 0;
        particles.emitBubble(this.x, this.y - 10, 0, -25);
      }
    }

    // Facing angle follows mouse aim smoothly
    const dx = aimWorldPos.x - this.x;
    const dy = aimWorldPos.y - this.y;
    const targetAngle = Math.atan2(dy, dx);
    this.facingAngle = targetAngle;

    // Apply movement with wall collision
    this.moveWithCollision(dtSec, world);

    // Oxygen mechanics:
    if (!world.ventLocations) {
      // Subsea Bunker / Home: safe pressurized life support, oxygen is always 100% full!
      inventory.replenishOxygen(50 * dtSec);
      inventory.oxygen = inventory.maxOxygen;
    } else {
      // Seabed: Check if close to hydrothermal vent
      let nearVent = false;
      for (const vent of world.ventLocations) {
        const dist = Math.hypot(this.x - vent.x, this.y - vent.y);
        if (dist < 60) {
          nearVent = true;
          break;
        }
      }

      if (nearVent) {
        inventory.replenishOxygen(25 * dtSec);
      } else {
        inventory.consumeOxygen(0.7 * dtSec);
      }
    }
  }

  private moveWithCollision(dtSec: number, world: { isSolid: (x: number, y: number) => boolean }) {
    const nextX = this.x + this.vx * dtSec;
    const nextY = this.y + this.vy * dtSec;

    // Check X collision
    if (!this.checkCollisionAt(nextX, this.y, world)) {
      this.x = nextX;
    } else {
      this.vx = 0;
    }

    // Check Y collision
    if (!this.checkCollisionAt(this.x, nextY, world)) {
      this.y = nextY;
    } else {
      this.vy = 0;
    }
  }

  private checkCollisionAt(testWorldX: number, testWorldY: number, world: { isSolid: (x: number, y: number) => boolean }): boolean {
    const pad = this.radius * 0.75;
    const points = [
      { x: testWorldX - pad, y: testWorldY - pad },
      { x: testWorldX + pad, y: testWorldY - pad },
      { x: testWorldX - pad, y: testWorldY + pad },
      { x: testWorldX + pad, y: testWorldY + pad }
    ];

    for (const p of points) {
      if (world.isSolid(p.x, p.y)) {
        return true;
      }
    }
    return false;
  }

  public getTargetedGrid(aimWorldPos: { x: number; y: number }): { x: number; y: number } {
    // Target grid tile under mouse, capped by player interaction range (~100 px)
    const maxRange = 110;
    let targetX = aimWorldPos.x;
    let targetY = aimWorldPos.y;

    const dist = Math.hypot(targetX - this.x, targetY - this.y);
    if (dist > maxRange) {
      const angle = Math.atan2(targetY - this.y, targetX - this.x);
      targetX = this.x + Math.cos(angle) * maxRange;
      targetY = this.y + Math.sin(angle) * maxRange;
    }

    return {
      x: Math.floor(targetX / TILE_SIZE),
      y: Math.floor(targetY / TILE_SIZE)
    };
  }

  public draw(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    const suit = SUITS_CATALOG[this.suitId] || SUITS_CATALOG.cyan;

    ctx.save();
    ctx.translate(this.x - camX, this.y - camY);
    ctx.rotate(this.facingAngle);

    // Flippers / fins animation
    const finKick = Math.sin(this.swimAnimTimer) * 5;

    // Back flippers
    ctx.fillStyle = suit.trimColor;
    ctx.beginPath();
    ctx.ellipse(-16, -8 + finKick, 8, 4, -0.3, 0, Math.PI * 2);
    ctx.ellipse(-16, 8 - finKick, 8, 4, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Oxygen Tank on back
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.roundRect(-14, -6, 8, 12, 3);
    ctx.fill();

    ctx.fillStyle = suit.trimColor;
    ctx.fillRect(-12, -4, 4, 8);

    // Diving Suit Body
    ctx.fillStyle = suit.bodyColor;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 13, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = suit.trimColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Diver Hands / Front limbs
    ctx.fillStyle = suit.trimColor;
    ctx.beginPath();
    ctx.arc(4, -10, 4, 0, Math.PI * 2);
    ctx.arc(4, 10, 4, 0, Math.PI * 2);
    ctx.fill();

    // Diving Helmet Dome
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(4, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glowing Glass Visor
    ctx.fillStyle = suit.visorColor;
    ctx.shadowColor = suit.glowColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(6, 0, 6, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Visor reflection shine
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(8, -2, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

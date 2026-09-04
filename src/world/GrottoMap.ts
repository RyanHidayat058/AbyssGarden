import { StorageChest } from '../entities/Chest';
import { RefineryMachine } from '../farming/Refinery';

export const GROTTO_TILE_SIZE = 48;

export enum GrottoTile {
  FLOOR = 0,
  WALL = 1,
  EXIT_PORTAL = 2,
  CRYSTAL = 3,
  OXYGEN_TERMINAL = 4
}

export class GrottoMap {
  public cols: number = 24;
  public rows: number = 16;
  public width: number;
  public height: number;
  public tiles: number[][];

  public chests: StorageChest[] = [];
  public refinery: RefineryMachine;
  public exitLocation: { x: number; y: number };
  public spawnLocation: { x: number; y: number };
  public wardrobeLocation = { gridX: 9, gridY: 2 };
  public oxygenTerminal = { gridX: 12, gridY: 1 };

  constructor() {
    this.width = this.cols * GROTTO_TILE_SIZE;
    this.height = this.rows * GROTTO_TILE_SIZE;
    this.tiles = [];

    // Default starter Small Chest placed in the bunker
    const starterChest = new StorageChest('chest_start', 'small', 4, 4);
    this.chests.push(starterChest);

    this.refinery = new RefineryMachine(18, 3);

    this.exitLocation = {
      x: 12 * GROTTO_TILE_SIZE + GROTTO_TILE_SIZE / 2,
      y: 14 * GROTTO_TILE_SIZE + GROTTO_TILE_SIZE / 2
    };

    // Safe spawn location well away from the exit hatch (144px above)
    this.spawnLocation = {
      x: 12 * GROTTO_TILE_SIZE + GROTTO_TILE_SIZE / 2,
      y: 11 * GROTTO_TILE_SIZE + GROTTO_TILE_SIZE / 2
    };

    this.generateMap();
  }

  private generateMap() {
    for (let r = 0; r < this.rows; r++) {
      this.tiles[r] = [];
      for (let c = 0; c < this.cols; c++) {
        if (r === 0 || r === this.rows - 1 || c === 0 || c === this.cols - 1) {
          this.tiles[r][c] = GrottoTile.WALL;
        } else if (r === 14 && c === 12) {
          this.tiles[r][c] = GrottoTile.EXIT_PORTAL;
        } else if (r === 1 && c === 12) {
          this.tiles[r][c] = GrottoTile.OXYGEN_TERMINAL;
        } else {
          this.tiles[r][c] = GrottoTile.FLOOR;
        }
      }
    }

    // Industrial pressure support pillars with bioluminescent conduits
    this.tiles[4][7] = GrottoTile.CRYSTAL;
    this.tiles[4][16] = GrottoTile.CRYSTAL;
    this.tiles[10][7] = GrottoTile.CRYSTAL;
    this.tiles[10][16] = GrottoTile.CRYSTAL;
  }

  public isSolid(worldX: number, worldY: number): boolean {
    const gx = Math.floor(worldX / GROTTO_TILE_SIZE);
    const gy = Math.floor(worldY / GROTTO_TILE_SIZE);

    if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows) return true;

    if (
      this.tiles[gy][gx] === GrottoTile.WALL ||
      this.tiles[gy][gx] === GrottoTile.CRYSTAL ||
      this.tiles[gy][gx] === GrottoTile.OXYGEN_TERMINAL
    ) {
      return true;
    }

    // Check chest collisions
    for (const chest of this.chests) {
      if (chest.isAt(gx, gy)) return true;
    }

    // Check refinery collision
    if (this.refinery.isUnlocked && this.refinery.isAt(gx, gy)) {
      return true;
    }

    // Check wardrobe collision
    if (gx === this.wardrobeLocation.gridX && gy === this.wardrobeLocation.gridY) {
      return true;
    }

    return false;
  }

  public isNearWardrobe(worldX: number, worldY: number): boolean {
    const wx = this.wardrobeLocation.gridX * GROTTO_TILE_SIZE + GROTTO_TILE_SIZE / 2;
    const wy = this.wardrobeLocation.gridY * GROTTO_TILE_SIZE + GROTTO_TILE_SIZE / 2;
    return Math.hypot(worldX - wx, worldY - wy) < 65;
  }

  public getChestAt(gx: number, gy: number): StorageChest | null {
    for (const chest of this.chests) {
      if (chest.isAt(gx, gy)) return chest;
    }
    return null;
  }

  public syncWithInventory(inv: { hasRefinery: boolean; unlockedMediumChest: boolean; unlockedLargeChest: boolean }) {
    this.refinery.isUnlocked = inv.hasRefinery;

    if (inv.unlockedMediumChest && !this.chests.some(c => c.tier === 'medium')) {
      this.chests.push(new StorageChest('chest_med', 'medium', 4, 8));
    }
    if (inv.unlockedLargeChest && !this.chests.some(c => c.tier === 'large')) {
      this.chests.push(new StorageChest('chest_lrg', 'large', 18, 8));
    }
  }

  public update(dtSec: number) {
    this.refinery.update(dtSec);
  }

  public draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, timeSec: number) {
    ctx.save();
    ctx.translate(-camX, -camY);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = c * GROTTO_TILE_SIZE;
        const y = r * GROTTO_TILE_SIZE;
        const tile = this.tiles[r][c];

        if (tile === GrottoTile.FLOOR) {
          // Reinforced pressurized bunker floor with non-slip steel tiles
          ctx.fillStyle = (r + c) % 2 === 0 ? '#0f172a' : '#1e293b';
          ctx.fillRect(x, y, GROTTO_TILE_SIZE, GROTTO_TILE_SIZE);

          // Subtle floor grid seams
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 1, y + 1, GROTTO_TILE_SIZE - 2, GROTTO_TILE_SIZE - 2);

          // Subtle safety rivets on tile corners
          ctx.fillStyle = '#334155';
          ctx.fillRect(x + 3, y + 3, 2, 2);
          ctx.fillRect(x + GROTTO_TILE_SIZE - 5, y + 3, 2, 2);
          ctx.fillRect(x + 3, y + GROTTO_TILE_SIZE - 5, 2, 2);
          ctx.fillRect(x + GROTTO_TILE_SIZE - 5, y + GROTTO_TILE_SIZE - 5, 2, 2);
        } else if (tile === GrottoTile.WALL) {
          // Heavy titanium submarine bulkhead
          ctx.fillStyle = '#090d16';
          ctx.fillRect(x, y, GROTTO_TILE_SIZE, GROTTO_TILE_SIZE);

          // Steel plate panel
          ctx.fillStyle = '#111827';
          ctx.fillRect(x + 3, y + 3, GROTTO_TILE_SIZE - 6, GROTTO_TILE_SIZE - 6);

          ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 2, y + 2, GROTTO_TILE_SIZE - 4, GROTTO_TILE_SIZE - 4);
        } else if (tile === GrottoTile.CRYSTAL) {
          // Power Conduits / Industrial Pressure Pillars
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(x, y, GROTTO_TILE_SIZE, GROTTO_TILE_SIZE);

          // Glowing energy conduit core
          const corePulse = Math.sin(timeSec * 4 + c) * 0.2 + 0.8;
          ctx.fillStyle = `rgba(56, 189, 248, ${0.75 * corePulse})`;
          ctx.fillRect(x + 16, y + 6, 16, GROTTO_TILE_SIZE - 12);

          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 10, y + 4, GROTTO_TILE_SIZE - 20, GROTTO_TILE_SIZE - 8);
        } else if (tile === GrottoTile.OXYGEN_TERMINAL) {
          // Life Support Oxygen Scrubber Station
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(x, y, GROTTO_TILE_SIZE, GROTTO_TILE_SIZE);

          // Cyan Oxygen Tank Reservoir
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.roundRect(x + 8, y + 6, GROTTO_TILE_SIZE - 16, GROTTO_TILE_SIZE - 12, 6);
          ctx.fill();

          // Glowing level indicator
          const oxyPulse = Math.sin(timeSec * 5) * 0.15 + 0.85;
          ctx.fillStyle = `rgba(74, 222, 128, ${oxyPulse})`;
          ctx.fillRect(x + 14, y + 14, GROTTO_TILE_SIZE - 28, 14);

          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = '#4ade80';
          ctx.textAlign = 'center';
          ctx.fillText('100% O2', x + GROTTO_TILE_SIZE / 2, y + GROTTO_TILE_SIZE + 9);
        } else if (tile === GrottoTile.EXIT_PORTAL) {
          // Subsea Bunker Airlock Hatch (Exit)
          // 1. Hazard floor border
          ctx.fillStyle = '#eab308';
          ctx.fillRect(x + 2, y + 2, GROTTO_TILE_SIZE - 4, GROTTO_TILE_SIZE - 4);
          ctx.fillStyle = '#0f172a';
          for (let hi = 4; hi < GROTTO_TILE_SIZE - 4; hi += 8) {
            ctx.fillRect(x + hi, y + 2, 4, GROTTO_TILE_SIZE - 4);
          }

          // 2. Heavy steel hatch cover
          const hX = x + GROTTO_TILE_SIZE / 2;
          const hY = y + GROTTO_TILE_SIZE / 2;
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(hX, hY, 18, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // 3. Submarine hatch wheel
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(hX, hY, 10, 0, Math.PI * 2);
          ctx.stroke();

          for (let a = 0; a < 4; a++) {
            const angle = (a * Math.PI) / 2 + 0.3;
            ctx.beginPath();
            ctx.moveTo(hX, hY);
            ctx.lineTo(hX + Math.cos(angle) * 9.5, hY + Math.sin(angle) * 9.5);
            ctx.stroke();
          }

          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#38bdf8';
          ctx.fillText('AIRLOCK [E]', hX, y + GROTTO_TILE_SIZE + 10);
        }
      }
    }

    // Draw Placed Chests
    for (const chest of this.chests) {
      chest.draw(ctx, 0, 0, GROTTO_TILE_SIZE);
    }

    // Draw Refinery Machine
    this.refinery.draw(ctx, 0, 0, GROTTO_TILE_SIZE);

    // Draw Wardrobe (Lemari Pakaian)
    const wx = this.wardrobeLocation.gridX * GROTTO_TILE_SIZE;
    const wy = this.wardrobeLocation.gridY * GROTTO_TILE_SIZE;

    // Outer wooden armoire
    ctx.fillStyle = '#3e1c12';
    ctx.strokeStyle = '#c2410c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(wx + 4, wy + 4, GROTTO_TILE_SIZE - 8, GROTTO_TILE_SIZE - 6, 6);
    ctx.fill();
    ctx.stroke();

    // Wardrobe doors line & brass trim
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(wx + GROTTO_TILE_SIZE / 2, wy + 8);
    ctx.lineTo(wx + GROTTO_TILE_SIZE / 2, wy + GROTTO_TILE_SIZE - 6);
    ctx.stroke();

    // Door handles
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(wx + GROTTO_TILE_SIZE / 2 - 4, wy + GROTTO_TILE_SIZE / 2, 2.5, 0, Math.PI * 2);
    ctx.arc(wx + GROTTO_TILE_SIZE / 2 + 4, wy + GROTTO_TILE_SIZE / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Suit emblem / Wardrobe icon on top
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🥋', wx + GROTTO_TILE_SIZE / 2, wy + 20);

    ctx.font = 'bold 8px Outfit, sans-serif';
    ctx.fillStyle = '#fdba74';
    ctx.fillText('WARDROBE', wx + GROTTO_TILE_SIZE / 2, wy + GROTTO_TILE_SIZE + 8);

    ctx.restore();
  }
}

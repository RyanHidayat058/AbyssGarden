import { FarmPlot } from '../farming/FarmPlot';
import { drawCrop } from '../farming/Crops';

export const TILE_SIZE = 48;

export enum TileType {
  SAND = 0,
  CORAL_WALL = 1,
  DEEP_TRENCH = 2,
  HYDROTHERMAL_VENT = 3,
  BARNABY_OUTPOST = 4,
  CAVE_PORTAL = 5
}

export interface SeabedProp {
  x: number;
  y: number;
  type: 'shell' | 'starfish' | 'pebble' | 'anemone';
  color: string;
  size: number;
}

export class WorldMap {
  public cols: number = 36;
  public rows: number = 28;
  public width: number;
  public height: number;
  public tiles: number[][];
  public farmPlots: Map<string, FarmPlot> = new Map();
  public props: SeabedProp[] = [];
  public ventLocations: { x: number; y: number }[] = [];
  public merchantLocation: { x: number; y: number } = { x: 0, y: 0 };
  public caveLocation: { x: number; y: number } = { x: 0, y: 0 };

  constructor() {
    this.width = this.cols * TILE_SIZE;
    this.height = this.rows * TILE_SIZE;
    this.tiles = [];
    this.generateMap();
  }

  private generateMap() {
    // Fill with sandy seabed by default
    for (let r = 0; r < this.rows; r++) {
      this.tiles[r] = [];
      for (let c = 0; c < this.cols; c++) {
        // Border boundaries are coral walls
        if (r === 0 || r === this.rows - 1 || c === 0 || c === this.cols - 1) {
          this.tiles[r][c] = TileType.CORAL_WALL;
        } else {
          this.tiles[r][c] = TileType.SAND;
        }
      }
    }

    // Natural coral formations / cliffs inside the map
    const clusters = [
      { c: 2, r: 1, w: 4, h: 2 }, // Cliff ridge backing the bunker on left
      { c: 6, r: 5, w: 3, h: 3 },
      { c: 28, r: 6, w: 4, h: 2 },
      { c: 8, r: 20, w: 3, h: 4 },
      { c: 27, r: 21, w: 4, h: 3 }
    ];
    for (const cluster of clusters) {
      for (let dy = 0; dy < cluster.h; dy++) {
        for (let dx = 0; dx < cluster.w; dx++) {
          const r = cluster.r + dy;
          const c = cluster.c + dx;
          if (r < this.rows && c < this.cols) {
            this.tiles[r][c] = TileType.CORAL_WALL;
          }
        }
      }
    }

    // Hydrothermal Vents (Bubble geysers to recharge oxygen)
    const vents = [
      { c: 8, r: 13 },
      { c: 27, r: 13 },
      { c: 18, r: 23 }
    ];
    for (const v of vents) {
      this.tiles[v.r][v.c] = TileType.HYDROTHERMAL_VENT;
      this.ventLocations.push({
        x: v.c * TILE_SIZE + TILE_SIZE / 2,
        y: v.r * TILE_SIZE + TILE_SIZE / 2
      });
    }

    // Barnaby's Outpost (Coral Throne / Bazaar)
    const mCol = 18;
    const mRow = 7;
    this.tiles[mRow][mCol] = TileType.BARNABY_OUTPOST;
    this.merchantLocation = {
      x: mCol * TILE_SIZE + TILE_SIZE / 2,
      y: mRow * TILE_SIZE + TILE_SIZE / 2
    };

    // Subsea Bunker Home Airlock (Situated at the left cliffside)
    const caveCol = 3;
    const caveRow = 3;
    this.tiles[caveRow][caveCol] = TileType.CAVE_PORTAL;
    this.caveLocation = {
      x: caveCol * TILE_SIZE + TILE_SIZE / 2,
      y: caveRow * TILE_SIZE + TILE_SIZE / 2
    };

    // Scatter decorative seabed props (shells, anemones, pebbles)
    const propTypes: ('shell' | 'starfish' | 'pebble' | 'anemone')[] = ['shell', 'starfish', 'pebble', 'anemone'];
    const shellColors = ['#fde047', '#f472b6', '#38bdf8', '#fb923c'];

    for (let i = 0; i < 70; i++) {
      const c = Math.floor(Math.random() * (this.cols - 2)) + 1;
      const r = Math.floor(Math.random() * (this.rows - 2)) + 1;
      if (this.tiles[r][c] === TileType.SAND) {
        this.props.push({
          x: c * TILE_SIZE + Math.random() * (TILE_SIZE - 12) + 6,
          y: r * TILE_SIZE + Math.random() * (TILE_SIZE - 12) + 6,
          type: propTypes[Math.floor(Math.random() * propTypes.length)],
          color: shellColors[Math.floor(Math.random() * shellColors.length)],
          size: 4 + Math.random() * 5
        });
      }
    }
  }

  public getPlot(gridX: number, gridY: number): FarmPlot | null {
    if (gridX < 0 || gridX >= this.cols || gridY < 0 || gridY >= this.rows) {
      return null;
    }
    if (this.tiles[gridY][gridX] !== TileType.SAND) {
      return null;
    }

    const key = `${gridX},${gridY}`;
    let plot = this.farmPlots.get(key);
    if (!plot) {
      plot = new FarmPlot(gridX, gridY);
      this.farmPlots.set(key, plot);
    }
    return plot;
  }

  public isSolid(worldX: number, worldY: number): boolean {
    const gridX = Math.floor(worldX / TILE_SIZE);
    const gridY = Math.floor(worldY / TILE_SIZE);

    if (gridX < 0 || gridX >= this.cols || gridY < 0 || gridY >= this.rows) {
      return true;
    }

    const tile = this.tiles[gridY][gridX];
    return tile === TileType.CORAL_WALL || tile === TileType.BARNABY_OUTPOST;
  }

  public update(dtSec: number) {
    for (const plot of this.farmPlots.values()) {
      plot.update(dtSec);
    }
  }

  public draw(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    viewportW: number,
    viewportH: number,
    timeSec: number,
    highlightGrid: { x: number; y: number } | null
  ) {
    const startCol = Math.max(0, Math.floor(camX / TILE_SIZE));
    const endCol = Math.min(this.cols - 1, Math.ceil((camX + viewportW) / TILE_SIZE));
    const startRow = Math.max(0, Math.floor(camY / TILE_SIZE));
    const endRow = Math.min(this.rows - 1, Math.ceil((camY + viewportH) / TILE_SIZE));

    ctx.save();
    ctx.translate(-camX, -camY);

    // 1. Draw Seabed Tiles
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;
        const tile = this.tiles[r][c];

        if (tile === TileType.SAND) {
          // Soft seabed gradient
          ctx.fillStyle = (r + c) % 2 === 0 ? '#0a2342' : '#0c284a';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

          // Subtle sand ripple texture
          ctx.strokeStyle = 'rgba(76, 243, 216, 0.04)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 4, y + 16);
          ctx.quadraticCurveTo(x + 24, y + 14, x + 44, y + 18);
          ctx.moveTo(x + 8, y + 34);
          ctx.quadraticCurveTo(x + 28, y + 36, x + 40, y + 32);
          ctx.stroke();

          // Check if tilled plot
          const key = `${c},${r}`;
          const plot = this.farmPlots.get(key);
          if (plot && plot.isTilled) {
            // Tilled reef soil mound
            ctx.fillStyle = '#061628';
            ctx.strokeStyle = plot.isNutrified ? '#4cf3d8' : 'rgba(76, 243, 216, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8, 8);
            ctx.fill();
            ctx.stroke();

            // Inner furrow pattern
            ctx.strokeStyle = 'rgba(76, 243, 216, 0.15)';
            ctx.beginPath();
            ctx.moveTo(x + 8, y + 16);
            ctx.lineTo(x + TILE_SIZE - 8, y + 16);
            ctx.moveTo(x + 8, y + 32);
            ctx.lineTo(x + TILE_SIZE - 8, y + 32);
            ctx.stroke();
          }
        } else if (tile === TileType.CORAL_WALL) {
          // Solid Coral Rock Reef
          ctx.fillStyle = '#1e1b4b';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

          // Coral texture layers
          ctx.fillStyle = '#312e81';
          ctx.beginPath();
          ctx.arc(x + 16, y + 16, 14, 0, Math.PI * 2);
          ctx.arc(x + 32, y + 28, 16, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#4338ca';
          ctx.beginPath();
          ctx.arc(x + 24, y + 24, 8, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = 'rgba(167, 139, 250, 0.3)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        } else if (tile === TileType.HYDROTHERMAL_VENT) {
          // Volcanic Vent Chimney
          ctx.fillStyle = '#1c1917';
          ctx.beginPath();
          ctx.roundRect(x + 6, y + 8, TILE_SIZE - 12, TILE_SIZE - 10, 6);
          ctx.fill();

          // Vent opening with bubbling heat glow
          const ventPulse = Math.sin(timeSec * 6 + c) * 0.2 + 0.8;
          ctx.fillStyle = `rgba(56, 189, 248, ${0.4 * ventPulse})`;
          ctx.beginPath();
          ctx.ellipse(x + TILE_SIZE / 2, y + 14, 12, 6, 0, 0, Math.PI * 2);
          ctx.fill();

          // Vent crystal minerals
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(x + 10, y + 26, 4, 10);
          ctx.fillRect(x + 32, y + 22, 5, 14);
        } else if (tile === TileType.BARNABY_OUTPOST) {
          // Pedestal for Barnaby the Crab
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

          ctx.fillStyle = '#f43f5e';
          ctx.beginPath();
          ctx.ellipse(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 20, 16, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#ffd166';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (tile === TileType.CAVE_PORTAL) {
          // Subsea Bunker Airlock Structure (Heavy Titanium Dome with Cover Hatch)
          // 1. Reinforced outer bulkhead arch
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 22, Math.PI, 0, false);
          ctx.lineTo(x + TILE_SIZE - 2, y + TILE_SIZE - 2);
          ctx.lineTo(x + 2, y + TILE_SIZE - 2);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // 2. Yellow/black hazard border stripe on footing
          ctx.fillStyle = '#eab308';
          ctx.fillRect(x + 4, y + TILE_SIZE - 6, TILE_SIZE - 8, 4);
          ctx.fillStyle = '#0f172a';
          for (let hi = 6; hi < TILE_SIZE - 6; hi += 8) {
            ctx.fillRect(x + hi, y + TILE_SIZE - 6, 4, 4);
          }

          // 3. Heavy circular sealed vault hatch door
          const hatchCenterX = x + TILE_SIZE / 2;
          const hatchCenterY = y + TILE_SIZE / 2 + 2;
          const hatchRadius = 15;

          const hatchGrad = ctx.createRadialGradient(
            hatchCenterX - 4, hatchCenterY - 4, 2,
            hatchCenterX, hatchCenterY, hatchRadius
          );
          hatchGrad.addColorStop(0, '#334155');
          hatchGrad.addColorStop(0.7, '#1e293b');
          hatchGrad.addColorStop(1, '#0f172a');

          ctx.fillStyle = hatchGrad;
          ctx.beginPath();
          ctx.arc(hatchCenterX, hatchCenterY, hatchRadius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 2;
          ctx.stroke();

          // 4. Submarine hatch valve wheel & locking spokes
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(hatchCenterX, hatchCenterY, 8, 0, Math.PI * 2);
          ctx.stroke();

          // Valve spokes
          for (let a = 0; a < 4; a++) {
            const angle = (a * Math.PI) / 2 + 0.35;
            ctx.beginPath();
            ctx.moveTo(hatchCenterX, hatchCenterY);
            ctx.lineTo(hatchCenterX + Math.cos(angle) * 7.5, hatchCenterY + Math.sin(angle) * 7.5);
            ctx.stroke();
          }

          // 5. Pressurized status LED light (green pulse when diver approaches)
          const ledGlow = Math.sin(timeSec * 4) * 0.2 + 0.8;
          ctx.fillStyle = '#22c55e';
          ctx.shadowColor = '#4ade80';
          ctx.shadowBlur = 8 * ledGlow;
          ctx.beginPath();
          ctx.arc(hatchCenterX, y + 8, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // 6. Subdued hint label
          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center';
          ctx.fillText('BUNKER [E]', hatchCenterX, y + TILE_SIZE + 9);
        }
      }
    }

    // 2. Draw Decorative Seabed Props
    for (const prop of this.props) {
      if (prop.x < camX - 20 || prop.x > camX + viewportW + 20 ||
          prop.y < camY - 20 || prop.y > camY + viewportH + 20) {
        continue;
      }

      ctx.save();
      ctx.translate(prop.x, prop.y);
      if (prop.type === 'shell') {
        ctx.fillStyle = prop.color;
        ctx.beginPath();
        ctx.arc(0, 0, prop.size, Math.PI, Math.PI * 2);
        ctx.fill();
      } else if (prop.type === 'starfish') {
        ctx.fillStyle = prop.color;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
          const sx = Math.cos(angle) * prop.size;
          const sy = Math.sin(angle) * prop.size;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
      } else if (prop.type === 'anemone') {
        const sway = Math.sin(timeSec * 3 + prop.x) * 3;
        ctx.strokeStyle = '#2dd4bf';
        ctx.lineWidth = 1.5;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 2, 0);
          ctx.quadraticCurveTo(i * 3 + sway, -prop.size * 0.7, i * 4 + sway, -prop.size * 1.5);
          ctx.stroke();
        }
      } else {
        // Pebble
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.ellipse(0, 0, prop.size, prop.size * 0.6, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 3. Draw Crops
    for (const plot of this.farmPlots.values()) {
      if (!plot.cropId) continue;
      const px = plot.gridX * TILE_SIZE + TILE_SIZE / 2;
      const py = plot.gridY * TILE_SIZE + TILE_SIZE - 6;

      drawCrop(ctx, plot.cropId, plot.growthStage, px, py, timeSec, plot.isNutrified, plot.mutations, plot.weightKg);
    }

    // 4. Highlighted Tile Cursor (where user is aiming)
    if (highlightGrid) {
      const hx = highlightGrid.x * TILE_SIZE;
      const hy = highlightGrid.y * TILE_SIZE;

      ctx.strokeStyle = '#4cf3d8';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(hx + 2, hy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.setLineDash([]);

      // Subtle fill
      ctx.fillStyle = 'rgba(76, 243, 216, 0.1)';
      ctx.fillRect(hx + 2, hy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    }

    ctx.restore();
  }
}

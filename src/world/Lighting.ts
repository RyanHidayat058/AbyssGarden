import { FarmPlot } from '../farming/FarmPlot';
import { CROPS_CONFIG } from '../farming/Crops';
import { TILE_SIZE } from './WorldMap';

export class LightingSystem {
  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;

  constructor(private width: number, private height: number) {
    this.lightCanvas = document.createElement('canvas');
    this.lightCanvas.width = width;
    this.lightCanvas.height = height;
    this.lightCtx = this.lightCanvas.getContext('2d')!;
  }

  public resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.lightCanvas.width = width;
    this.lightCanvas.height = height;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    playerX: number,
    playerY: number,
    aimAngle: number,
    farmPlots: Map<string, FarmPlot>,
    vents: { x: number; y: number }[],
    merchantPos: { x: number; y: number },
    timeOfDay: number, // 0.0 to 1.0 (day cycle)
    spotlightDist: number = 220
  ) {
    const lCtx = this.lightCtx;
    lCtx.clearRect(0, 0, this.width, this.height);

    // Calculate ambient darkness level (darker during Abyssal Night)
    // 0.25 = noon, 0.75 = midnight
    const nightFactor = Math.sin(timeOfDay * Math.PI * 2);
    const ambientAlpha = 0.55 + nightFactor * 0.35; // range: 0.2 to 0.9

    // Fill darkness
    lCtx.fillStyle = `rgba(3, 10, 24, ${ambientAlpha})`;
    lCtx.fillRect(0, 0, this.width, this.height);

    // Everything drawn next cuts through darkness using 'destination-out'
    lCtx.globalCompositeOperation = 'destination-out';

    // 1. Diver Visor Flashlight Spotlight
    const screenPlayerX = playerX - camX;
    const screenPlayerY = playerY - camY;

    // Ambient radial glow around diver
    const diverGlow = lCtx.createRadialGradient(
      screenPlayerX, screenPlayerY, 10,
      screenPlayerX, screenPlayerY, 95
    );
    diverGlow.addColorStop(0, 'rgba(0, 0, 0, 1)');
    diverGlow.addColorStop(0.7, 'rgba(0, 0, 0, 0.6)');
    diverGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    lCtx.fillStyle = diverGlow;
    lCtx.beginPath();
    lCtx.arc(screenPlayerX, screenPlayerY, 95, 0, Math.PI * 2);
    lCtx.fill();

    // Conical spotlight cone
    const coneDist = spotlightDist;
    const coneAngle = Math.PI * 0.32;
    const startAngle = aimAngle - coneAngle / 2;
    const endAngle = aimAngle + coneAngle / 2;

    const coneGrad = lCtx.createRadialGradient(
      screenPlayerX, screenPlayerY, 15,
      screenPlayerX, screenPlayerY, coneDist
    );
    coneGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
    coneGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.5)');
    coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    lCtx.fillStyle = coneGrad;
    lCtx.beginPath();
    lCtx.moveTo(screenPlayerX, screenPlayerY);
    lCtx.arc(screenPlayerX, screenPlayerY, coneDist, startAngle, endAngle);
    lCtx.closePath();
    lCtx.fill();

    // 2. Bioluminescent Crops Glow
    for (const plot of farmPlots.values()) {
      if (!plot.cropId || plot.growthStage === 0) continue;
      const config = CROPS_CONFIG[plot.cropId];
      if (!config) continue;

      const cropWorldX = plot.gridX * TILE_SIZE + TILE_SIZE / 2;
      const cropWorldY = plot.gridY * TILE_SIZE + TILE_SIZE / 2;
      const scX = cropWorldX - camX;
      const scY = cropWorldY - camY;

      // Skip if offscreen
      if (scX < -100 || scX > this.width + 100 || scY < -100 || scY > this.height + 100) {
        continue;
      }

      const stageRatio = (plot.growthStage + 1) / config.stages;
      const rad = config.lightRadius * stageRatio;

      const cropGlow = lCtx.createRadialGradient(scX, scY, 4, scX, scY, rad);
      cropGlow.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
      cropGlow.addColorStop(0.6, 'rgba(0, 0, 0, 0.5)');
      cropGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

      lCtx.fillStyle = cropGlow;
      lCtx.beginPath();
      lCtx.arc(scX, scY, rad, 0, Math.PI * 2);
      lCtx.fill();
    }

    // 3. Hydrothermal Vents Glow
    for (const vent of vents) {
      const vx = vent.x - camX;
      const vy = vent.y - camY;
      if (vx < -80 || vx > this.width + 80 || vy < -80 || vy > this.height + 80) continue;

      const ventGrad = lCtx.createRadialGradient(vx, vy, 10, vx, vy, 85);
      ventGrad.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
      ventGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      lCtx.fillStyle = ventGrad;
      lCtx.beginPath();
      lCtx.arc(vx, vy, 85, 0, Math.PI * 2);
      lCtx.fill();
    }

    // 4. Barnaby's Outpost Warm Glow
    const mx = merchantPos.x - camX;
    const my = merchantPos.y - camY;
    const mGrad = lCtx.createRadialGradient(mx, my, 15, mx, my, 110);
    mGrad.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
    mGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    lCtx.fillStyle = mGrad;
    lCtx.beginPath();
    lCtx.arc(mx, my, 110, 0, Math.PI * 2);
    lCtx.fill();

    // Reset composite operation
    lCtx.globalCompositeOperation = 'source-over';

    // Composite darkness onto main game canvas
    ctx.drawImage(this.lightCanvas, 0, 0);

    // Optional color wash pass for glowing neon highlights
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const plot of farmPlots.values()) {
      if (!plot.cropId || plot.growthStage < 2) continue;
      const config = CROPS_CONFIG[plot.cropId];
      if (!config) continue;

      const scX = plot.gridX * TILE_SIZE + TILE_SIZE / 2 - camX;
      const scY = plot.gridY * TILE_SIZE + TILE_SIZE / 2 - camY;

      const aura = ctx.createRadialGradient(scX, scY, 0, scX, scY, config.lightRadius * 0.7);
      aura.addColorStop(0, config.glowColor + '66'); // 40% alpha
      aura.addColorStop(1, 'transparent');

      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(scX, scY, config.lightRadius * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  public renderGrotto(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    playerX: number,
    playerY: number,
    aimAngle: number,
    spotlightDist: number = 220
  ) {
    const lCtx = this.lightCtx;
    lCtx.clearRect(0, 0, this.width, this.height);

    // Soft cozy cavern ambiance
    lCtx.fillStyle = 'rgba(5, 12, 28, 0.45)';
    lCtx.fillRect(0, 0, this.width, this.height);

    lCtx.globalCompositeOperation = 'destination-out';

    const screenPlayerX = playerX - camX;
    const screenPlayerY = playerY - camY;

    // Ambient radial glow around diver in cave
    const diverGlow = lCtx.createRadialGradient(
      screenPlayerX, screenPlayerY, 15,
      screenPlayerX, screenPlayerY, 160
    );
    diverGlow.addColorStop(0, 'rgba(0, 0, 0, 1)');
    diverGlow.addColorStop(0.7, 'rgba(0, 0, 0, 0.6)');
    diverGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    lCtx.fillStyle = diverGlow;
    lCtx.beginPath();
    lCtx.arc(screenPlayerX, screenPlayerY, 160, 0, Math.PI * 2);
    lCtx.fill();

    // Spotlight cone
    const fov = Math.PI / 3;
    lCtx.beginPath();
    lCtx.moveTo(screenPlayerX, screenPlayerY);
    lCtx.arc(screenPlayerX, screenPlayerY, spotlightDist * 1.1, aimAngle - fov / 2, aimAngle + fov / 2);
    lCtx.closePath();
    lCtx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    lCtx.fill();

    lCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.lightCanvas, 0, 0);
  }
}

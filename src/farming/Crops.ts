import { CropMutation } from '../world/Weather';

export type CropId = 'kelp' | 'coral' | 'pearl' | 'jellyshroom';

export interface CropConfig {
  id: CropId;
  name: string;
  description: string;
  seedIcon: string;
  harvestIcon: string;
  harvestName: string;
  growthTimeSec: number;
  stages: number;
  seedPrice: number;
  harvestPrice: number;
  glowColor: string;
  lightRadius: number;
}

export const CROPS_CONFIG: Record<CropId, CropConfig> = {
  kelp: {
    id: 'kelp',
    name: 'Luminescent Kelp Spore',
    description: 'Fast-growing abyssal kelp that absorbs ambient ocean currents and emits a soothing emerald glow.',
    seedIcon: '🌱',
    harvestIcon: '🌿',
    harvestName: 'Glowing Kelp Frond',
    growthTimeSec: 12,
    stages: 4,
    seedPrice: 3,
    harvestPrice: 4,
    glowColor: '#1be7aa',
    lightRadius: 40
  },
  coral: {
    id: 'coral',
    name: 'Neon Coral Polyp',
    description: 'Delicate branching coral formation glowing with electric magenta hues. Revered by subsea jewelers.',
    seedIcon: '🪸',
    harvestIcon: '🔮',
    harvestName: 'Neon Coral Cluster',
    growthTimeSec: 20,
    stages: 4,
    seedPrice: 8,
    harvestPrice: 11,
    glowColor: '#ff6b8b',
    lightRadius: 55
  },
  pearl: {
    id: 'pearl',
    name: 'Abyssal Oyster Seedling',
    description: 'A deep-sea bivalve that nurtures shimmering rainbow pearls within its mineral shell.',
    seedIcon: '🦪',
    harvestIcon: '✨',
    harvestName: 'Radiant Deep Pearl',
    growthTimeSec: 32,
    stages: 4,
    seedPrice: 18,
    harvestPrice: 24,
    glowColor: '#ffd166',
    lightRadius: 65
  },
  jellyshroom: {
    id: 'jellyshroom',
    name: 'Jelly-Shroom Spore',
    description: 'Rare hybrid flora that pulses like a deep-sea jellyfish. Emits mysterious violet starlight.',
    seedIcon: '🍄',
    harvestIcon: '💠',
    harvestName: 'Vibrant Jelly-Cap',
    growthTimeSec: 45,
    stages: 4,
    seedPrice: 40,
    harvestPrice: 52,
    glowColor: '#c084fc',
    lightRadius: 80
  }
};

/**
 * Procedural drawing helper for rendering crops at different growth stages
 * with underwater swaying animation and natural weight-based visual scaling.
 */
export function drawCrop(
  ctx: CanvasRenderingContext2D,
  cropId: CropId,
  stage: number, // 0 to 3
  centerX: number,
  bottomY: number,
  timeSec: number,
  isNutrified: boolean,
  mutations?: CropMutation[] | CropMutation | null,
  weightKg: number = 1.0
) {
  const config = CROPS_CONFIG[cropId];
  if (!config) return;

  const sway = Math.sin(timeSec * 2 + centerX * 0.05) * 3;
  const pulse = Math.sin(timeSec * 3 + centerX) * 0.15 + 1;

  // Natural scaling based on crop weight (between 0.82x and 1.22x)
  const scale = Math.max(0.82, Math.min(1.22, 0.88 + (weightKg - 0.80) * 0.32));

  ctx.save();
  ctx.translate(centerX, bottomY);
  ctx.scale(scale, scale);

  switch (cropId) {
    case 'kelp':
      drawKelpStage(ctx, stage, sway);
      break;
    case 'coral':
      drawCoralStage(ctx, stage, sway);
      break;
    case 'pearl':
      drawPearlStage(ctx, stage, sway);
      break;
    case 'jellyshroom':
      drawJellyshroomStage(ctx, stage, sway, pulse);
      break;
  }

  // Draw nutrient sparkle indicator if fertilized
  if (isNutrified && stage < config.stages - 1) {
    ctx.fillStyle = '#4cf3d8';
    ctx.beginPath();
    ctx.arc(Math.sin(timeSec * 4) * 12, -28 + Math.cos(timeSec * 4) * 4, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw Stacked Mutation Auras
  const mutList = Array.isArray(mutations) ? mutations : (mutations ? [mutations] : []);
  if (mutList.length > 0) {
    ctx.save();
    const rot = timeSec * 3;
    const pulseScale = Math.sin(timeSec * 5) * 0.15 + 1.0;
    const auraY = -24;

    for (let mIdx = 0; mIdx < mutList.length; mIdx++) {
      const mut = mutList[mIdx];
      const layerOffset = mIdx * 2.5;

      if (mut === 'wet') {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, auraY, (14 + layerOffset) * pulseScale, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#bae6fd';
        ctx.beginPath();
        ctx.arc(Math.cos(rot) * (16 + layerOffset), auraY + Math.sin(rot) * (16 + layerOffset), 2.5, 0, Math.PI * 2);
        ctx.arc(Math.cos(rot + Math.PI) * (16 + layerOffset), auraY + Math.sin(rot + Math.PI) * (16 + layerOffset), 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (mut === 'frozen') {
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#93c5fd';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3 + rot * 0.5;
          const x1 = Math.cos(a) * (14 + layerOffset) * pulseScale;
          const y1 = auraY + Math.sin(a) * (14 + layerOffset) * pulseScale;
          if (i === 0) ctx.moveTo(x1, y1);
          else ctx.lineTo(x1, y1);
        }
        ctx.closePath();
        ctx.stroke();
      } else if (mut === 'thunderbolt') {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i * Math.PI * 2) / 5 + rot * 1.5;
          const r = ((i % 2 === 0 ? 16 : 9) + layerOffset) * pulseScale;
          const x1 = Math.cos(a) * r;
          const y1 = auraY + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x1, y1);
          else ctx.lineTo(x1, y1);
        }
        ctx.closePath();
        ctx.stroke();
      } else if (mut === 'bloodmoon') {
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(0, auraY, (16 + layerOffset) * pulseScale, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ff0055';
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2 + rot;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * (18 + layerOffset), auraY + Math.sin(a) * (18 + layerOffset), 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  ctx.restore();
}

function drawKelpStage(ctx: CanvasRenderingContext2D, stage: number, sway: number) {
  ctx.fillStyle = '#10b981';
  ctx.strokeStyle = '#059669';
  ctx.lineWidth = 2;

  if (stage === 0) {
    // Spore / sprout
    ctx.beginPath();
    ctx.arc(0, -4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (stage === 1) {
    // Small shoot
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(sway * 0.5, -12, sway, -20);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(sway, -20, 5, 8, 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (stage === 2) {
    // Medium kelp with fronds
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(sway * 0.5, -18, sway, -32);
    ctx.stroke();

    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.ellipse(sway * 0.7 - 6, -16, 5, 10, -0.4, 0, Math.PI * 2);
    ctx.ellipse(sway * 0.7 + 6, -22, 5, 10, 0.4, 0, Math.PI * 2);
    ctx.ellipse(sway, -34, 6, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Stage 3: Fully mature lush bioluminescent kelp
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(sway * 0.6, -24, sway * 1.2, -44);
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#6ee7b7';
    // Multiple glowing layered leaves
    for (let i = 0; i < 4; i++) {
      const frondY = -12 - i * 9;
      const frondSway = sway * (0.3 + i * 0.25);
      const dir = i % 2 === 0 ? 1 : -1;

      ctx.beginPath();
      ctx.ellipse(frondSway + dir * 8, frondY, 7, 14, dir * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Glowing tip
    ctx.fillStyle = '#a7f3d0';
    ctx.beginPath();
    ctx.arc(sway * 1.2, -45, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCoralStage(ctx: CanvasRenderingContext2D, stage: number, sway: number) {
  ctx.fillStyle = '#f43f5e';
  ctx.strokeStyle = '#e11d48';
  ctx.lineWidth = 2.5;

  if (stage === 0) {
    // Tiny pink polyp mound
    ctx.beginPath();
    ctx.ellipse(0, -3, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (stage === 1) {
    // 2 mini branches
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-6 + sway * 0.3, -14);
    ctx.moveTo(4, 0);
    ctx.lineTo(6 + sway * 0.3, -16);
    ctx.stroke();
  } else if (stage === 2) {
    // Branching coral structure
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -10);
    ctx.lineTo(-10 + sway * 0.4, -24);
    ctx.moveTo(0, -10);
    ctx.lineTo(10 + sway * 0.4, -26);
    ctx.moveTo(0, -10);
    ctx.lineTo(sway * 0.3, -28);
    ctx.stroke();

    ctx.fillStyle = '#fb7185';
    ctx.beginPath();
    ctx.arc(-10 + sway * 0.4, -24, 4, 0, Math.PI * 2);
    ctx.arc(10 + sway * 0.4, -26, 4, 0, Math.PI * 2);
    ctx.arc(sway * 0.3, -28, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Stage 3: Majestic glowing neon coral reef
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -12);
    ctx.lineTo(-14 + sway * 0.4, -30);
    ctx.moveTo(0, -12);
    ctx.lineTo(14 + sway * 0.4, -32);
    ctx.moveTo(0, -12);
    ctx.lineTo(sway * 0.3, -36);
    ctx.moveTo(-7, -20);
    ctx.lineTo(-18 + sway * 0.4, -34);
    ctx.moveTo(7, -20);
    ctx.lineTo(18 + sway * 0.4, -35);
    ctx.stroke();

    // Fluorescent bulbs on branches
    ctx.fillStyle = '#fda4af';
    const tips = [
      [-14 + sway * 0.4, -30],
      [14 + sway * 0.4, -32],
      [sway * 0.3, -36],
      [-18 + sway * 0.4, -34],
      [18 + sway * 0.4, -35]
    ];
    for (const [tx, ty] of tips) {
      ctx.beginPath();
      ctx.arc(tx, ty, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPearlStage(ctx: CanvasRenderingContext2D, stage: number, sway: number) {
  if (stage === 0) {
    // Small clam shell closed
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(0, -3, 5, Math.PI, Math.PI * 2);
    ctx.fill();
  } else if (stage === 1) {
    // Shell growing, ridges
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.ellipse(0, -6, 9, 6, 0, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();
  } else if (stage === 2) {
    // Slightly opened shell
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.ellipse(0, -8, 13, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Slight iridescent glimmer
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.ellipse(0, -7, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Stage 3: Wide open clam showing lustrous glowing pearl!
    // Lower shell valve
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.ellipse(0, -4, 15, 7, 0, 0, Math.PI);
    ctx.fill();

    // Upper shell valve
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.ellipse(0, -18, 14, 8, sway * 0.05, Math.PI, 0);
    ctx.fill();

    // Inner pearl bed
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.ellipse(0, -7, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Radiant Pearl!
    ctx.fillStyle = '#fffbeb';
    ctx.shadowColor = '#ffd166';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, -10, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Specular highlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-2, -12, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawJellyshroomStage(ctx: CanvasRenderingContext2D, stage: number, sway: number, pulse: number) {
  if (stage === 0) {
    // Purple seedling
    ctx.fillStyle = '#8b5cf6';
    ctx.beginPath();
    ctx.arc(0, -4, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (stage === 1) {
    // Small stalk & cap
    ctx.fillStyle = '#a855f7';
    ctx.fillRect(-2, -10, 4, 10);
    ctx.beginPath();
    ctx.arc(0, -10, 7, Math.PI, 0);
    ctx.fill();
  } else if (stage === 2) {
    // Translucent dome with tentacles
    ctx.fillStyle = '#c084fc';
    ctx.fillRect(-3, -16, 6, 16);

    ctx.beginPath();
    ctx.arc(sway * 0.3, -16, 11, Math.PI, 0);
    ctx.fill();

    // Hanging tentacles
    ctx.strokeStyle = '#e9d5ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-5, -16);
    ctx.quadraticCurveTo(-7 + sway * 0.4, -6, -5 + sway, 0);
    ctx.moveTo(5, -16);
    ctx.quadraticCurveTo(7 + sway * 0.4, -6, 5 + sway, 0);
    ctx.stroke();
  } else {
    // Stage 3: Glorious pulsating bioluminescent jellyfish-mushroom
    const capY = -24;

    // Stem
    ctx.fillStyle = 'rgba(168, 85, 247, 0.7)';
    ctx.beginPath();
    ctx.roundRect(-4, capY, 8, 24, 4);
    ctx.fill();

    // Pulsing Jelly Cap
    ctx.fillStyle = 'rgba(192, 132, 252, 0.85)';
    ctx.beginPath();
    ctx.ellipse(sway * 0.4, capY, 15 * pulse, 12 * pulse, 0, Math.PI, 0);
    ctx.fill();

    // Inner glowing core
    ctx.fillStyle = '#f3e8ff';
    ctx.beginPath();
    ctx.arc(sway * 0.4, capY - 4, 6, 0, Math.PI * 2);
    ctx.fill();

    // Hanging luminous stingers/tentacles
    ctx.strokeStyle = 'rgba(233, 213, 255, 0.8)';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      const startX = (i * 6) + sway * 0.4;
      const tentacleSway = sway * (1 + Math.abs(i) * 0.3);
      ctx.beginPath();
      ctx.moveTo(startX, capY);
      ctx.bezierCurveTo(
        startX + tentacleSway * 0.5, capY + 10,
        startX - tentacleSway * 0.5, capY + 18,
        startX + tentacleSway, capY + 26
      );
      ctx.stroke();
    }
  }
}

import { CropMutation } from '../world/Weather';

export type ChestTier = 'small' | 'medium' | 'large';

export interface ChestItemSlot {
  type: 'seed' | 'harvest' | 'refined' | 'nutrient';
  id: string;
  name: string;
  icon: string;
  count: number;
  price?: number;
  mutations?: CropMutation[];
  mutation?: CropMutation | null;
  weightKg?: number;
}

export function getChestMutKey(item?: ChestItemSlot | null): string {
  if (!item) return '';
  const list = item.mutations || (item.mutation ? [item.mutation] : []);
  return [...list].sort().join('+');
}

export interface ChestConfig {
  tier: ChestTier;
  name: string;
  capacity: number;
  widthTiles: number;
  heightTiles: number;
  cost: number;
}

export const CHEST_CONFIGS: Record<ChestTier, ChestConfig> = {
  small: {
    tier: 'small',
    name: 'Small Reef Chest',
    capacity: 8,
    widthTiles: 1,
    heightTiles: 1,
    cost: 40
  },
  medium: {
    tier: 'medium',
    name: 'Medium Ironwood Chest',
    capacity: 24,
    widthTiles: 2,
    heightTiles: 1,
    cost: 95
  },
  large: {
    tier: 'large',
    name: 'Large Abyssal Vault',
    capacity: 64,
    widthTiles: 3,
    heightTiles: 1,
    cost: 180
  }
};

export class StorageChest {
  public id: string;
  public tier: ChestTier;
  public gridX: number;
  public gridY: number;
  public slots: (ChestItemSlot | null)[];

  constructor(id: string, tier: ChestTier, gridX: number, gridY: number, savedSlots?: (ChestItemSlot | null)[]) {
    this.id = id;
    this.tier = tier;
    this.gridX = gridX;
    this.gridY = gridY;

    const config = CHEST_CONFIGS[tier];
    if (savedSlots && savedSlots.length === config.capacity) {
      this.slots = savedSlots;
    } else {
      this.slots = new Array(config.capacity).fill(null);
    }
  }

  public get config(): ChestConfig {
    return CHEST_CONFIGS[this.tier];
  }

  public isAt(gx: number, gy: number): boolean {
    return gx >= this.gridX && gx < this.gridX + this.config.widthTiles &&
           gy >= this.gridY && gy < this.gridY + this.config.heightTiles;
  }

  public addItem(item: ChestItemSlot): { added: boolean; remaining: number } {
    const maxStack = 16;
    let remaining = item.count;
    const itemMutKey = getChestMutKey(item);

    // 1. Try filling existing partial stacks of the same item and identical mutations
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot && slot.id === item.id && slot.count < maxStack && getChestMutKey(slot) === itemMutKey) {
        const space = maxStack - slot.count;
        const add = Math.min(space, remaining);
        slot.count += add;
        remaining -= add;
        if (remaining <= 0) return { added: true, remaining: 0 };
      }
    }

    // 2. Try placing remaining in empty slots
    for (let i = 0; i < this.slots.length; i++) {
      if (!this.slots[i]) {
        const add = Math.min(maxStack, remaining);
        this.slots[i] = {
          ...item,
          count: add
        };
        remaining -= add;
        if (remaining <= 0) return { added: true, remaining: 0 };
      }
    }

    return { added: remaining < item.count, remaining };
  }

  public depositItem(item: ChestItemSlot): boolean {
    return this.addItem(item).added;
  }

  public draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, tileSize: number = 48) {
    const x = this.gridX * tileSize - camX;
    const y = this.gridY * tileSize - camY;
    const w = this.config.widthTiles * tileSize;
    const h = this.config.heightTiles * tileSize;

    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h - 2, w / 2 + 2, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Chest Body
    const bodyColor = this.tier === 'large' ? '#1e1b4b' : this.tier === 'medium' ? '#3e2723' : '#451a03';
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 8, w - 8, h - 14, 6);
    ctx.fill();

    // Metallic trim bands
    const trimColor = this.tier === 'large' ? '#a78bfa' : this.tier === 'medium' ? '#fbbf24' : '#94a3b8';
    ctx.strokeStyle = trimColor;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x + 4, y + 8, w - 8, h - 14);

    // Lid divider line
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 18);
    ctx.lineTo(x + w - 4, y + 18);
    ctx.stroke();

    // Lock clasp in the center
    ctx.fillStyle = this.tier === 'large' ? '#c084fc' : '#ffd166';
    ctx.beginPath();
    ctx.roundRect(x + w / 2 - 5, y + 14, 10, 10, 2);
    ctx.fill();

    // Keyhole
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 18, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Name tag
    ctx.font = 'bold 10px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8fafc';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(this.config.name, x + w / 2, y + 4);

    ctx.restore();
  }
}

import { Inventory } from './Inventory';

export interface RefineryRecipe {
  id: string;
  inputCropId: string;
  inputName: string;
  outputId: string;
  outputName: string;
  outputIcon: string;
  outputPrice: number;
  durationSec: number;
  description: string;
}

export const REFINERY_RECIPES: RefineryRecipe[] = [
  {
    id: 'bio_fuel',
    inputCropId: 'kelp',
    inputName: 'Glowing Kelp Frond',
    outputId: 'kelp_fuel',
    outputName: 'Kelp Bio-Fuel Capsule',
    outputIcon: '🧪',
    outputPrice: 65,
    durationSec: 8,
    description: 'Distill kelp fronds into clean bioluminescent fuel cells favored by deep trench explorer subs.'
  },
  {
    id: 'polished_coral',
    inputCropId: 'coral',
    inputName: 'Neon Coral Cluster',
    outputId: 'polished_gem',
    outputName: 'Polished Luminous Gem',
    outputIcon: '💎',
    outputPrice: 165,
    durationSec: 14,
    description: 'Precision cut and buff fluorescent coral branches into brilliant gemstones for royal subsea jewelry.'
  },
  {
    id: 'pearl_amulet',
    inputCropId: 'pearl',
    inputName: 'Radiant Deep Pearl',
    outputId: 'protection_amulet',
    outputName: 'Abyssal Protection Amulet',
    outputIcon: '🧿',
    outputPrice: 320,
    durationSec: 22,
    description: 'Enchant lustrous pearls with hydrothermal minerals to create a protective deep-water talisman.'
  },
  {
    id: 'starlight_elixir',
    inputCropId: 'jellyshroom',
    inputName: 'Vibrant Jelly-Cap',
    outputId: 'starlight_elixir',
    outputName: 'Starlight Abyssal Elixir',
    outputIcon: '🍶',
    outputPrice: 580,
    durationSec: 30,
    description: 'Ferment rare jelly spores into a mystical serum that revitalizes divers and illuminates dark trenches.'
  }
];

export class RefineryMachine {
  public isUnlocked: boolean = false;
  public gridX: number = 18;
  public gridY: number = 3;

  constructor(gridX: number = 18, gridY: number = 3) {
    this.gridX = gridX;
    this.gridY = gridY;
  }

  public isProcessing: boolean = false;
  public activeRecipe: RefineryRecipe | null = null;
  public progressTimerSec: number = 0;
  public outputReady: boolean = false;
  public outputItem: { id: string; name: string; icon: string; count: number; price: number } | null = null;

  public isAt(gx: number, gy: number): boolean {
    return gx >= this.gridX && gx <= this.gridX + 1 && gy >= this.gridY && gy <= this.gridY + 1;
  }

  public update(dtSec: number): boolean {
    if (this.isProcessing && this.activeRecipe) {
      this.progressTimerSec += dtSec;
      if (this.progressTimerSec >= this.activeRecipe.durationSec) {
        this.isProcessing = false;
        this.outputReady = true;
        this.outputItem = {
          id: this.activeRecipe.outputId,
          name: this.activeRecipe.outputName,
          icon: this.activeRecipe.outputIcon,
          count: 1,
          price: this.activeRecipe.outputPrice
        };
        return true; // Finished!
      }
    }
    return false;
  }

  public startRefining(recipeId: string, inventory: Inventory): { success: boolean; error?: string } {
    if (this.isProcessing || this.outputReady) {
      return { success: false, error: 'Refinery is currently busy or has uncollected output!' };
    }

    const recipe = REFINERY_RECIPES.find(r => r.id === recipeId);
    if (!recipe) return { success: false, error: 'Recipe not found' };

    // Check if player has the crop in inventory
    const count = inventory.harvestCounts[recipe.inputCropId as 'kelp' | 'coral' | 'pearl' | 'jellyshroom'] || 0;
    if (count <= 0) {
      return { success: false, error: `You do not have any ${recipe.inputName} in your inventory!` };
    }

    // Consume ingredient
    inventory.harvestCounts[recipe.inputCropId as 'kelp' | 'coral' | 'pearl' | 'jellyshroom']--;
    this.activeRecipe = recipe;
    this.progressTimerSec = 0;
    this.isProcessing = true;
    this.outputReady = false;
    this.outputItem = null;

    return { success: true };
  }

  public collectOutput(inventory: Inventory): { success: boolean; item?: { name: string; count: number }; error?: string } {
    if (!this.outputReady || !this.outputItem) {
      return { success: false, error: 'No output ready to collect.' };
    }

    // Attempt to add to player inventory
    const added = inventory.addItem({
      type: 'refined',
      id: this.outputItem.id,
      name: this.outputItem.name,
      icon: this.outputItem.icon,
      count: this.outputItem.count,
      price: this.outputItem.price
    });

    if (!added) {
      return { success: false, error: 'Inventory full! Make room in hotbar or home chest.' };
    }

    const itemCollected = { name: this.outputItem.name, count: this.outputItem.count };
    this.outputReady = false;
    this.outputItem = null;
    this.activeRecipe = null;
    this.progressTimerSec = 0;

    return { success: true, item: itemCollected };
  }

  public draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, tileSize: number = 48) {
    if (!this.isUnlocked) return;

    const x = this.gridX * tileSize - camX;
    const y = this.gridY * tileSize - camY;
    const w = 2 * tileSize;
    const h = 2 * tileSize;

    ctx.save();

    // Machine Base Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h - 6, w / 2 + 4, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Machine Metallic Frame
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(x + 6, y + 10, w - 12, h - 16, 8);
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Glass Bio-Chamber Dome
    ctx.fillStyle = this.isProcessing ? 'rgba(56, 189, 248, 0.35)' : 'rgba(30, 41, 59, 0.8)';
    ctx.beginPath();
    ctx.roundRect(x + 16, y + 20, w - 32, h - 44, 6);
    ctx.fill();

    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Progress or Ready Glow
    if (this.isProcessing && this.activeRecipe) {
      const pct = Math.min(1, this.progressTimerSec / this.activeRecipe.durationSec);
      ctx.fillStyle = '#34d399';
      ctx.fillRect(x + 18, y + 22, (w - 36) * pct, 4);

      // Bubbling particles inside chamber
      ctx.fillStyle = '#4cf3d8';
      ctx.beginPath();
      ctx.arc(x + w / 2 + Math.sin(this.progressTimerSec * 10) * 8, y + h / 2 - 4, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.outputReady && this.outputItem) {
      // Ready Indicator Lamp
      ctx.fillStyle = '#ffd166';
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + 28, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Machine Label
    ctx.font = 'bold 10px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText('Bio-Extractor', x + w / 2, y + 6);

    ctx.restore();
  }
}

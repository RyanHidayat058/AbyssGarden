import { CropId, CROPS_CONFIG } from './Crops';
import { CropMutation } from '../world/Weather';

export class FarmPlot {
  public isTilled: boolean = false;
  public cropId: CropId | null = null;
  public growthStage: number = 0; // 0 to 3
  public growthTimerSec: number = 0;
  public isNutrified: boolean = false;
  public readyToHarvest: boolean = false;
  public mutations: CropMutation[] = [];
  public weightKg: number = 1.0;

  public get mutation(): CropMutation | null {
    return this.mutations.length > 0 ? this.mutations[this.mutations.length - 1] : null;
  }

  public set mutation(mut: CropMutation | null) {
    if (mut) {
      if (!this.mutations.includes(mut)) this.mutations.push(mut);
    } else {
      this.mutations = [];
    }
  }

  constructor(public gridX: number, public gridY: number) {}

  public till(): boolean {
    if (!this.isTilled) {
      this.isTilled = true;
      return true;
    }
    return false;
  }

  public untill(): boolean {
    if (this.isTilled && !this.cropId) {
      this.isTilled = false;
      this.isNutrified = false;
      this.growthStage = 0;
      this.growthTimerSec = 0;
      this.readyToHarvest = false;
      this.mutations = [];
      return true;
    }
    return false;
  }

  public plant(cropId: CropId): boolean {
    if (this.isTilled && !this.cropId) {
      this.cropId = cropId;
      this.growthStage = 0;
      this.growthTimerSec = 0;
      this.readyToHarvest = false;
      this.mutations = [];
      // Natural base weight roll: 0.85 to 1.25 kg
      this.weightKg = Number((0.85 + Math.random() * 0.40).toFixed(2));
      return true;
    }
    return false;
  }

  public hasMutation(mut: CropMutation): boolean {
    return this.mutations.includes(mut);
  }

  public applyMutation(mut: CropMutation): boolean {
    if (this.cropId && !this.mutations.includes(mut)) {
      this.mutations.push(mut);
      return true;
    }
    return false;
  }

  public applyNutrient(): boolean {
    if (this.cropId && !this.isNutrified && !this.readyToHarvest) {
      this.isNutrified = true;
      // Extra nutrients boost weight significantly (+0.20 - 0.40 kg)
      this.weightKg = Number((this.weightKg + 0.20 + Math.random() * 0.20).toFixed(2));
      return true;
    }
    return false;
  }

  public update(dtSec: number) {
    if (!this.cropId || this.readyToHarvest) return;

    const config = CROPS_CONFIG[this.cropId];
    if (!config) return;

    // Growth multiplier: 2.2x if injected with plankton nutrients
    const speedMultiplier = this.isNutrified ? 2.2 : 1.0;
    this.growthTimerSec += dtSec * speedMultiplier;

    const stageDuration = config.growthTimeSec / (config.stages - 1);
    const calculatedStage = Math.min(config.stages - 1, Math.floor(this.growthTimerSec / stageDuration));

    this.growthStage = calculatedStage;

    if (this.growthStage >= config.stages - 1) {
      this.readyToHarvest = true;
    }
  }

  public harvest(): {
    cropId: CropId;
    count: number;
    mutations: CropMutation[];
    mutation: CropMutation | null;
    weightKg: number;
  } | null {
    if (this.cropId && this.readyToHarvest) {
      const harvestedId = this.cropId;
      const harvestedMutations = [...this.mutations];
      const harvestedMutation = this.mutation;
      const harvestedWeight = this.weightKg;

      // All crops are strictly single-harvest to avoid exploitation
      this.cropId = null;
      this.growthStage = 0;
      this.growthTimerSec = 0;
      this.readyToHarvest = false;
      this.isNutrified = false;
      this.mutations = [];
      this.weightKg = 1.0;

      return {
        cropId: harvestedId,
        count: 1,
        mutations: harvestedMutations,
        mutation: harvestedMutation,
        weightKg: harvestedWeight
      };
    }
    return null;
  }
}

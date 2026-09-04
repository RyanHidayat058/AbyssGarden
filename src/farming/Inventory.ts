import { CropId, CROPS_CONFIG } from './Crops';
import { CropMutation, calculateMutationMultiplier, getMutationPrefixAndIcons } from '../world/Weather';

export type ItemType = 'tool' | 'nutrient' | 'seed' | 'harvest' | 'refined';

export interface HotbarSlot {
  type: ItemType;
  id: string; // ToolId or CropId or RefinedId
  name: string;
  icon: string;
  count?: number; // max 16 for stackables
  price?: number;
  mutations?: CropMutation[];
  mutation?: CropMutation | null;
  weightKg?: number;
}

export const SEED_START_SLOT = 3;
export const SEED_END_SLOT = 5;
export const HARVEST_START_SLOT = 6;
export const HARVEST_END_SLOT = 8;

export function getMutationsKey(mutations?: CropMutation[] | CropMutation | null): string {
  if (!mutations) return '';
  const list = Array.isArray(mutations) ? mutations : [mutations];
  return [...list].sort().join('+');
}

export const MAX_STACK_SIZE = 16;

export class Inventory {
  public pearlShells: number = 50;
  public oxygen: number = 100;
  public maxOxygen: number = 100;
  public oxygenUpgradeLevel: number = 1;
  public swimSpeedLevel: number = 1;
  public spotlightLevel: number = 1;
  public hasRefinery: boolean = false;
  public unlockedMediumChest: boolean = false;
  public unlockedLargeChest: boolean = false;

  // Personal Wardrobe Suit Customization
  public suitColor: string = 'cyan';
  public unlockedSuits: string[] = ['cyan'];

  // Inventory count of seeds (synced with slots)
  public seedCounts: Record<CropId, number> = {
    kelp: 4,
    coral: 2,
    pearl: 1,
    jellyshroom: 0
  };

  // Inventory count of harvested crops
  public harvestCounts: Record<CropId, number> = {
    kelp: 0,
    coral: 0,
    pearl: 0,
    jellyshroom: 0
  };

  // 9 slots hotbar (0-2: Tools/Nutrients, 3-5: Bibit, 6-8: Panen)
  public selectedSlotIndex: number = 0;
  public hotbarSlots: HotbarSlot[] = [
    // --- 1. TOOLS & CONSUMABLE (Slots 0, 1, 2) ---
    { type: 'tool', id: 'shovel', name: 'Sand Shovel', icon: '⛏️' },
    { type: 'tool', id: 'leveler', name: 'Sand Leveler', icon: '🧹' },
    { type: 'nutrient', id: 'nutrient', name: 'Plankton Nutrients', icon: '🧪', count: 5 },
    // --- 2. BIBIT / SEED POUCH (Slots 3, 4, 5) ---
    { type: 'seed', id: 'kelp', name: 'Kelp Spores', icon: CROPS_CONFIG.kelp.seedIcon, count: 4 },
    { type: 'seed', id: 'coral', name: 'Coral Polyps', icon: CROPS_CONFIG.coral.seedIcon, count: 2 },
    { type: 'seed', id: 'pearl', name: 'Oyster Seed', icon: CROPS_CONFIG.pearl.seedIcon, count: 1 },
    // --- 3. HASIL PANEN / HARVEST BASKET (Slots 6, 7, 8) ---
    { type: 'harvest', id: 'empty', name: 'Empty Harvest Slot', icon: '', count: 0 },
    { type: 'harvest', id: 'empty', name: 'Empty Harvest Slot', icon: '', count: 0 },
    { type: 'harvest', id: 'empty', name: 'Empty Harvest Slot', icon: '', count: 0 }
  ];

  public getSelectedSlot(): HotbarSlot {
    return this.hotbarSlots[this.selectedSlotIndex];
  }

  public selectSlot(index: number) {
    if (index >= 0 && index < this.hotbarSlots.length) {
      this.selectedSlotIndex = index;
    }
  }

  public get nutrientCount(): number {
    const slot = this.hotbarSlots.find(s => s.id === 'nutrient');
    return slot && slot.count !== undefined ? slot.count : 0;
  }

  public useNutrient(): boolean {
    const slot = this.hotbarSlots.find(s => s.id === 'nutrient');
    if (slot && (slot.count || 0) > 0) {
      slot.count = (slot.count || 0) - 1;
      return true;
    }
    return false;
  }

  public addNutrients(amount: number) {
    const slot = this.hotbarSlots.find(s => s.id === 'nutrient');
    if (slot) {
      slot.count = (slot.count || 0) + amount;
    }
  }

  public syncCountsFromSlots() {
    this.seedCounts = { kelp: 0, coral: 0, pearl: 0, jellyshroom: 0 };
    this.harvestCounts = { kelp: 0, coral: 0, pearl: 0, jellyshroom: 0 };
    for (let i = 0; i < this.hotbarSlots.length; i++) {
      const slot = this.hotbarSlots[i];
      if (!slot) continue;
      // Wipe non-tool items that reached 0 so slot is clean empty
      if (slot.type !== 'tool' && slot.type !== 'nutrient' && (!slot.count || slot.count <= 0)) {
        this.hotbarSlots[i] = {
          type: i <= SEED_END_SLOT ? 'seed' : 'harvest',
          id: 'empty',
          name: i <= SEED_END_SLOT ? 'Empty Seed Slot' : 'Empty Harvest Slot',
          icon: '',
          count: 0
        };
        continue;
      }
      if (slot.type === 'seed' && slot.id in this.seedCounts && slot.count && slot.count > 0) {
        this.seedCounts[slot.id as CropId] = (this.seedCounts[slot.id as CropId] || 0) + slot.count;
      } else if (slot.type === 'harvest' && slot.id in this.harvestCounts && slot.count && slot.count > 0) {
        this.harvestCounts[slot.id as CropId] = (this.harvestCounts[slot.id as CropId] || 0) + slot.count;
      }
    }
  }

  public syncHotbarCounts() {
    for (let i = SEED_START_SLOT; i <= SEED_END_SLOT; i++) {
      const slot = this.hotbarSlots[i];
      if (slot && slot.type === 'seed' && slot.id !== 'empty') {
        const cropId = slot.id as CropId;
        slot.count = this.seedCounts[cropId] || 0;
        if (slot.count <= 0) {
          this.hotbarSlots[i] = { type: 'seed', id: 'empty', name: 'Empty Seed Slot', icon: '', count: 0 };
        }
      }
    }
  }

  public canAddHarvest(
    cropId: CropId,
    amount: number = 1,
    mutations?: CropMutation[] | CropMutation | null,
    _weightKg?: number
  ): { canAdd: boolean; reason?: string } {
    const config = CROPS_CONFIG[cropId];
    if (!config) return { canAdd: false, reason: 'Unknown crop' };
    const mutKey = getMutationsKey(mutations);

    // Strictly check Harvest slots (6 to 8)
    for (let i = HARVEST_START_SLOT; i <= HARVEST_END_SLOT; i++) {
      const slot = this.hotbarSlots[i];
      if (slot && slot.type === 'harvest' && slot.id === cropId && getMutationsKey(slot.mutations || slot.mutation) === mutKey) {
        if ((slot.count || 0) + amount <= MAX_STACK_SIZE) {
          return { canAdd: true };
        }
      }
    }

    // Check for empty harvest slot
    for (let i = HARVEST_START_SLOT; i <= HARVEST_END_SLOT; i++) {
      const slot = this.hotbarSlots[i];
      if (!slot || slot.id === 'empty' || !slot.count || slot.count === 0) {
        return { canAdd: true };
      }
    }

    // Check if full
    for (let i = HARVEST_START_SLOT; i <= HARVEST_END_SLOT; i++) {
      const slot = this.hotbarSlots[i];
      if (slot && slot.id === cropId && getMutationsKey(slot.mutations || slot.mutation) === mutKey && (slot.count || 0) >= MAX_STACK_SIZE) {
        return { canAdd: false, reason: 'Harvest Stack Full (Max 16)!' };
      }
    }

    return { canAdd: false, reason: 'Harvest Basket Full! (Store crops in bunker chest)' };
  }

  public addHarvest(
    cropId: CropId,
    amount: number = 1,
    mutations?: CropMutation[] | CropMutation | null,
    weightKg: number = 1.0
  ): boolean {
    const validation = this.canAddHarvest(cropId, amount, mutations);
    if (!validation.canAdd) return false;

    const config = CROPS_CONFIG[cropId];
    const mutList = Array.isArray(mutations) ? mutations : (mutations ? [mutations] : []);
    const mutKey = getMutationsKey(mutList);
    this.harvestCounts[cropId] = (this.harvestCounts[cropId] || 0) + amount;

    // Calculate stacked mutation multiplier:
    const multiplier = calculateMutationMultiplier(mutList);
    const meta = getMutationPrefixAndIcons(mutList);

    // Weight factor
    const weightFactor = 1.0 + (weightKg - 1.0) * 0.10;
    const baseWithWeight = Math.max(config.seedPrice + 1, config.harvestPrice * weightFactor);
    const calculatedPrice = Number((Math.round(baseWithWeight * multiplier * 10) / 10).toFixed(1));

    const formattedWeight = weightKg.toFixed(1);
    const displayName = `${meta.prefix}${config.harvestName} (${formattedWeight} kg)`;
    const displayIcon = meta.icons ? `${config.harvestIcon}${meta.icons}` : config.harvestIcon;

    // 1. Try filling existing partial stack in Harvest slots 6 to 8
    for (let i = HARVEST_START_SLOT; i <= HARVEST_END_SLOT; i++) {
      const slot = this.hotbarSlots[i];
      if (
        slot &&
        slot.type === 'harvest' &&
        slot.id === cropId &&
        getMutationsKey(slot.mutations || slot.mutation) === mutKey &&
        (slot.count || 0) < MAX_STACK_SIZE
      ) {
        const curCount = slot.count || 0;
        const curWeight = slot.weightKg || 1.0;
        const curPrice = slot.price || config.harvestPrice;
        const newCount = Math.min(MAX_STACK_SIZE, curCount + amount);
        const avgWeight = Number(((curWeight * curCount + weightKg * amount) / newCount).toFixed(1));
        const avgPrice = Number(((curPrice * curCount + calculatedPrice * amount) / newCount).toFixed(1));

        slot.count = newCount;
        slot.weightKg = avgWeight;
        slot.price = avgPrice;
        slot.mutations = mutList;
        slot.mutation = mutList.length > 0 ? mutList[mutList.length - 1] : null;
        slot.name = `${meta.prefix}${config.harvestName} (${avgWeight} kg)`;
        return true;
      }
    }

    // 2. Put into empty slot in Harvest slots 6 to 8
    for (let i = HARVEST_START_SLOT; i <= HARVEST_END_SLOT; i++) {
      const slot = this.hotbarSlots[i];
      if (!slot || slot.id === 'empty' || !slot.count || slot.count === 0) {
        this.hotbarSlots[i] = {
          type: 'harvest',
          id: cropId,
          name: displayName,
          icon: displayIcon,
          count: amount,
          price: calculatedPrice,
          mutations: mutList,
          mutation: mutList.length > 0 ? mutList[mutList.length - 1] : null,
          weightKg: Number(weightKg.toFixed(1))
        };
        return true;
      }
    }

    return true;
  }

  public canAddSeed(cropId: CropId, amount: number = 1): boolean {
    // Strictly check Seed slots 3 to 5
    for (let i = SEED_START_SLOT; i <= SEED_END_SLOT; i++) {
      const slot = this.hotbarSlots[i];
      if (slot && slot.type === 'seed' && slot.id === cropId && (slot.count || 0) + amount <= MAX_STACK_SIZE) {
        return true;
      }
    }
    for (let i = SEED_START_SLOT; i <= SEED_END_SLOT; i++) {
      const slot = this.hotbarSlots[i];
      if (!slot || slot.id === 'empty' || !slot.count || slot.count === 0) return true;
    }
    return false;
  }

  public addSeed(cropId: CropId, amount: number = 1): boolean {
    const config = CROPS_CONFIG[cropId];
    this.seedCounts[cropId] = (this.seedCounts[cropId] || 0) + amount;

    // 1. Try adding to existing seed slot in 3 to 5
    for (let i = SEED_START_SLOT; i <= SEED_END_SLOT; i++) {
      const slot = this.hotbarSlots[i];
      if (slot && slot.type === 'seed' && slot.id === cropId && (slot.count || 0) < MAX_STACK_SIZE) {
        slot.count = Math.min(MAX_STACK_SIZE, (slot.count || 0) + amount);
        return true;
      }
    }

    // 2. Put into empty seed slot in 3 to 5
    for (let i = SEED_START_SLOT; i <= SEED_END_SLOT; i++) {
      const slot = this.hotbarSlots[i];
      if (!slot || slot.id === 'empty' || !slot.count || slot.count === 0) {
        this.hotbarSlots[i] = {
          type: 'seed',
          id: cropId,
          name: config.name,
          icon: config.seedIcon,
          count: amount
        };
        return true;
      }
    }

    return false;
  }

  public useSeed(cropId: CropId): boolean {
    for (let i = SEED_START_SLOT; i <= SEED_END_SLOT; i++) {
      const slot = this.hotbarSlots[i];
      if (slot && slot.type === 'seed' && slot.id === cropId && (slot.count || 0) > 0) {
        slot.count = (slot.count || 0) - 1;
        this.seedCounts[cropId] = Math.max(0, (this.seedCounts[cropId] || 0) - 1);
        if (slot.count === 0) {
          // Completely clear the slot so it is empty!
          this.hotbarSlots[i] = { type: 'seed', id: 'empty', name: 'Empty Seed Slot', icon: '', count: 0 };
        }
        return true;
      }
    }
    return false;
  }

  public addItem(item: {
    type: ItemType;
    id: string;
    name: string;
    icon: string;
    count: number;
    price?: number;
    mutations?: CropMutation[];
    mutation?: CropMutation | null;
    weightKg?: number;
  }): boolean {
    if (item.type === 'seed') {
      return this.addSeed(item.id as CropId, item.count);
    }
    if (item.type === 'harvest') {
      return this.addHarvest(item.id as CropId, item.count, item.mutations || item.mutation, item.weightKg || 1.0);
    }
    if (item.type === 'nutrient') {
      this.addNutrients(item.count);
      return true;
    }
    return false;
  }

  public consumeOxygen(delta: number) {
    this.oxygen = Math.max(0, this.oxygen - delta);
  }

  public replenishOxygen(amount: number) {
    this.oxygen = Math.min(this.maxOxygen, this.oxygen + amount);
  }

  public addShells(amount: number) {
    this.pearlShells = Math.round((this.pearlShells + amount) * 10) / 10;
  }

  public spendShells(amount: number): boolean {
    if (this.pearlShells >= amount) {
      this.pearlShells = Math.round((this.pearlShells - amount) * 10) / 10;
      return true;
    }
    return false;
  }

  public getSwimSpeed(): number {
    return 135 + (this.swimSpeedLevel - 1) * 35; // base speed ~135 px/sec
  }

  public getSpotlightDist(): number {
    return 220 + (this.spotlightLevel - 1) * 55;
  }
}

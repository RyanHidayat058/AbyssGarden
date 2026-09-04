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

export const MAX_HOTBAR_SLOTS = 6;
export const MAX_STACK_SIZE = 16;
// Slots 0 and 1 are permanent tools: Shovel (⛏️) and Leveler / Sapu (🧹). They MUST NEVER be overwritten!
export const ITEM_START_SLOT = 2; // Slots 2..5 (Hotkeys 3, 4, 5, 6)

export function getMutationsKey(mutations?: CropMutation[] | CropMutation | null): string {
  if (!mutations) return '';
  const list = Array.isArray(mutations) ? mutations : [mutations];
  return [...list].sort().join('+');
}

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

  // Strictly 6 slots hotbar:
  // Slot 0 (Key 1): Sand Shovel (⛏️, permanent unlimited tool)
  // Slot 1 (Key 2): Sand Leveler / Sapu (🧹, permanent unlimited tool - NEVER overwritten)
  // Slot 2 (Key 3): Plankton Nutrients (🧪, consumable; vanishes when 0)
  // Slots 3-5 (Keys 4-6): Seeds / Flora Harvests / Backpack items
  public selectedSlotIndex: number = 0;
  public hotbarSlots: HotbarSlot[] = [
    { type: 'tool', id: 'shovel', name: 'Sand Shovel', icon: '⛏️' },
    { type: 'tool', id: 'leveler', name: 'Sand Leveler', icon: '🧹' },
    { type: 'nutrient', id: 'nutrient', name: 'Plankton Nutrients', icon: '🧪', count: 5 },
    { type: 'seed', id: 'kelp', name: 'Kelp Spores', icon: CROPS_CONFIG.kelp.seedIcon, count: 4 },
    { type: 'seed', id: 'coral', name: 'Coral Polyps', icon: CROPS_CONFIG.coral.seedIcon, count: 2 },
    { type: 'seed', id: 'pearl', name: 'Oyster Seed', icon: CROPS_CONFIG.pearl.seedIcon, count: 1 }
  ];

  // Callback for reactive UI updates (instant HUD re-render on any inventory change)
  public onChange?: () => void;

  public notifyChange() {
    if (this.onChange) {
      this.onChange();
    }
  }

  public getSelectedSlot(): HotbarSlot {
    return this.hotbarSlots[this.selectedSlotIndex] || this.hotbarSlots[0];
  }

  public selectSlot(index: number) {
    if (index >= 0 && index < this.hotbarSlots.length) {
      this.selectedSlotIndex = index;
      this.notifyChange();
    }
  }

  public get nutrientCount(): number {
    let total = 0;
    for (let i = ITEM_START_SLOT; i < this.hotbarSlots.length; i++) {
      const slot = this.hotbarSlots[i];
      if (slot && slot.id === 'nutrient' && slot.count && slot.count > 0) {
        total += slot.count;
      }
    }
    return total;
  }

  public useNutrient(): boolean {
    for (let i = ITEM_START_SLOT; i < this.hotbarSlots.length; i++) {
      const slot = this.hotbarSlots[i];
      if (slot && slot.id === 'nutrient' && (slot.count || 0) > 0) {
        slot.count = (slot.count || 0) - 1;
        if (slot.count <= 0) {
          // Vanishes completely when depleted!
          this.hotbarSlots[i] = {
            type: 'harvest',
            id: 'empty',
            name: 'Empty Slot',
            icon: '',
            count: 0
          };
        }
        this.notifyChange();
        return true;
      }
    }
    return false;
  }

  public canAddNutrients(amount: number = 5): boolean {
    // 1. Check existing nutrient slot with room in item slots (2..5)
    for (let i = ITEM_START_SLOT; i < this.hotbarSlots.length; i++) {
      const slot = this.hotbarSlots[i];
      if (slot && slot.id === 'nutrient' && (slot.count || 0) + amount <= MAX_STACK_SIZE) {
        return true;
      }
    }
    // 2. Check for empty slot in item slots (2..5)
    for (let i = ITEM_START_SLOT; i < this.hotbarSlots.length; i++) {
      const slot = this.hotbarSlots[i];
      if (!slot || slot.id === 'empty' || !slot.count || slot.count === 0) {
        return true;
      }
    }
    return false;
  }

  public addNutrients(amount: number = 5): boolean {
    // 1. Add to existing nutrient slot in item slots (2..5)
    for (let i = ITEM_START_SLOT; i < this.hotbarSlots.length; i++) {
      const slot = this.hotbarSlots[i];
      if (slot && slot.id === 'nutrient' && (slot.count || 0) < MAX_STACK_SIZE) {
        slot.count = Math.min(MAX_STACK_SIZE, (slot.count || 0) + amount);
        this.notifyChange();
        return true;
      }
    }
    // 2. Fill first empty slot in item slots (2..5)
    for (let i = ITEM_START_SLOT; i < this.hotbarSlots.length; i++) {
      const slot = this.hotbarSlots[i];
      if (!slot || slot.id === 'empty' || !slot.count || slot.count === 0) {
        this.hotbarSlots[i] = {
          type: 'nutrient',
          id: 'nutrient',
          name: 'Plankton Nutrients',
          icon: '🧪',
          count: amount
        };
        this.notifyChange();
        return true;
      }
    }
    return false;
  }

  public syncCountsFromSlots() {
    this.seedCounts = { kelp: 0, coral: 0, pearl: 0, jellyshroom: 0 };
    this.harvestCounts = { kelp: 0, coral: 0, pearl: 0, jellyshroom: 0 };

    // GUARANTEE: Slot 0 is ALWAYS Shovel
    if (!this.hotbarSlots[0] || this.hotbarSlots[0].id !== 'shovel') {
      this.hotbarSlots[0] = { type: 'tool', id: 'shovel', name: 'Sand Shovel', icon: '⛏️' };
    }

    // GUARANTEE: Slot 1 is ALWAYS Sand Leveler / Sapu (🧹)
    if (!this.hotbarSlots[1] || this.hotbarSlots[1].id !== 'leveler') {
      const displaced = this.hotbarSlots[1];
      this.hotbarSlots[1] = { type: 'tool', id: 'leveler', name: 'Sand Leveler', icon: '🧹' };
      // If slot 1 had an item, rescue it to the first free item slot (2..5)
      if (displaced && displaced.type !== 'tool' && (displaced.count || 0) > 0 && displaced.id !== 'empty') {
        for (let j = ITEM_START_SLOT; j < this.hotbarSlots.length; j++) {
          if (!this.hotbarSlots[j] || this.hotbarSlots[j].id === 'empty' || !this.hotbarSlots[j].count || this.hotbarSlots[j].count === 0) {
            this.hotbarSlots[j] = displaced;
            break;
          }
        }
      }
    }

    // Process item slots (2..5)
    for (let i = ITEM_START_SLOT; i < this.hotbarSlots.length; i++) {
      const slot = this.hotbarSlots[i];
      if (!slot) continue;

      // Wipe non-tool items that reached 0 so slot is clean empty
      if (slot.type !== 'tool' && (!slot.count || slot.count <= 0)) {
        this.hotbarSlots[i] = {
          type: 'harvest',
          id: 'empty',
          name: 'Empty Slot',
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
    this.notifyChange();
  }

  public canAddHarvest(
    cropId: CropId,
    amount: number = 1,
    mutations?: CropMutation[] | CropMutation | null,
    weightKg: number = 1.0
  ): { canAdd: boolean; reason?: string } {
    const config = CROPS_CONFIG[cropId];
    if (!config) return { canAdd: false, reason: 'Unknown crop' };
    const mutKey = getMutationsKey(mutations);
    const targetWeight = Number(weightKg.toFixed(1));

    // 1. Check if an existing identical stack exists with room in item slots (2..5)
    for (let i = ITEM_START_SLOT; i < this.hotbarSlots.length; i++) {
      const slot = this.hotbarSlots[i];
      if (
        slot &&
        slot.type === 'harvest' &&
        slot.id === cropId &&
        getMutationsKey(slot.mutations || slot.mutation) === mutKey &&
        Number((slot.weightKg || 1.0).toFixed(1)) === targetWeight
      ) {
        if ((slot.count || 0) + amount <= MAX_STACK_SIZE) {
          return { canAdd: true };
        }
      }
    }

    // 2. Check for an empty slot in item slots (2..5)
    for (let i = ITEM_START_SLOT; i < this.hotbarSlots.length; i++) {
      const slot = this.hotbarSlots[i];
      if (!slot || slot.id === 'empty' || !slot.count || slot.count === 0) {
        return { canAdd: true };
      }
    }

    // 3. Inventory is full
    for (let i = ITEM_START_SLOT; i < this.hotbarSlots.length; i++) {
      const slot = this.hotbarSlots[i];
      if (
        slot &&
        slot.id === cropId &&
        getMutationsKey(slot.mutations || slot.mutation) === mutKey &&
        Number((slot.weightKg || 1.0).toFixed(1)) === targetWeight &&
        (slot.count || 0) >= MAX_STACK_SIZE
      ) {
        return { canAdd: false, reason: 'Harvest Stack Full (Max 16)!' };
      }
    }

    return { canAdd: false, reason: 'Inventory Full! No free slot (Sell or store in chest)' };
  }

  public addHarvest(
    cropId: CropId,
    amount: number = 1,
    mutations?: CropMutation[] | CropMutation | null,
    weightKg: number = 1.0
  ): boolean {
    const validation = this.canAddHarvest(cropId, amount, mutations, weightKg);
    if (!validation.canAdd) return false;

    const config = CROPS_CONFIG[cropId];
    const mutList = Array.isArray(mutations) ? mutations : (mutations ? [mutations] : []);
    const mutKey = getMutationsKey(mutList);
    const targetWeight = Number(weightKg.toFixed(1));

    this.harvestCounts[cropId] = (this.harvestCounts[cropId] || 0) + amount;

    // Calculate mutation multiplier & pricing
    const multiplier = calculateMutationMultiplier(mutList);
    const meta = getMutationPrefixAndIcons(mutList);
    const weightFactor = 1.0 + (targetWeight - 1.0) * 0.10;
    const baseWithWeight = Math.max(config.seedPrice + 1, config.harvestPrice * weightFactor);
    const calculatedPrice = Number((Math.round(baseWithWeight * multiplier * 10) / 10).toFixed(1));

    const displayName = `${meta.prefix}${config.harvestName} (${targetWeight.toFixed(1)} kg)`;
    const displayIcon = meta.icons ? `${config.harvestIcon}${meta.icons}` : config.harvestIcon;

    // 1. Try stacking into existing identical slot in item slots (2..5)
    for (let i = ITEM_START_SLOT; i < this.hotbarSlots.length; i++) {
      const slot = this.hotbarSlots[i];
      if (
        slot &&
        slot.type === 'harvest' &&
        slot.id === cropId &&
        getMutationsKey(slot.mutations || slot.mutation) === mutKey &&
        Number((slot.weightKg || 1.0).toFixed(1)) === targetWeight &&
        (slot.count || 0) < MAX_STACK_SIZE
      ) {
        slot.count = Math.min(MAX_STACK_SIZE, (slot.count || 0) + amount);
        this.notifyChange();
        return true;
      }
    }

    // 2. Put into first empty slot in item slots (2..5)
    for (let i = ITEM_START_SLOT; i < this.hotbarSlots.length; i++) {
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
          weightKg: targetWeight
        };
        this.notifyChange();
        return true;
      }
    }

    return false;
  }

  public canAddSeed(cropId: CropId, amount: number = 1): boolean {
    // 1. Check existing seed stack with room in item slots (2..5)
    for (let i = ITEM_START_SLOT; i < this.hotbarSlots.length; i++) {
      const slot = this.hotbarSlots[i];
      if (slot && slot.type === 'seed' && slot.id === cropId && (slot.count || 0) + amount <= MAX_STACK_SIZE) {
        return true;
      }
    }
    // 2. Check for empty slot in item slots (2..5)
    for (let i = ITEM_START_SLOT; i < this.hotbarSlots.length; i++) {
      const slot = this.hotbarSlots[i];
      if (!slot || slot.id === 'empty' || !slot.count || slot.count === 0) {
        return true;
      }
    }
    return false;
  }

  public addSeed(cropId: CropId, amount: number = 1): boolean {
    const config = CROPS_CONFIG[cropId];
    this.seedCounts[cropId] = (this.seedCounts[cropId] || 0) + amount;

    // 1. Try adding to existing matching seed stack in item slots (2..5)
    for (let i = ITEM_START_SLOT; i < this.hotbarSlots.length; i++) {
      const slot = this.hotbarSlots[i];
      if (slot && slot.type === 'seed' && slot.id === cropId && (slot.count || 0) < MAX_STACK_SIZE) {
        slot.count = Math.min(MAX_STACK_SIZE, (slot.count || 0) + amount);
        this.notifyChange();
        return true;
      }
    }

    // 2. Put into first empty slot in item slots (2..5)
    for (let i = ITEM_START_SLOT; i < this.hotbarSlots.length; i++) {
      const slot = this.hotbarSlots[i];
      if (!slot || slot.id === 'empty' || !slot.count || slot.count === 0) {
        this.hotbarSlots[i] = {
          type: 'seed',
          id: cropId,
          name: config.name,
          icon: config.seedIcon,
          count: amount
        };
        this.notifyChange();
        return true;
      }
    }

    return false;
  }

  public useSeed(cropId: CropId): boolean {
    for (let i = ITEM_START_SLOT; i < this.hotbarSlots.length; i++) {
      const slot = this.hotbarSlots[i];
      if (slot && slot.type === 'seed' && slot.id === cropId && (slot.count || 0) > 0) {
        slot.count = (slot.count || 0) - 1;
        this.seedCounts[cropId] = Math.max(0, (this.seedCounts[cropId] || 0) - 1);
        if (slot.count === 0) {
          // Completely clear the slot so it is empty!
          this.hotbarSlots[i] = {
            type: 'harvest',
            id: 'empty',
            name: 'Empty Slot',
            icon: '',
            count: 0
          };
        }
        this.syncCountsFromSlots();
        this.notifyChange();
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
      return this.addNutrients(item.count);
    }
    if (item.type === 'refined') {
      // Find matching refined stack or empty slot in item slots (2..5)
      for (let i = ITEM_START_SLOT; i < this.hotbarSlots.length; i++) {
        const slot = this.hotbarSlots[i];
        if (slot && slot.type === 'refined' && slot.id === item.id && (slot.count || 0) + item.count <= MAX_STACK_SIZE) {
          slot.count = (slot.count || 0) + item.count;
          this.notifyChange();
          return true;
        }
      }
      for (let i = ITEM_START_SLOT; i < this.hotbarSlots.length; i++) {
        const slot = this.hotbarSlots[i];
        if (!slot || slot.id === 'empty' || !slot.count || slot.count === 0) {
          this.hotbarSlots[i] = { ...item };
          this.notifyChange();
          return true;
        }
      }
      return false;
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

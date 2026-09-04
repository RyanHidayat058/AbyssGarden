import { StorageChest } from '../entities/Chest';
import { Inventory } from '../farming/Inventory';
import { SoundSystem } from '../core/Sound';

export class ChestModal {
  private modalEl: HTMLElement;
  private titleEl: HTMLElement;
  private chestGridEl: HTMLElement;
  private hotbarGridEl: HTMLElement;
  private messageEl: HTMLElement;

  public isOpen: boolean = false;
  private activeChest: StorageChest | null = null;

  constructor(
    private inventory: Inventory,
    private sound: SoundSystem,
    private onStateChange?: () => void
  ) {
    this.modalEl = document.getElementById('modal-chest')!;
    this.titleEl = document.getElementById('chest-title')!;
    this.chestGridEl = document.getElementById('chest-grid')!;
    this.hotbarGridEl = document.getElementById('chest-hotbar-grid')!;
    this.messageEl = document.getElementById('chest-message')!;

    this.setupEvents();
  }

  private setupEvents() {
    document.getElementById('btn-close-chest')?.addEventListener('click', () => {
      this.close();
    });

    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.key === 'Escape') {
        this.close();
      }
    });
  }

  public open(chest: StorageChest) {
    this.activeChest = chest;
    this.isOpen = true;
    this.modalEl.classList.remove('hidden');
    this.sound.playClick();
    this.render();
  }

  public close() {
    this.isOpen = false;
    this.activeChest = null;
    this.modalEl.classList.add('hidden');
    this.sound.playClick();
    if (this.onStateChange) this.onStateChange();
  }

  public render() {
    if (!this.activeChest) return;

    this.titleEl.textContent = `${this.activeChest.config.name} (${this.activeChest.config.capacity} Slots)`;
    this.messageEl.textContent = 'Click an item to transfer between Chest and Hotbar (Max Stack: 16)';
    this.messageEl.className = 'chest-info-tip';

    this.chestGridEl.innerHTML = '';
    this.chestGridEl.className = `chest-grid tier-${this.activeChest.tier}`;

    this.activeChest.slots.forEach((slot, index) => {
      const slotEl = document.createElement('div');
      slotEl.className = `chest-slot ${slot ? 'has-item' : 'empty'}`;

      if (slot) {
        slotEl.innerHTML = `
          <div class="item-icon">${slot.icon}</div>
          <div class="item-count">${slot.count}</div>
          <div class="item-tooltip">${slot.name} (x${slot.count})</div>
        `;
        slotEl.addEventListener('click', () => this.transferFromChest(index));
      } else {
        slotEl.innerHTML = `<div class="empty-slot-label">${index + 1}</div>`;
      }

      this.chestGridEl.appendChild(slotEl);
    });

    this.hotbarGridEl.innerHTML = '';
    this.inventory.hotbarSlots.forEach((slot, index) => {
      const slotEl = document.createElement('div');
      slotEl.className = `hotbar-slot-box ${slot.count ? 'has-item' : 'tool-or-empty'}`;

      if (slot.type === 'tool') {
        slotEl.innerHTML = `
          <div class="item-icon">${slot.icon}</div>
          <div class="item-badge">Tool</div>
          <div class="item-tooltip">${slot.name} (Equipped)</div>
        `;
      } else if (slot.count && slot.count > 0) {
        slotEl.innerHTML = `
          <div class="item-icon">${slot.icon}</div>
          <div class="item-count">${slot.count}</div>
          <div class="item-tooltip">${slot.name} (x${slot.count})</div>
        `;
        slotEl.addEventListener('click', () => this.transferToChest(index));
      } else {
        slotEl.innerHTML = `<div class="empty-slot-label">Empty</div>`;
      }

      this.hotbarGridEl.appendChild(slotEl);
    });
  }

  private showMessage(msg: string, isError: boolean = false) {
    this.messageEl.textContent = msg;
    this.messageEl.className = isError ? 'chest-info-tip error' : 'chest-info-tip';
  }

  private transferFromChest(chestSlotIndex: number) {
    if (!this.activeChest) return;
    const item = this.activeChest.slots[chestSlotIndex];
    if (!item || item.count <= 0) return;

    const added = this.inventory.addItem({
      type: item.type,
      id: item.id,
      name: item.name,
      icon: item.icon,
      count: item.count,
      price: item.price,
      mutations: item.mutations,
      mutation: item.mutation,
      weightKg: item.weightKg
    });

    if (added) {
      this.activeChest.slots[chestSlotIndex] = null;
      this.sound.playCoin();
      this.showMessage(`Transferred ${item.name} to Hotbar.`);
      this.render();
      if (this.onStateChange) this.onStateChange();
    } else {
      this.sound.playHurt();
      this.showMessage('Hotbar full! (6 slots max, 16 per stack)', true);
    }
  }

  private transferToChest(hotbarSlotIndex: number) {
    if (!this.activeChest) return;
    const slot = this.inventory.hotbarSlots[hotbarSlotIndex];
    if (!slot || slot.type === 'tool' || !slot.count || slot.count <= 0) {
      return;
    }

    const deposited = this.activeChest.depositItem({
      type: slot.type,
      id: slot.id,
      name: slot.name,
      icon: slot.icon,
      count: slot.count,
      price: slot.price,
      mutations: slot.mutations,
      mutation: slot.mutation,
      weightKg: slot.weightKg
    });

    if (deposited) {
      const storedName = slot.name;
      slot.count = 0;
      slot.id = 'empty';
      slot.name = slot.type === 'seed' ? 'Empty Seed Slot' : (slot.type === 'harvest' ? 'Empty Harvest Slot' : 'Empty Slot');
      slot.icon = '';
      slot.price = 0;
      slot.mutations = [];
      slot.mutation = undefined;
      this.inventory.syncCountsFromSlots();
      this.sound.playCoin();
      this.showMessage(`Stored ${storedName} in Chest.`);
      this.render();
      if (this.onStateChange) this.onStateChange();
    } else {
      this.sound.playHurt();
      this.showMessage(`Chest is full! (${this.activeChest.config.capacity} slots max, 16 per stack)`, true);
    }
  }
}

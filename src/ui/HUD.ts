import { Inventory, HotbarSlot } from '../farming/Inventory';

export class HUD {
  private shellCountEl: HTMLElement;
  private oxygenBarEl: HTMLElement;
  private oxygenTextEl: HTMLElement;
  private tideIconEl: HTMLElement;
  private tidePhaseEl: HTMLElement;
  private tideClockEl: HTMLElement;
  private hotbarSlotsEl: HTMLElement;
  private actionPromptEl: HTMLElement;
  private promptTextEl: HTMLElement;
  private diverAvatarEl: HTMLElement;
  private diverNameEl: HTMLElement;
  private diverRankEl: HTMLElement;

  constructor(
    private inventory: Inventory,
    private onSlotSelect: (index: number) => void
  ) {
    this.shellCountEl = document.getElementById('shell-count')!;
    this.oxygenBarEl = document.getElementById('oxygen-bar')!;
    this.oxygenTextEl = document.getElementById('oxygen-text')!;
    this.tideIconEl = document.getElementById('tide-icon')!;
    this.tidePhaseEl = document.getElementById('tide-phase')!;
    this.tideClockEl = document.getElementById('tide-clock')!;
    this.hotbarSlotsEl = document.getElementById('hotbar-slots')!;
    this.actionPromptEl = document.getElementById('action-prompt')!;
    this.promptTextEl = document.getElementById('prompt-text')!;
    this.diverAvatarEl = document.getElementById('diver-avatar-hud')!;
    this.diverNameEl = document.getElementById('diver-name-hud')!;
    this.diverRankEl = document.getElementById('diver-rank-hud')!;

    this.renderHotbar();
  }

  public updateDiverBadge(name: string, rank: string, avatar: string = '🤿') {
    this.diverNameEl.textContent = name;
    this.diverRankEl.textContent = rank;
    this.diverAvatarEl.textContent = avatar;
  }

  public renderSlots() {
    this.renderHotbar();
  }

  public renderHotbar() {
    this.hotbarSlotsEl.innerHTML = '';

    this.inventory.hotbarSlots.forEach((slot: HotbarSlot, index: number) => {
      const slotEl = document.createElement('div');
      const isEmpty = slot.id === 'empty' || !slot.icon || (slot.count === 0 && slot.type !== 'tool');

      slotEl.className = `hotbar-slot ${index === this.inventory.selectedSlotIndex ? 'active' : ''} ${isEmpty ? 'is-empty' : ''}`;

      if (index === 0) slotEl.classList.add('group-start-tool');
      if (index === 3) slotEl.classList.add('group-start-seed');
      if (index === 6) slotEl.classList.add('group-start-harvest');

      slotEl.title = isEmpty ? `Slot ${index + 1} (Empty)` : slot.name;

      const keyLabel = document.createElement('span');
      keyLabel.className = 'slot-key';
      keyLabel.textContent = `${index + 1}`;

      const icon = document.createElement('span');
      icon.className = 'slot-icon';
      icon.textContent = isEmpty ? '' : slot.icon;

      slotEl.appendChild(keyLabel);
      slotEl.appendChild(icon);

      if (slot.type === 'nutrient' && slot.count !== undefined) {
        const count = document.createElement('span');
        count.className = `slot-count ${slot.count === 0 ? 'empty-count' : ''}`;
        count.textContent = `${slot.count}`;
        slotEl.appendChild(count);
      } else if (slot.type !== 'tool' && slot.count && slot.count > 0) {
        const count = document.createElement('span');
        count.className = 'slot-count';
        count.textContent = `${slot.count}`;
        slotEl.appendChild(count);
      }

      slotEl.addEventListener('click', () => {
        this.onSlotSelect(index);
      });

      this.hotbarSlotsEl.appendChild(slotEl);
    });
  }

  public update(timeOfDay: number, dayNumber: number, promptMessage: string | null) {
    // 1. Update Currency
    const s = this.inventory.pearlShells;
    this.shellCountEl.textContent = Number.isInteger(s) ? `${s}` : s.toFixed(1);

    // 2. Update Oxygen Bar
    const oxyPercent = Math.max(0, Math.min(100, Math.round((this.inventory.oxygen / this.inventory.maxOxygen) * 100)));
    this.oxygenBarEl.style.width = `${oxyPercent}%`;
    this.oxygenTextEl.textContent = `${oxyPercent}%`;

    if (oxyPercent <= 25) {
      this.oxygenBarEl.classList.add('low');
    } else {
      this.oxygenBarEl.classList.remove('low');
    }

    // 3. Update Tide / Day-Night Phase
    // timeOfDay: 0.0 to 1.0 (0.0 = 06:00, 0.5 = 18:00, 1.0 = 06:00 next day)
    const hourFloat = (timeOfDay * 24 + 6) % 24;
    const hours = Math.floor(hourFloat);
    const minutes = Math.floor((hourFloat - hours) * 60);
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    this.tideClockEl.textContent = `Day ${dayNumber} • ${timeStr}`;

    if (hourFloat >= 6 && hourFloat < 17) {
      this.tideIconEl.textContent = '☀️';
      this.tidePhaseEl.textContent = 'Sunlit Shallow Tide';
    } else if (hourFloat >= 17 && hourFloat < 20) {
      this.tideIconEl.textContent = '🌅';
      this.tidePhaseEl.textContent = 'Abyssal Dusk Tide';
    } else {
      this.tideIconEl.textContent = '🌙';
      this.tidePhaseEl.textContent = 'Deep Abyssal Night';
    }

    // 4. Update Hotbar Active, Counts & Icons
    const slotElements = this.hotbarSlotsEl.children;
    for (let i = 0; i < slotElements.length; i++) {
      const el = slotElements[i] as HTMLElement;
      if (i === this.inventory.selectedSlotIndex) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }

      const slotData = this.inventory.hotbarSlots[i];
      if (!slotData) continue;
      const isEmpty = slotData.id === 'empty' || !slotData.icon || (slotData.count === 0 && slotData.type !== 'tool');

      if (isEmpty) {
        el.classList.add('is-empty');
        el.title = `Slot ${i + 1} (Empty)`;
      } else {
        el.classList.remove('is-empty');
        el.title = slotData.name;
      }

      const iconEl = el.querySelector('.slot-icon');
      if (iconEl) {
        iconEl.textContent = isEmpty ? '' : slotData.icon;
      }

      let countEl = el.querySelector('.slot-count') as HTMLElement | null;
      if (slotData.type === 'nutrient' && slotData.count !== undefined) {
        if (!countEl) {
          countEl = document.createElement('span');
          countEl.className = 'slot-count';
          el.appendChild(countEl);
        }
        countEl.textContent = `${slotData.count}`;
        if (slotData.count === 0) {
          countEl.classList.add('empty-count');
        } else {
          countEl.classList.remove('empty-count');
        }
      } else if (slotData.type !== 'tool' && slotData.count && slotData.count > 0) {
        if (!countEl) {
          countEl = document.createElement('span');
          countEl.className = 'slot-count';
          el.appendChild(countEl);
        }
        countEl.textContent = `${slotData.count}`;
        countEl.classList.remove('empty-count');
      } else {
        if (countEl) {
          countEl.remove();
        }
      }
    }

    // 5. Update Action Prompt
    if (promptMessage) {
      this.promptTextEl.textContent = promptMessage;
      this.actionPromptEl.classList.remove('hidden');
    } else {
      this.actionPromptEl.classList.add('hidden');
    }
  }
}

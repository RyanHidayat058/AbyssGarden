import { Inventory } from '../farming/Inventory';
import { CropId, CROPS_CONFIG } from '../farming/Crops';
import { SoundSystem } from '../core/Sound';

export class ShopModal {
  private modalEl: HTMLElement;
  private sporesListEl: HTMLElement;
  private gearListEl: HTMLElement;
  private sellListEl: HTMLElement;

  private tabSporesBtn: HTMLElement;
  private tabGearBtn: HTMLElement;
  private tabSellBtn: HTMLElement;
  private shopShellCountEl: HTMLElement;

  public isOpen: boolean = false;
  private activeTab: 'spores' | 'gear' | 'sell' = 'spores';

  constructor(
    private inventory: Inventory,
    private sound: SoundSystem,
    private onTrade?: (earnedShells: number) => void,
    private onSpend?: (spentShells: number) => void
  ) {
    this.modalEl = document.getElementById('modal-shop')!;
    this.sporesListEl = document.getElementById('shop-spores-list')!;
    this.gearListEl = document.getElementById('shop-gear-list')!;
    this.sellListEl = document.getElementById('shop-sell-list')!;

    this.tabSporesBtn = document.getElementById('tab-spores')!;
    this.tabGearBtn = document.getElementById('tab-gear')!;
    this.tabSellBtn = document.getElementById('tab-sell')!;
    this.shopShellCountEl = document.getElementById('shop-shell-count')!;

    this.setupEvents();
  }

  private setupEvents() {
    document.getElementById('btn-close-shop')?.addEventListener('click', () => {
      this.close();
    });

    this.tabSporesBtn.addEventListener('click', () => this.switchTab('spores'));
    this.tabGearBtn.addEventListener('click', () => this.switchTab('gear'));
    this.tabSellBtn.addEventListener('click', () => this.switchTab('sell'));
  }

  private switchTab(tab: 'spores' | 'gear' | 'sell') {
    this.activeTab = tab;
    this.sound.playClick();

    // Reset tab buttons
    this.tabSporesBtn.classList.remove('active');
    this.tabGearBtn.classList.remove('active');
    this.tabSellBtn.classList.remove('active');

    // Hide all lists
    this.sporesListEl.classList.add('hidden');
    this.gearListEl.classList.add('hidden');
    this.sellListEl.classList.add('hidden');

    if (tab === 'spores') {
      this.tabSporesBtn.classList.add('active');
      this.sporesListEl.classList.remove('hidden');
      this.renderSporesItems();
    } else if (tab === 'gear') {
      this.tabGearBtn.classList.add('active');
      this.gearListEl.classList.remove('hidden');
      this.renderGearItems();
    } else {
      this.tabSellBtn.classList.add('active');
      this.sellListEl.classList.remove('hidden');
      this.renderSellItems();
    }
  }

  public open() {
    this.isOpen = true;
    this.modalEl.classList.remove('hidden');
    this.sound.playClick();
    this.updateBalance();
    this.switchTab(this.activeTab);
  }

  public close() {
    this.isOpen = false;
    this.modalEl.classList.add('hidden');
    this.sound.playClick();
  }

  private updateBalance() {
    const s = this.inventory.pearlShells;
    this.shopShellCountEl.textContent = Number.isInteger(s) ? `${s}` : s.toFixed(1);
  }

  private renderSporesItems() {
    this.sporesListEl.innerHTML = '';

    const cropKeys: CropId[] = ['kelp', 'coral', 'pearl', 'jellyshroom'];
    for (const id of cropKeys) {
      const crop = CROPS_CONFIG[id];
      const card = document.createElement('div');
      card.className = 'shop-item-card';

      card.innerHTML = `
        <div class="shop-item-icon">${crop.seedIcon}</div>
        <div class="shop-item-details">
          <div class="shop-item-title">${crop.name}</div>
          <div class="shop-item-desc">${crop.description}</div>
          <div class="shop-item-price">Cost: ${crop.seedPrice} 🐚</div>
        </div>
      `;

      const buyBtn = document.createElement('button');
      buyBtn.className = 'shop-buy-btn';
      buyBtn.textContent = 'Buy 1';
      buyBtn.disabled = this.inventory.pearlShells < crop.seedPrice;

      buyBtn.addEventListener('click', () => {
        if (!this.inventory.canAddSeed(id, 1)) {
          this.sound.playHurt();
          alert('Inventory Full! No free slot (Sell items or store in chest first).');
          return;
        }
        if (this.inventory.spendShells(crop.seedPrice)) {
          this.inventory.addSeed(id, 1);
          this.sound.playCoin();
          this.onSpend?.(crop.seedPrice);
          this.updateBalance();
          this.renderSporesItems();
        }
      });

      card.appendChild(buyBtn);
      this.sporesListEl.appendChild(card);
    }
  }

  private renderGearItems() {
    this.gearListEl.innerHTML = '';

    // 1. Oxygen Tank Upgrade
    const oxyCost = this.inventory.oxygenUpgradeLevel * 220;
    const oxyCard = document.createElement('div');
    oxyCard.className = 'shop-item-card';
    oxyCard.innerHTML = `
      <div class="shop-item-icon">🤿</div>
      <div class="shop-item-details">
        <div class="shop-item-title">Oxygen Tank Mk ${this.inventory.oxygenUpgradeLevel + 1}</div>
        <div class="shop-item-desc">Expand personal diving oxygen capacity by +40 units.</div>
        <div class="shop-item-price">Cost: ${oxyCost} 🐚 (Current: ${this.inventory.maxOxygen})</div>
      </div>
    `;
    const oxyBtn = document.createElement('button');
    oxyBtn.className = 'shop-buy-btn';
    oxyBtn.textContent = 'Upgrade';
    oxyBtn.disabled = this.inventory.pearlShells < oxyCost;
    oxyBtn.addEventListener('click', () => {
      if (this.inventory.spendShells(oxyCost)) {
        this.inventory.oxygenUpgradeLevel++;
        this.inventory.maxOxygen += 40;
        this.inventory.oxygen = this.inventory.maxOxygen;
        this.sound.playCoin();
        this.onSpend?.(oxyCost);
        this.updateBalance();
        this.renderGearItems();
      }
    });
    oxyCard.appendChild(oxyBtn);
    this.gearListEl.appendChild(oxyCard);

    // 2. Hydrodynamic Fins Upgrade
    const finsCost = this.inventory.swimSpeedLevel * 260;
    const finsCard = document.createElement('div');
    finsCard.className = 'shop-item-card';
    finsCard.innerHTML = `
      <div class="shop-item-icon">🧜</div>
      <div class="shop-item-details">
        <div class="shop-item-title">Hydrodynamic Fins Mk ${this.inventory.swimSpeedLevel + 1}</div>
        <div class="shop-item-desc">High-flexibility subsea fins granting +25% swimming speed to your diver.</div>
        <div class="shop-item-price">Cost: ${finsCost} 🐚 (Level: ${this.inventory.swimSpeedLevel})</div>
      </div>
    `;
    const finsBtn = document.createElement('button');
    finsBtn.className = 'shop-buy-btn';
    finsBtn.textContent = 'Upgrade';
    finsBtn.disabled = this.inventory.pearlShells < finsCost;
    finsBtn.addEventListener('click', () => {
      if (this.inventory.spendShells(finsCost)) {
        this.inventory.swimSpeedLevel++;
        this.sound.playCoin();
        this.onSpend?.(finsCost);
        this.updateBalance();
        this.renderGearItems();
      }
    });
    finsCard.appendChild(finsBtn);
    this.gearListEl.appendChild(finsCard);

    // 3. Halogen Spotlight Upgrade
    const lightCost = this.inventory.spotlightLevel * 300;
    const lightCard = document.createElement('div');
    lightCard.className = 'shop-item-card';
    lightCard.innerHTML = `
      <div class="shop-item-icon">🔦</div>
      <div class="shop-item-details">
        <div class="shop-item-title">Abyssal Halogen Spotlight Mk ${this.inventory.spotlightLevel + 1}</div>
        <div class="shop-item-desc">Personal high-intensity beam piercing through deep ocean gloom.</div>
        <div class="shop-item-price">Cost: ${lightCost} 🐚 (Beam: ${this.inventory.getSpotlightDist()}px)</div>
      </div>
    `;
    const lightBtn = document.createElement('button');
    lightBtn.className = 'shop-buy-btn';
    lightBtn.textContent = 'Upgrade';
    lightBtn.disabled = this.inventory.pearlShells < lightCost;
    lightBtn.addEventListener('click', () => {
      if (this.inventory.spendShells(lightCost)) {
        this.inventory.spotlightLevel++;
        this.sound.playCoin();
        this.onSpend?.(lightCost);
        this.updateBalance();
        this.renderGearItems();
      }
    });
    lightCard.appendChild(lightBtn);
    this.gearListEl.appendChild(lightCard);

    // 4. Bio-Extractor Refinery Machine (Home Grotto)
    const refCard = document.createElement('div');
    refCard.className = 'shop-item-card';
    refCard.innerHTML = `
      <div class="shop-item-icon">⚗️</div>
      <div class="shop-item-details">
        <div class="shop-item-title">Bio-Extractor & Crop Refinery</div>
        <div class="shop-item-desc">Unlocks catalytic refinery in your Home Grotto to synthesize high-value capsules, gems, and elixirs.</div>
        <div class="shop-item-price">${this.inventory.hasRefinery ? 'Purchased & Active' : 'Cost: 480 Shells'}</div>
      </div>
    `;
    const refBtn = document.createElement('button');
    refBtn.className = 'shop-buy-btn';
    refBtn.textContent = this.inventory.hasRefinery ? 'Owned' : 'Purchase';
    refBtn.disabled = this.inventory.hasRefinery || this.inventory.pearlShells < 480;
    refBtn.addEventListener('click', () => {
      if (this.inventory.spendShells(480)) {
        this.inventory.hasRefinery = true;
        this.sound.playCoin();
        this.onSpend?.(480);
        this.updateBalance();
        this.renderGearItems();
      }
    });
    refCard.appendChild(refBtn);
    this.gearListEl.appendChild(refCard);

    // 5. Medium Ironwood Storage Chest (24 Slots)
    const medChestCard = document.createElement('div');
    medChestCard.className = 'shop-item-card';
    medChestCard.innerHTML = `
      <div class="shop-item-icon">📦</div>
      <div class="shop-item-details">
        <div class="shop-item-title">Medium Ironwood Chest (24 Slots)</div>
        <div class="shop-item-desc">Spacious 2x1 underwater storage chest placed inside your Home Grotto.</div>
        <div class="shop-item-price">${this.inventory.unlockedMediumChest ? 'Installed in Cave' : 'Cost: 280 Shells'}</div>
      </div>
    `;
    const medChestBtn = document.createElement('button');
    medChestBtn.className = 'shop-buy-btn';
    medChestBtn.textContent = this.inventory.unlockedMediumChest ? 'Owned' : 'Install';
    medChestBtn.disabled = this.inventory.unlockedMediumChest || this.inventory.pearlShells < 280;
    medChestBtn.addEventListener('click', () => {
      if (this.inventory.spendShells(280)) {
        this.inventory.unlockedMediumChest = true;
        this.sound.playCoin();
        this.onSpend?.(280);
        this.updateBalance();
        this.renderGearItems();
      }
    });
    medChestCard.appendChild(medChestBtn);
    this.gearListEl.appendChild(medChestCard);

    // 6. Large Abyssal Vault Chest (64 Slots)
    const lrgChestCard = document.createElement('div');
    lrgChestCard.className = 'shop-item-card';
    lrgChestCard.innerHTML = `
      <div class="shop-item-icon">🗄️</div>
      <div class="shop-item-details">
        <div class="shop-item-title">Large Abyssal Vault (64 Slots)</div>
        <div class="shop-item-desc">Massive 3x1 reinforced vault for vast deep-sea storage expeditions.</div>
        <div class="shop-item-price">${this.inventory.unlockedLargeChest ? 'Installed in Cave' : 'Cost: 650 Shells'}</div>
      </div>
    `;
    const lrgChestBtn = document.createElement('button');
    lrgChestBtn.className = 'shop-buy-btn';
    lrgChestBtn.textContent = this.inventory.unlockedLargeChest ? 'Owned' : 'Install';
    lrgChestBtn.disabled = this.inventory.unlockedLargeChest || this.inventory.pearlShells < 650;
    lrgChestBtn.addEventListener('click', () => {
      if (this.inventory.spendShells(650)) {
        this.inventory.unlockedLargeChest = true;
        this.sound.playCoin();
        this.onSpend?.(650);
        this.updateBalance();
        this.renderGearItems();
      }
    });
    lrgChestCard.appendChild(lrgChestBtn);
    this.gearListEl.appendChild(lrgChestCard);

    // 7. Plankton Nutrient Vial (5x Refill Pack)
    const nutCost = 10;
    const nutCard = document.createElement('div');
    nutCard.className = 'shop-item-card';
    nutCard.innerHTML = `
      <div class="shop-item-icon">🧪</div>
      <div class="shop-item-details">
        <div class="shop-item-title">Plankton Nutrient Vial (5x Refill)</div>
        <div class="shop-item-desc">High-potency organic accelerator to fast-track crop maturity and boost flora yield.</div>
        <div class="shop-item-price">Cost: ${nutCost} 🐚 (Current: ${this.inventory.nutrientCount} vials)</div>
      </div>
    `;
    const nutBtn = document.createElement('button');
    nutBtn.className = 'shop-buy-btn';
    nutBtn.textContent = 'Buy Pack (+5)';
    nutBtn.disabled = this.inventory.pearlShells < nutCost;
    nutBtn.addEventListener('click', () => {
      if (!this.inventory.canAddNutrients(5)) {
        this.sound.playHurt();
        alert('Inventory Full! No free slot (Sell items or store in chest first).');
        return;
      }
      if (this.inventory.spendShells(nutCost)) {
        this.inventory.addNutrients(5);
        this.sound.playCoin();
        this.onSpend?.(nutCost);
        this.updateBalance();
        this.renderGearItems();
      }
    });
    nutCard.appendChild(nutBtn);
    this.gearListEl.appendChild(nutCard);
  }

  private renderSellItems() {
    this.sellListEl.innerHTML = '';
    let hasAnyItems = false;

    // 1. Harvested Crops from Hotbar (including mutated varieties)
    for (const slot of this.inventory.hotbarSlots) {
      if (slot.type === 'harvest' && slot.count && slot.count > 0) {
        hasAnyItems = true;
        const price = slot.price || 40;

        const card = document.createElement('div');
        card.className = 'shop-item-card';

        card.innerHTML = `
          <div class="shop-item-icon">${slot.icon}</div>
          <div class="shop-item-details">
            <div class="shop-item-title">${slot.name}</div>
            <div class="shop-item-desc">In stock: <strong>${slot.count}</strong> units</div>
            <div class="shop-item-price">Sell Value: ${price} 🐚 each ${slot.mutations && slot.mutations.length > 0 ? `(${slot.mutations.map(m => m.toUpperCase()).join(' + ')})` : (slot.mutation ? `(${slot.mutation.toUpperCase()})` : '')}</div>
          </div>
        `;

        const sellBtn = document.createElement('button');
        sellBtn.className = 'shop-sell-btn';
        sellBtn.textContent = `Sell 1 (+${price} 🐚)`;

        sellBtn.addEventListener('click', () => {
          if (slot.count && slot.count > 0) {
            slot.count--;
            if (slot.count <= 0) {
              slot.count = 0;
              slot.id = 'empty';
              slot.name = 'Empty Harvest Slot';
              slot.icon = '';
              slot.price = 0;
              slot.mutations = [];
              slot.mutation = undefined;
            }
            this.inventory.addShells(price);
            this.inventory.syncCountsFromSlots();
            this.sound.playCoin();
            this.onTrade?.(price);
            this.updateBalance();
            this.renderSellItems();
          }
        });

        card.appendChild(sellBtn);
        this.sellListEl.appendChild(card);
      }
    }

    // 2. Refined Goods from hotbar slots
    for (const slot of this.inventory.hotbarSlots) {
      if (slot.type === 'refined' && slot.count && slot.count > 0) {
        hasAnyItems = true;
        const price = slot.price || 65;

        const card = document.createElement('div');
        card.className = 'shop-item-card';
        card.innerHTML = `
          <div class="shop-item-icon">${slot.icon}</div>
          <div class="shop-item-details">
            <div class="shop-item-title">${slot.name} [Refined]</div>
            <div class="shop-item-desc">In stock: <strong>${slot.count}</strong> units</div>
            <div class="shop-item-price">Sell Value: ${price} Shells each</div>
          </div>
        `;

        const sellBtn = document.createElement('button');
        sellBtn.className = 'shop-sell-btn';
        sellBtn.textContent = `Sell 1 (+${price})`;
        sellBtn.addEventListener('click', () => {
          if (slot.count && slot.count > 0) {
            slot.count--;
            if (slot.count <= 0) {
              slot.count = 0;
              slot.id = 'empty';
              slot.name = 'Empty Slot';
              slot.icon = '';
              slot.price = 0;
            }
            this.inventory.addShells(price);
            this.inventory.syncCountsFromSlots();
            this.sound.playCoin();
            this.onTrade?.(price);
            this.updateBalance();
            this.renderSellItems();
          }
        });

        card.appendChild(sellBtn);
        this.sellListEl.appendChild(card);
      }
    }

    if (!hasAnyItems) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.gridColumn = '1 / -1';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.style.padding = '30px';
      emptyMsg.style.color = 'var(--text-muted)';
      emptyMsg.textContent = 'You do not have any harvested crops or refined products in your sack. Harvest crops or refine goods to sell!';
      this.sellListEl.appendChild(emptyMsg);
    }
  }
}

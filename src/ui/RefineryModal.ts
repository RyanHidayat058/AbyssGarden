import { RefineryMachine, REFINERY_RECIPES } from '../farming/Refinery';
import { Inventory } from '../farming/Inventory';
import { SoundSystem } from '../core/Sound';

export class RefineryModal {
  private modalEl: HTMLElement;
  private statusBannerEl: HTMLElement;
  private recipeListEl: HTMLElement;
  private processingAreaEl: HTMLElement;
  private completedAreaEl: HTMLElement;
  private messageEl: HTMLElement;

  public isOpen: boolean = false;

  constructor(
    private refinery: RefineryMachine,
    private inventory: Inventory,
    private sound: SoundSystem,
    private onStateChange?: () => void
  ) {
    this.modalEl = document.getElementById('modal-refinery')!;
    this.statusBannerEl = document.getElementById('refinery-status-banner')!;
    this.recipeListEl = document.getElementById('refinery-recipes-list')!;
    this.processingAreaEl = document.getElementById('refinery-processing-area')!;
    this.completedAreaEl = document.getElementById('refinery-completed-area')!;
    this.messageEl = document.getElementById('refinery-message')!;

    this.setupEvents();
  }

  private setupEvents() {
    document.getElementById('btn-close-refinery')?.addEventListener('click', () => {
      this.close();
    });

    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.key === 'Escape') {
        this.close();
      }
    });
  }

  public open() {
    this.isOpen = true;
    this.modalEl.classList.remove('hidden');
    this.sound.playClick();
    this.render();
  }

  public close() {
    this.isOpen = false;
    this.modalEl.classList.add('hidden');
    this.sound.playClick();
  }

  public update() {
    if (!this.isOpen) return;
    this.render();
  }

  public render() {
    this.messageEl.textContent = '';

    if (this.refinery.outputReady && this.refinery.outputItem) {
      // Finished state
      this.statusBannerEl.innerHTML = '<span class="badge ready">REFINING COMPLETE</span> Batch ready for collection';
      this.recipeListEl.classList.add('hidden');
      this.processingAreaEl.classList.add('hidden');
      this.completedAreaEl.classList.remove('hidden');

      this.completedAreaEl.innerHTML = `
        <div class="refined-item-card">
          <div class="refined-icon">${this.refinery.outputItem.icon}</div>
          <div class="refined-info">
            <div class="refined-name">${this.refinery.outputItem.name}</div>
            <div class="refined-val">Market Value: <strong>${this.refinery.outputItem.price} Shells</strong></div>
          </div>
          <button id="btn-collect-refined" class="btn-collect">Collect Item</button>
        </div>
      `;

      document.getElementById('btn-collect-refined')?.addEventListener('click', () => {
        const res = this.refinery.collectOutput(this.inventory);
        if (res.success) {
          this.sound.playCoin();
          this.render();
          if (this.onStateChange) this.onStateChange();
        } else {
          this.sound.playHurt();
          this.messageEl.textContent = res.error || 'Inventory full!';
          this.messageEl.className = 'refinery-msg error';
        }
      });
    } else if (this.refinery.isProcessing && this.refinery.activeRecipe) {
      // Processing state
      const recipe = this.refinery.activeRecipe;
      const pct = Math.min(100, Math.floor((this.refinery.progressTimerSec / recipe.durationSec) * 100));
      const remainingSec = Math.max(0, Math.ceil(recipe.durationSec - this.refinery.progressTimerSec));

      this.statusBannerEl.innerHTML = '<span class="badge active">PROCESSING</span> Bio-catalysis in progress...';
      this.recipeListEl.classList.add('hidden');
      this.completedAreaEl.classList.add('hidden');
      this.processingAreaEl.classList.remove('hidden');

      this.processingAreaEl.innerHTML = `
        <div class="processing-card">
          <div class="recipe-target">${recipe.outputIcon} Synthesizing ${recipe.outputName}</div>
          <div class="progress-bar-container">
            <div class="progress-bar-fill" style="width: ${pct}%"></div>
          </div>
          <div class="progress-label">${pct}% Complete (${remainingSec}s remaining)</div>
        </div>
      `;
    } else {
      // Idle state: choose recipe
      this.statusBannerEl.innerHTML = '<span class="badge idle">STANDBY</span> Select a harvested crop to refine';
      this.processingAreaEl.classList.add('hidden');
      this.completedAreaEl.classList.add('hidden');
      this.recipeListEl.classList.remove('hidden');

      this.recipeListEl.innerHTML = '';
      REFINERY_RECIPES.forEach(recipe => {
        const cropCount = this.inventory.harvestCounts[recipe.inputCropId as 'kelp' | 'coral' | 'pearl' | 'jellyshroom'] || 0;
        const canRefine = cropCount > 0;

        const card = document.createElement('div');
        card.className = `refinery-recipe-card ${canRefine ? 'available' : 'disabled'}`;
        card.innerHTML = `
          <div class="recipe-output-icon">${recipe.outputIcon}</div>
          <div class="recipe-details">
            <div class="recipe-title">${recipe.outputName}</div>
            <div class="recipe-desc">${recipe.description}</div>
            <div class="recipe-meta">
              <span>Requires: 1x ${recipe.inputName} (You have: <strong>${cropCount}</strong>)</span>
              <span>Time: <strong>${recipe.durationSec}s</strong></span>
              <span>Sell Value: <strong>${recipe.outputPrice} Shells</strong></span>
            </div>
          </div>
          <button class="btn-refine" ${canRefine ? '' : 'disabled'}>Refine</button>
        `;

        if (canRefine) {
          card.querySelector('.btn-refine')?.addEventListener('click', () => {
            const res = this.refinery.startRefining(recipe.id, this.inventory);
            if (res.success) {
              this.sound.playClick();
              this.render();
              if (this.onStateChange) this.onStateChange();
            } else {
              this.sound.playHurt();
              this.messageEl.textContent = res.error || 'Failed to refine';
              this.messageEl.className = 'refinery-msg error';
            }
          });
        }

        this.recipeListEl.appendChild(card);
      });
    }
  }
}

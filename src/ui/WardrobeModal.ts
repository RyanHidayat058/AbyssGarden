import { Inventory } from '../farming/Inventory';
import { SoundSystem } from '../core/Sound';
import { SUITS_CATALOG } from '../entities/Suits';

export class WardrobeModal {
  private modalEl: HTMLElement;
  private suitsListEl: HTMLElement;
  private previewCanvas: HTMLCanvasElement;
  private previewCtx: CanvasRenderingContext2D;
  private shellCountEl: HTMLElement;

  public isOpen: boolean = false;
  private previewSuitId: string = 'cyan';
  private animTimer: number = 0;
  private animFrameId: number | null = null;

  constructor(
    private inventory: Inventory,
    private sound: SoundSystem,
    private onEquipSuit: (suitId: string) => void,
    private onSpendShells?: (amount: number) => void
  ) {
    this.modalEl = document.getElementById('modal-wardrobe')!;
    this.suitsListEl = document.getElementById('wardrobe-suits-list')!;
    this.previewCanvas = document.getElementById('wardrobe-preview-canvas') as HTMLCanvasElement;
    this.previewCtx = this.previewCanvas ? this.previewCanvas.getContext('2d')! : null!;
    this.shellCountEl = document.getElementById('wardrobe-shell-count')!;

    this.setupEvents();
  }

  private setupEvents() {
    document.getElementById('btn-close-wardrobe')?.addEventListener('click', () => {
      this.close();
    });
  }

  public open() {
    this.isOpen = true;
    this.previewSuitId = this.inventory.suitColor || 'cyan';
    this.modalEl.classList.remove('hidden');
    this.sound.playClick();
    this.updateBalance();
    this.renderSuits();
    this.startPreviewAnim();
  }

  public close() {
    this.isOpen = false;
    this.modalEl.classList.add('hidden');
    this.sound.playClick();
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private updateBalance() {
    if (this.shellCountEl) {
      this.shellCountEl.textContent = `${this.inventory.pearlShells}`;
    }
  }

  private renderSuits() {
    if (!this.suitsListEl) return;
    this.suitsListEl.innerHTML = '';

    for (const [id, suit] of Object.entries(SUITS_CATALOG)) {
      const isUnlocked = this.inventory.unlockedSuits.includes(id) || suit.price === 0;
      const isEquipped = this.inventory.suitColor === id;

      const card = document.createElement('div');
      card.className = `wardrobe-suit-card ${isEquipped ? 'equipped' : ''} ${id === this.previewSuitId ? 'selected' : ''}`;

      card.innerHTML = `
        <div class="suit-badge-icon" style="background: ${suit.trimColor}22; border: 1px solid ${suit.trimColor}; color: ${suit.trimColor};">
          ${suit.badge}
        </div>
        <div class="suit-info">
          <div class="suit-title">${suit.name}</div>
          <div class="suit-desc">${suit.description}</div>
          <div class="suit-cost">${isUnlocked ? 'Owned' : `Cost: ${suit.price} 🐚`}</div>
        </div>
      `;

      card.addEventListener('mouseenter', () => {
        this.previewSuitId = id;
      });

      const btn = document.createElement('button');
      btn.className = 'wardrobe-action-btn';

      if (isEquipped) {
        btn.textContent = 'Equipped';
        btn.disabled = true;
      } else if (isUnlocked) {
        btn.textContent = 'Equip';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.inventory.suitColor = id;
          this.previewSuitId = id;
          this.sound.playClick();
          this.onEquipSuit(id);
          this.renderSuits();
        });
      } else {
        btn.textContent = `Buy ${suit.price} 🐚`;
        btn.disabled = this.inventory.pearlShells < suit.price;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.inventory.spendShells(suit.price)) {
            if (!this.inventory.unlockedSuits.includes(id)) {
              this.inventory.unlockedSuits.push(id);
            }
            this.inventory.suitColor = id;
            this.previewSuitId = id;
            this.sound.playCoin();
            this.onSpendShells?.(suit.price);
            this.onEquipSuit(id);
            this.updateBalance();
            this.renderSuits();
          }
        });
      }

      card.appendChild(btn);
      this.suitsListEl.appendChild(card);
    }
  }

  private startPreviewAnim() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);

    const loop = (timestamp: number) => {
      if (!this.isOpen) return;
      this.animTimer = timestamp * 0.006;
      this.drawPreview();
      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  private drawPreview() {
    if (!this.previewCanvas || !this.previewCtx) return;
    const ctx = this.previewCtx;
    const w = this.previewCanvas.width;
    const h = this.previewCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const suit = SUITS_CATALOG[this.previewSuitId] || SUITS_CATALOG.cyan;
    const finKick = Math.sin(this.animTimer * 1.5) * 5;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1.8, 1.8);

    // Flippers
    ctx.fillStyle = suit.trimColor;
    ctx.beginPath();
    ctx.ellipse(-16, -8 + finKick, 8, 4, -0.3, 0, Math.PI * 2);
    ctx.ellipse(-16, 8 - finKick, 8, 4, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Oxygen Tank
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.roundRect(-14, -6, 8, 12, 3);
    ctx.fill();

    ctx.fillStyle = suit.trimColor;
    ctx.fillRect(-12, -4, 4, 8);

    // Suit Body
    ctx.fillStyle = suit.bodyColor;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 13, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = suit.trimColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Limbs
    ctx.fillStyle = suit.trimColor;
    ctx.beginPath();
    ctx.arc(4, -10, 4, 0, Math.PI * 2);
    ctx.arc(4, 10, 4, 0, Math.PI * 2);
    ctx.fill();

    // Helmet Dome
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(4, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glowing Visor
    ctx.fillStyle = suit.visorColor;
    ctx.shadowColor = suit.glowColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(6, 0, 6, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Visor reflection
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(8, -2, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

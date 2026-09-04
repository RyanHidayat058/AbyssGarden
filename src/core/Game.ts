import { Camera } from './Camera';
import { InputManager } from './Input';
import { SoundSystem } from './Sound';
import { WorldMap, TILE_SIZE } from '../world/WorldMap';
import { GrottoMap, GROTTO_TILE_SIZE } from '../world/GrottoMap';
import { ParticleSystem } from '../world/Particles';
import { LightingSystem } from '../world/Lighting';
import { Aquanaut } from '../entities/Aquanaut';
import { MerchantCrab } from '../entities/MerchantCrab';
import { AmbientFauna } from '../entities/AmbientFish';
import { RemotePlayer } from '../entities/RemotePlayer';
import { StorageChest } from '../entities/Chest';
import { Inventory } from '../farming/Inventory';
import { CropId, CROPS_CONFIG } from '../farming/Crops';
import { FarmPlot } from '../farming/FarmPlot';
import { REFINERY_RECIPES } from '../farming/Refinery';
import { HUD } from '../ui/HUD';
import { ShopModal } from '../ui/ShopModal';
import { AccountManager } from './Account';
import { SettingsModal } from '../ui/SettingsModal';
import { ChestModal } from '../ui/ChestModal';
import { RefineryModal } from '../ui/RefineryModal';
import { AuthModal } from '../ui/AuthModal';
import { FriendsModal } from '../ui/FriendsModal';
import { ExpeditionsModal } from '../ui/ExpeditionsModal';
import { WardrobeModal } from '../ui/WardrobeModal';
import { WeatherSystem, getMutationPrefixAndIcons, CropMutation } from '../world/Weather';
import { SUITS_CATALOG } from '../entities/Suits';
import { NetworkManager } from './Network';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  public camera: Camera;
  public input: InputManager;
  public sound: SoundSystem;
  public world: WorldMap;
  public grotto: GrottoMap;
  public particles: ParticleSystem;
  public lighting: LightingSystem;
  public weather: WeatherSystem;
  public player: Aquanaut;
  public merchant: MerchantCrab;
  public fauna: AmbientFauna;
  public inventory: Inventory;
  public hud: HUD;
  public shop: ShopModal;
  public wardrobeModal: WardrobeModal;
  public account: AccountManager;
  public settings: SettingsModal;

  // New Modals
  public chestModal: ChestModal;
  public refineryModal: RefineryModal;
  public authModal: AuthModal;
  public friendsModal: FriendsModal;
  public expeditionsModal: ExpeditionsModal;

  // Weather HUD elements
  private weatherTitleEl: HTMLElement | null = null;
  private weatherClockEl: HTMLElement | null = null;
  private weatherIconEl: HTMLElement | null = null;

  // Multiplayer & Persistence
  public network: NetworkManager;
  public remotePlayers: Map<string, RemotePlayer> = new Map();
  public gameMode: 'solo' | 'coop' = 'solo';
  public currentExpeditionId: string | null = null;
  public activeMap: 'seabed' | 'grotto' = 'seabed';
  private autoSaveTimerSec: number = 0;
  private portalCooldownSec: number = 0;

  private lastTimestamp: number = 0;
  private isRunning: boolean = false;
  private timeSec: number = 0;

  // Day & Tide Cycle (1 cycle = 180 seconds)
  public dayCycleTime: number = 0.2; // starts around 10:48 AM
  public dayNumber: number = 1;
  private readonly DAY_DURATION_SEC = 180;

  private modalHelpEl: HTMLElement;
  private modalRespawnEl: HTMLElement;
  private modalLoginEl: HTMLElement;
  private selectedAvatar: string = '🤿';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;

    this.world = new WorldMap();
    this.grotto = new GrottoMap();
    this.camera = new Camera(window.innerWidth, window.innerHeight, this.world.width, this.world.height);
    this.input = new InputManager(this.canvas);
    this.sound = new SoundSystem();
    this.particles = new ParticleSystem(this.world.width, this.world.height);
    this.lighting = new LightingSystem(this.camera.viewportWidth, this.camera.viewportHeight);

    // Spawn player in center garden
    const startX = 18 * TILE_SIZE + TILE_SIZE / 2;
    const startY = 14 * TILE_SIZE + TILE_SIZE / 2;
    this.player = new Aquanaut(startX, startY);

    // Barnaby the Crab
    this.merchant = new MerchantCrab(this.world.merchantLocation.x, this.world.merchantLocation.y);

    // Ambient ocean life
    this.fauna = new AmbientFauna(this.world.width, this.world.height);

    this.inventory = new Inventory();
    this.account = new AccountManager();
    this.network = new NetworkManager();

    this.hud = new HUD(this.inventory, (index: number) => {
      this.inventory.selectSlot(index);
      this.sound.playClick();
    });

    this.inventory.onChange = () => {
      this.hud.renderHotbar();
    };

    this.shop = new ShopModal(
      this.inventory,
      this.sound,
      (earnedShells: number) => {
        this.account.updateStats(earnedShells, 0);
        this.updateDiverBadge();
        this.grotto.syncWithInventory(this.inventory);
        if (this.gameMode === 'coop') {
          this.network.syncExpeditionShells(this.inventory.pearlShells, earnedShells);
        }
        this.saveCurrentGame();
      },
      (spentShells: number) => {
        this.grotto.syncWithInventory(this.inventory);
        if (this.gameMode === 'coop') {
          this.network.syncExpeditionShells(this.inventory.pearlShells, -spentShells);
        }
        this.saveCurrentGame();
      }
    );

    this.settings = new SettingsModal(this.sound, this.account, () => {
      this.handleLogout();
    });

    // New Modals Initialization
    this.chestModal = new ChestModal(this.inventory, this.sound, () => {
      this.saveCurrentGame();
    });

    this.refineryModal = new RefineryModal(this.grotto.refinery, this.inventory, this.sound, () => {
      this.saveCurrentGame();
    });

    this.authModal = new AuthModal(this.network, this.sound, async (user) => {
      this.account.createNewDiver(user.callsign, '🤿');
      this.updateDiverBadge();
      this.particles.addFloatingText(this.player.x, this.player.y - 40, `Signed in as ${user.callsign}`, '#ffd166');
      await this.loadGameData('solo');
    });

    this.friendsModal = new FriendsModal(this.network, this.sound, (friendCallsign) => {
      this.particles.addFloatingText(this.player.x, this.player.y - 30, `Invite sent to ${friendCallsign}`, '#38bdf8');
    });

    this.expeditionsModal = new ExpeditionsModal(
      this.network,
      this.sound,
      (expedition) => this.handleJoinExpedition(expedition),
      () => this.handleLeaveExpedition()
    );

    // Weather System Initialization
    this.weather = new WeatherSystem();
    this.weatherTitleEl = document.getElementById('weather-title');
    this.weatherClockEl = document.getElementById('weather-clock');
    this.weatherIconEl = document.getElementById('weather-icon');

    this.weather.onWeatherChanged = (w, cfg) => {
      if (this.weatherTitleEl) this.weatherTitleEl.textContent = cfg.name;
      if (this.weatherIconEl) this.weatherIconEl.textContent = cfg.icon;
      this.particles.addFloatingText(this.player.x, this.player.y - 50, cfg.announcement, cfg.bannerColor);
      if (w === 'storm' || w === 'bloodmoon') {
        this.sound.playDig();
      }
      if (this.gameMode === 'coop') {
        this.network.sendWeatherChange(w, this.weather.activeWeatherTimer);
      }
    };

    this.weather.onLightningStrike = () => {
      this.sound.playDig();
      this.particles.emitSparkles(this.player.x + (Math.random() - 0.5) * 300, this.player.y - 80, '#fde047', 25);
    };

    // Wardrobe Modal Initialization
    this.wardrobeModal = new WardrobeModal(
      this.inventory,
      this.sound,
      (suitId: string) => {
        this.player.suitId = suitId;
        this.inventory.suitColor = suitId;
        const suitName = SUITS_CATALOG[suitId]?.name || suitId;
        this.particles.addFloatingText(this.player.x, this.player.y - 40, `Equipped ${suitName}!`, '#38bdf8');
        if (this.gameMode === 'coop') {
          this.network.sendSuitChange(suitId);
        }
        this.saveCurrentGame();
      },
      (cost: number) => {
        if (this.gameMode === 'coop') {
          this.network.syncExpeditionShells(this.inventory.pearlShells, -cost);
        }
        this.saveCurrentGame();
      }
    );

    this.modalHelpEl = document.getElementById('modal-help')!;
    this.modalRespawnEl = document.getElementById('modal-respawn')!;
    this.modalLoginEl = document.getElementById('modal-login')!;

    this.setupUIEvents();
    this.setupNetworkEvents();
    this.updateDiverBadge();
    this.resize(window.innerWidth, window.innerHeight);

    // Unconditionally load saved game state (loads from database if logged in, fallback to local storage)
    this.loadGameData('solo');
  }

  public updateDiverBadge() {
    const prof = this.account.currentProfile;
    const name = this.network.currentUser ? this.network.currentUser.callsign : prof.name;
    this.hud.updateDiverBadge(name, prof.rank, prof.avatarIcon);
  }

  private handleLogout() {
    this.network.logout();
    this.modalLoginEl.classList.remove('hidden');
    const inputEl = document.getElementById('login-diver-name') as HTMLInputElement;
    if (inputEl) {
      inputEl.value = '';
      inputEl.focus();
    }
  }

  private setupUIEvents() {
    // Top Right HUD Buttons
    document.getElementById('btn-sound')?.addEventListener('click', () => {
      const isMuted = this.sound.toggleMute();
      const soundIcon = document.getElementById('sound-icon');
      if (soundIcon) soundIcon.textContent = isMuted ? '🔇' : '🔊';
    });

    document.getElementById('btn-settings')?.addEventListener('click', () => {
      this.settings.open('controls');
    });

    document.getElementById('btn-expeditions')?.addEventListener('click', () => {
      this.expeditionsModal.open();
    });

    document.getElementById('btn-friends')?.addEventListener('click', () => {
      this.friendsModal.open();
    });

    document.getElementById('btn-auth')?.addEventListener('click', () => {
      this.authModal.open();
    });

    document.getElementById('diver-hud-badge')?.addEventListener('click', () => {
      this.authModal.open();
    });

    // Help button
    document.getElementById('btn-help')?.addEventListener('click', () => {
      this.modalHelpEl.classList.remove('hidden');
      this.sound.playClick();
    });
    document.getElementById('btn-close-help')?.addEventListener('click', () => {
      this.modalHelpEl.classList.add('hidden');
      this.sound.playClick();
    });

    // Respawn button
    document.getElementById('btn-respawn')?.addEventListener('click', () => {
      this.modalRespawnEl.classList.add('hidden');
      this.inventory.oxygen = this.inventory.maxOxygen;
      this.activeMap = 'seabed';
      this.camera.setBounds(this.world.width, this.world.height);
      this.player.x = 18 * TILE_SIZE + TILE_SIZE / 2;
      this.player.y = 14 * TILE_SIZE + TILE_SIZE / 2;
      this.player.vx = 0;
      this.player.vy = 0;
      this.particles.addFloatingText(this.player.x, this.player.y - 30, 'Rescued!', '#4cf3d8');
      this.sound.playClick();
    });

    // Avatar selector in login modal
    const avatarOptions = document.querySelectorAll('.avatar-option');
    avatarOptions.forEach((opt) => {
      opt.addEventListener('click', () => {
        avatarOptions.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        this.selectedAvatar = opt.getAttribute('data-avatar') || '🤿';
        this.sound.playClick();
      });
    });

    // Diver login submit button
    document.getElementById('btn-login-submit')?.addEventListener('click', () => {
      const inputEl = document.getElementById('login-diver-name') as HTMLInputElement;
      const name = inputEl?.value.trim() || 'Aquanaut Diver';
      this.account.createNewDiver(name, this.selectedAvatar);
      this.modalLoginEl.classList.add('hidden');
      this.updateDiverBadge();
      this.sound.playCoin();
      this.particles.addFloatingText(this.player.x, this.player.y - 40, `Welcome, ${name}!`, '#ffd166');
    });

    // Ambient sound gesture trigger
    const startAudioOnce = () => {
      this.sound.startAmbient();
      window.removeEventListener('pointerdown', startAudioOnce);
      window.removeEventListener('keydown', startAudioOnce);
    };
    window.addEventListener('pointerdown', startAudioOnce);
    window.addEventListener('keydown', startAudioOnce);

    // Save on beforeunload
    window.addEventListener('beforeunload', () => {
      this.saveCurrentGame();
    });
  }

  private setupNetworkEvents() {
    this.network.on('player_join', (data: any) => {
      const p = new RemotePlayer(data.player.id, data.player.callsign, data.player.x || 800, data.player.y || 600);
      this.remotePlayers.set(data.player.id, p);
      this.particles.addFloatingText(this.player.x, this.player.y - 45, `${data.player.callsign} joined the expedition!`, '#4ade80');
      this.sound.playCoin();
    });

    this.network.on('player_leave', (data: any) => {
      const p = this.remotePlayers.get(data.userId);
      if (p) {
        this.particles.addFloatingText(p.x, p.y - 30, `${p.callsign} surfaced`, '#94a3b8');
        this.remotePlayers.delete(data.userId);
      }
    });

    this.network.on('player_moved', (data: any) => {
      let p = this.remotePlayers.get(data.userId);
      if (!p) {
        p = new RemotePlayer(data.userId, data.callsign || 'Diver', data.x, data.y, '🤿', data.facingAngle, data.suitId || 'cyan');
        this.remotePlayers.set(data.userId, p);
      }
      p.updateFromNetwork(data.x, data.y, data.vx, data.vy, data.facingAngle, data.isMoving, data.map, data.suitId);
    });

    this.network.on('suit_updated', (data: any) => {
      const p = this.remotePlayers.get(data.userId);
      if (p) {
        p.suitId = data.suitId;
        this.particles.addFloatingText(p.x, p.y - 30, `Suit changed to ${SUITS_CATALOG[data.suitId]?.name || data.suitId}`, '#38bdf8');
      }
    });

    this.network.on('weather_synced', (data: any) => {
      if (data.weather) {
        this.weather.setWeather(data.weather, data.remainingDurationSec);
      }
    });

    const onFarmUpdate = (data: any) => {
      const action = data.action || data.actionType;
      const gx = data.x !== undefined ? data.x : data.gridX;
      const gy = data.y !== undefined ? data.y : data.gridY;
      const plot = this.world.getPlot(gx, gy);
      if (!plot) return;

      if (action === 'till') {
        plot.isTilled = true;
      } else if (action === 'untill') {
        plot.untill();
      } else if (action === 'plant' && data.cropId) {
        plot.plant(data.cropId as CropId);
      } else if (action === 'nutrient') {
        plot.applyNutrient();
        if (data.mutation) {
          const parts = String(data.mutation).split('+');
          for (const m of parts) {
            plot.applyMutation(m as CropMutation);
          }
        }
      } else if (action === 'harvest') {
        plot.harvest();
      }
    };

    this.network.on('farm_updated', onFarmUpdate);
    this.network.on('farm_update', onFarmUpdate);

    this.network.on('room_members', (data: any) => {
      this.expeditionsModal.updateRoomDivers(data.members || []);
    });

    this.network.on('shells_synced', (data: any) => {
      const { shells, changer, delta } = data;
      this.inventory.pearlShells = shells;
      this.hud.renderSlots();
      if (changer && changer !== this.network.currentUser?.callsign) {
        const sign = delta > 0 ? `+${delta}` : `${delta}`;
        const color = delta > 0 ? '#4ade80' : '#f87171';
        this.particles.addFloatingText(this.player.x, this.player.y - 45, `${changer}: ${sign} 🐚`, color);
        this.sound.playCoin();
      }
    });
  }

  private async handleJoinExpedition(expedition: any) {
    // 1. Save solo game first
    await this.saveCurrentGame();

    // 2. Switch mode to coop
    this.gameMode = 'coop';
    this.currentExpeditionId = expedition.id;
    this.particles.addFloatingText(this.player.x, this.player.y - 40, `Entering: ${expedition.name}`, '#38bdf8');

    // 3. Connect WebSocket
    if (this.network.token) {
      this.network.connectWebSocket(this.network.token, expedition.id);
    }

    // 4. Load separate expedition inventory and shared world state
    await this.loadGameData('coop', expedition.id);
  }

  private async handleLeaveExpedition() {
    // 1. Save expedition state
    await this.saveCurrentGame();

    // 2. Clear remote players and disconnect
    this.remotePlayers.clear();

    // 3. Switch back to solo
    this.gameMode = 'solo';
    this.currentExpeditionId = null;
    this.particles.addFloatingText(this.player.x, this.player.y - 40, 'Returned to Solo Journey', '#ffd166');

    // 4. Reload solo inventory and private garden
    await this.loadGameData('solo');
  }

  public async saveCurrentGame() {
    const plotsData: any[] = [];
    for (const [key, plot] of this.world.farmPlots.entries()) {
      if (plot.isTilled || plot.cropId) {
        plotsData.push({
          key,
          x: plot.gridX,
          y: plot.gridY,
          isTilled: plot.isTilled,
          cropId: plot.cropId,
          growthStage: plot.growthStage,
          growthTimerSec: plot.growthTimerSec,
          isNutrified: plot.isNutrified,
          readyToHarvest: plot.readyToHarvest,
          mutations: plot.mutations,
          mutation: plot.mutation,
          weightKg: plot.weightKg
        });
      }
    }

    const chestsData = this.grotto.chests.map(c => ({
      id: c.id,
      tier: c.tier,
      gridX: c.gridX,
      gridY: c.gridY,
      slots: c.slots
    }));

    const payload = {
      mode: this.gameMode,
      expedition_id: this.currentExpeditionId,
      shells: this.inventory.pearlShells,
      inventory_slots: this.inventory.hotbarSlots,
      farm_plots: plotsData,
      chests: chestsData,
      refinery_state: {
        isUnlocked: this.grotto.refinery.isUnlocked,
        isProcessing: this.grotto.refinery.isProcessing,
        activeRecipeId: this.grotto.refinery.activeRecipe?.id,
        progressTimerSec: this.grotto.refinery.progressTimerSec,
        outputReady: this.grotto.refinery.outputReady,
        outputItem: this.grotto.refinery.outputItem,
        personal_upgrades: {
          maxOxygen: this.inventory.maxOxygen,
          oxygenUpgradeLevel: this.inventory.oxygenUpgradeLevel,
          swimSpeedLevel: this.inventory.swimSpeedLevel,
          spotlightLevel: this.inventory.spotlightLevel,
          suitColor: this.inventory.suitColor,
          unlockedSuits: this.inventory.unlockedSuits
        }
      }
    };

    if (this.network.token) {
      try {
        await this.network.saveGameData(payload);
      } catch (err) {
        console.warn('Network save failed:', err);
      }
    }

    // LocalStorage backup
    try {
      localStorage.setItem(`abyss_save_${this.gameMode}_${this.currentExpeditionId || 'solo'}`, JSON.stringify(payload));
    } catch {}
  }

  public async loadGameData(mode: 'solo' | 'coop', expeditionId?: string) {
    let save: any = null;

    if (this.network.token) {
      try {
        const res = await this.network.loadGameData(mode, expeditionId);
        if (res.save) {
          save = res.save;
        }
      } catch (err) {
        console.warn('Network load failed, checking local storage:', err);
      }
    }

    if (!save) {
      const local = localStorage.getItem(`abyss_save_${mode}_${expeditionId || 'solo'}`);
      if (local) {
        try { save = JSON.parse(local); } catch {}
      }
    }

    if (save) {
      if (typeof save.shells === 'number') this.inventory.pearlShells = save.shells;
      if (Array.isArray(save.inventory_slots)) {
        const slots = save.inventory_slots.slice(0, 6);
        if (!slots[0] || slots[0].id !== 'shovel') {
          slots[0] = { type: 'tool', id: 'shovel', name: 'Sand Shovel', icon: '⛏️' };
        }
        if (!slots[1] || slots[1].id !== 'leveler') {
          slots[1] = { type: 'tool', id: 'leveler', name: 'Sand Leveler', icon: '🧹' };
        }
        while (slots.length < 6) {
          slots.push({ type: 'harvest', id: 'empty', name: 'Empty Slot', icon: '', count: 0 });
        }
        for (let i = 2; i < slots.length; i++) {
          if (!slots[i] || !slots[i].count || slots[i].count <= 0) {
            slots[i] = { type: 'harvest', id: 'empty', name: 'Empty Slot', icon: '', count: 0 };
          }
        }
        this.inventory.hotbarSlots = slots;
        this.inventory.syncCountsFromSlots();
      }
      if (Array.isArray(save.farm_plots)) {
        this.world.farmPlots.clear();
        for (const p of save.farm_plots) {
          const gx = p.x !== undefined ? p.x : p.gridX;
          const gy = p.y !== undefined ? p.y : p.gridY;
          if (gx !== undefined && gy !== undefined) {
            const plot = new FarmPlot(gx, gy);
            plot.isTilled = !!p.isTilled;
            plot.cropId = p.cropId || null;
            plot.growthStage = typeof p.growthStage === 'number' ? p.growthStage : 0;
            plot.growthTimerSec = typeof p.growthTimerSec === 'number' ? p.growthTimerSec : 0;
            plot.isNutrified = !!p.isNutrified;
            plot.readyToHarvest = !!p.readyToHarvest;
            plot.mutations = Array.isArray(p.mutations) ? p.mutations : (p.mutation ? [p.mutation] : []);
            plot.weightKg = typeof p.weightKg === 'number' ? p.weightKg : 1.0;
            const key = p.key || `${gx},${gy}`;
            this.world.farmPlots.set(key, plot);
          }
        }
      }
      if (Array.isArray(save.chests) && save.chests.length > 0) {
        this.grotto.chests = save.chests.map((c: any) => new StorageChest(c.id, c.tier, c.gridX, c.gridY, c.slots));
      }
      if (save.refinery_state) {
        this.grotto.refinery.isUnlocked = !!save.refinery_state.isUnlocked;
        this.grotto.refinery.isProcessing = !!save.refinery_state.isProcessing;
        this.grotto.refinery.progressTimerSec = save.refinery_state.progressTimerSec || 0;
        this.grotto.refinery.outputReady = !!save.refinery_state.outputReady;
        this.grotto.refinery.outputItem = save.refinery_state.outputItem || null;
        if (save.refinery_state.activeRecipeId) {
          this.grotto.refinery.activeRecipe = REFINERY_RECIPES.find(r => r.id === save.refinery_state.activeRecipeId) || null;
        }

        const pu = save.refinery_state.personal_upgrades || save.personal_upgrades;
        if (pu) {
          if (typeof pu.maxOxygen === 'number') this.inventory.maxOxygen = pu.maxOxygen;
          if (typeof pu.oxygenUpgradeLevel === 'number') this.inventory.oxygenUpgradeLevel = pu.oxygenUpgradeLevel;
          if (typeof pu.swimSpeedLevel === 'number') this.inventory.swimSpeedLevel = pu.swimSpeedLevel;
          if (typeof pu.spotlightLevel === 'number') this.inventory.spotlightLevel = pu.spotlightLevel;
          if (pu.suitColor) {
            this.inventory.suitColor = pu.suitColor;
            this.player.suitId = pu.suitColor;
          }
          if (Array.isArray(pu.unlockedSuits)) {
            this.inventory.unlockedSuits = pu.unlockedSuits;
          }
        }
      }
    }

    this.grotto.syncWithInventory(this.inventory);
    this.hud.renderSlots();
  }

  public resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.camera.resize(width, height);
    this.lighting.resize(width, height);
  }

  public start() {
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  private loop(timestamp: number) {
    if (!this.isRunning) return;

    const dtMs = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    const dtSec = Math.min(dtMs / 1000, 0.1);
    this.timeSec += dtSec;

    this.update(dtSec);
    this.render();

    requestAnimationFrame(this.loop.bind(this));
  }

  private update(dtSec: number) {
    // 1. Advance Day/Tide Cycle
    this.dayCycleTime += dtSec / this.DAY_DURATION_SEC;
    if (this.dayCycleTime >= 1.0) {
      this.dayCycleTime -= 1.0;
      this.dayNumber++;
      this.particles.addFloatingText(this.player.x, this.player.y - 40, `Day ${this.dayNumber} Dawns!`, '#ffd166');
    }

    // Auto-save periodic timer (every 15s)
    this.autoSaveTimerSec += dtSec;
    if (this.autoSaveTimerSec >= 15) {
      this.autoSaveTimerSec = 0;
      this.saveCurrentGame();
    }

    // Portal transition debounce
    if (this.portalCooldownSec > 0) {
      this.portalCooldownSec -= dtSec;
    }

    // Advance Weather System
    this.weather.update(dtSec);
    if (this.weather.shouldCheckMutation(dtSec)) {
      if (this.activeMap === 'seabed') {
        const mut = this.weather.rollCropMutation();
        if (mut) {
          // Crops can receive this mutation if they don't already have it (allowing all 4 to stack!)
          const plots = Array.from(this.world.farmPlots.values()).filter(p => p.cropId && !p.hasMutation(mut.id));
          if (plots.length > 0) {
            const target = plots[Math.floor(Math.random() * plots.length)];
            target.applyMutation(mut.id);
            const cfg = CROPS_CONFIG[target.cropId!];
            const px = target.gridX * TILE_SIZE + TILE_SIZE / 2;
            const py = target.gridY * TILE_SIZE + TILE_SIZE / 2;
            this.particles.emitSparkles(px, py, mut.color, 25);
            const stackNotice = target.mutations.length > 1 ? ` (${target.mutations.length}x Multi-Mutated!)` : '!';
            this.particles.addFloatingText(px, py - 20, `⚡ Flora Mutated: ${mut.prefix} ${cfg?.name || 'Flora'}${stackNotice}`, mut.color);
            if (this.gameMode === 'coop') {
              this.network.sendFarmAction('nutrient', target.gridX, target.gridY, target.cropId || undefined, undefined, mut.id);
            }
          }
        }
      }
    }

    if (this.weatherClockEl) {
      this.weatherClockEl.textContent = this.weather.getRemainingTimeFormatted();
    }

    // 2. Hotkey handling (1-6, M, H, O, C, F, Escape)
    if (this.input.hotkeyJustPressed !== null) {
      const slotIndex = this.input.hotkeyJustPressed - 1;
      this.inventory.selectSlot(slotIndex);
      this.sound.playClick();
    }

    if (this.input.wheelDelta !== 0) {
      let nextSlot = this.inventory.selectedSlotIndex + (this.input.wheelDelta > 0 ? 1 : -1);
      if (nextSlot < 0) nextSlot = this.inventory.hotbarSlots.length - 1;
      if (nextSlot >= this.inventory.hotbarSlots.length) nextSlot = 0;
      this.inventory.selectSlot(nextSlot);
      this.sound.playClick();
    }

    if (this.input.keys['KeyM']) {
      this.input.keys['KeyM'] = false;
      const isMuted = this.sound.toggleMute();
      const soundIcon = document.getElementById('sound-icon');
      if (soundIcon) soundIcon.textContent = isMuted ? '🔇' : '🔊';
    }

    if (this.input.keys['KeyO']) {
      this.input.keys['KeyO'] = false;
      if (this.settings.isOpen) {
        this.settings.close();
      } else {
        this.settings.open('controls');
      }
    }

    if (this.input.keys['KeyC']) {
      this.input.keys['KeyC'] = false;
      if (this.expeditionsModal.isOpen) {
        this.expeditionsModal.close();
      } else {
        this.expeditionsModal.open();
      }
    }

    if (this.input.keys['KeyF']) {
      this.input.keys['KeyF'] = false;
      if (this.friendsModal.isOpen) {
        this.friendsModal.close();
      } else {
        this.friendsModal.open();
      }
    }

    if (this.input.keys['KeyH']) {
      this.input.keys['KeyH'] = false;
      this.modalHelpEl.classList.toggle('hidden');
      this.sound.playClick();
    }

    if (this.input.keys['Escape']) {
      this.input.keys['Escape'] = false;
      if (this.shop.isOpen) this.shop.close();
      if (this.wardrobeModal.isOpen) this.wardrobeModal.close();
      if (this.settings.isOpen) this.settings.close();
      if (this.chestModal.isOpen) this.chestModal.close();
      if (this.refineryModal.isOpen) this.refineryModal.close();
      if (this.authModal.isOpen) this.authModal.close();
      if (this.friendsModal.isOpen) this.friendsModal.close();
      if (this.expeditionsModal.isOpen) this.expeditionsModal.close();
      this.modalHelpEl.classList.add('hidden');
    }

    // 3. Movement & Player Update
    const isAnyModalOpen = this.shop.isOpen ||
                           this.wardrobeModal.isOpen ||
                           this.settings.isOpen ||
                           this.chestModal.isOpen ||
                           this.refineryModal.isOpen ||
                           this.authModal.isOpen ||
                           this.friendsModal.isOpen ||
                           this.expeditionsModal.isOpen ||
                           !this.modalHelpEl.classList.contains('hidden') ||
                           !this.modalLoginEl.classList.contains('hidden');

    const moveVector = this.input.getMoveVector();
    const aimWorldPos = this.camera.screenToWorld(this.input.mousePos.x, this.input.mousePos.y);

    const activeWorld = this.activeMap === 'seabed' ? this.world : this.grotto;

    if (!isAnyModalOpen) {
      this.player.update(dtSec, moveVector, aimWorldPos, activeWorld, this.particles, this.inventory);
    }

    // 4. Update Camera
    this.camera.follow(this.player.x, this.player.y, 0.08);

    // 5. Update World, Flora & Fauna
    if (this.activeMap === 'seabed') {
      this.world.update(dtSec);
      this.fauna.update(dtSec);
      this.merchant.update(dtSec, this.player.x, this.player.y);
    } else {
      this.grotto.update(dtSec);
      this.refineryModal.update();
    }
    this.particles.update(dtSec);

    // Update Remote Players in Co-op
    if (this.gameMode === 'coop') {
      for (const rp of this.remotePlayers.values()) {
        rp.update(dtSec);
      }
      // Broadcast local movement throttled
      this.network.sendMove(
        this.player.x,
        this.player.y,
        this.player.vx,
        this.player.vy,
        this.player.facingAngle,
        this.player.isMoving,
        this.activeMap,
        this.player.suitId
      );
    }

    // 6. Check Oxygen
    if (this.inventory.oxygen <= 0 && this.modalRespawnEl.classList.contains('hidden')) {
      this.modalRespawnEl.classList.remove('hidden');
    }

    // 7. Interaction Prompts & Action Logic
    let promptMsg: string | null = null;
    const targetedGrid = this.player.getTargetedGrid(aimWorldPos);

    if (this.activeMap === 'seabed') {
      // Check Subsea Bunker Hatch
      const distToCave = Math.hypot(this.player.x - this.world.caveLocation.x, this.player.y - this.world.caveLocation.y);
      if (distToCave < 48) {
        promptMsg = 'Press [E] to Enter Subsea Bunker';
        if (this.input.interactJustPressed && this.portalCooldownSec <= 0 && !isAnyModalOpen) {
          this.activeMap = 'grotto';
          this.portalCooldownSec = 0.6;
          this.input.interactJustPressed = false;
          this.input.actionJustPressed = false;
          this.camera.setBounds(this.grotto.width, this.grotto.height);
          this.player.x = this.grotto.spawnLocation.x;
          this.player.y = this.grotto.spawnLocation.y;
          this.player.vx = 0;
          this.player.vy = 0;
          this.sound.playClick();
          promptMsg = null;
          this.particles.addFloatingText(this.player.x, this.player.y - 30, 'Subsea Bunker', '#38bdf8');
          this.hud.update(this.dayCycleTime, this.dayNumber, null);
          return;
        }
      }

      // Merchant
      if (this.merchant.isPlayerNear) {
        promptMsg = 'Press [E] or Space to Trade with Barnaby';
        if ((this.input.interactJustPressed || this.input.actionJustPressed) && !isAnyModalOpen) {
          this.shop.open();
        }
      } else {
        // Farming plots on seabed
        const plot = this.world.getPlot(targetedGrid.x, targetedGrid.y);
        if (plot) {
          const activeSlot = this.inventory.getSelectedSlot();
          if (plot.readyToHarvest) {
            const crop = CROPS_CONFIG[plot.cropId!];
            promptMsg = `Ready! Press [Space] or Click to harvest ${crop?.harvestName || 'flora'}`;
          } else if (!plot.isTilled && activeSlot.id === 'shovel') {
            promptMsg = 'Press [Space] or Click to till sand';
          } else if (plot.isTilled && !plot.cropId && activeSlot.id === 'leveler') {
            promptMsg = 'Press [Space] or Click to level sand (restore seabed)';
          } else if (plot.isTilled && !plot.cropId && activeSlot.type === 'seed') {
            promptMsg = `Press [Space] or Click to plant ${activeSlot.name}`;
          } else if (plot.cropId && !plot.isNutrified && activeSlot.id === 'nutrient') {
            if (this.inventory.nutrientCount > 0) {
              promptMsg = 'Press [Space] or Click to inject nutrients';
            } else {
              promptMsg = 'Nutrient Vial Empty! (Buy refill from Barnaby)';
            }
          }
        }
      }
    } else {
      // IN GROTTO / SUBSEA BUNKER
      // Check Exit Airlock Hatch
      const distToExit = Math.hypot(this.player.x - this.grotto.exitLocation.x, this.player.y - this.grotto.exitLocation.y);
      if (distToExit < 48) {
        promptMsg = 'Press [E] to Exit Airlock';
        if (this.input.interactJustPressed && this.portalCooldownSec <= 0 && !isAnyModalOpen) {
          this.activeMap = 'seabed';
          this.portalCooldownSec = 0.6;
          this.input.interactJustPressed = false;
          this.input.actionJustPressed = false;
          this.camera.setBounds(this.world.width, this.world.height);
          this.player.x = this.world.caveLocation.x;
          this.player.y = this.world.caveLocation.y + 60;
          this.player.vx = 0;
          this.player.vy = 0;
          this.sound.playClick();
          promptMsg = null;
          this.particles.addFloatingText(this.player.x, this.player.y - 30, 'Deep Seabed', '#38bdf8');
          this.hud.update(this.dayCycleTime, this.dayNumber, null);
          return;
        }
      }

      // Check Storage Chests in Grotto
      for (const chest of this.grotto.chests) {
        const chestPixelX = chest.gridX * GROTTO_TILE_SIZE + (chest.config.widthTiles * GROTTO_TILE_SIZE) / 2;
        const chestPixelY = chest.gridY * GROTTO_TILE_SIZE + GROTTO_TILE_SIZE / 2;
        const dist = Math.hypot(this.player.x - chestPixelX, this.player.y - chestPixelY);

        if (dist < 56) {
          promptMsg = `Press [E] or Space to Open ${chest.config.name}`;
          if ((this.input.interactJustPressed || this.input.actionJustPressed) && !isAnyModalOpen) {
            this.chestModal.open(chest);
          }
          break;
        }
      }

      // Check Refinery Machine in Grotto
      const refPixelX = this.grotto.refinery.gridX * GROTTO_TILE_SIZE + GROTTO_TILE_SIZE;
      const refPixelY = this.grotto.refinery.gridY * GROTTO_TILE_SIZE + GROTTO_TILE_SIZE;
      const distRef = Math.hypot(this.player.x - refPixelX, this.player.y - refPixelY);

      if (distRef < 64) {
        if (this.grotto.refinery.isUnlocked) {
          promptMsg = 'Press [E] or Space to Operate Bio-Extractor';
          if ((this.input.interactJustPressed || this.input.actionJustPressed) && !isAnyModalOpen) {
            this.refineryModal.open();
          }
        } else {
          promptMsg = 'Bio-Extractor Locked (Purchase from Barnaby\'s Gear Shop)';
        }
      }

      // Check Wardrobe in Grotto
      if (this.grotto.isNearWardrobe(this.player.x, this.player.y)) {
        promptMsg = 'Press [E] or Space to Open Wardrobe';
        if ((this.input.interactJustPressed || this.input.actionJustPressed) && !isAnyModalOpen) {
          this.wardrobeModal.open();
        }
      }
    }

    // 8. Execute Tool Action (Seabed only)
    if (this.activeMap === 'seabed') {
      const performAction = (this.input.actionJustPressed || this.input.mouseJustPressed) &&
                            !this.merchant.isPlayerNear &&
                            !isAnyModalOpen;

      const plot = this.world.getPlot(targetedGrid.x, targetedGrid.y);
      if (performAction && plot) {
        this.handleFarmingAction(plot, targetedGrid);
      }
    }

    // 9. Update UI HUD
    this.hud.update(this.dayCycleTime, this.dayNumber, promptMsg);

    // Reset input impulses
    this.input.update();
  }

  private handleFarmingAction(plot: ReturnType<typeof this.world.getPlot>, grid: { x: number; y: number }) {
    if (!plot) return;
    const activeSlot = this.inventory.getSelectedSlot();
    const worldTileX = grid.x * TILE_SIZE + TILE_SIZE / 2;
    const worldTileY = grid.y * TILE_SIZE + TILE_SIZE / 2;

    // 1. Harvest takes priority if crop is mature
    if (plot.readyToHarvest) {
      // In-place stack & inventory capacity validation!
      const canTake = this.inventory.canAddHarvest(plot.cropId!, 1, plot.mutations, plot.weightKg);
      if (!canTake.canAdd) {
        this.sound.playHurt();
        this.particles.addFloatingText(this.player.x, this.player.y - 30, canTake.reason || 'Inventory Full!', '#f87171');
        return;
      }

      const result = plot.harvest();
      if (result) {
        const config = CROPS_CONFIG[result.cropId];
        this.inventory.addHarvest(result.cropId, result.count, result.mutations, result.weightKg);
        this.sound.playHarvest();
        const mutMeta = getMutationPrefixAndIcons(result.mutations);
        const mutColor = mutMeta.color || config.glowColor;
        this.particles.emitSparkles(worldTileX, worldTileY, mutColor, 20);
        const stackNotice = result.mutations.length > 1 ? ` [${result.mutations.length}x Stack!]` : '';
        this.particles.addFloatingText(worldTileX, worldTileY - 20, `+${result.count} ${mutMeta.prefix}${config.harvestName} (${result.weightKg.toFixed(1)} kg)${stackNotice}!`, mutColor);

        // Broadcast to co-op
        if (this.gameMode === 'coop') {
          this.network.sendFarmAction('harvest', grid.x, grid.y, undefined, undefined, result.mutations.join('+'));
        }

        // Update Account Stats
        this.account.updateStats(0, result.count);
        this.updateDiverBadge();
        this.saveCurrentGame();
      }
      return;
    }

    // 2. Sand Shovel: Tills plot (Unlimited Tool)
    if (activeSlot.id === 'shovel') {
      if (plot.till()) {
        this.sound.playDig();
        this.particles.emitSparkles(worldTileX, worldTileY, '#e2e8f0', 8);
        this.particles.addFloatingText(worldTileX, worldTileY - 15, 'Tilled!', '#94a3b8');

        if (this.gameMode === 'coop') {
          this.network.sendFarmAction('till', grid.x, grid.y);
        }
        this.saveCurrentGame();
      }
      return;
    }

    // 3. Sand Leveler: Flattens tilled plot back to seabed floor (Unlimited Tool)
    if (activeSlot.id === 'leveler') {
      if (plot.isTilled && !plot.cropId) {
        if (plot.untill()) {
          this.sound.playDig();
          this.particles.emitSparkles(worldTileX, worldTileY, '#e2e8f0', 10);
          this.particles.addFloatingText(worldTileX, worldTileY - 15, 'Flattened Sand! 🧹', '#94a3b8');

          if (this.gameMode === 'coop') {
            this.network.sendFarmAction('untill', grid.x, grid.y);
          }
          this.saveCurrentGame();
        }
      }
      return;
    }

    // 4. Planting Spores
    if (activeSlot.type === 'seed' && plot.isTilled && !plot.cropId) {
      const cropId = activeSlot.id as CropId;
      if (this.inventory.useSeed(cropId)) {
        plot.plant(cropId);
        const config = CROPS_CONFIG[cropId];
        this.sound.playPlant();
        this.particles.emitSparkles(worldTileX, worldTileY, config.glowColor, 12);
        this.particles.addFloatingText(worldTileX, worldTileY - 15, `Planted ${config.name}!`, config.glowColor);

        if (this.gameMode === 'coop') {
          this.network.sendFarmAction('plant', grid.x, grid.y, cropId);
        }
        this.saveCurrentGame();
      } else {
        this.particles.addFloatingText(worldTileX, worldTileY - 15, 'No spores left!', '#f87171');
      }
      return;
    }

    // 5. Nutrient Injector: Consumable!
    if (activeSlot.id === 'nutrient') {
      if (plot.cropId && !plot.isNutrified) {
        if (this.inventory.nutrientCount <= 0) {
          this.sound.playHurt();
          this.particles.addFloatingText(this.player.x, this.player.y - 30, 'Nutrient Vial Empty! (Buy refill from Barnaby)', '#f87171');
          return;
        }

        if (this.inventory.useNutrient()) {
          plot.applyNutrient();
          this.sound.playNutrient();
          this.particles.emitSparkles(worldTileX, worldTileY, '#4cf3d8', 16);
          this.particles.addFloatingText(worldTileX, worldTileY - 15, `Nutrients Injected! ⚡ (${this.inventory.nutrientCount} left)`, '#4cf3d8');

          if (this.gameMode === 'coop') {
            this.network.sendFarmAction('nutrient', grid.x, grid.y);
          }
          this.saveCurrentGame();
        }
      }
      return;
    }
  }

  private render() {
    const ctx = this.ctx;
    const cam = this.camera;

    // Clear Screen
    ctx.fillStyle = this.activeMap === 'seabed' ? '#030d1a' : '#090514';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.activeMap === 'seabed') {
      // Aimed grid target
      const aimWorldPos = cam.screenToWorld(this.input.mousePos.x, this.input.mousePos.y);
      const targetGrid = this.player.getTargetedGrid(aimWorldPos);

      // 1. Draw Seabed World Tiles & Crops
      this.world.draw(
        ctx,
        cam.x,
        cam.y,
        cam.viewportWidth,
        cam.viewportHeight,
        this.timeSec,
        targetGrid
      );

      // 2. Draw Ambient Fishes
      this.fauna.draw(ctx, cam.x, cam.y);

      // 3. Draw Barnaby the Crab
      this.merchant.draw(ctx, cam.x, cam.y);

      // 4. Draw Remote Players (if on seabed)
      if (this.gameMode === 'coop') {
        for (const rp of this.remotePlayers.values()) {
          if (rp.currentMap === 'seabed') {
            rp.draw(ctx, cam.x, cam.y);
          }
        }
      }

      // 5. Draw Local Player
      this.player.draw(ctx, cam.x, cam.y);

      // 6. Draw Seabed Dynamic Lighting
      this.lighting.render(
        ctx,
        cam.x,
        cam.y,
        this.player.x,
        this.player.y,
        this.player.facingAngle,
        this.world.farmPlots,
        this.world.ventLocations,
        this.world.merchantLocation,
        this.dayCycleTime,
        this.inventory.getSpotlightDist()
      );

      // 7. Draw Weather Atmospheric Effects & Overlays
      this.weather.render(ctx, this.canvas.width, this.canvas.height);
    } else {
      // HOME GROTTO RENDERING
      // 1. Draw Grotto Cavern, Crystal Walls, Chests & Refinery
      this.grotto.draw(ctx, cam.x, cam.y, this.timeSec);

      // 2. Draw Remote Players (if in grotto)
      if (this.gameMode === 'coop') {
        for (const rp of this.remotePlayers.values()) {
          if (rp.currentMap === 'grotto') {
            rp.draw(ctx, cam.x, cam.y);
          }
        }
      }

      // 3. Draw Local Player
      this.player.draw(ctx, cam.x, cam.y);

      // 4. Draw Grotto Interior Lighting
      this.lighting.renderGrotto(
        ctx,
        cam.x,
        cam.y,
        this.player.x,
        this.player.y,
        this.player.facingAngle,
        this.inventory.getSpotlightDist()
      );
    }

    // Underwater Particles & Floating Text on top
    this.particles.draw(ctx, cam.x, cam.y);
  }
}

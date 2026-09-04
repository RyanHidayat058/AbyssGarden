import { SoundSystem } from '../core/Sound';
import { AccountManager } from '../core/Account';

export class SettingsModal {
  private modalEl: HTMLElement;
  private tabControlsBtn: HTMLElement;
  private tabAudioBtn: HTMLElement;
  private tabAccountBtn: HTMLElement;

  private paneControlsEl: HTMLElement;
  private paneAudioEl: HTMLElement;
  private paneAccountEl: HTMLElement;

  // Audio elements
  private sliderMaster: HTMLInputElement;
  private sliderAmbient: HTMLInputElement;
  private sliderSfx: HTMLInputElement;
  private valMasterText: HTMLElement;
  private valAmbientText: HTMLElement;
  private valSfxText: HTMLElement;

  // Account elements
  private diverNameInput: HTMLInputElement;
  private btnSaveDiverName: HTMLButtonElement;
  private diverRankEl: HTMLElement;
  private diverStatsEl: HTMLElement;
  private btnLogout: HTMLButtonElement;

  public isOpen: boolean = false;

  constructor(
    private sound: SoundSystem,
    private account: AccountManager,
    private onLogoutCallback: () => void
  ) {
    this.modalEl = document.getElementById('modal-settings')!;
    this.tabControlsBtn = document.getElementById('tab-settings-controls')!;
    this.tabAudioBtn = document.getElementById('tab-settings-audio')!;
    this.tabAccountBtn = document.getElementById('tab-settings-account')!;

    this.paneControlsEl = document.getElementById('pane-settings-controls')!;
    this.paneAudioEl = document.getElementById('pane-settings-audio')!;
    this.paneAccountEl = document.getElementById('pane-settings-account')!;

    this.sliderMaster = document.getElementById('slider-master') as HTMLInputElement;
    this.sliderAmbient = document.getElementById('slider-ambient') as HTMLInputElement;
    this.sliderSfx = document.getElementById('slider-sfx') as HTMLInputElement;
    this.valMasterText = document.getElementById('val-master-text')!;
    this.valAmbientText = document.getElementById('val-ambient-text')!;
    this.valSfxText = document.getElementById('val-sfx-text')!;

    this.diverNameInput = document.getElementById('diver-name-input') as HTMLInputElement;
    this.btnSaveDiverName = document.getElementById('btn-save-diver-name') as HTMLButtonElement;
    this.diverRankEl = document.getElementById('diver-rank-display')!;
    this.diverStatsEl = document.getElementById('diver-stats-display')!;
    this.btnLogout = document.getElementById('btn-logout-account') as HTMLButtonElement;

    this.setupEvents();
  }

  private setupEvents() {
    // Close button
    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      this.close();
    });

    // Tab switching
    this.tabControlsBtn.addEventListener('click', () => this.switchTab('controls'));
    this.tabAudioBtn.addEventListener('click', () => this.switchTab('audio'));
    this.tabAccountBtn.addEventListener('click', () => this.switchTab('account'));

    // Audio Sliders
    this.sliderMaster.addEventListener('input', () => {
      const val = parseInt(this.sliderMaster.value, 10) / 100;
      this.sound.setMasterVolume(val);
      this.valMasterText.textContent = `${this.sliderMaster.value}%`;
    });

    this.sliderAmbient.addEventListener('input', () => {
      const val = parseInt(this.sliderAmbient.value, 10) / 100;
      this.sound.setAmbientVolume(val);
      this.valAmbientText.textContent = `${this.sliderAmbient.value}%`;
    });

    this.sliderSfx.addEventListener('input', () => {
      const val = parseInt(this.sliderSfx.value, 10) / 100;
      this.sound.setSfxVolume(val);
      this.valSfxText.textContent = `${this.sliderSfx.value}%`;
    });

    // Test Audio SFX button
    document.getElementById('btn-test-sound')?.addEventListener('click', () => {
      this.sound.playHarvest();
    });

    // Save Diver Name
    this.btnSaveDiverName.addEventListener('click', () => {
      const newName = this.diverNameInput.value.trim();
      if (newName) {
        this.account.setDiverName(newName);
        this.sound.playCoin();
        this.renderAccountInfo();
      }
    });

    // Logout Button
    this.btnLogout.addEventListener('click', () => {
      const confirmed = confirm('Are you sure you want to log out of this Diver Profile? Your progress is saved.');
      if (confirmed) {
        this.sound.playClick();
        this.account.logout();
        this.close();
        this.onLogoutCallback();
      }
    });
  }

  private switchTab(tab: 'controls' | 'audio' | 'account') {
    this.sound.playClick();

    // Reset buttons
    this.tabControlsBtn.classList.remove('active');
    this.tabAudioBtn.classList.remove('active');
    this.tabAccountBtn.classList.remove('active');

    // Reset panes
    this.paneControlsEl.classList.add('hidden');
    this.paneAudioEl.classList.add('hidden');
    this.paneAccountEl.classList.add('hidden');

    if (tab === 'controls') {
      this.tabControlsBtn.classList.add('active');
      this.paneControlsEl.classList.remove('hidden');
    } else if (tab === 'audio') {
      this.tabAudioBtn.classList.add('active');
      this.paneAudioEl.classList.remove('hidden');
      this.syncAudioSliders();
    } else {
      this.tabAccountBtn.classList.add('active');
      this.paneAccountEl.classList.remove('hidden');
      this.renderAccountInfo();
    }
  }

  public syncAudioSliders() {
    const masterVal = Math.round(this.sound.getMasterVolume() * 100);
    const ambientVal = Math.round(this.sound.getAmbientVolume() * 100);
    const sfxVal = Math.round(this.sound.getSfxVolume() * 100);

    this.sliderMaster.value = `${masterVal}`;
    this.valMasterText.textContent = `${masterVal}%`;

    this.sliderAmbient.value = `${ambientVal}`;
    this.valAmbientText.textContent = `${ambientVal}%`;

    this.sliderSfx.value = `${sfxVal}`;
    this.valSfxText.textContent = `${sfxVal}%`;
  }

  public renderAccountInfo() {
    const profile = this.account.currentProfile;
    this.diverNameInput.value = profile.name;
    this.diverRankEl.textContent = profile.rank;

    this.diverStatsEl.innerHTML = `
      <div class="account-stat-row">
        <span>Avatar:</span> <strong>${profile.avatarIcon}</strong>
      </div>
      <div class="account-stat-row">
        <span>Lifetime Shells:</span> <strong>${profile.totalShellsEarned} 🐚</strong>
      </div>
      <div class="account-stat-row">
        <span>Flora Harvested:</span> <strong>${profile.totalHarvests} crops</strong>
      </div>
      <div class="account-stat-row">
        <span>First Expedition:</span> <strong>${profile.createdAt}</strong>
      </div>
    `;
  }

  public open(defaultTab: 'controls' | 'audio' | 'account' = 'controls') {
    this.isOpen = true;
    this.modalEl.classList.remove('hidden');
    this.sound.playClick();
    this.switchTab(defaultTab);
  }

  public close() {
    this.isOpen = false;
    this.modalEl.classList.add('hidden');
    this.sound.playClick();
  }
}

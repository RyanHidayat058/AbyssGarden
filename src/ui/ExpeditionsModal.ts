import { NetworkManager } from '../core/Network';
import { SoundSystem } from '../core/Sound';

export class ExpeditionsModal {
  private modalEl: HTMLElement;
  private tabCreateBtn: HTMLElement;
  private tabJoinBtn: HTMLElement;
  private tabSavedBtn: HTMLElement;

  private createSectionEl: HTMLElement;
  private joinSectionEl: HTMLElement;
  private savedSectionEl: HTMLElement;
  private activeRoomSectionEl: HTMLElement;

  private expNameInput: HTMLInputElement;
  private btnCreateExp: HTMLButtonElement;
  private joinCodeInput: HTMLInputElement;
  private btnJoinExp: HTMLButtonElement;
  private savedListEl: HTMLElement;
  private messageEl: HTMLElement;

  // Active room elements
  private roomCodeDisplayEl: HTMLElement;
  private roomDiversListEl: HTMLElement;
  private btnLeaveExp: HTMLButtonElement;

  public isOpen: boolean = false;
  private onExpeditionJoined?: (expedition: any) => void;
  private onExpeditionLeft?: () => void;

  constructor(
    private network: NetworkManager,
    private sound: SoundSystem,
    onJoined?: (expedition: any) => void,
    onLeft?: () => void
  ) {
    this.onExpeditionJoined = onJoined;
    this.onExpeditionLeft = onLeft;

    this.modalEl = document.getElementById('modal-expeditions')!;
    this.tabCreateBtn = document.getElementById('tab-exp-create')!;
    this.tabJoinBtn = document.getElementById('tab-exp-join')!;
    this.tabSavedBtn = document.getElementById('tab-exp-saved')!;

    this.createSectionEl = document.getElementById('exp-create-section')!;
    this.joinSectionEl = document.getElementById('exp-join-section')!;
    this.savedSectionEl = document.getElementById('exp-saved-section')!;
    this.activeRoomSectionEl = document.getElementById('exp-active-room-section')!;

    this.expNameInput = document.getElementById('input-exp-name') as HTMLInputElement;
    this.btnCreateExp = document.getElementById('btn-create-exp') as HTMLButtonElement;
    this.joinCodeInput = document.getElementById('input-join-code') as HTMLInputElement;
    this.btnJoinExp = document.getElementById('btn-join-exp') as HTMLButtonElement;
    this.savedListEl = document.getElementById('exp-saved-list')!;
    this.messageEl = document.getElementById('exp-message')!;

    this.roomCodeDisplayEl = document.getElementById('exp-active-code')!;
    this.roomDiversListEl = document.getElementById('exp-divers-list')!;
    this.btnLeaveExp = document.getElementById('btn-leave-exp') as HTMLButtonElement;

    this.setupEvents();
  }

  private setupEvents() {
    document.getElementById('btn-close-expeditions')?.addEventListener('click', () => {
      this.close();
    });

    this.tabCreateBtn.addEventListener('click', () => this.switchTab('create'));
    this.tabJoinBtn.addEventListener('click', () => this.switchTab('join'));
    this.tabSavedBtn.addEventListener('click', () => this.switchTab('saved'));

    this.btnCreateExp.addEventListener('click', () => this.handleCreate());
    this.btnJoinExp.addEventListener('click', () => this.handleJoin());
    this.btnLeaveExp.addEventListener('click', () => this.handleLeave());

    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.key === 'Escape') {
        this.close();
      }
    });
  }

  private switchTab(tab: 'create' | 'join' | 'saved') {
    this.sound.playClick();
    this.messageEl.textContent = '';

    this.tabCreateBtn.classList.toggle('active', tab === 'create');
    this.tabJoinBtn.classList.toggle('active', tab === 'join');
    this.tabSavedBtn.classList.toggle('active', tab === 'saved');

    this.createSectionEl.classList.toggle('hidden', tab !== 'create');
    this.joinSectionEl.classList.toggle('hidden', tab !== 'join');
    this.savedSectionEl.classList.toggle('hidden', tab !== 'saved');

    if (tab === 'saved') {
      this.loadSavedExpeditions();
    }
  }

  public open() {
    if (!this.network.token || !this.network.currentUser) {
      alert('Please sign in first to access co-op expeditions.');
      return;
    }

    this.isOpen = true;
    this.modalEl.classList.remove('hidden');
    this.sound.playClick();
    this.messageEl.textContent = '';

    if (this.network.activeRoomCode) {
      this.renderActiveRoom();
    } else {
      this.activeRoomSectionEl.classList.add('hidden');
      document.getElementById('exp-tabs-nav')?.classList.remove('hidden');
      this.switchTab('create');
    }
  }

  public close() {
    this.isOpen = false;
    this.modalEl.classList.add('hidden');
    this.sound.playClick();
  }

  public renderActiveRoom() {
    document.getElementById('exp-tabs-nav')?.classList.add('hidden');
    this.createSectionEl.classList.add('hidden');
    this.joinSectionEl.classList.add('hidden');
    this.savedSectionEl.classList.add('hidden');
    this.activeRoomSectionEl.classList.remove('hidden');

    this.roomCodeDisplayEl.textContent = this.network.activeRoomCode || '------';
  }

  public updateRoomDivers(players: { callsign: string }[]) {
    this.roomDiversListEl.innerHTML = '';
    players.forEach(p => {
      const item = document.createElement('div');
      item.className = 'exp-diver-chip';
      item.innerHTML = `<span class="diver-badge">Diver</span> <strong>${p.callsign}</strong>`;
      this.roomDiversListEl.appendChild(item);
    });
  }

  private async handleCreate() {
    const name = this.expNameInput.value.trim() || `${this.network.currentUser?.callsign}'s Expedition`;
    this.btnCreateExp.disabled = true;

    try {
      const exp = await this.network.createExpedition(name);
      if (exp) {
        this.sound.playCoin();
        this.renderActiveRoom();
        if (this.onExpeditionJoined) this.onExpeditionJoined(exp);
      }
    } catch (err: any) {
      this.sound.playHurt();
      this.showMessage(err.message || 'Failed to create expedition', true);
    } finally {
      this.btnCreateExp.disabled = false;
    }
  }

  private async handleJoin() {
    const code = this.joinCodeInput.value.trim().toUpperCase();
    if (!code) {
      this.showMessage('Please enter a 6-character room code.', true);
      return;
    }

    this.btnJoinExp.disabled = true;
    try {
      const exp = await this.network.joinExpedition(code);
      if (exp) {
        this.sound.playCoin();
        this.renderActiveRoom();
        if (this.onExpeditionJoined) this.onExpeditionJoined(exp);
      }
    } catch (err: any) {
      this.sound.playHurt();
      this.showMessage(err.message || 'Failed to join expedition', true);
    } finally {
      this.btnJoinExp.disabled = false;
    }
  }

  private async loadSavedExpeditions() {
    this.savedListEl.innerHTML = '<div class="exp-loading">Loading expedition records...</div>';
    try {
      const list = await this.network.getMyExpeditions();

      if (!list || list.length === 0) {
        this.savedListEl.innerHTML = '<div class="exp-empty">You have not created or joined any expeditions yet.</div>';
        return;
      }

      this.savedListEl.innerHTML = '';
      list.forEach((exp: any) => {
        const item = document.createElement('div');
        item.className = 'saved-exp-card';
        const code = exp.code || exp.room_code || '------';
        item.innerHTML = `
          <div class="saved-exp-info">
            <div class="saved-exp-name">${exp.name}</div>
            <div class="saved-exp-meta">
              Code: <span class="code-tag">${code}</span> | Role: <em>${exp.role || 'Member'}</em> | Max 4 Divers
            </div>
          </div>
          <button class="btn-resume-exp" data-code="${code}">Resume</button>
        `;

        item.querySelector('.btn-resume-exp')?.addEventListener('click', async () => {
          try {
            const joinedExp = await this.network.joinExpedition(code);
            if (joinedExp) {
              this.sound.playCoin();
              this.renderActiveRoom();
              if (this.onExpeditionJoined) this.onExpeditionJoined(joinedExp);
            }
          } catch (err: any) {
            this.sound.playHurt();
            this.showMessage(err.message || 'Could not resume expedition', true);
          }
        });

        this.savedListEl.appendChild(item);
      });
    } catch (err: any) {
      this.savedListEl.innerHTML = `<div class="exp-empty error">Failed to load expeditions: ${err.message}</div>`;
    }
  }

  private handleLeave() {
    this.network.leaveExpedition();
    this.sound.playClick();
    this.activeRoomSectionEl.classList.add('hidden');
    document.getElementById('exp-tabs-nav')?.classList.remove('hidden');
    this.switchTab('create');
    if (this.onExpeditionLeft) this.onExpeditionLeft();
  }

  private showMessage(msg: string, isError: boolean = false) {
    this.messageEl.textContent = msg;
    this.messageEl.className = isError ? 'exp-msg error' : 'exp-msg success';
  }
}

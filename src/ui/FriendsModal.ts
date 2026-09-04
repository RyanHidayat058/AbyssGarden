import { NetworkManager } from '../core/Network';
import { SoundSystem } from '../core/Sound';

export class FriendsModal {
  private modalEl: HTMLElement;
  private myCallsignEl: HTMLElement;
  private addFriendInput: HTMLInputElement;
  private addFriendBtn: HTMLButtonElement;
  private friendsListEl: HTMLElement;
  private messageEl: HTMLElement;

  public isOpen: boolean = false;
  private onInviteCallback?: (friendCallsign: string) => void;

  constructor(
    private network: NetworkManager,
    private sound: SoundSystem,
    onInvite?: (friendCallsign: string) => void
  ) {
    this.onInviteCallback = onInvite;
    this.modalEl = document.getElementById('modal-friends')!;
    this.myCallsignEl = document.getElementById('friends-my-callsign')!;
    this.addFriendInput = document.getElementById('input-add-friend') as HTMLInputElement;
    this.addFriendBtn = document.getElementById('btn-add-friend') as HTMLButtonElement;
    this.friendsListEl = document.getElementById('friends-list')!;
    this.messageEl = document.getElementById('friends-message')!;

    this.setupEvents();
  }

  private setupEvents() {
    document.getElementById('btn-close-friends')?.addEventListener('click', () => {
      this.close();
    });

    this.addFriendBtn.addEventListener('click', () => {
      this.handleAddFriend();
    });

    this.addFriendInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleAddFriend();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.key === 'Escape') {
        this.close();
      }
    });
  }

  public async open() {
    if (!this.network.token || !this.network.currentUser) {
      alert('Please sign in first to access your friend roster.');
      return;
    }

    this.isOpen = true;
    this.modalEl.classList.remove('hidden');
    this.sound.playClick();
    this.myCallsignEl.textContent = this.network.currentUser.callsign;
    this.messageEl.textContent = '';
    await this.refreshList();
  }

  public close() {
    this.isOpen = false;
    this.modalEl.classList.add('hidden');
    this.sound.playClick();
  }

  public async refreshList() {
    this.friendsListEl.innerHTML = '<div class="friends-loading">Scanning comms frequencies...</div>';
    try {
      const friends = await this.network.getFriends();

      if (friends.length === 0) {
        this.friendsListEl.innerHTML = '<div class="friends-empty">No divers on your frequency yet. Enter a callsign above to add!</div>';
        return;
      }

      this.friendsListEl.innerHTML = '';
      friends.forEach((f: any) => {
        const item = document.createElement('div');
        item.className = 'friend-row';
        item.innerHTML = `
          <div class="friend-avatar">Diver</div>
          <div class="friend-info">
            <div class="friend-callsign">${f.callsign}</div>
            <div class="friend-status online">Connected to Abyss Net</div>
          </div>
          <div class="friend-actions">
            ${this.network.activeRoomCode ? `<button class="btn-invite-friend" data-callsign="${f.callsign}">Invite</button>` : ''}
          </div>
        `;

        item.querySelector('.btn-invite-friend')?.addEventListener('click', () => {
          if (this.onInviteCallback) {
            this.onInviteCallback(f.callsign);
            this.showMessage(`Expedition invite dispatched to ${f.callsign}!`);
            this.sound.playCoin();
          }
        });

        this.friendsListEl.appendChild(item);
      });
    } catch (err: any) {
      this.friendsListEl.innerHTML = `<div class="friends-empty error">Failed to load friends: ${err.message}</div>`;
    }
  }

  private async handleAddFriend() {
    const callsign = this.addFriendInput.value.trim();
    if (!callsign) return;

    this.addFriendBtn.disabled = true;
    try {
      await this.network.addFriend(callsign);
      this.sound.playCoin();
      this.showMessage(`Added ${callsign} to your friend list!`);
      this.addFriendInput.value = '';
      await this.refreshList();
    } catch (err: any) {
      this.sound.playHurt();
      this.showMessage(err.message || 'Could not add friend', true);
    } finally {
      this.addFriendBtn.disabled = false;
    }
  }

  private showMessage(msg: string, isError: boolean = false) {
    this.messageEl.textContent = msg;
    this.messageEl.className = isError ? 'friends-msg error' : 'friends-msg success';
  }
}

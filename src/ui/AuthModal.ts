import { NetworkManager } from '../core/Network';
import { SoundSystem } from '../core/Sound';

export class AuthModal {
  private modalEl: HTMLElement;
  private tabLoginBtn: HTMLElement;
  private tabRegisterBtn: HTMLElement;
  private formEl: HTMLFormElement;
  private callsignInput: HTMLInputElement;
  private passwordInput: HTMLInputElement;
  private submitBtn: HTMLButtonElement;
  private messageEl: HTMLElement;

  public isOpen: boolean = false;
  private isRegisterMode: boolean = false;

  constructor(
    private network: NetworkManager,
    private sound: SoundSystem,
    private onAuthSuccess?: (user: { id: string; callsign: string }) => void
  ) {
    this.modalEl = document.getElementById('modal-auth')!;
    this.tabLoginBtn = document.getElementById('tab-auth-login')!;
    this.tabRegisterBtn = document.getElementById('tab-auth-register')!;
    this.formEl = document.getElementById('auth-form') as HTMLFormElement;
    this.callsignInput = document.getElementById('auth-callsign') as HTMLInputElement;
    this.passwordInput = document.getElementById('auth-password') as HTMLInputElement;
    this.submitBtn = document.getElementById('btn-auth-submit') as HTMLButtonElement;
    this.messageEl = document.getElementById('auth-message')!;

    this.setupEvents();
  }

  private setupEvents() {
    document.getElementById('btn-close-auth')?.addEventListener('click', () => {
      this.close();
    });

    this.tabLoginBtn.addEventListener('click', () => {
      this.setMode(false);
    });

    this.tabRegisterBtn.addEventListener('click', () => {
      this.setMode(true);
    });

    this.formEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });
  }

  private setMode(register: boolean) {
    this.isRegisterMode = register;
    this.sound.playClick();
    this.messageEl.textContent = '';

    if (register) {
      this.tabRegisterBtn.classList.add('active');
      this.tabLoginBtn.classList.remove('active');
      this.submitBtn.textContent = 'Create Diver Profile';
    } else {
      this.tabLoginBtn.classList.add('active');
      this.tabRegisterBtn.classList.remove('active');
      this.submitBtn.textContent = 'Sign In to Seabed';
    }
  }

  public open() {
    this.isOpen = true;
    this.modalEl.classList.remove('hidden');
    this.sound.playClick();
    this.setMode(false);
  }

  public close() {
    this.isOpen = false;
    this.modalEl.classList.add('hidden');
    this.sound.playClick();
  }

  private async handleSubmit() {
    const callsign = this.callsignInput.value.trim();
    const password = this.passwordInput.value;

    if (!callsign || !password) {
      this.showMessage('Please enter both callsign and access key.', true);
      return;
    }

    this.submitBtn.disabled = true;
    this.submitBtn.textContent = 'Contacting Seabed Terminal...';

    try {
      const user = this.isRegisterMode
        ? await this.network.register(callsign, password)
        : await this.network.login(callsign, password);

      if (user && user.id) {
        this.sound.playCoin();
        this.showMessage(`Welcome aboard, Diver ${user.callsign}!`);
        setTimeout(() => {
          this.close();
          if (this.onAuthSuccess) this.onAuthSuccess({ id: user.id, callsign: user.callsign });
        }, 600);
      }
    } catch (err: any) {
      this.sound.playHurt();
      this.showMessage(err.message || 'Authentication error', true);
    } finally {
      this.submitBtn.disabled = false;
      this.submitBtn.textContent = this.isRegisterMode ? 'Create Diver Profile' : 'Sign In to Seabed';
    }
  }

  private showMessage(msg: string, isError: boolean = false) {
    this.messageEl.textContent = msg;
    this.messageEl.className = isError ? 'auth-msg error' : 'auth-msg success';
  }
}

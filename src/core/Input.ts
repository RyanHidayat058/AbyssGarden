export class InputManager {
  public keys: { [key: string]: boolean } = {};
  public mousePos: { x: number; y: number } = { x: 0, y: 0 };
  public isMouseDown: boolean = false;
  public mouseJustPressed: boolean = false;
  public actionJustPressed: boolean = false;
  public interactJustPressed: boolean = false;
  public hotkeyJustPressed: number | null = null;
  public wheelDelta: number = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.setupListeners();
  }

  private setupListeners() {
    window.addEventListener('keydown', (e) => {
      // Prevent default scrolling on arrow keys & space
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      if (!this.keys[e.code]) {
        if (e.code === 'Space') this.actionJustPressed = true;
        if (e.code === 'KeyE') this.interactJustPressed = true;
        if (e.key >= '1' && e.key <= '6') {
          this.hotkeyJustPressed = parseInt(e.key, 10);
        }
      }
      this.keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this.mousePos.x = (e.clientX - rect.left) * scaleX;
      this.mousePos.y = (e.clientY - rect.top) * scaleY;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isMouseDown = true;
        this.mouseJustPressed = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMouseDown = false;
      }
    });

    window.addEventListener('wheel', (e) => {
      this.wheelDelta = Math.sign(e.deltaY);
    }, { passive: true });
  }

  public getMoveVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) y -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) y += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;

    // Normalize diagonal movement
    if (x !== 0 && y !== 0) {
      const invLen = 1 / Math.SQRT2;
      x *= invLen;
      y *= invLen;
    }

    return { x, y };
  }

  public update() {
    // Reset one-frame pulses
    this.mouseJustPressed = false;
    this.actionJustPressed = false;
    this.interactJustPressed = false;
    this.hotkeyJustPressed = null;
    this.wheelDelta = 0;
  }
}

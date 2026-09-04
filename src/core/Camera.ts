export class Camera {
  public x: number = 0;
  public y: number = 0;
  public targetX: number = 0;
  public targetY: number = 0;
  public zoom: number = 1;

  constructor(
    public viewportWidth: number,
    public viewportHeight: number,
    public worldWidth: number,
    public worldHeight: number
  ) {}

  public follow(targetX: number, targetY: number, lerpFactor: number = 0.1) {
    this.targetX = targetX - this.viewportWidth / 2;
    this.targetY = targetY - this.viewportHeight / 2;

    // Smooth movement
    this.x += (this.targetX - this.x) * lerpFactor;
    this.y += (this.targetY - this.y) * lerpFactor;

    // Clamp or center camera within world bounds
    if (this.worldWidth <= this.viewportWidth) {
      this.x = (this.worldWidth - this.viewportWidth) / 2;
    } else {
      this.x = Math.max(0, Math.min(this.x, this.worldWidth - this.viewportWidth));
    }

    if (this.worldHeight <= this.viewportHeight) {
      this.y = (this.worldHeight - this.viewportHeight) / 2;
    } else {
      this.y = Math.max(0, Math.min(this.y, this.worldHeight - this.viewportHeight));
    }
  }

  public screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: screenX + this.x,
      y: screenY + this.y
    };
  }

  public worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX - this.x,
      y: worldY - this.y
    };
  }

  public resize(width: number, height: number) {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  public setBounds(worldWidth: number, worldHeight: number) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }
}

// High-Performance 60 FPS HTML5 Canvas Eye Renderer & Expression Engine

export type EyeTheme = 'natural' | 'cyberpunk' | 'cat' | 'googly' | 'pixel' | 'robot';

export interface EyeOptions {
  theme: EyeTheme;
  x: number;
  y: number;
  radius: number;
  targetX: number;
  targetY: number;
  isIdle: boolean;
  velocity: number;
  clickBurstCount: number;
  isWinking: boolean;
}

export class EyeEngine {
  private spinAngle = 0;
  private springX = 0;
  private springY = 0;
  private springVx = 0;
  private springVy = 0;
  private lastTargetX = 0;
  private lastTargetY = 0;

  public update(options: EyeOptions, dt: number) {
    const dx = options.targetX - this.lastTargetX;
    const dy = options.targetY - this.lastTargetY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1.0) {
      this.springVx += dx * 0.1;
      this.springVy += dy * 0.1;
    }

    this.lastTargetX = options.targetX;
    this.lastTargetY = options.targetY;

    // Spring physics step
    const k = 90.0;
    const c = 9.0;
    const fx = -k * this.springX;
    const fy = -k * this.springY;

    this.springVx += (fx - c * this.springVx) * dt;
    this.springVy += (fy - c * this.springVy) * dt;

    this.springX += this.springVx * dt;
    this.springY += this.springVy * dt;

    // Dizzy spin update
    if (options.velocity > 1200) {
      this.spinAngle += (options.velocity / 1200) * dt * Math.PI * 4;
    }
  }

  public draw(ctx: CanvasRenderingContext2D, options: EyeOptions) {
    ctx.save();
    ctx.translate(options.x, options.y);

    const relX = options.targetX - options.x;
    const relY = options.targetY - options.y;
    const angle = Math.atan2(relY, relX);
    const dist = Math.sqrt(relX * relX + relY * relY);

    const maxOffset = options.radius * 0.45;
    const currentOffset = Math.min(maxOffset, dist * 0.12);

    const pupilX = Math.cos(angle) * currentOffset + (options.theme === 'googly' ? this.springX : 0);
    const pupilY = Math.sin(angle) * currentOffset + (options.theme === 'googly' ? this.springY : 0);

    // Dynamic Dilated pupil factor for Surprised state
    const pupilScale = options.clickBurstCount >= 2 ? 1.4 : 1.0;

    // Eyelid droop for Sleepy state
    let eyelidLevel = options.isIdle ? 0.6 : 0;
    if (options.isWinking) eyelidLevel = 0.95;

    switch (options.theme) {
      case 'cyberpunk':
        this.drawCyberpunk(ctx, options.radius, angle, pupilX, pupilY, eyelidLevel);
        break;
      case 'cat':
        this.drawCat(ctx, options.radius, pupilX, pupilY, eyelidLevel);
        break;
      case 'googly':
        this.drawGoogly(ctx, options.radius, pupilX, pupilY, eyelidLevel);
        break;
      case 'pixel':
        this.drawPixel(ctx, options.radius, angle, eyelidLevel);
        break;
      case 'robot':
        this.drawRobot(ctx, options.radius, pupilX, pupilY, eyelidLevel);
        break;
      case 'natural':
      default:
        this.drawNatural(ctx, options.radius, pupilX, pupilY, pupilScale, eyelidLevel);
        break;
    }

    ctx.restore();
  }

  private drawNatural(
    ctx: CanvasRenderingContext2D,
    r: number,
    px: number,
    py: number,
    pupilScale: number,
    eyelid: number
  ) {
    // Sclera
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const scleraGrad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    scleraGrad.addColorStop(0, '#ffffff');
    scleraGrad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = scleraGrad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
    ctx.clip();

    // Iris
    const irisR = r * 0.5;
    ctx.beginPath();
    ctx.arc(px, py, irisR, 0, Math.PI * 2);
    const irisGrad = ctx.createRadialGradient(px, py, 2, px, py, irisR);
    irisGrad.addColorStop(0, '#06b6d4');
    irisGrad.addColorStop(0.7, '#0284c7');
    irisGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = irisGrad;
    ctx.fill();

    // Pupil
    const pupilR = irisR * 0.45 * pupilScale;
    ctx.beginPath();
    ctx.arc(px, py, pupilR, 0, Math.PI * 2);
    ctx.fillStyle = '#090d16';
    ctx.fill();

    // Gloss Reflection
    ctx.beginPath();
    ctx.arc(px - irisR * 0.3, py - irisR * 0.3, irisR * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fill();

    // Eyelid
    if (eyelid > 0) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-r, -r, r * 2, r * 2 * eyelid);
    }

    ctx.restore();
  }

  private drawCyberpunk(
    ctx: CanvasRenderingContext2D,
    r: number,
    angle: number,
    px: number,
    py: number,
    eyelid: number
  ) {
    // Outer Neon Ring
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 3;
    ctx.stroke();

    // HUD Arc
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.8, angle - 0.6 + this.spinAngle, angle + 0.6 + this.spinAngle);
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Core LED Iris
    ctx.beginPath();
    ctx.arc(px, py, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 12;

    // Crosshair Lines
    ctx.beginPath();
    ctx.moveTo(px - r * 0.3, py);
    ctx.lineTo(px + r * 0.3, py);
    ctx.moveTo(px, py - r * 0.3);
    ctx.lineTo(px, py + r * 0.3);
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (eyelid > 0) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(-r, -r, r * 2, r * 2 * eyelid);
    }
  }

  private drawCat(
    ctx: CanvasRenderingContext2D,
    r: number,
    px: number,
    py: number,
    eyelid: number
  ) {
    // Amber Sclera
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
    ctx.clip();

    // Slit Pupil
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(0.25, 0.9);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.restore();

    if (eyelid > 0) {
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(-r, -r, r * 2, r * 2 * eyelid);
    }

    ctx.restore();
  }

  private drawGoogly(
    ctx: CanvasRenderingContext2D,
    r: number,
    px: number,
    py: number,
    eyelid: number
  ) {
    // Big White Sclera
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, 0, Math.PI * 2);
    ctx.clip();

    // Loose Bouncing Pupil
    ctx.beginPath();
    ctx.arc(px, py, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#020617';
    ctx.fill();

    if (eyelid > 0) {
      ctx.fillStyle = '#334155';
      ctx.fillRect(-r, -r, r * 2, r * 2 * eyelid);
    }

    ctx.restore();
  }

  private drawPixel(
    ctx: CanvasRenderingContext2D,
    r: number,
    angle: number,
    eyelid: number
  ) {
    const size = Math.floor(r / 4);

    // Pixel box sclera (8x8)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-4 * size, -4 * size, 8 * size, 8 * size);

    // Pixel iris (4x4)
    const stepX = Math.round(Math.cos(angle) * 1.5) * size;
    const stepY = Math.round(Math.sin(angle) * 1.5) * size;
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(-2 * size + stepX, -2 * size + stepY, 4 * size, 4 * size);

    // Pixel pupil (2x2)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-1 * size + stepX, -1 * size + stepY, 2 * size, 2 * size);

    if (eyelid > 0) {
      const rows = Math.floor(8 * eyelid);
      ctx.fillStyle = '#090d16';
      ctx.fillRect(-4 * size, -4 * size, 8 * size, rows * size);
    }
  }

  private drawRobot(
    ctx: CanvasRenderingContext2D,
    r: number,
    px: number,
    py: number,
    eyelid: number
  ) {
    // Dark Metallic Base
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Concentric Radar Rings
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.stroke();

    // Red Laser Iris
    ctx.beginPath();
    ctx.arc(px, py, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 10;

    if (eyelid > 0) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-r, -r, r * 2, r * 2 * eyelid);
    }
    ctx.shadowBlur = 0;
  }
}

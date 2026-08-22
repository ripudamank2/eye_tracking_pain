// High-Performance 60 FPS HTML5 Canvas Eye Renderer with Organic Eyelids, Blinking & Tear Crying System

export type EyeTheme = 'cute' | 'natural' | 'cyberpunk' | 'cat' | 'googly' | 'pixel' | 'robot';

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
  isCrying?: boolean;
}

export class EyeEngine {
  private spinAngle = 0;
  private springX = 0;
  private springY = 0;
  private springVx = 0;
  private springVy = 0;
  private lastTargetX = 0;
  private lastTargetY = 0;

  // Organic Blinking System
  private blinkTimer = 0;
  private nextBlinkInterval = 3.5;
  private isBlinking = false;
  private blinkProgress = 0;
  private blinkDuration = 0.14;
  private blinkElapsed = 0;
  private isDoubleBlinking = false;

  // Tear Animation System
  private tearOffset = 0;

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

    // --- Organic Natural Blinking Logic ---
    this.blinkTimer += dt;

    if (!this.isBlinking && this.blinkTimer >= this.nextBlinkInterval) {
      this.isBlinking = true;
      this.blinkElapsed = 0;
      this.blinkTimer = 0;
      this.isDoubleBlinking = Math.random() < 0.2;
      this.nextBlinkInterval = 2.5 + Math.random() * 2.3;
    }

    if (this.isBlinking) {
      this.blinkElapsed += dt;
      const half = this.blinkDuration / 2;

      if (this.blinkElapsed <= half) {
        this.blinkProgress = Math.sin((this.blinkElapsed / half) * (Math.PI / 2));
      } else if (this.blinkElapsed <= this.blinkDuration) {
        this.blinkProgress = Math.sin(((this.blinkDuration - this.blinkElapsed) / half) * (Math.PI / 2));
      } else {
        this.blinkProgress = 0;

        if (this.isDoubleBlinking) {
          this.isDoubleBlinking = false;
          this.blinkElapsed = 0;
        } else {
          this.isBlinking = false;
        }
      }
    }

    // Tear Dripping Update
    if (options.isCrying) {
      this.tearOffset = (this.tearOffset + dt * 140) % 90;
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

    const pupilScale = options.clickBurstCount >= 2 ? 1.4 : 1.0;

    let eyelidLevel = this.blinkProgress;
    if (options.isIdle) eyelidLevel = Math.max(eyelidLevel, 0.55);
    if (options.isWinking) eyelidLevel = 1.0;
    if (options.isCrying) eyelidLevel = Math.max(eyelidLevel, 0.7);

    switch (options.theme) {
      case 'cute':
        this.drawCute(ctx, options.radius, pupilX, pupilY, pupilScale, eyelidLevel);
        break;
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

    // Draw Crying Anime Tear Drops
    if (options.isCrying) {
      this.drawTears(ctx, options.radius);
    }

    ctx.restore();
  }

  // Draw Animated Tear Drops
  private drawTears(ctx: CanvasRenderingContext2D, r: number) {
    ctx.save();
    const tearY = r * 0.6 + this.tearOffset;
    const tearSize = r * 0.28;

    // Left tear drop
    ctx.beginPath();
    ctx.arc(-r * 0.4, tearY, tearSize, 0, Math.PI);
    ctx.quadraticCurveTo(-r * 0.4 - tearSize, tearY - tearSize * 1.5, -r * 0.4, tearY - tearSize * 2);
    ctx.quadraticCurveTo(-r * 0.4 + tearSize, tearY - tearSize * 1.5, -r * 0.4 + tearSize, tearY);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.fill();

    // Tear reflection
    ctx.beginPath();
    ctx.arc(-r * 0.4 - tearSize * 0.3, tearY - tearSize * 0.3, tearSize * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();

    ctx.restore();
  }

  // Draw Organic Curved Eyelids
  private drawOrganicEyelids(ctx: CanvasRenderingContext2D, r: number, eyelidLevel: number, skinColor = '#0f172a', lineStyle = '#06b6d4') {
    if (eyelidLevel <= 0.01) return;

    ctx.save();
    const topCapY = -r - 5;
    const lidMaxY = r * 1.05;
    const currentY = -r + (lidMaxY + r) * Math.min(1.0, eyelidLevel);

    ctx.beginPath();
    ctx.moveTo(-r - 4, topCapY);
    ctx.lineTo(r + 4, topCapY);
    ctx.lineTo(r + 4, currentY);
    ctx.quadraticCurveTo(0, currentY + r * 0.25 * eyelidLevel, -r - 4, currentY);
    ctx.closePath();

    ctx.fillStyle = skinColor;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-r - 2, currentY);
    ctx.quadraticCurveTo(0, currentY + r * 0.25 * eyelidLevel, r + 2, currentY);
    ctx.strokeStyle = lineStyle;
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();
  }

  private drawCute(
    ctx: CanvasRenderingContext2D,
    r: number,
    px: number,
    py: number,
    pupilScale: number,
    eyelid: number
  ) {
    // Pink Blush Aura
    ctx.beginPath();
    ctx.ellipse(0, r * 0.85, r * 0.7, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(244, 114, 182, 0.35)';
    ctx.fill();

    // Sclera
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const scleraGrad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
    scleraGrad.addColorStop(0, '#ffffff');
    scleraGrad.addColorStop(0.85, '#f1f5f9');
    scleraGrad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = scleraGrad;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
    ctx.clip();

    // Iris
    const irisR = r * 0.58;
    ctx.beginPath();
    ctx.arc(px, py, irisR, 0, Math.PI * 2);
    const irisGrad = ctx.createRadialGradient(px, py, 2, px, py, irisR);
    irisGrad.addColorStop(0, '#38bdf8');
    irisGrad.addColorStop(0.5, '#0284c7');
    irisGrad.addColorStop(0.85, '#0369a1');
    irisGrad.addColorStop(1, '#0c4a6e');
    ctx.fillStyle = irisGrad;
    ctx.fill();

    // Pupil
    const pupilR = irisR * 0.42 * pupilScale;
    ctx.beginPath();
    ctx.arc(px, py, pupilR, 0, Math.PI * 2);
    ctx.fillStyle = '#070a13';
    ctx.fill();

    // Glossy Catchlights
    ctx.beginPath();
    ctx.arc(px - irisR * 0.32, py - irisR * 0.32, irisR * 0.26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(px + irisR * 0.28, py + irisR * 0.28, irisR * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fill();

    this.drawOrganicEyelids(ctx, r, eyelid, '#090d16', '#f472b6');

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

    const irisR = r * 0.5;
    ctx.beginPath();
    ctx.arc(px, py, irisR, 0, Math.PI * 2);
    const irisGrad = ctx.createRadialGradient(px, py, 2, px, py, irisR);
    irisGrad.addColorStop(0, '#06b6d4');
    irisGrad.addColorStop(0.7, '#0284c7');
    irisGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = irisGrad;
    ctx.fill();

    const pupilR = irisR * 0.45 * pupilScale;
    ctx.beginPath();
    ctx.arc(px, py, pupilR, 0, Math.PI * 2);
    ctx.fillStyle = '#090d16';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(px - irisR * 0.3, py - irisR * 0.3, irisR * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();

    this.drawOrganicEyelids(ctx, r, eyelid, '#0f172a', '#38bdf8');

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
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, r * 0.8, angle - 0.6 + this.spinAngle, angle + 0.6 + this.spinAngle);
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(px, py, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(px - r * 0.3, py);
    ctx.lineTo(px + r * 0.3, py);
    ctx.moveTo(px, py - r * 0.3);
    ctx.lineTo(px, py + r * 0.3);
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 2;
    ctx.stroke();

    this.drawOrganicEyelids(ctx, r, eyelid, '#090d16', '#ec4899');
  }

  private drawCat(
    ctx: CanvasRenderingContext2D,
    r: number,
    px: number,
    py: number,
    eyelid: number
  ) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const catGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, r);
    catGrad.addColorStop(0, '#fef08a');
    catGrad.addColorStop(0.6, '#f59e0b');
    catGrad.addColorStop(1, '#b45309');
    ctx.fillStyle = catGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(px, py, r * 0.12, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#090d16';
    ctx.fill();

    this.drawOrganicEyelids(ctx, r, eyelid, '#0f172a', '#f59e0b');
  }

  private drawGoogly(
    ctx: CanvasRenderingContext2D,
    r: number,
    px: number,
    py: number,
    eyelid: number
  ) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#94a3b8';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(px, py, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#020617';
    ctx.fill();

    this.drawOrganicEyelids(ctx, r, eyelid, '#1e293b', '#94a3b8');
  }

  private drawPixel(
    ctx: CanvasRenderingContext2D,
    r: number,
    angle: number,
    eyelid: number
  ) {
    const size = Math.round(r / 4);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-size * 2, -size * 2, size * 4, size * 4);

    const px = Math.round(Math.cos(angle)) * size;
    const py = Math.round(Math.sin(angle)) * size;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(px - size / 2, py - size / 2, size, size);

    if (eyelid > 0) {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(-size * 2, -size * 2, size * 4, size * 4 * eyelid);
    }
  }

  private drawRobot(
    ctx: CanvasRenderingContext2D,
    r: number,
    px: number,
    py: number,
    eyelid: number
  ) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#334155';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(px, py, r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#f43f5e';
    ctx.fill();

    this.drawOrganicEyelids(ctx, r, eyelid, '#0f172a', '#f43f5e');
  }
}

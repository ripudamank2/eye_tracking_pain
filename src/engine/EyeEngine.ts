// High-Performance 60 FPS HTML5 Canvas Eye Renderer with Organic Eyelids, Blinking & Tear Crying System

export type EyeTheme =
  | 'cute'
  | 'natural'
  | 'cyberpunk'
  | 'cat'
  | 'googly'
  | 'pixel'
  | 'robot'
  | 'galaxy'
  | 'flame'
  | 'dragon'
  | 'matrix'
  | 'animeheart'
  | 'custom';

// In-App Custom Eye Studio: user-tunable pupil color, iris gradient, and glow intensity
// for the 'custom' theme. Kept separate from EyeOptions since it changes far less often
// than per-frame render state.
export interface CustomEyeStyle {
  pupilColor: string;
  irisColorInner: string;
  irisColorOuter: string;
  glowIntensity: number; // 0..1
}

export const DEFAULT_CUSTOM_EYE_STYLE: CustomEyeStyle = {
  pupilColor: '#070a13',
  irisColorInner: '#38bdf8',
  irisColorOuter: '#0c4a6e',
  glowIntensity: 0.5,
};

// Emotion & Expression Engine: which mood overlay to render on top of the base theme.
export type EyeExpression = 'neutral' | 'happy' | 'love' | 'surprised' | 'focused' | 'sleepy';

export type EyebrowMood = 'neutral' | 'surprised' | 'focused' | 'sleepy';

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
  expression?: EyeExpression;
  showEyebrows?: boolean;
  // Music Reactive Pupil Pulse: 0..1 bass-band level, applied as an extra pupil-scale multiplier.
  musicPulseLevel?: number;
  // Real, landmark-derived eyelid closedness (0 open..1 closed) from WebcamTracker's
  // GazeProcessor. When provided, this replaces the synthetic timer-driven blink
  // animation below so the rendered eyelid actually follows the tracked user's real
  // blinks instead of an unrelated procedural animation. Omit (mouse-only mode, no
  // camera) to keep the original synthetic blink, which is still needed there since
  // there's no real eyelid signal to follow.
  realBlinkLevel?: number;
}

export class EyeEngine {
  public customStyle: CustomEyeStyle = { ...DEFAULT_CUSTOM_EYE_STYLE };
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
    // Only advances the synthetic timer when there's no real tracked blink signal to
    // follow instead (see EyeOptions.realBlinkLevel). Letting this keep running in the
    // background while webcam tracking is active would accumulate a large blinkTimer
    // that fires a jarring "catch-up" synthetic blink the moment tracking drops.
    const hasRealBlinkSignal = options.realBlinkLevel !== undefined;

    if (!hasRealBlinkSignal) {
      this.blinkTimer += dt;

      if (!this.isBlinking && this.blinkTimer >= this.nextBlinkInterval) {
        this.isBlinking = true;
        this.blinkElapsed = 0;
        this.blinkTimer = 0;
        this.isDoubleBlinking = Math.random() < 0.2;
        this.nextBlinkInterval = 2.5 + Math.random() * 2.3;
      }
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

    const baseScale = options.clickBurstCount >= 2 ? 1.4 : 1.0;
    const pupilScale = baseScale * (1 + (options.musicPulseLevel ?? 0) * 0.35);

    const expression = options.expression ?? 'neutral';

    // Happy squint: eyelids curve up into a `^ ^` arc instead of tracking blink state.
    const isHappySquint = expression === 'happy';

    let eyelidLevel = options.realBlinkLevel ?? this.blinkProgress;
    if (options.isIdle) eyelidLevel = Math.max(eyelidLevel, 0.55);
    if (options.isWinking) eyelidLevel = 1.0;
    if (options.isCrying) eyelidLevel = Math.max(eyelidLevel, 0.7);

    if (isHappySquint) {
      this.drawHappySquint(ctx, options.radius);
    } else if (expression === 'love') {
      this.drawLoveHeartPupil(ctx, options.radius, pupilX, pupilY);
    } else {
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
        case 'galaxy':
          this.drawGalaxy(ctx, options.radius, pupilX, pupilY, eyelidLevel);
          break;
        case 'flame':
          this.drawFlame(ctx, options.radius, pupilX, pupilY, eyelidLevel);
          break;
        case 'dragon':
          this.drawDragon(ctx, options.radius, angle, pupilX, pupilY, eyelidLevel);
          break;
        case 'matrix':
          this.drawMatrixRain(ctx, options.radius, pupilX, pupilY, eyelidLevel);
          break;
        case 'animeheart':
          this.drawAnimeHeart(ctx, options.radius, pupilX, pupilY, pupilScale, eyelidLevel);
          break;
        case 'custom':
          this.drawCustom(ctx, options.radius, pupilX, pupilY, pupilScale, eyelidLevel);
          break;
        case 'natural':
        default:
          this.drawNatural(ctx, options.radius, pupilX, pupilY, pupilScale, eyelidLevel);
          break;
      }
    }

    // Draw Crying Anime Tear Drops
    if (options.isCrying) {
      this.drawTears(ctx, options.radius);
    }

    ctx.restore();

    if (options.showEyebrows) {
      this.drawEyebrow(ctx, options.x, options.y, options.radius, this.expressionToEyebrowMood(expression));
    }
  }

  private expressionToEyebrowMood(expression: EyeExpression): EyebrowMood {
    if (expression === 'surprised' || expression === 'focused' || expression === 'sleepy') return expression;
    return 'neutral';
  }

  // Happy/Smiling Eyes: eyelids squint into upward `^` curved arcs (anime-style closed-eye smile).
  private drawHappySquint(ctx: CanvasRenderingContext2D, r: number) {
    ctx.save();

    // Soft glow behind the arc so it reads as an expression, not a closed blink line.
    ctx.beginPath();
    ctx.moveTo(-r * 1.05, r * 0.15);
    ctx.quadraticCurveTo(0, -r * 0.75, r * 1.05, r * 0.15);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = Math.max(6, r * 0.4);
    ctx.lineCap = 'round';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = r * 0.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Crisp cyan-outlined core stroke on top, distinct from the dark solid blink arc.
    ctx.beginPath();
    ctx.moveTo(-r * 1.05, r * 0.15);
    ctx.quadraticCurveTo(0, -r * 0.75, r * 1.05, r * 0.15);
    ctx.strokeStyle = '#0c4a6e';
    ctx.lineWidth = Math.max(3, r * 0.2);
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-r * 1.05, r * 0.15);
    ctx.quadraticCurveTo(0, -r * 0.75, r * 1.05, r * 0.15);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = Math.max(1.5, r * 0.08);
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();
  }

  // Love/Heart Pupil Mode: pupils morph into a glowing pulsing heart shape.
  private drawLoveHeartPupil(ctx: CanvasRenderingContext2D, r: number, px: number, py: number) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const scleraGrad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
    scleraGrad.addColorStop(0, '#ffffff');
    scleraGrad.addColorStop(1, '#fce7f3');
    ctx.fillStyle = scleraGrad;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#f472b6';
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
    ctx.clip();

    const pulse = 1 + Math.sin(this.spinAngle * 4) * 0.08;
    const heartSize = r * 0.5 * pulse;
    this.drawHeartShape(ctx, px, py, heartSize, '#ec4899', 'rgba(236, 72, 153, 0.9)');

    ctx.beginPath();
    ctx.arc(px - heartSize * 0.3, py - heartSize * 0.3, heartSize * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();

    ctx.restore();
  }

  private drawHeartShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, fill: string, glow: string) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = glow;
    ctx.shadowBlur = size * 0.6;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.35);
    ctx.bezierCurveTo(-size, -size * 0.4, -size * 0.5, -size * 1.1, 0, -size * 0.3);
    ctx.bezierCurveTo(size * 0.5, -size * 1.1, size, -size * 0.4, 0, size * 0.35);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
  }

  // Animated Mini Eyebrows: rendered above the eye, independent of theme, for surprised/focused/sleepy moods.
  private drawEyebrow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, mood: EyebrowMood) {
    if (mood === 'neutral') return;

    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.lineCap = 'round';

    const browY = -r * 1.35;
    ctx.beginPath();

    if (mood === 'surprised') {
      ctx.moveTo(-r * 0.65, browY + r * 0.1);
      ctx.quadraticCurveTo(0, browY - r * 0.35, r * 0.65, browY + r * 0.1);
    } else if (mood === 'focused') {
      ctx.moveTo(-r * 0.6, browY + r * 0.25);
      ctx.lineTo(r * 0.6, browY - r * 0.05);
    } else {
      // sleepy: low, gently drooping brow
      ctx.moveTo(-r * 0.55, browY + r * 0.3);
      ctx.quadraticCurveTo(0, browY + r * 0.45, r * 0.55, browY + r * 0.35);
    }

    ctx.stroke();
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

  // Cosmic Galaxy Eyes: rotating spiral galaxy iris with floating stardust.
  private drawGalaxy(
    ctx: CanvasRenderingContext2D,
    r: number,
    px: number,
    py: number,
    eyelid: number
  ) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#020617';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#7c3aed';
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
    ctx.clip();

    const irisR = r * 0.62;
    const spiralGrad = ctx.createRadialGradient(px, py, 2, px, py, irisR);
    spiralGrad.addColorStop(0, '#f5d0fe');
    spiralGrad.addColorStop(0.35, '#a78bfa');
    spiralGrad.addColorStop(0.7, '#4c1d95');
    spiralGrad.addColorStop(1, '#020617');
    ctx.beginPath();
    ctx.arc(px, py, irisR, 0, Math.PI * 2);
    ctx.fillStyle = spiralGrad;
    ctx.fill();

    // Spiral arms
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(this.spinAngle * 0.3);
    for (let arm = 0; arm < 3; arm++) {
      ctx.beginPath();
      const armAngle = (arm / 3) * Math.PI * 2;
      for (let t = 0; t <= 1; t += 0.08) {
        const a = armAngle + t * Math.PI * 2.2;
        const rad = t * irisR * 0.85;
        const x = Math.cos(a) * rad;
        const y = Math.sin(a) * rad;
        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(232, 121, 249, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();

    // Stardust points
    const dustSeedBase = Math.floor(this.spinAngle * 2);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + this.spinAngle * 0.5;
      const rad = irisR * (0.3 + 0.55 * ((i + dustSeedBase) % 5) / 5);
      const dx = px + Math.cos(a) * rad;
      const dy = py + Math.sin(a) * rad;
      ctx.beginPath();
      ctx.arc(dx, dy, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fill();
    }

    // Pupil core
    ctx.beginPath();
    ctx.arc(px, py, irisR * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = '#0b001a';
    ctx.fill();

    this.drawOrganicEyelids(ctx, r, eyelid, '#020617', '#a78bfa');
    ctx.restore();
  }

  // Fiery Flame Eyes: animated flickering flame aura around the iris.
  private drawFlame(
    ctx: CanvasRenderingContext2D,
    r: number,
    px: number,
    py: number,
    eyelid: number
  ) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#1c0a00';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#f97316';
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
    ctx.clip();

    // Flickering flame aura around the iris
    const flicker = 0.85 + Math.sin(this.spinAngle * 6) * 0.15;
    const auraR = r * 0.75 * flicker;
    const auraGrad = ctx.createRadialGradient(px, py, r * 0.2, px, py, auraR);
    auraGrad.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
    auraGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.8)');
    auraGrad.addColorStop(1, 'rgba(153, 27, 27, 0.1)');
    ctx.beginPath();
    ctx.arc(px, py, auraR, 0, Math.PI * 2);
    ctx.fillStyle = auraGrad;
    ctx.fill();

    // Iris
    const irisR = r * 0.5;
    const irisGrad = ctx.createRadialGradient(px, py, 2, px, py, irisR);
    irisGrad.addColorStop(0, '#fef08a');
    irisGrad.addColorStop(0.5, '#f97316');
    irisGrad.addColorStop(1, '#7c2d12');
    ctx.beginPath();
    ctx.arc(px, py, irisR, 0, Math.PI * 2);
    ctx.fillStyle = irisGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(px, py, irisR * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = '#1c0a00';
    ctx.fill();

    this.drawOrganicEyelids(ctx, r, eyelid, '#1c0a00', '#f97316');
    ctx.restore();
  }

  // Dragon/Reptile Eyes: glowing golden scales with a dynamic vertical pupil slit.
  private drawDragon(
    ctx: CanvasRenderingContext2D,
    r: number,
    angle: number,
    px: number,
    py: number,
    eyelid: number
  ) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const scaleGrad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
    scaleGrad.addColorStop(0, '#fde68a');
    scaleGrad.addColorStop(0.6, '#ca8a04');
    scaleGrad.addColorStop(1, '#422006');
    ctx.fillStyle = scaleGrad;
    ctx.fill();

    // Scale texture ring
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82, r * 0.14, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(66, 32, 6, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
    ctx.clip();

    // Vertical reptile pupil slit, oriented toward gaze target
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle + Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.1, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#0c0a00';
    ctx.fill();
    ctx.restore();

    this.drawOrganicEyelids(ctx, r, eyelid, '#422006', '#ca8a04');
    ctx.restore();
  }

  // Matrix Code Rain Eyes: falling green matrix characters inside the pupil.
  private drawMatrixRain(
    ctx: CanvasRenderingContext2D,
    r: number,
    px: number,
    py: number,
    eyelid: number
  ) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#22c55e';
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
    ctx.clip();

    const irisR = r * 0.7;
    ctx.font = `${Math.max(6, r * 0.22)}px monospace`;
    ctx.fillStyle = '#052e16';
    ctx.beginPath();
    ctx.arc(px, py, irisR, 0, Math.PI * 2);
    ctx.fill();

    const cols = 5;
    for (let c = 0; c < cols; c++) {
      const colX = px - irisR + (c / (cols - 1)) * irisR * 2;
      const fallOffset = (this.tearOffset * 1.5 + c * 17) % (irisR * 2.4);
      const charY = py - irisR + fallOffset;
      const char = (c + Math.floor(this.spinAngle * 3)) % 2 === 0 ? '1' : '0';
      ctx.fillStyle = 'rgba(74, 222, 128, 0.9)';
      ctx.fillText(char, colX, charY);
    }

    ctx.beginPath();
    ctx.arc(px, py, irisR * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#022c22';
    ctx.fill();

    this.drawOrganicEyelids(ctx, r, eyelid, '#000000', '#22c55e');
    ctx.restore();
  }

  // Anime Heart Eyes: pulsing pink heart-shaped pupils with star catchlights (a permanent-love theme variant).
  private drawAnimeHeart(
    ctx: CanvasRenderingContext2D,
    r: number,
    px: number,
    py: number,
    pupilScale: number,
    eyelid: number
  ) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const scleraGrad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
    scleraGrad.addColorStop(0, '#ffffff');
    scleraGrad.addColorStop(1, '#fce7f3');
    ctx.fillStyle = scleraGrad;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#f472b6';
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
    ctx.clip();

    const pulse = 1 + Math.sin(this.spinAngle * 4) * 0.06;
    this.drawHeartShape(ctx, px, py, r * 0.48 * pupilScale * pulse, '#ec4899', 'rgba(244, 114, 182, 0.8)');

    // Star catchlight
    this.drawStar(ctx, px - r * 0.2, py - r * 0.25, r * 0.12);

    this.drawOrganicEyelids(ctx, r, eyelid, '#3f0a24', '#f472b6');
    ctx.restore();
  }

  // In-App Custom Eye Studio: renders with the user-tunable pupil/iris colors and glow.
  private drawCustom(
    ctx: CanvasRenderingContext2D,
    r: number,
    px: number,
    py: number,
    pupilScale: number,
    eyelid: number
  ) {
    const { pupilColor, irisColorInner, irisColorOuter, glowIntensity } = this.customStyle;

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const scleraGrad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
    scleraGrad.addColorStop(0, '#ffffff');
    scleraGrad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = scleraGrad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = irisColorOuter;
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
    ctx.clip();

    if (glowIntensity > 0) {
      ctx.shadowColor = irisColorInner;
      ctx.shadowBlur = r * glowIntensity;
    }

    const irisR = r * 0.58;
    ctx.beginPath();
    ctx.arc(px, py, irisR, 0, Math.PI * 2);
    const irisGrad = ctx.createRadialGradient(px, py, 2, px, py, irisR);
    irisGrad.addColorStop(0, irisColorInner);
    irisGrad.addColorStop(1, irisColorOuter);
    ctx.fillStyle = irisGrad;
    ctx.fill();
    ctx.shadowBlur = 0;

    const pupilR = irisR * 0.42 * pupilScale;
    ctx.beginPath();
    ctx.arc(px, py, pupilR, 0, Math.PI * 2);
    ctx.fillStyle = pupilColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(px - irisR * 0.3, py - irisR * 0.3, irisR * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();

    this.drawOrganicEyelids(ctx, r, eyelid, '#0f172a', irisColorInner);
    ctx.restore();
  }

  private drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * size;
      const y = Math.sin(a) * size;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      const a2 = a + Math.PI / 5;
      ctx.lineTo(Math.cos(a2) * size * 0.4, Math.sin(a2) * size * 0.4);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();
    ctx.restore();
  }
}

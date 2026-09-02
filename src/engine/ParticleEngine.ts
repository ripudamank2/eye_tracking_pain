// Particle Burst, Cursor Trail, Modifier Badges, Laser Reticle, Spotlight & Heatmap Engine

export type ParticleShape = 'default' | 'stars' | 'hearts' | 'coins' | 'matrix';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
  char?: string;
}

export interface TrailPoint {
  x: number;
  y: number;
  alpha: number;
}

export interface ModifierBadge {
  x: number;
  y: number;
  label: string;
  alpha: number;
}

export interface ClickPoint {
  x: number;
  y: number;
  timestamp: number;
}

export interface GravityWell {
  x: number;
  y: number;
  age: number;
  maxAge: number;
}

export class ParticleEngine {
  public particles: Particle[] = [];
  public trail: TrailPoint[] = [];
  public badges: ModifierBadge[] = [];
  public clickPoints: ClickPoint[] = [];
  public gravityWells: GravityWell[] = [];
  public currentShape: ParticleShape = 'default';
  // Speed-Adaptive Trails: cyan at rest, shifting toward fiery orange as cursor speed increases.
  public speedAdaptiveTrails = false;
  private maxTrail = 20;
  private lastTrailSpeed = 0;

  public spawnBurst(x: number, y: number, color = '#f59e0b') {
    const count = 16;
    const matrixChars = ['0', '1', '👁️', '⚡', '💻', '✨'];

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
      const speed = 60 + Math.random() * 80;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 4 + Math.random() * 4,
        alpha: 1.0,
        color,
        char: matrixChars[Math.floor(Math.random() * matrixChars.length)],
      });
    }
  }

  public addBadge(x: number, y: number, label: string) {
    if (!label) return;
    this.badges.push({
      x: x + 20,
      y: y - 20,
      label,
      alpha: 1.0,
    });
  }

  public addTrailPoint(x: number, y: number, speed = 0) {
    this.trail.unshift({ x, y, alpha: 1.0 });
    this.lastTrailSpeed = speed;
    if (this.trail.length > this.maxTrail) this.trail.pop();
  }

  public recordClick(x: number, y: number) {
    this.clickPoints.push({ x, y, timestamp: Date.now() });
    if (this.clickPoints.length > 200) this.clickPoints.shift();
  }

  // Gravity Well Black Hole FX: click spawns a well that pulls nearby particles inward before dissipating.
  public spawnGravityWell(x: number, y: number) {
    this.gravityWells.push({ x, y, age: 0, maxAge: 1.4 });
  }

  public update(dt: number) {
    for (let i = this.gravityWells.length - 1; i >= 0; i--) {
      const well = this.gravityWells[i];
      well.age += dt;
      if (well.age >= well.maxAge) {
        this.gravityWells.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      for (const well of this.gravityWells) {
        const dx = well.x - p.x;
        const dy = well.y - p.y;
        const distSq = Math.max(100, dx * dx + dy * dy);
        const pull = (2200 / distSq) * (1 - well.age / well.maxAge);
        p.vx += dx * pull * dt;
        p.vy += dy * pull * dt;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= dt * 2.0;
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }

    for (let i = 0; i < this.trail.length; i++) {
      this.trail[i].alpha = Math.max(0, 1.0 - i / this.maxTrail);
    }

    for (let i = this.badges.length - 1; i >= 0; i--) {
      const b = this.badges[i];
      b.y -= 20 * dt;
      b.alpha -= dt * 1.5;
      if (b.alpha <= 0) this.badges.splice(i, 1);
    }
  }

  // Interpolates cyan (slow) -> orange (fast) for the speed-adaptive trail color.
  private speedToColor(speed: number): string {
    const t = Math.max(0, Math.min(1, speed / 2200));
    const from = { r: 6, g: 182, b: 212 };
    const to = { r: 249, g: 115, b: 22 };
    const r = Math.round(from.r + (to.r - from.r) * t);
    const g = Math.round(from.g + (to.g - from.g) * t);
    const b = Math.round(from.b + (to.b - from.b) * t);
    return `${r}, ${g}, ${b}`;
  }

  public drawTrail(ctx: CanvasRenderingContext2D) {
    if (this.trail.length < 2) return;
    ctx.save();
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const rgb = this.speedAdaptiveTrails ? this.speedToColor(this.lastTrailSpeed) : '6, 182, 212';

    for (let i = 0; i < this.trail.length - 1; i++) {
      const pt1 = this.trail[i];
      const pt2 = this.trail[i + 1];
      ctx.beginPath();
      ctx.moveTo(pt1.x, pt1.y);
      ctx.lineTo(pt2.x, pt2.y);
      ctx.strokeStyle = `rgba(${rgb}, ${pt1.alpha * 0.7})`;
      ctx.stroke();
    }
    ctx.restore();
  }

  public drawGravityWells(ctx: CanvasRenderingContext2D) {
    if (this.gravityWells.length === 0) return;
    ctx.save();
    for (const well of this.gravityWells) {
      const progress = well.age / well.maxAge;
      const radius = 6 + progress * 34;
      const alpha = 1 - progress;

      const grad = ctx.createRadialGradient(well.x, well.y, 0, well.x, well.y, radius);
      grad.addColorStop(0, `rgba(2, 6, 23, ${alpha})`);
      grad.addColorStop(0.7, `rgba(76, 29, 149, ${alpha * 0.7})`);
      grad.addColorStop(1, 'rgba(76, 29, 149, 0)');

      ctx.beginPath();
      ctx.arc(well.x, well.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.restore();
  }

  public drawParticles(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      if (this.currentShape === 'stars') {
        ctx.fillStyle = '#f59e0b';
        ctx.font = '14px sans-serif';
        ctx.fillText('★', p.x, p.y);
      } else if (this.currentShape === 'hearts') {
        ctx.fillStyle = '#ec4899';
        ctx.font = '14px sans-serif';
        ctx.fillText('♥', p.x, p.y);
      } else if (this.currentShape === 'coins') {
        ctx.fillStyle = '#eab308';
        ctx.font = '14px sans-serif';
        ctx.fillText('🪙', p.x, p.y);
      } else if (this.currentShape === 'matrix') {
        ctx.fillStyle = '#10b981';
        ctx.font = '12px monospace';
        ctx.fillText(p.char || '0', p.x, p.y);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  public drawBadges(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.font = '12px monospace';
    for (const b of this.badges) {
      ctx.globalAlpha = b.alpha;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1;
      const textWidth = ctx.measureText(b.label).width;

      ctx.fillRect(b.x, b.y - 14, textWidth + 12, 20);
      ctx.strokeRect(b.x, b.y - 14, textWidth + 12, 20);

      ctx.fillStyle = '#f8fafc';
      ctx.fillText(b.label, b.x + 6, b.y);
    }
    ctx.restore();
  }

  public drawLaserReticle(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();

    // Laser core
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 15;
    ctx.fill();

    // Reticle rings
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(x - 25, y); ctx.lineTo(x - 10, y);
    ctx.moveTo(x + 10, y); ctx.lineTo(x + 25, y);
    ctx.moveTo(x, y - 25); ctx.lineTo(x, y - 10);
    ctx.moveTo(x, y + 10); ctx.lineTo(x, y + 25);
    ctx.stroke();

    ctx.restore();
  }

  public drawSpotlight(ctx: CanvasRenderingContext2D, width: number, height: number, x: number, y: number) {
    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'destination-out';
    const grad = ctx.createRadialGradient(x, y, 10, x, y, 160);
    grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
    grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.8)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.arc(x, y, 160, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  public drawHeatmap(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const pt of this.clickPoints) {
      const grad = ctx.createRadialGradient(pt.x, pt.y, 2, pt.x, pt.y, 35);
      grad.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
      grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.2)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 35, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.restore();
  }
}

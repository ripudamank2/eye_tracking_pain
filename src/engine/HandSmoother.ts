// Cursor smoothing for Air Touch - a hand-tracking-specific implementation, deliberately
// NOT importing or modifying GazeProcessor's OneEuroFilter (that class is private to
// GazeProcessor.ts and out of scope to touch per this feature's explicit instructions).
// This is an independent One-Euro-style filter: the same well-understood, standard
// technique for noisy human-input signals (Casiez et al., 2012 - see GazeProcessor.ts's
// identical citation), reimplemented here because "the right algorithm for smoothing a
// tracked point" is not itself gaze-pipeline-specific, but the code must be.

export interface HandSmootherOptions {
  minCutoff: number;
  beta: number;
  dCutoff: number;
  /** Normalized (0..1, same units as landmark coordinates) movement below which input is treated as noise and the smoothed output does not move at all - eliminates residual jitter a pure low-pass filter still lets through when the hand is nominally still. */
  deadZone: number;
}

export const DEFAULT_HAND_SMOOTHER_OPTIONS: HandSmootherOptions = {
  minCutoff: 1.2,
  beta: 0.4,
  dCutoff: 1.0,
  deadZone: 0.004,
};

class Axis1DFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev: number | null = null;
  private dxPrev = 0;

  constructor(minCutoff: number, beta: number, dCutoff: number) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(x: number, dt: number): number {
    const safeDt = Math.max(1e-6, dt);
    if (this.xPrev === null) {
      this.xPrev = x;
      return x;
    }
    const dx = (x - this.xPrev) / safeDt;
    const aD = this.alpha(this.dCutoff, safeDt);
    const dxHat = this.dxPrev + aD * (dx - this.dxPrev);

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this.alpha(cutoff, safeDt);
    const xHat = this.xPrev + a * (x - this.xPrev);

    this.xPrev = xHat;
    this.dxPrev = dxHat;
    return xHat;
  }

  reset(value?: number) {
    this.xPrev = value ?? null;
    this.dxPrev = 0;
  }
}

/**
 * Smooths a stream of normalized (x, y) points (e.g. the index fingertip position) into
 * a jitter-free cursor position. Pure/stateful but with no DOM/Electron dependency -
 * fully unit-testable with synthetic timestamps.
 */
export class HandSmoother {
  private filterX: Axis1DFilter;
  private filterY: Axis1DFilter;
  private options: HandSmootherOptions;
  private lastRawX: number | null = null;
  private lastRawY: number | null = null;

  constructor(options: Partial<HandSmootherOptions> = {}) {
    this.options = { ...DEFAULT_HAND_SMOOTHER_OPTIONS, ...options };
    this.filterX = new Axis1DFilter(this.options.minCutoff, this.options.beta, this.options.dCutoff);
    this.filterY = new Axis1DFilter(this.options.minCutoff, this.options.beta, this.options.dCutoff);
  }

  public setOptions(options: Partial<HandSmootherOptions>) {
    this.options = { ...this.options, ...options };
    this.filterX = new Axis1DFilter(this.options.minCutoff, this.options.beta, this.options.dCutoff);
    this.filterY = new Axis1DFilter(this.options.minCutoff, this.options.beta, this.options.dCutoff);
  }

  public getOptions(): HandSmootherOptions {
    return this.options;
  }

  /** dt in seconds. Returns the smoothed normalized point. */
  public smooth(x: number, y: number, dt: number): { x: number; y: number } {
    // Dead zone: if the raw input barely moved since last call, feed the filter the
    // PREVIOUS raw value instead of the new one - this stops a stationary hand's
    // sub-pixel landmark noise from ever reaching the filter as "movement" at all,
    // which a pure low-pass filter alone does not fully suppress (it reduces jitter
    // amplitude but a filter with no dead zone still visibly vibrates on pure noise).
    let effectiveX = x;
    let effectiveY = y;
    if (this.lastRawX !== null && this.lastRawY !== null) {
      const moved = Math.hypot(x - this.lastRawX, y - this.lastRawY);
      if (moved < this.options.deadZone) {
        effectiveX = this.lastRawX;
        effectiveY = this.lastRawY;
      }
    }
    this.lastRawX = x;
    this.lastRawY = y;

    return {
      x: this.filterX.filter(effectiveX, dt),
      y: this.filterY.filter(effectiveY, dt),
    };
  }

  /** Snaps the filter to a specific value with no smoothing lag - use when the hand reappears after being lost, so recovery doesn't visibly glide in from the last stale position (see HandTracker's hand-loss handling). */
  public snapTo(x: number, y: number) {
    this.filterX.reset(x);
    this.filterY.reset(y);
    this.lastRawX = x;
    this.lastRawY = y;
  }

  public reset() {
    this.filterX.reset();
    this.filterY.reset();
    this.lastRawX = null;
    this.lastRawY = null;
  }
}

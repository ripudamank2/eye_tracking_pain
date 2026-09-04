import { describe, it, expect } from 'vitest';
import { HandSmoother } from './HandSmoother';

describe('HandSmoother - jitter reduction', () => {
  it('reduces noise around a stationary point compared to raw input', () => {
    const s = new HandSmoother();
    const centerX = 0.5;
    const centerY = 0.5;
    // Deterministic pseudo-noise (not Math.random()) around a fixed point, matching the
    // project's existing convention for reproducible jitter tests (see GazeProcessor.test.ts).
    let seed = 42;
    const noise = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return (seed / 2147483648 - 0.5) * 0.01;
    };

    const smoothedPositions: { x: number; y: number }[] = [];
    const rawPositions: { x: number; y: number }[] = [];
    let t = 0;
    for (let i = 0; i < 60; i++) {
      const rawX = centerX + noise();
      const rawY = centerY + noise();
      rawPositions.push({ x: rawX, y: rawY });
      t += 1 / 60;
      smoothedPositions.push(s.smooth(rawX, rawY, 1 / 60));
    }

    const jitterOf = (points: { x: number; y: number }[]) => {
      let sum = 0;
      for (let i = 1; i < points.length; i++) {
        sum += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      }
      return sum / (points.length - 1);
    };

    const rawJitter = jitterOf(rawPositions);
    const smoothedJitter = jitterOf(smoothedPositions.slice(10)); // skip the initial filter warm-up
    expect(smoothedJitter).toBeLessThan(rawJitter);
  });

  it('a stable, unmoving input stays stable after smoothing', () => {
    const s = new HandSmoother();
    let last = s.smooth(0.5, 0.5, 1 / 60);
    for (let i = 0; i < 30; i++) {
      const next = s.smooth(0.5, 0.5, 1 / 60);
      expect(next.x).toBeCloseTo(last.x, 5);
      expect(next.y).toBeCloseTo(last.y, 5);
      last = next;
    }
  });
});

describe('HandSmoother - dead zone', () => {
  it('sub-dead-zone movement does not change the smoothed output', () => {
    const s = new HandSmoother({ deadZone: 0.01 });
    s.smooth(0.5, 0.5, 1 / 60);
    const before = s.smooth(0.5, 0.5, 1 / 60);
    // Movement well under the 0.01 dead zone.
    const after = s.smooth(0.5021 - 0.002 /* net movement ~0.002 */, 0.5, 1 / 60);
    expect(after.x).toBeCloseTo(before.x, 4);
  });
});

describe('HandSmoother - sudden movement', () => {
  it('responds to a large, deliberate movement rather than heavily lagging it out', () => {
    const s = new HandSmoother();
    // Settle at one point first.
    for (let i = 0; i < 20; i++) s.smooth(0.2, 0.2, 1 / 60);

    // Then move far away and hold.
    let last = { x: 0.2, y: 0.2 };
    for (let i = 0; i < 30; i++) {
      last = s.smooth(0.8, 0.8, 1 / 60);
    }

    // After enough frames holding the new position, the filter should have converged
    // close to it (not still lagging significantly behind).
    expect(last.x).toBeCloseTo(0.8, 1);
    expect(last.y).toBeCloseTo(0.8, 1);
  });
});

describe('HandSmoother - hand disappearance and recovery', () => {
  it('snapTo immediately jumps to a new position with no lag', () => {
    const s = new HandSmoother();
    for (let i = 0; i < 20; i++) s.smooth(0.2, 0.2, 1 / 60);

    s.snapTo(0.9, 0.1);
    const next = s.smooth(0.9, 0.1, 1 / 60);

    expect(next.x).toBeCloseTo(0.9, 3);
    expect(next.y).toBeCloseTo(0.1, 3);
  });

  it('reset clears filter state so the next sample is returned unfiltered (matches GazeProcessor OneEuroFilter convention)', () => {
    const s = new HandSmoother();
    for (let i = 0; i < 20; i++) s.smooth(0.2, 0.2, 1 / 60);

    s.reset();
    const first = s.smooth(0.9, 0.1, 1 / 60);

    // First sample after a reset should pass through unfiltered (no previous state to blend against).
    expect(first.x).toBeCloseTo(0.9, 5);
    expect(first.y).toBeCloseTo(0.1, 5);
  });
});

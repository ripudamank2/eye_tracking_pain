import { describe, it, expect } from 'vitest';
import { ScreenMapper, computeScreenMapperFit } from './ScreenMapper';
import type { AirTouchCalibration } from './handTypes';

const SCREEN_W = 1920;
const SCREEN_H = 1080;

function fiveCornerCalibration(): AirTouchCalibration {
  // A camera region [0.1, 0.9] x [0.1, 0.9] mapping onto the full screen [0,1] x [0,1] -
  // a plausible real calibration shape (usable camera region smaller than the full
  // normalized 0..1 range, per the task's explicit "usable camera region" requirement).
  return {
    topLeft: { camera: { x: 0.1, y: 0.1 }, target: { x: 0, y: 0 } },
    topRight: { camera: { x: 0.9, y: 0.1 }, target: { x: 1, y: 0 } },
    bottomLeft: { camera: { x: 0.1, y: 0.9 }, target: { x: 0, y: 1 } },
    bottomRight: { camera: { x: 0.9, y: 0.9 }, target: { x: 1, y: 1 } },
    center: { camera: { x: 0.5, y: 0.5 }, target: { x: 0.5, y: 0.5 } },
  };
}

describe('ScreenMapper - uncalibrated default', () => {
  it('is not calibrated before any calibration is set', () => {
    const m = new ScreenMapper();
    expect(m.isCalibrated()).toBe(false);
    expect(m.getMeanErrorNorm()).toBeNull();
  });
});

describe('ScreenMapper - calibrated mapping', () => {
  it('maps the calibrated center point to the screen center', () => {
    const m = new ScreenMapper({ mirrorX: false });
    m.setCalibration(fiveCornerCalibration());
    expect(m.isCalibrated()).toBe(true);

    const p = m.map(0.5, 0.5, SCREEN_W, SCREEN_H);
    expect(p.x).toBeCloseTo(SCREEN_W / 2, 0);
    expect(p.y).toBeCloseTo(SCREEN_H / 2, 0);
  });

  it('maps the calibrated corners to the screen corners (within clamping margin)', () => {
    const m = new ScreenMapper({ mirrorX: false, edgeMarginPx: 0 });
    m.setCalibration(fiveCornerCalibration());

    const topLeft = m.map(0.1, 0.1, SCREEN_W, SCREEN_H);
    expect(topLeft.x).toBeCloseTo(0, 0);
    expect(topLeft.y).toBeCloseTo(0, 0);

    const bottomRight = m.map(0.9, 0.9, SCREEN_W, SCREEN_H);
    expect(bottomRight.x).toBeCloseTo(SCREEN_W, 0);
    expect(bottomRight.y).toBeCloseTo(SCREEN_H, 0);
  });

  it('reports a low mean calibration error for a clean, consistent calibration', () => {
    const fit = computeScreenMapperFit(fiveCornerCalibration());
    expect(fit.meanErrorNorm).not.toBeNull();
    expect(fit.meanErrorNorm as number).toBeLessThan(0.01);
  });

  it('reports a nonzero error for an inconsistent calibration', () => {
    const noisy: AirTouchCalibration = fiveCornerCalibration();
    // Corrupt one corner so it disagrees with the affine fit the other 4 points imply.
    noisy.bottomRight = { camera: { x: 0.5, y: 0.5 }, target: { x: 1, y: 1 } };
    const fit = computeScreenMapperFit(noisy);
    expect(fit.meanErrorNorm as number).toBeGreaterThan(0.05);
  });
});

describe('ScreenMapper - clamping', () => {
  it('clamps a camera point outside the calibrated region to stay within screen bounds', () => {
    const m = new ScreenMapper({ mirrorX: false, edgeMarginPx: 4 });
    m.setCalibration(fiveCornerCalibration());

    // Far outside the calibrated [0.1, 0.9] region - the linear extrapolation would
    // land off-screen without clamping.
    const p = m.map(-0.5, -0.5, SCREEN_W, SCREEN_H);
    expect(p.x).toBeGreaterThanOrEqual(4);
    expect(p.y).toBeGreaterThanOrEqual(4);
    expect(p.x).toBeLessThanOrEqual(SCREEN_W - 4);
    expect(p.y).toBeLessThanOrEqual(SCREEN_H - 4);
  });

  it('never returns a coordinate outside [margin, screenSize - margin] for extreme input', () => {
    const m = new ScreenMapper({ mirrorX: false, edgeMarginPx: 10 });
    m.setCalibration(fiveCornerCalibration());

    for (const [x, y] of [
      [100, 100],
      [-100, -100],
      [1000, 0.5],
    ]) {
      const p = m.map(x, y, SCREEN_W, SCREEN_H);
      expect(p.x).toBeGreaterThanOrEqual(10);
      expect(p.x).toBeLessThanOrEqual(SCREEN_W - 10);
      expect(p.y).toBeGreaterThanOrEqual(10);
      expect(p.y).toBeLessThanOrEqual(SCREEN_H - 10);
    }
  });
});

describe('ScreenMapper - mirroring', () => {
  it('mirrorX flips which screen side a given camera x maps toward', () => {
    const mirrored = new ScreenMapper({ mirrorX: true });
    const unmirrored = new ScreenMapper({ mirrorX: false });
    mirrored.setCalibration(fiveCornerCalibration());
    unmirrored.setCalibration(fiveCornerCalibration());

    // A camera point on the left side of frame (x=0.1)...
    const mirroredResult = mirrored.map(0.1, 0.5, SCREEN_W, SCREEN_H);
    const unmirroredResult = unmirrored.map(0.1, 0.5, SCREEN_W, SCREEN_H);

    // ...should land on opposite screen halves depending on mirroring.
    expect(mirroredResult.x).toBeGreaterThan(SCREEN_W / 2);
    expect(unmirroredResult.x).toBeLessThan(SCREEN_W / 2);
  });
});

describe('ScreenMapper - invalid coordinates', () => {
  it('falls back to the screen center for non-finite input rather than propagating NaN', () => {
    const m = new ScreenMapper({ mirrorX: false });
    m.setCalibration(fiveCornerCalibration());

    const p = m.map(NaN, Infinity, SCREEN_W, SCREEN_H);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });

  it('does not fit a calibration from fewer than 3 points', () => {
    const sparse: AirTouchCalibration = {
      topLeft: { camera: { x: 0.1, y: 0.1 }, target: { x: 0, y: 0 } },
      topRight: { camera: { x: 0.9, y: 0.1 }, target: { x: 1, y: 0 } },
      bottomLeft: null,
      bottomRight: null,
      center: null,
    };
    const fit = computeScreenMapperFit(sparse);
    expect(fit.meanErrorNorm).toBeNull();
  });
});

describe('ScreenMapper - reset', () => {
  it('resetCalibration returns to the uncalibrated state', () => {
    const m = new ScreenMapper();
    m.setCalibration(fiveCornerCalibration());
    expect(m.isCalibrated()).toBe(true);

    m.resetCalibration();
    expect(m.isCalibrated()).toBe(false);
  });
});

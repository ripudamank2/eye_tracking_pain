// Maps a normalized (0..1) camera-space point (e.g. the smoothed index-fingertip
// position from HandSmoother) to a screen-space point, using its own independent
// 5-point calibration - deliberately separate from GazeProcessor's calibration
// (computeCalibration/CalibrationResult), stored and computed independently so an Air
// Touch calibration run can never read, overwrite, or otherwise interact with gaze
// calibration data, per this feature's explicit instructions.

import type { AirTouchCalibration, CalibrationCorner, ScreenPoint } from './handTypes';
import { EMPTY_AIR_TOUCH_CALIBRATION } from './handTypes';

export interface ScreenMapperOptions {
  /** Mirrors the camera's X axis before mapping - on by default, since a hand tracked in an unmirrored front camera feed moving right in the real world reports increasing x, but users expect their on-screen cursor to move the same visual direction they see themselves move in a mirrored preview. */
  mirrorX: boolean;
  /** Fraction of the screen (0..0.4) reserved as a margin the mapped cursor can never enter from any edge - keeps the cursor reachable near edges without requiring the hand to reach the literal edge of the camera's field of view. */
  edgeMarginPx: number;
}

export const DEFAULT_SCREEN_MAPPER_OPTIONS: ScreenMapperOptions = {
  mirrorX: true,
  edgeMarginPx: 4,
};

/**
 * Least-squares affine fit (independent reimplementation of the same general technique
 * GazeProcessor.computeCalibration uses for gaze - not shared code, not shared state,
 * and tuned for Air Touch's 5-point corner+center calibration shape rather than gaze's
 * arbitrary point set).
 */
function fitAxis(cameraValues: number[], screenValues: number[]) {
  const n = cameraValues.length;
  const meanCam = cameraValues.reduce((a, b) => a + b, 0) / n;
  const meanScreen = screenValues.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (cameraValues[i] - meanCam) * (screenValues[i] - meanScreen);
    den += (cameraValues[i] - meanCam) * (cameraValues[i] - meanCam);
  }

  const gain = den > 1e-8 ? num / den : 1;
  const offset = meanScreen - gain * meanCam;
  return { gain, offset };
}

export interface ScreenMapperFit {
  gainX: number;
  offsetX: number;
  gainY: number;
  offsetY: number;
  /** Mean reprojection error across calibration points, in normalized (0..1) screen units - 0 is perfect, higher is worse. Null when no calibration has been applied yet (falls back to an identity-ish default mapping). */
  meanErrorNorm: number | null;
}

const DEFAULT_FIT: ScreenMapperFit = { gainX: 1, offsetX: 0, gainY: 1, offsetY: 0, meanErrorNorm: null };

function cornersToPoints(cal: AirTouchCalibration): CalibrationCorner[] {
  return [cal.topLeft, cal.topRight, cal.bottomLeft, cal.bottomRight, cal.center].filter(
    (c): c is CalibrationCorner => c !== null
  );
}

export function computeScreenMapperFit(calibration: AirTouchCalibration): ScreenMapperFit {
  const points = cornersToPoints(calibration);
  if (points.length < 3) {
    // Fewer than 3 points can't meaningfully fit an affine mapping with an
    // independent gain - not enough data to trust over the identity default.
    return DEFAULT_FIT;
  }

  const camX = points.map((p) => p.camera.x);
  const camY = points.map((p) => p.camera.y);
  const screenX = points.map((p) => p.target.x);
  const screenY = points.map((p) => p.target.y);

  const fitX = fitAxis(camX, screenX);
  const fitY = fitAxis(camY, screenY);

  let totalError = 0;
  for (const p of points) {
    const predX = fitX.gain * p.camera.x + fitX.offset;
    const predY = fitY.gain * p.camera.y + fitY.offset;
    totalError += Math.hypot(predX - p.target.x, predY - p.target.y);
  }

  return {
    gainX: fitX.gain,
    offsetX: fitX.offset,
    gainY: fitY.gain,
    offsetY: fitY.offset,
    meanErrorNorm: totalError / points.length,
  };
}

export class ScreenMapper {
  private options: ScreenMapperOptions;
  private fit: ScreenMapperFit = DEFAULT_FIT;
  private calibration: AirTouchCalibration = { ...EMPTY_AIR_TOUCH_CALIBRATION };

  constructor(options: Partial<ScreenMapperOptions> = {}) {
    this.options = { ...DEFAULT_SCREEN_MAPPER_OPTIONS, ...options };
  }

  public setOptions(options: Partial<ScreenMapperOptions>) {
    this.options = { ...this.options, ...options };
  }

  public getOptions(): ScreenMapperOptions {
    return this.options;
  }

  public setCalibration(calibration: AirTouchCalibration) {
    this.calibration = calibration;
    this.fit = computeScreenMapperFit(calibration);
  }

  public getCalibration(): AirTouchCalibration {
    return this.calibration;
  }

  public resetCalibration() {
    this.calibration = { ...EMPTY_AIR_TOUCH_CALIBRATION };
    this.fit = DEFAULT_FIT;
  }

  public isCalibrated(): boolean {
    return this.fit.meanErrorNorm !== null;
  }

  public getMeanErrorNorm(): number | null {
    return this.fit.meanErrorNorm;
  }

  /**
   * Maps a normalized (0..1) camera-space point to a screen-space pixel point, applying
   * mirroring, the fitted calibration, and edge-margin clamping. screenWidth/Height are
   * passed per-call (not cached) since the target window can be resized between calls.
   */
  public map(cameraX: number, cameraY: number, screenWidth: number, screenHeight: number): ScreenPoint {
    const mirroredX = this.options.mirrorX ? 1 - cameraX : cameraX;

    const normX = this.fit.gainX * mirroredX + this.fit.offsetX;
    const normY = this.fit.gainY * cameraY + this.fit.offsetY;

    const rawX = normX * screenWidth;
    const rawY = normY * screenHeight;

    const margin = this.options.edgeMarginPx;
    const clampedX = Math.max(margin, Math.min(screenWidth - margin, rawX));
    const clampedY = Math.max(margin, Math.min(screenHeight - margin, rawY));

    // Defends against NaN/Infinity propagating into consumer code (e.g. a degenerate
    // calibration fit, or a caller passing a non-finite screenWidth/Height) - falls back
    // to the screen center rather than an invalid coordinate a native input call could
    // choke on or that could move a real OS cursor to an undefined location.
    return {
      x: Number.isFinite(clampedX) ? clampedX : screenWidth / 2,
      y: Number.isFinite(clampedY) ? clampedY : screenHeight / 2,
    };
  }
}

// Pure gaze-processing pipeline: converts raw MediaPipe face-mesh landmarks into a
// filtered, calibrated screen-space gaze point. Contains zero browser/hardware APIs
// (no getUserMedia, no DOM, no MediaPipe construction) specifically so it can be
// unit-tested with synthetic landmark fixtures - see GazeProcessor.test.ts.
//
// Root design problem this replaces: the previous WebcamTracker computed screen
// coordinates directly inside its MediaPipe results callback, with a single LERP as
// the only filtering stage. That conflated raw-landmark noise, blink artifacts,
// calibration, and hardware plumbing into one function, which is why jitter,
// blink-gaze coupling, and distance sensitivity couldn't be fixed independently.
// This module isolates the actual signal-processing logic so each concern has one
// place to live and can be tested without a camera.

export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

export interface GazeSample {
  x: number;
  y: number;
  /** 0..1 - how much this sample should be trusted (low during blinks / extreme head pose). */
  confidence: number;
}

export interface GazeResult {
  /** Smoothed screen-space coordinates, already clamped to the viewport. */
  x: number;
  y: number;
  /** Raw (pre-filter, pre-calibration) normalized gaze offset, exposed for diagnostics. */
  rawOffsetX: number;
  rawOffsetY: number;
  /** Overall tracking confidence for this frame, 0..1. */
  confidence: number;
  /** True if this frame's gaze was suppressed (e.g. mid-blink) and the filter is holding its last good estimate. */
  isHeld: boolean;
}

// --- One-Euro Filter --------------------------------------------------------------
// A standard low-latency jitter filter (Casiez et al., 2012) built specifically for
// noisy human-input signals like gaze/pointer tracking: it adapts its cutoff frequency
// to the signal's speed, so a still gaze gets heavy smoothing (kills jitter) while a
// fast gaze shift gets light smoothing (kills lag). A fixed-alpha LERP - what this
// project used before - cannot do both; it either lags on fast moves or stays jittery
// when still, depending on the single alpha chosen.
class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev: number | null = null;
  private dxPrev = 0;

  constructor(minCutoff = 1.0, beta = 0.02, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  public filter(x: number, dt: number): number {
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

  public reset(value?: number) {
    this.xPrev = value ?? null;
    this.dxPrev = 0;
  }
}

// --- Multi-point calibration --------------------------------------------------------
// The previous implementation only ever calibrated a single "neutral center" point,
// which cannot correct for the actual (nonlinear, per-user) relationship between iris
// deflection and screen position - it can only shift the origin, not scale the axes.
// This calibrates a per-axis gain from a small set of known screen-target fixations,
// which is the minimum needed to correct for user-to-user differences in eye geometry
// and camera distance.
export interface CalibrationPoint {
  screenX: number;
  screenY: number;
  gazeOffsetX: number;
  gazeOffsetY: number;
}

export interface CalibrationResult {
  centerOffsetX: number;
  centerOffsetY: number;
  gainX: number;
  gainY: number;
  /** Mean absolute reprojection error across calibration points, in normalized gaze-offset units. Lower is better; 0 is perfect. */
  meanError: number;
}

const DEFAULT_GAIN = 4.0;

export function computeCalibration(points: CalibrationPoint[], screenWidth: number, screenHeight: number): CalibrationResult {
  if (points.length === 0) {
    return { centerOffsetX: 0, centerOffsetY: 0, gainX: DEFAULT_GAIN, gainY: DEFAULT_GAIN, meanError: NaN };
  }

  if (points.length === 1) {
    // Single-point calibration can only correct the center offset, matching the
    // previous behavior - not enough data to fit a gain.
    return {
      centerOffsetX: points[0].gazeOffsetX,
      centerOffsetY: points[0].gazeOffsetY,
      gainX: DEFAULT_GAIN,
      gainY: DEFAULT_GAIN,
      meanError: 0,
    };
  }

  // Least-squares fit of screenPos = center*screenExtent + gain*screenExtent*gazeOffset
  // per axis, using the calibration points as (gazeOffset, screenPos) pairs.
  const fitAxis = (offsets: number[], screenPositions: number[], extent: number, center: number) => {
    const n = offsets.length;
    const meanOffset = offsets.reduce((a, b) => a + b, 0) / n;
    const meanScreen = screenPositions.reduce((a, b) => a + b, 0) / n;

    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (offsets[i] - meanOffset) * (screenPositions[i] - meanScreen);
      den += (offsets[i] - meanOffset) * (offsets[i] - meanOffset);
    }

    // Degenerate case: all calibration points had (near-)identical gaze offsets
    // (e.g. duplicate points, or a user who didn't actually move their eyes).
    // Fall back to the default gain rather than dividing by ~0.
    const gain = den > 1e-8 ? num / den / extent : DEFAULT_GAIN;
    const centerOffset = (meanScreen - center) / extent / gain - meanOffset;

    return { gain, centerOffset };
  };

  const offsetsX = points.map((p) => p.gazeOffsetX);
  const offsetsY = points.map((p) => p.gazeOffsetY);
  const screenXs = points.map((p) => p.screenX);
  const screenYs = points.map((p) => p.screenY);

  const fitX = fitAxis(offsetsX, screenXs, screenWidth / 2, screenWidth / 2);
  const fitY = fitAxis(offsetsY, screenYs, screenHeight / 2, screenHeight / 2);

  let totalError = 0;
  for (const p of points) {
    const predX = screenWidth / 2 + (p.gazeOffsetX + fitX.centerOffset) * fitX.gain * (screenWidth / 2);
    const predY = screenHeight / 2 + (p.gazeOffsetY + fitY.centerOffset) * fitY.gain * (screenHeight / 2);
    totalError += Math.hypot(predX - p.screenX, predY - p.screenY);
  }

  return {
    centerOffsetX: fitX.centerOffset,
    centerOffsetY: fitY.centerOffset,
    gainX: Math.abs(fitX.gain) > 1e-6 ? fitX.gain : DEFAULT_GAIN,
    gainY: Math.abs(fitY.gain) > 1e-6 ? fitY.gain : DEFAULT_GAIN,
    meanError: totalError / points.length,
  };
}

// --- Landmark-derived measurements --------------------------------------------------
// Standard MediaPipe FaceMesh (refineLandmarks: true) indices.
export const LANDMARK = {
  IRIS_LEFT: 468,
  IRIS_RIGHT: 473,
  NOSE_TIP: 1,
  EYE_LEFT_OUTER: 33,
  EYE_RIGHT_OUTER: 263,
  EYELID_LEFT_TOP: 159,
  EYELID_LEFT_BOTTOM: 145,
  EYELID_RIGHT_TOP: 386,
  EYELID_RIGHT_BOTTOM: 374,
} as const;

export interface EyeApertureResult {
  leftAperture: number;
  rightAperture: number;
  /** 0 (fully open) .. 1 (fully closed), averaged across both eyes - drives eyelid rendering. */
  blinkLevel: number;
  /** True when both eyes are closed enough to be considered a blink (as opposed to a wink). */
  isBlinking: boolean;
}

const BLINK_CLOSED_THRESHOLD = 0.12;
const BLINK_OPEN_THRESHOLD = 0.2;

export function computeEyeAperture(landmarks: Landmark[], eyeSpan: number): EyeApertureResult | null {
  const leftTop = landmarks[LANDMARK.EYELID_LEFT_TOP];
  const leftBottom = landmarks[LANDMARK.EYELID_LEFT_BOTTOM];
  const rightTop = landmarks[LANDMARK.EYELID_RIGHT_TOP];
  const rightBottom = landmarks[LANDMARK.EYELID_RIGHT_BOTTOM];

  if (!leftTop || !leftBottom || !rightTop || !rightBottom) return null;

  const span = eyeSpan || 0.1;
  const leftAperture = Math.abs(leftBottom.y - leftTop.y) / span;
  const rightAperture = Math.abs(rightBottom.y - rightTop.y) / span;

  const avgAperture = (leftAperture + rightAperture) / 2;
  // Map aperture to a 0..1 "closedness" level with the same thresholds used for
  // discrete blink/wink classification, so the rendered eyelid and the gaze-gating
  // decision are always in agreement (previously these were two unrelated systems).
  const blinkLevel = 1 - Math.max(0, Math.min(1, (avgAperture - BLINK_CLOSED_THRESHOLD) / (BLINK_OPEN_THRESHOLD - BLINK_CLOSED_THRESHOLD)));

  return {
    leftAperture,
    rightAperture,
    blinkLevel,
    isBlinking: leftAperture < BLINK_CLOSED_THRESHOLD && rightAperture < BLINK_CLOSED_THRESHOLD,
  };
}

// --- Gaze pipeline -------------------------------------------------------------------
export interface GazeProcessorDiagnostics {
  rawJitter: number;
  filteredJitter: number;
  lastConfidence: number;
  framesHeldForBlink: number;
  calibrationError: number;
}

export class GazeProcessor {
  private filterX = new OneEuroFilter();
  private filterY = new OneEuroFilter();

  private baselineX = 0.5;
  private baselineY = 0.5;
  private calibrationSamples = 0;
  private isBaselined = false;

  private calibration: CalibrationResult = { centerOffsetX: 0, centerOffsetY: 0, gainX: DEFAULT_GAIN, gainY: DEFAULT_GAIN, meanError: NaN };

  // User-facing manual sensitivity multiplier, applied on top of the calibrated gain.
  // Kept separate from the calibration fit itself so a manual adjustment doesn't
  // require re-running calibration, and calibrating doesn't reset a user's manual tweak.
  public manualGainMultiplier = 1.0;

  private lastGoodX: number | null = null;
  private lastGoodY: number | null = null;

  // Diagnostics (see EyeEngineDiagnostics for the app-facing aggregator)
  private recentRawPositions: { x: number; y: number }[] = [];
  private recentFilteredPositions: { x: number; y: number }[] = [];
  private framesHeldForBlink = 0;

  public setCalibration(result: CalibrationResult) {
    this.calibration = result;
  }

  public getCalibration(): CalibrationResult {
    return this.calibration;
  }

  public resetBaseline() {
    this.isBaselined = false;
    this.calibrationSamples = 0;
  }

  public resetFilters() {
    this.filterX.reset();
    this.filterY.reset();
    this.lastGoodX = null;
    this.lastGoodY = null;
  }

  /**
   * Computes normalized (pre-screen-mapping) gaze offset from iris + nose landmarks,
   * with head-yaw AND head-pitch compensation (the previous implementation only
   * compensated yaw). Exposed separately from `process` so it can be unit-tested
   * against fixed landmark fixtures without needing dt/screen-size plumbing.
   */
  public computeRawOffset(leftIris: Landmark, rightIris: Landmark, noseTip: Landmark, eyeSpan: number): { offsetX: number; offsetY: number } {
    const irisAvgX = (leftIris.x + rightIris.x) / 2;
    const irisAvgY = (leftIris.y + rightIris.y) / 2;

    if (!this.isBaselined) {
      this.baselineX = (this.baselineX * this.calibrationSamples + irisAvgX) / (this.calibrationSamples + 1);
      this.baselineY = (this.baselineY * this.calibrationSamples + irisAvgY) / (this.calibrationSamples + 1);
      this.calibrationSamples++;
      if (this.calibrationSamples >= 15) this.isBaselined = true;
    }

    const gazeDeltaX = -(irisAvgX - this.baselineX);
    const gazeDeltaY = irisAvgY - this.baselineY;

    const span = eyeSpan || 0.1;
    const eyeCenterX = (leftIris.x + rightIris.x) / 2;
    const eyeCenterY = (leftIris.y + rightIris.y) / 2;

    // Head yaw (left/right turn) and pitch (up/down tilt) both shift where the nose
    // sits relative to the eye-line; compensating only yaw (the previous behavior)
    // left Y-axis accuracy to degrade under head nodding, which is at least as common
    // as head turning during normal desk use.
    const headYawOffset = (noseTip.x - eyeCenterX) / span;
    const headPitchOffset = (noseTip.y - eyeCenterY) / span;

    const totalOffsetX = gazeDeltaX + headYawOffset * 0.15;
    // Pitch compensation is subtracted: as the head tilts down (nose Y increases
    // relative to eyes), the apparent iris Y-deflection increases even at constant
    // gaze, so we remove that component.
    const totalOffsetY = gazeDeltaY - headPitchOffset * 0.1;

    return { offsetX: totalOffsetX, offsetY: totalOffsetY };
  }

  /**
   * Full per-frame pipeline: raw offset -> calibration -> distance compensation ->
   * blink gating -> One-Euro filtering -> screen-space clamp.
   */
  public process(params: {
    leftIris: Landmark;
    rightIris: Landmark;
    noseTip: Landmark;
    eyeSpan: number;
    referenceEyeSpan: number;
    aperture: EyeApertureResult | null;
    screenWidth: number;
    screenHeight: number;
    dt: number;
  }): GazeResult {
    const { leftIris, rightIris, noseTip, eyeSpan, referenceEyeSpan, aperture, screenWidth, screenHeight, dt } = params;

    const { offsetX, offsetY } = this.computeRawOffset(leftIris, rightIris, noseTip, eyeSpan);

    // Distance compensation: eyeSpan (normalized inter-iris distance) shrinks as the
    // face moves away from the camera. The same physical gaze deflection produces a
    // smaller normalized iris movement at a greater distance, so scale the offset
    // inversely by how much closer/farther the face is versus the calibration
    // distance. Without this (the previous behavior), sensitivity was only correct
    // at whatever distance the user happened to be during calibration.
    const distanceRatio = referenceEyeSpan > 0 ? referenceEyeSpan / (eyeSpan || referenceEyeSpan) : 1;
    const compensatedX = offsetX * distanceRatio;
    const compensatedY = offsetY * distanceRatio;

    const calibratedX = (compensatedX + this.calibration.centerOffsetX) * this.calibration.gainX * this.manualGainMultiplier;
    const calibratedY = (compensatedY + this.calibration.centerOffsetY) * this.calibration.gainY * this.manualGainMultiplier;

    const screenCenterX = screenWidth / 2;
    const screenCenterY = screenHeight / 2;

    const targetX = screenCenterX + calibratedX * screenCenterX;
    const targetY = screenCenterY + calibratedY * screenCenterY;

    this.recentRawPositions.push({ x: targetX, y: targetY });
    if (this.recentRawPositions.length > 30) this.recentRawPositions.shift();

    // Blink gating: during a blink, iris landmarks are unreliable (partially
    // occluded), so freeze the filter's input at its last good estimate rather than
    // feeding it the noisy blink-time position. The previous implementation had no
    // such gate - a real blink would visibly spike the tracked gaze position.
    const isBlinking = aperture?.isBlinking ?? false;
    let effectiveX = targetX;
    let effectiveY = targetY;
    let isHeld = false;

    if (isBlinking && this.lastGoodX !== null && this.lastGoodY !== null) {
      effectiveX = this.lastGoodX;
      effectiveY = this.lastGoodY;
      isHeld = true;
      this.framesHeldForBlink++;
    } else {
      this.lastGoodX = targetX;
      this.lastGoodY = targetY;
    }

    const clampedX = Math.max(40, Math.min(screenWidth - 40, effectiveX));
    const clampedY = Math.max(40, Math.min(screenHeight - 40, effectiveY));

    const filteredX = this.filterX.filter(clampedX, dt);
    const filteredY = this.filterY.filter(clampedY, dt);

    this.recentFilteredPositions.push({ x: filteredX, y: filteredY });
    if (this.recentFilteredPositions.length > 30) this.recentFilteredPositions.shift();

    // Confidence: reduced during blinks, and reduced at extreme head yaw where the
    // iris-to-nose geometry this pipeline depends on becomes less reliable.
    const yawMagnitude = Math.abs((noseTip.x - (leftIris.x + rightIris.x) / 2) / (eyeSpan || 0.1));
    const yawConfidence = Math.max(0, 1 - yawMagnitude / 0.8);
    const confidence = isBlinking ? 0.15 : Math.max(0.2, yawConfidence);

    return {
      x: filteredX,
      y: filteredY,
      rawOffsetX: offsetX,
      rawOffsetY: offsetY,
      confidence,
      isHeld,
    };
  }

  public getDiagnostics(): GazeProcessorDiagnostics {
    const jitterOf = (points: { x: number; y: number }[]) => {
      if (points.length < 2) return 0;
      let sum = 0;
      for (let i = 1; i < points.length; i++) {
        sum += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      }
      return sum / (points.length - 1);
    };

    return {
      rawJitter: jitterOf(this.recentRawPositions),
      filteredJitter: jitterOf(this.recentFilteredPositions),
      lastConfidence: this.recentFilteredPositions.length > 0 ? 1 : 0,
      framesHeldForBlink: this.framesHeldForBlink,
      calibrationError: this.calibration.meanError,
    };
  }
}

import { describe, it, expect } from 'vitest';
import {
  GazeProcessor,
  computeCalibration,
  computeEyeAperture,
  validateLandmarkTopology,
  type Landmark,
  type CalibrationPoint,
} from './GazeProcessor';

// Synthetic landmark builder: places iris/nose/eyelid points at plausible normalized
// (0..1) face-mesh coordinates so tests don't depend on real camera/MediaPipe data.
function makeLandmarks(overrides: Partial<Record<number, Landmark>> = {}): Landmark[] {
  const arr: Landmark[] = new Array(478).fill(null).map(() => ({ x: 0.5, y: 0.5 }));
  arr[468] = { x: 0.45, y: 0.5 }; // left iris
  arr[473] = { x: 0.55, y: 0.5 }; // right iris
  arr[1] = { x: 0.5, y: 0.55 }; // nose tip
  arr[159] = { x: 0.45, y: 0.47 }; // left eyelid top
  arr[145] = { x: 0.45, y: 0.53 }; // left eyelid bottom (open: 0.06 gap)
  arr[386] = { x: 0.55, y: 0.47 }; // right eyelid top
  arr[374] = { x: 0.55, y: 0.53 }; // right eyelid bottom (open)
  for (const [idx, val] of Object.entries(overrides)) {
    arr[Number(idx)] = val as Landmark;
  }
  return arr;
}

describe('computeEyeAperture', () => {
  it('reports both eyes open with blinkLevel near 0 for a normal gap', () => {
    const landmarks = makeLandmarks();
    const eyeSpan = 0.1; // right(0.55) - left(0.45)
    const result = computeEyeAperture(landmarks, eyeSpan);

    expect(result).not.toBeNull();
    expect(result!.isBlinking).toBe(false);
    expect(result!.blinkLevel).toBeLessThan(0.3);
  });

  it('detects a full blink when both eyelid gaps collapse', () => {
    const landmarks = makeLandmarks({
      159: { x: 0.45, y: 0.5 },
      145: { x: 0.45, y: 0.505 }, // 0.005 gap -> aperture 0.05, below 0.12 threshold
      386: { x: 0.55, y: 0.5 },
      374: { x: 0.55, y: 0.505 },
    });
    const result = computeEyeAperture(landmarks, 0.1);

    expect(result!.isBlinking).toBe(true);
    expect(result!.blinkLevel).toBeCloseTo(1, 1);
  });

  it('does not classify a one-eye closure (wink) as a blink', () => {
    const landmarks = makeLandmarks({
      159: { x: 0.45, y: 0.5 },
      145: { x: 0.45, y: 0.505 }, // left closed
      // right stays open from the base fixture
    });
    const result = computeEyeAperture(landmarks, 0.1);

    expect(result!.leftAperture).toBeLessThan(0.12);
    expect(result!.rightAperture).toBeGreaterThan(0.12);
    expect(result!.isBlinking).toBe(false);
  });

  it('returns null when eyelid landmarks are missing (defensive boundary check)', () => {
    const landmarks = makeLandmarks();
    // Simulate a landmark array that's shorter than expected.
    const truncated = landmarks.slice(0, 100);
    expect(computeEyeAperture(truncated, 0.1)).toBeNull();
  });

  it('does not divide by zero when eyeSpan is 0', () => {
    const landmarks = makeLandmarks();
    expect(() => computeEyeAperture(landmarks, 0)).not.toThrow();
    const result = computeEyeAperture(landmarks, 0);
    expect(Number.isFinite(result!.leftAperture)).toBe(true);
  });
});

describe('computeCalibration', () => {
  it('returns a sane default when given zero points', () => {
    const result = computeCalibration([], 1920, 1080);
    expect(result.gainX).toBeGreaterThan(0);
    expect(result.gainY).toBeGreaterThan(0);
    expect(Number.isNaN(result.meanError)).toBe(true);
  });

  it('calibrates a single point to a pure center-offset correction with zero error', () => {
    const points: CalibrationPoint[] = [{ screenX: 960, screenY: 540, gazeOffsetX: 0.1, gazeOffsetY: -0.05 }];
    const result = computeCalibration(points, 1920, 1080);

    expect(result.centerOffsetX).toBeCloseTo(0.1, 5);
    expect(result.centerOffsetY).toBeCloseTo(-0.05, 5);
    expect(result.meanError).toBe(0);
  });

  it('fits gain + offset for multiple calibration points with near-zero reprojection error', () => {
    // Simulate a perfectly linear user: screenPos = center + gain * offset * halfExtent,
    // with a known gain of 5 and a known offset of 0.02, then verify the fit recovers
    // predictions that reproduce the same screen points (this is what "meanError low"
    // means operationally - not that gain/offset match exactly, since the fit is
    // parameterized differently, but that it predicts the calibration points well).
    const trueGain = 5;
    const trueCenterOffset = 0.02;
    const screenWidth = 1920;
    const screenHeight = 1080;

    const offsetsX = [-0.15, -0.05, 0, 0.05, 0.15];
    const points: CalibrationPoint[] = offsetsX.map((off) => ({
      gazeOffsetX: off,
      gazeOffsetY: off * 0.6,
      screenX: screenWidth / 2 + (off + trueCenterOffset) * trueGain * (screenWidth / 2),
      screenY: screenHeight / 2 + (off * 0.6 + trueCenterOffset) * trueGain * (screenHeight / 2),
    }));

    const result = computeCalibration(points, screenWidth, screenHeight);
    expect(result.meanError).toBeLessThan(1); // sub-pixel reprojection error
  });

  it('falls back to the default gain instead of dividing by zero when all points are identical', () => {
    const points: CalibrationPoint[] = [
      { screenX: 960, screenY: 540, gazeOffsetX: 0.1, gazeOffsetY: 0.1 },
      { screenX: 960, screenY: 540, gazeOffsetX: 0.1, gazeOffsetY: 0.1 },
    ];
    expect(() => computeCalibration(points, 1920, 1080)).not.toThrow();
    const result = computeCalibration(points, 1920, 1080);
    expect(Number.isFinite(result.gainX)).toBe(true);
    expect(Number.isFinite(result.gainY)).toBe(true);
  });
});

describe('GazeProcessor.computeRawOffset', () => {
  it('reports zero offset once baselined on a perfectly centered, forward-facing gaze', () => {
    const gp = new GazeProcessor();
    const leftIris: Landmark = { x: 0.45, y: 0.5 };
    const rightIris: Landmark = { x: 0.55, y: 0.5 };
    const noseTip: Landmark = { x: 0.5, y: 0.55 };

    let last = { offsetX: 0, offsetY: 0 };
    for (let i = 0; i < 20; i++) {
      last = gp.computeRawOffset(leftIris, rightIris, noseTip, 0.1);
    }

    expect(Math.abs(last.offsetX)).toBeLessThan(0.05);
  });

  it('reports a leftward offset when the iris shifts left relative to the calibrated baseline', () => {
    const gp = new GazeProcessor();
    const centerLeft: Landmark = { x: 0.45, y: 0.5 };
    const centerRight: Landmark = { x: 0.55, y: 0.5 };
    const nose: Landmark = { x: 0.5, y: 0.55 };

    for (let i = 0; i < 20; i++) gp.computeRawOffset(centerLeft, centerRight, nose, 0.1);

    // Both irises shift left in normalized space (gaze moves toward the user's left,
    // i.e. -X in gazeDeltaX's sign convention since it's negated in the source).
    const shiftedLeft: Landmark = { x: 0.4, y: 0.5 };
    const shiftedRight: Landmark = { x: 0.5, y: 0.5 };
    const result = gp.computeRawOffset(shiftedLeft, shiftedRight, nose, 0.1);

    expect(result.offsetX).toBeGreaterThan(0);
  });

  it('compensates head pitch so a tilted-down head does not register as a Y gaze shift', () => {
    const gpWithoutPitch = new GazeProcessor();
    const leftIris: Landmark = { x: 0.45, y: 0.5 };
    const rightIris: Landmark = { x: 0.55, y: 0.5 };

    // Nose further below the eye-line than the fixture default simulates a downward head tilt.
    const tiltedNose: Landmark = { x: 0.5, y: 0.65 };
    const neutralNose: Landmark = { x: 0.5, y: 0.55 };

    for (let i = 0; i < 20; i++) gpWithoutPitch.computeRawOffset(leftIris, rightIris, neutralNose, 0.1);
    const neutralResult = gpWithoutPitch.computeRawOffset(leftIris, rightIris, neutralNose, 0.1);
    const tiltedResult = gpWithoutPitch.computeRawOffset(leftIris, rightIris, tiltedNose, 0.1);

    // With the same iris position but a tilted head, pitch compensation should pull
    // the effective Y-offset back toward the neutral reading rather than reporting a
    // large, spurious downward gaze shift purely from head tilt.
    expect(Math.abs(tiltedResult.offsetY - neutralResult.offsetY)).toBeLessThan(0.1);
  });
});

describe('GazeProcessor.process (full pipeline)', () => {
  const baseParams = {
    leftIris: { x: 0.45, y: 0.5 } as Landmark,
    rightIris: { x: 0.55, y: 0.5 } as Landmark,
    noseTip: { x: 0.5, y: 0.55 } as Landmark,
    eyeSpan: 0.1,
    referenceEyeSpan: 0.1,
    aperture: computeEyeAperture(makeLandmarks(), 0.1),
    screenWidth: 1920,
    screenHeight: 1080,
    dt: 1 / 60,
  };

  it('clamps output to within the screen bounds margin', () => {
    const gp = new GazeProcessor();
    // Extreme iris deflection to try to push the result out of bounds.
    const result = gp.process({ ...baseParams, leftIris: { x: 0.1, y: 0.1 }, rightIris: { x: 0.2, y: 0.1 } });

    expect(result.x).toBeGreaterThanOrEqual(40);
    expect(result.x).toBeLessThanOrEqual(1920 - 40);
    expect(result.y).toBeGreaterThanOrEqual(40);
    expect(result.y).toBeLessThanOrEqual(1080 - 40);
  });

  it('holds the last good position during a blink instead of tracking noisy blink-time landmarks', () => {
    const gp = new GazeProcessor();

    // Establish a stable "last good" position over several open-eye frames.
    let lastResult = gp.process(baseParams);
    for (let i = 0; i < 5; i++) lastResult = gp.process(baseParams);
    const goodX = lastResult.x;
    const goodY = lastResult.y;

    // Simulate a blink frame with wildly different (noisy) iris landmarks - this is
    // exactly the failure mode the previous implementation had no defense against.
    // Position holding reacts to the raw per-frame aperture immediately (every frame,
    // not debounced) - occluded landmarks are unreliable the instant the aperture
    // closes, so there is no acceptable delay here. Only discrete blink *counting* is
    // debounced to 2+ consecutive frames (see the next two tests) - real-camera
    // validation data showed a single-frame count gate produced an implausible blink
    // rate from landmark-jitter noise, but that debounce must not also delay the
    // position hold, or one frame of noisy landmarks leaks through the filter.
    const blinkAperture = computeEyeAperture(
      makeLandmarks({ 159: { x: 0.45, y: 0.5 }, 145: { x: 0.45, y: 0.505 }, 386: { x: 0.55, y: 0.5 }, 374: { x: 0.55, y: 0.505 } }),
      0.1
    );
    const blinkResult = gp.process({
      ...baseParams,
      leftIris: { x: 0.05, y: 0.9 }, // implausible noisy position during eyelid occlusion
      rightIris: { x: 0.95, y: 0.9 },
      aperture: blinkAperture,
    });

    expect(blinkResult.isHeld).toBe(true);
    expect(blinkResult.x).toBeCloseTo(goodX, 0);
    expect(blinkResult.y).toBeCloseTo(goodY, 0);
    expect(blinkResult.confidence).toBeLessThan(0.3);
  });

  it('does not count a single noisy closed-aperture frame as a discrete blink', () => {
    const gp = new GazeProcessor();
    gp.process(baseParams);

    const blinkAperture = computeEyeAperture(
      makeLandmarks({ 159: { x: 0.45, y: 0.5 }, 145: { x: 0.45, y: 0.505 }, 386: { x: 0.55, y: 0.5 }, 374: { x: 0.55, y: 0.505 } }),
      0.1
    );
    // A single closed-aperture frame should hold position (tested above) but must not
    // register as a counted blink event - that requires 2+ consecutive frames.
    gp.process({ ...baseParams, aperture: blinkAperture });
    gp.process(baseParams); // aperture reopens immediately - a real blink would still be closed

    expect(gp.getDiagnostics().blinkCount).toBe(0);
  });

  it('counts a discrete blink once the closed aperture persists across 2+ frames', () => {
    const gp = new GazeProcessor();
    gp.process(baseParams);

    const blinkAperture = computeEyeAperture(
      makeLandmarks({ 159: { x: 0.45, y: 0.5 }, 145: { x: 0.45, y: 0.505 }, 386: { x: 0.55, y: 0.5 }, 374: { x: 0.55, y: 0.505 } }),
      0.1
    );
    gp.process({ ...baseParams, aperture: blinkAperture });
    gp.process({ ...baseParams, aperture: blinkAperture });

    expect(gp.getDiagnostics().blinkCount).toBe(1);
  });

  it('resumes tracking immediately once the blink ends', () => {
    const gp = new GazeProcessor();
    gp.process(baseParams);

    const blinkAperture = computeEyeAperture(
      makeLandmarks({ 159: { x: 0.45, y: 0.5 }, 145: { x: 0.45, y: 0.505 }, 386: { x: 0.55, y: 0.5 }, 374: { x: 0.55, y: 0.505 } }),
      0.1
    );
    gp.process({ ...baseParams, aperture: blinkAperture });
    gp.process({ ...baseParams, aperture: blinkAperture });

    const afterBlink = gp.process(baseParams);
    expect(afterBlink.isHeld).toBe(false);
  });

  it('compensates distance: a closer face (larger eyeSpan) produces a smaller raw offset scale for the same absolute iris shift', () => {
    const gpNear = new GazeProcessor();
    const gpFar = new GazeProcessor();

    const nearParams = { ...baseParams, eyeSpan: 0.2, referenceEyeSpan: 0.1 };
    const farParams = { ...baseParams, eyeSpan: 0.05, referenceEyeSpan: 0.1 };

    for (let i = 0; i < 15; i++) {
      gpNear.process(nearParams);
      gpFar.process(farParams);
    }

    const shiftedLeftIris: Landmark = { x: 0.43, y: 0.5 };
    const shiftedRightIris: Landmark = { x: 0.53, y: 0.5 };

    const nearResult = gpNear.process({ ...nearParams, leftIris: shiftedLeftIris, rightIris: shiftedRightIris });
    const farResult = gpFar.process({ ...farParams, leftIris: shiftedLeftIris, rightIris: shiftedRightIris });

    // Farther face (smaller eyeSpan) should get a larger compensation multiplier
    // (referenceEyeSpan / eyeSpan > 1), producing a larger screen-space deflection
    // for the same normalized iris movement magnitude.
    const nearDeflection = Math.abs(nearResult.x - 960);
    const farDeflection = Math.abs(farResult.x - 960);
    expect(farDeflection).toBeGreaterThan(nearDeflection);
  });

  it('reduces confidence at extreme head yaw', () => {
    const gp = new GazeProcessor();
    const straightNose: Landmark = { x: 0.5, y: 0.55 };
    const turnedNose: Landmark = { x: 0.9, y: 0.55 }; // nose far from eye-center = extreme yaw

    for (let i = 0; i < 10; i++) gp.process({ ...baseParams, noseTip: straightNose });
    const straightResult = gp.process({ ...baseParams, noseTip: straightNose });
    const turnedResult = gp.process({ ...baseParams, noseTip: turnedNose });

    expect(turnedResult.confidence).toBeLessThan(straightResult.confidence);
  });

  it('never produces NaN or Infinity output across a range of degenerate inputs', () => {
    const gp = new GazeProcessor();
    const degenerateCases = [
      { ...baseParams, eyeSpan: 0 },
      { ...baseParams, referenceEyeSpan: 0 },
      { ...baseParams, dt: 0 },
      { ...baseParams, leftIris: { x: 0, y: 0 }, rightIris: { x: 0, y: 0 } },
      { ...baseParams, aperture: null },
    ];

    for (const params of degenerateCases) {
      const result = gp.process(params);
      expect(Number.isFinite(result.x)).toBe(true);
      expect(Number.isFinite(result.y)).toBe(true);
      expect(Number.isFinite(result.confidence)).toBe(true);
    }
  });

  it('filtered jitter is lower than raw jitter for a noisy-but-stationary gaze (validates the One-Euro filter actually filters)', () => {
    const gp = new GazeProcessor();
    const rng = mulberry32(42);

    for (let i = 0; i < 60; i++) {
      const noiseX = (rng() - 0.5) * 0.01;
      const noiseY = (rng() - 0.5) * 0.01;
      gp.process({
        ...baseParams,
        leftIris: { x: 0.45 + noiseX, y: 0.5 + noiseY },
        rightIris: { x: 0.55 + noiseX, y: 0.5 + noiseY },
      });
    }

    const diagnostics = gp.getDiagnostics();
    expect(diagnostics.filteredJitter).toBeLessThan(diagnostics.rawJitter);
  });
});

// --- Worker/tasks-vision migration: landmark topology validation --------------------
// Added when the inference backend moved from the legacy @mediapipe/face_mesh library
// (main thread only) to @mediapipe/tasks-vision's FaceLandmarker (Web Worker) - see
// docs/LANDMARK_MAPPING.md. These tests use the SAME makeLandmarks() fixture as every
// other test in this file specifically to prove the gaze pipeline's behavior is
// unaffected by which backend produced the array - the shape ({x,y,z}[]) is what
// matters, not which library built it.
describe('validateLandmarkTopology', () => {
  it('accepts a well-formed 478-point landmark array with all required indices present', () => {
    const result = validateLandmarkTopology(makeLandmarks());
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects an array shorter than 478 points (e.g. iris refinement not enabled/available)', () => {
    const shortArray = makeLandmarks().slice(0, 468); // base mesh only, no iris points
    const result = validateLandmarkTopology(shortArray);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('478');
  });

  it('rejects an array with the right length but a missing required landmark', () => {
    const landmarks = makeLandmarks();
    // @ts-expect-error - deliberately constructing an invalid fixture for this test
    landmarks[468] = undefined;
    const result = validateLandmarkTopology(landmarks);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('IRIS_LEFT');
  });

  it('rejects a required landmark with non-finite coordinates (NaN/Infinity)', () => {
    const landmarks = makeLandmarks({ 386: { x: NaN, y: 0.5 } });
    const result = validateLandmarkTopology(landmarks);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('EYELID_RIGHT_TOP');
  });

  it('does not reject an array with extra landmarks beyond 478 (forward-compatible)', () => {
    const landmarks = [...makeLandmarks(), { x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }];
    const result = validateLandmarkTopology(landmarks);
    expect(result.valid).toBe(true);
  });
});

describe('GazeProcessor backend-equivalence (migration regression check)', () => {
  it('produces identical gaze output whether landmarks include a `z` field with different precision or an extra `visibility` field (tasks-vision includes visibility; legacy face_mesh does not)', () => {
    const legacyStyleLandmarks = makeLandmarks(); // {x, y} only, as legacy face_mesh produces
    const tasksVisionStyleLandmarks = legacyStyleLandmarks.map((lm) => ({
      ...lm,
      z: 0,
      visibility: 1, // extra field tasks-vision's NormalizedLandmark includes that legacy does not
    }));

    const gpLegacy = new GazeProcessor();
    const gpTasksVision = new GazeProcessor();

    const params = (landmarks: Landmark[]) => ({
      leftIris: landmarks[468],
      rightIris: landmarks[473],
      noseTip: landmarks[1],
      eyeSpan: 0.1,
      referenceEyeSpan: 0.1,
      aperture: computeEyeAperture(landmarks, 0.1),
      screenWidth: 1920,
      screenHeight: 1080,
      dt: 1 / 60,
    });

    let legacyResult, tasksVisionResult;
    for (let i = 0; i < 10; i++) {
      legacyResult = gpLegacy.process(params(legacyStyleLandmarks));
      tasksVisionResult = gpTasksVision.process(params(tasksVisionStyleLandmarks));
    }

    expect(tasksVisionResult!.x).toBeCloseTo(legacyResult!.x, 10);
    expect(tasksVisionResult!.y).toBeCloseTo(legacyResult!.y, 10);
    expect(tasksVisionResult!.confidence).toBeCloseTo(legacyResult!.confidence, 10);
  });
});

// Deterministic PRNG so noise-based tests are reproducible across runs (no Math.random flakiness).
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

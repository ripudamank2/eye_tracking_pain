// Orchestration for Air Touch / Hand Control: wires HandTracker's per-frame hand data
// through HandGestureDetector -> HandSmoother -> ScreenMapper -> AirTouchController, and
// exposes React state for the UI. Mirrors useDrowsinessGuard.ts's shape (own the pure
// engine instances in refs, drive them from real events/polling, expose plain state) -
// kept out of App.tsx so App.tsx only wires this hook's return value into the UI.
//
// This hook does NOT touch WebcamTracker's gaze pipeline - it only reads the already-
// playing video element via webcamTracker.getVideoElement() (see HandTracker.ts) to
// avoid a second getUserMedia() call, and starts hand inference only once eye-tracking
// webcam access is already active.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WebcamTracker } from '../services/WebcamTracker';
import { HandTracker } from '../services/HandTracker';
import type { HandTrackerDiagnostics } from '../services/HandTracker';
import { HandGestureDetector, DEFAULT_HAND_GESTURE_THRESHOLDS } from '../engine/HandGestureDetector';
import type { HandGestureThresholds } from '../engine/HandGestureDetector';
import { HandSmoother } from '../engine/HandSmoother';
import { ScreenMapper } from '../engine/ScreenMapper';
import { AirTouchController } from '../services/AirTouchController';
import { InAppSystemInputProvider } from '../services/SystemInputProvider';
import type { AirTouchControllerState } from '../services/AirTouchController';
import type { AirTouchCalibration, AirTouchGesture } from '../engine/handTypes';
import { EMPTY_AIR_TOUCH_CALIBRATION } from '../engine/handTypes';

export type AirTouchSensitivity = 'low' | 'normal' | 'high';

// Same "explicit heuristic, needs real-camera tuning" framing as
// useDrowsinessGuard.ts's SENSITIVITY_PRESETS - see docs/HAND_LANDMARK_MAPPING.md and
// PROJECT_STATUS.md for the reasoning behind these starting values.
const SENSITIVITY_PRESETS: Record<AirTouchSensitivity, Partial<HandGestureThresholds>> = {
  low: { pinchCloseThreshold: 0.28, pinchOpenThreshold: 0.45, confirmFrames: 3 },
  normal: {},
  high: { pinchCloseThreshold: 0.42, pinchOpenThreshold: 0.55, confirmFrames: 1 },
};

export interface AirTouchSettings {
  enabled: boolean;
  sensitivity: AirTouchSensitivity;
  smoothingStrength: number; // 0..1, maps to HandSmoother's minCutoff (lower = smoother/more lag)
  pinchThreshold: number; // 0..1, overrides pinchCloseThreshold directly when the user adjusts it
  gestureCooldownMs: number;
  handConfidenceThreshold: number;
  mirrorCamera: boolean;
}

export const DEFAULT_AIR_TOUCH_SETTINGS: AirTouchSettings = {
  enabled: false,
  sensitivity: 'normal',
  smoothingStrength: 0.5,
  pinchThreshold: DEFAULT_HAND_GESTURE_THRESHOLDS.pinchCloseThreshold,
  gestureCooldownMs: DEFAULT_HAND_GESTURE_THRESHOLDS.clickCooldownMs,
  handConfidenceThreshold: DEFAULT_HAND_GESTURE_THRESHOLDS.minConfidence,
  mirrorCamera: true,
};

export type AirTouchCalibrationStep = 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right' | 'center';
const CALIBRATION_STEPS: AirTouchCalibrationStep[] = ['top_left', 'top_right', 'bottom_left', 'bottom_right', 'center'];
const STEP_TO_KEY: Record<AirTouchCalibrationStep, keyof AirTouchCalibration> = {
  top_left: 'topLeft',
  top_right: 'topRight',
  bottom_left: 'bottomLeft',
  bottom_right: 'bottomRight',
  center: 'center',
};
const STEP_TARGET: Record<AirTouchCalibrationStep, { x: number; y: number }> = {
  top_left: { x: 0, y: 0 },
  top_right: { x: 1, y: 0 },
  bottom_left: { x: 0, y: 1 },
  bottom_right: { x: 1, y: 1 },
  center: { x: 0.5, y: 0.5 },
};

interface UseAirTouchArgs {
  webcamTracker: WebcamTracker;
  webcamActive: boolean;
  settings: AirTouchSettings;
}

export interface UseAirTouchResult {
  controllerState: AirTouchControllerState;
  handDiagnostics: HandTrackerDiagnostics;
  calibration: AirTouchCalibration;
  isCalibrated: boolean;
  calibrationErrorNorm: number | null;
  clearEmergencyStop: () => void;
  disable: () => void;
  // Calibration flow
  calibrationStepIndex: number | null; // null = not currently calibrating
  startCalibration: () => void;
  captureCalibrationPoint: () => void;
  cancelCalibration: () => void;
  resetCalibration: () => void;
}

export function useAirTouch({ webcamTracker, webcamActive, settings }: UseAirTouchArgs): UseAirTouchResult {
  const handTrackerRef = useRef<HandTracker | null>(null);
  const gestureDetectorRef = useRef(new HandGestureDetector());
  const smootherRef = useRef(new HandSmoother());
  const mapperRef = useRef(new ScreenMapper());
  const inputProviderRef = useRef(new InAppSystemInputProvider());
  const controllerRef = useRef(new AirTouchController(inputProviderRef.current));
  const lastFrameTimeRef = useRef<number | null>(null);
  // Mirrors the calibrationStepIndex state into a ref so captureCalibrationPoint can
  // read the current step synchronously without nesting a setState call inside another
  // setState's updater function (a fragile pattern React's own docs warn against -
  // updater functions should stay pure). Kept in sync by the effect below.
  const calibrationStepIndexRef = useRef<number | null>(null);

  const [controllerState, setControllerState] = useState<AirTouchControllerState>(() => controllerRef.current.getState());
  const [handDiagnostics, setHandDiagnostics] = useState<HandTrackerDiagnostics>({
    status: 'idle',
    fps: 0,
    inferenceTimeMs: 0,
    handDetected: false,
    confidence: 0,
    handedness: 'Unknown',
  });
  const [calibration, setCalibration] = useState<AirTouchCalibration>({ ...EMPTY_AIR_TOUCH_CALIBRATION });
  const [calibrationStepIndex, setCalibrationStepIndex] = useState<number | null>(null);
  const latestPointerRef = useRef<{ x: number; y: number } | null>(null);

  // Push settings into the pure engine instances whenever they change.
  useEffect(() => {
    gestureDetectorRef.current.setThresholds({
      ...SENSITIVITY_PRESETS[settings.sensitivity],
      pinchCloseThreshold: settings.pinchThreshold,
      clickCooldownMs: settings.gestureCooldownMs,
      minConfidence: settings.handConfidenceThreshold,
    });
  }, [settings.sensitivity, settings.pinchThreshold, settings.gestureCooldownMs, settings.handConfidenceThreshold]);

  useEffect(() => {
    // smoothingStrength 0..1 -> minCutoff: lower cutoff = heavier smoothing/more lag,
    // higher = more responsive/less smoothing. 0.3 and 3.0 are the practical useful
    // range for this filter shape (see HandSmoother.ts / GazeProcessor.ts's identical
    // One-Euro filter for the same minCutoff semantics).
    const minCutoff = 0.3 + settings.smoothingStrength * 2.7;
    smootherRef.current.setOptions({ minCutoff });
  }, [settings.smoothingStrength]);

  useEffect(() => {
    mapperRef.current.setOptions({ mirrorX: settings.mirrorCamera });
  }, [settings.mirrorCamera]);

  useEffect(() => {
    controllerRef.current.setEnabled(settings.enabled);
    setControllerState(controllerRef.current.getState());
  }, [settings.enabled]);

  // Start/stop hand tracking alongside webcam availability + the enabled setting -
  // hand inference only runs when both the eye-tracking webcam is active (so a video
  // element exists to read from) and the user has turned Air Touch on.
  useEffect(() => {
    if (!webcamActive || !settings.enabled) {
      if (handTrackerRef.current) {
        handTrackerRef.current.stop();
        handTrackerRef.current = null;
      }
      gestureDetectorRef.current.reset();
      smootherRef.current.reset();
      lastFrameTimeRef.current = null;
      return;
    }

    const videoElement = webcamTracker.getVideoElement();
    if (!videoElement) return;

    let cancelled = false;
    const tracker = new HandTracker();
    handTrackerRef.current = tracker;

    tracker
      .start(videoElement, {
        onFrame: (frame) => {
          if (cancelled) return;
          const dt =
            lastFrameTimeRef.current !== null ? Math.max(1 / 120, Math.min(1 / 5, (frame.timestampMs - lastFrameTimeRef.current) / 1000)) : 1 / 30;
          lastFrameTimeRef.current = frame.timestampMs;

          const gestureState = gestureDetectorRef.current.process(frame);
          latestPointerRef.current = gestureState.pointer;

          let screenCursor = null;
          if (gestureState.pointer) {
            const smoothed = smootherRef.current.smooth(gestureState.pointer.x, gestureState.pointer.y, dt);
            screenCursor = mapperRef.current.map(smoothed.x, smoothed.y, window.innerWidth, window.innerHeight);
          }

          controllerRef.current.update(gestureState, screenCursor);
          setControllerState(controllerRef.current.getState());
          setHandDiagnostics(tracker.getDiagnostics());
        },
        onNoHand: (timestampMs) => {
          if (cancelled) return;
          lastFrameTimeRef.current = null;
          const gestureState = gestureDetectorRef.current.notifyHandLost(timestampMs);
          controllerRef.current.update(gestureState, null);
          setControllerState(controllerRef.current.getState());
          setHandDiagnostics(tracker.getDiagnostics());
        },
        onStatusChange: () => {
          if (cancelled) return;
          setHandDiagnostics(tracker.getDiagnostics());
        },
      })
      .then((ready) => {
        if (!ready && !cancelled) {
          console.warn('[useAirTouch] HandTracker failed to start.');
        }
      });

    return () => {
      cancelled = true;
      tracker.stop();
      // Belt-and-suspenders: guarantee no input stays held when this effect tears down
      // for any reason (webcam disabled, Air Touch disabled, component unmount).
      controllerRef.current.releaseAllInput();
      if (handTrackerRef.current === tracker) handTrackerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webcamActive, settings.enabled, webcamTracker]);

  // Full teardown on unmount - the effect above's cleanup already handles the common
  // case, but this covers the controller's own destroy() path too (safety belt-and-
  // suspenders per AirTouchController's own doc comment).
  useEffect(() => {
    return () => {
      controllerRef.current.destroy();
    };
  }, []);

  const clearEmergencyStop = useCallback(() => {
    controllerRef.current.clearEmergencyStop();
    setControllerState(controllerRef.current.getState());
  }, []);

  const disable = useCallback(() => {
    controllerRef.current.setEnabled(false);
    setControllerState(controllerRef.current.getState());
  }, []);

  // Keep the ref mirror in sync with the state whenever it changes (covers all setters
  // below, including React StrictMode's double-invoke in development).
  useEffect(() => {
    calibrationStepIndexRef.current = calibrationStepIndex;
  }, [calibrationStepIndex]);

  // --- Calibration flow ---
  // Stored entirely independently from gaze calibration (AirTouchCalibration / this
  // hook's own state) - never reads or writes anything CalibrationModal/GazeProcessor own.
  const startCalibration = useCallback(() => {
    setCalibration({ ...EMPTY_AIR_TOUCH_CALIBRATION });
    setCalibrationStepIndex(0);
  }, []);

  const captureCalibrationPoint = useCallback(() => {
    const currentIndex = calibrationStepIndexRef.current;
    if (currentIndex === null) return;

    const pointer = latestPointerRef.current;
    if (!pointer) return; // no hand detected this instant - do not record a bogus point, let the user retry

    const step = CALIBRATION_STEPS[currentIndex];
    const key = STEP_TO_KEY[step];
    setCalibration((prev) => ({ ...prev, [key]: { camera: pointer, target: STEP_TARGET[step] } }));

    const nextIndex = currentIndex + 1;
    setCalibrationStepIndex(nextIndex >= CALIBRATION_STEPS.length ? null : nextIndex);
  }, []);

  const cancelCalibration = useCallback(() => {
    setCalibrationStepIndex(null);
  }, []);

  const resetCalibration = useCallback(() => {
    mapperRef.current.resetCalibration();
    setCalibration({ ...EMPTY_AIR_TOUCH_CALIBRATION });
    setCalibrationStepIndex(null);
  }, []);

  // Apply the calibration to the mapper whenever it changes and calibration has ended.
  useEffect(() => {
    if (calibrationStepIndex !== null) return; // still mid-flow, don't apply a partial calibration
    const hasAnyPoint = Object.values(calibration).some((v) => v !== null);
    if (hasAnyPoint) mapperRef.current.setCalibration(calibration);
  }, [calibration, calibrationStepIndex]);

  return {
    controllerState,
    handDiagnostics,
    calibration,
    isCalibrated: mapperRef.current.isCalibrated(),
    calibrationErrorNorm: mapperRef.current.getMeanErrorNorm(),
    clearEmergencyStop,
    disable,
    calibrationStepIndex,
    startCalibration,
    captureCalibrationPoint,
    cancelCalibration,
    resetCalibration,
  };
}

export type { AirTouchGesture };

// Pure, timestamp-driven gesture recognition over MediaPipe hand landmarks - deliberately
// mirrors DrowsinessDetector.ts's shape (a plain class fed per-frame input via one
// method, zero DOM/React/Electron/input-injection dependencies, unit-testable with
// synthetic fixtures) so it can be reasoned about and tested the same way.
//
// This module does NOT touch the eye-tracking pipeline in any way - it is a fully
// independent consumer of a different MediaPipe task's output. See
// docs/HAND_LANDMARK_MAPPING.md for the verified landmark indices used below.
//
// Design constraint carried over from real-camera validation lessons on the gaze
// pipeline (see PROJECT_STATUS.md): a single noisy frame must never fire a discrete
// event. Every gesture transition here requires either a duration hold or an explicit
// debounce/cooldown - see PINCH_CONFIRM_FRAMES, click cooldown, etc.

import type { HandFrame, HandLandmark, AirTouchGesture, AirTouchGestureState } from './handTypes';

export interface HandGestureThresholds {
  /** Normalized (relative to hand scale, see handScale()) thumb-to-index distance below which a pinch is considered active. */
  pinchCloseThreshold: number;
  /** Pinch must open beyond this (with hysteresis vs. pinchCloseThreshold) to be considered released - prevents flicker right at the boundary. */
  pinchOpenThreshold: number;
  /** Normalized fingertip movement (relative to hand scale) beyond which a held pinch is reclassified as a drag rather than a stationary click-hold. */
  dragStartDistance: number;
  /** Minimum time between two discrete click events of the same type, regardless of gesture state - defends against any residual flicker the state machine itself doesn't already prevent. */
  clickCooldownMs: number;
  /** Consecutive frames a raw pose must persist before being treated as a confirmed gesture transition - filters single-frame landmark noise, same rationale as DrowsinessDetector's rawClosedFrameStreak. */
  confirmFrames: number;
  /** Same idea as confirmFrames, but specifically for the fist/emergency-stop pose - kept separately configurable and defaulting lower than confirmFrames because an emergency stop's whole purpose is to react immediately; the cost of a false-positive stop (user re-enables Air Touch) is far lower than the cost of a delayed one (a frame or two of unwanted drag/click continuing). */
  fistConfirmFrames: number;
  /** Below this handedness/detection confidence, a frame's pose is not trusted for gesture classification. */
  minConfidence: number;
}

export const DEFAULT_HAND_GESTURE_THRESHOLDS: HandGestureThresholds = {
  pinchCloseThreshold: 0.35,
  pinchOpenThreshold: 0.5,
  dragStartDistance: 0.15,
  clickCooldownMs: 350,
  confirmFrames: 2,
  fistConfirmFrames: 1,
  minConfidence: 0.4,
};

// Landmark indices - see docs/HAND_LANDMARK_MAPPING.md for verification.
const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_PIP = 6;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_PIP = 10;
const MIDDLE_TIP = 12;
const RING_PIP = 14;
const RING_TIP = 16;
const PINKY_PIP = 18;
const PINKY_TIP = 20;

function dist(a: HandLandmark, b: HandLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Hand-scale reference distance (wrist to middle-finger MCP) - the hand-tracking equivalent of GazeProcessor's eyeSpan: a stable per-frame scale so distance thresholds stay meaningful as the hand moves closer to/farther from the camera. Never reuses or imports GazeProcessor - independent implementation per the task's explicit instruction. */
function handScale(landmarks: HandLandmark[]): number {
  const wrist = landmarks[WRIST];
  const middleMcp = landmarks[MIDDLE_MCP];
  if (!wrist || !middleMcp) return 0.2; // plausible fallback, avoids division by ~0
  return Math.max(0.05, dist(wrist, middleMcp));
}

/** A finger is "extended" if its tip is farther from the wrist than its PIP joint is - a simple, real-time-cheap curl test that works regardless of hand rotation (unlike a fixed y-coordinate comparison, which breaks if the hand is sideways or upside down). */
function isFingerExtended(landmarks: HandLandmark[], tipIdx: number, pipIdx: number): boolean {
  const wrist = landmarks[WRIST];
  const tip = landmarks[tipIdx];
  const pip = landmarks[pipIdx];
  if (!wrist || !tip || !pip) return false;
  return dist(wrist, tip) > dist(wrist, pip) * 1.1; // 10% margin against noise at the boundary
}

interface RawPoseResult {
  indexExtended: boolean;
  middleExtended: boolean;
  ringExtended: boolean;
  pinkyExtended: boolean;
  pinchDistance: number; // normalized by hand scale
}

function classifyRawPose(landmarks: HandLandmark[]): RawPoseResult {
  const scale = handScale(landmarks);
  const thumbTip = landmarks[THUMB_TIP];
  const indexTip = landmarks[INDEX_TIP];

  return {
    indexExtended: isFingerExtended(landmarks, INDEX_TIP, INDEX_PIP),
    middleExtended: isFingerExtended(landmarks, MIDDLE_TIP, MIDDLE_PIP),
    ringExtended: isFingerExtended(landmarks, RING_TIP, RING_PIP),
    pinkyExtended: isFingerExtended(landmarks, PINKY_TIP, PINKY_PIP),
    pinchDistance: thumbTip && indexTip ? dist(thumbTip, indexTip) / scale : Infinity,
  };
}

type PinchPhase = 'open' | 'closing' | 'closed' | 'dragging';

export class HandGestureDetector {
  private thresholds: HandGestureThresholds;

  private pinchPhase: PinchPhase = 'open';
  private pinchStartPoint: { x: number; y: number } | null = null;
  /** Hand scale (see handScale()) captured at pinch-start, so the drag-distance check stays normalized to the hand's apparent size at that moment rather than an arbitrary fixed constant. */
  private pinchStartHandScale = 0.2;
  // -Infinity (not 0) so "no click has ever happened" never satisfies the cooldown
  // check against a real small timestamp (e.g. `40 - 0 = 40 < clickCooldownMs` would
  // incorrectly suppress the very first click of a session if this started at 0).
  private lastLeftClickAt = -Infinity;
  private lastRightClickAt = -Infinity;

  // Confirm-frame streaks for each candidate raw pose, so a single noisy frame can't
  // flip the recognized gesture (mirrors DrowsinessDetector's rawClosedFrameStreak).
  private twoFingerStreak = 0;
  private openPalmStreak = 0;
  private fistStreak = 0;
  // Gates the two-finger click to fire once per gesture entry (edge, not level) - fist
  // and open-palm are deliberately level-triggered instead (their whole purpose is to
  // report "currently paused"/"currently stopped" every frame, not a one-time event), so
  // they need no equivalent wasFist/wasOpenPalm edge-tracking.
  private wasTwoFinger = false;

  private lastGesture: AirTouchGesture = 'none';

  constructor(thresholds: Partial<HandGestureThresholds> = {}) {
    this.thresholds = { ...DEFAULT_HAND_GESTURE_THRESHOLDS, ...thresholds };
  }

  public setThresholds(thresholds: Partial<HandGestureThresholds>) {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  public getThresholds(): HandGestureThresholds {
    return this.thresholds;
  }

  /** Call when no hand frame is available this tick (no hand detected, or tracking paused) - never synthesize a frame for a missing hand. Safely resets any in-progress pinch/drag rather than leaving it stuck. */
  public notifyHandLost(timestampMs: number): AirTouchGestureState {
    const wasDragging = this.pinchPhase === 'dragging';
    this.pinchPhase = 'open';
    this.pinchStartPoint = null;
    this.twoFingerStreak = 0;
    this.openPalmStreak = 0;
    this.fistStreak = 0;
    this.wasTwoFinger = false;
    this.lastGesture = 'none';

    return {
      gesture: 'none',
      pointer: null,
      clickEvent: null,
      dragStart: false,
      // Surface a dragEnd exactly once, on the frame the hand is lost while a drag was
      // active, so a consumer (AirTouchController) reliably releases the mouse button
      // rather than leaving it held because the pinch-release frame never arrived.
      dragEnd: wasDragging,
      timestampMs,
    };
  }

  public process(frame: HandFrame): AirTouchGestureState {
    if (frame.confidence < this.thresholds.minConfidence || frame.landmarks.length < 21) {
      return this.notifyHandLost(frame.timestampMs);
    }

    const pose = classifyRawPose(frame.landmarks);
    const scale = handScale(frame.landmarks);
    const indexTip = frame.landmarks[INDEX_TIP];
    const pointer = indexTip ? { x: indexTip.x, y: indexTip.y } : null;

    // --- Fist / open-palm classification (mutually exclusive with pinch/pointer) ---
    const rawFist = !pose.indexExtended && !pose.middleExtended && !pose.ringExtended && !pose.pinkyExtended;
    const rawOpenPalm = pose.indexExtended && pose.middleExtended && pose.ringExtended && pose.pinkyExtended;
    const rawTwoFinger = pose.indexExtended && pose.middleExtended && !pose.ringExtended && !pose.pinkyExtended;

    this.fistStreak = rawFist ? this.fistStreak + 1 : 0;
    this.openPalmStreak = rawOpenPalm ? this.openPalmStreak + 1 : 0;
    this.twoFingerStreak = rawTwoFinger ? this.twoFingerStreak + 1 : 0;

    const isFist = this.fistStreak >= this.thresholds.fistConfirmFrames;
    const isOpenPalm = this.openPalmStreak >= this.thresholds.confirmFrames;
    const isTwoFinger = this.twoFingerStreak >= this.thresholds.confirmFrames;

    if (isFist) {
      // Emergency-stop pose overrides everything else, including any in-progress pinch/drag.
      const wasDragging = this.pinchPhase === 'dragging';
      this.pinchPhase = 'open';
      this.pinchStartPoint = null;
      this.lastGesture = 'fist';
      return {
        gesture: 'fist',
        pointer,
        clickEvent: null,
        dragStart: false,
        dragEnd: wasDragging,
        timestampMs: frame.timestampMs,
      };
    }

    if (isOpenPalm) {
      const wasDragging = this.pinchPhase === 'dragging';
      this.pinchPhase = 'open';
      this.pinchStartPoint = null;
      this.lastGesture = 'open_palm';
      return {
        gesture: 'open_palm',
        pointer,
        clickEvent: null,
        dragStart: false,
        dragEnd: wasDragging,
        timestampMs: frame.timestampMs,
      };
    }

    if (isTwoFinger) {
      let clickEvent: 'right' | null = null;
      if (!this.wasTwoFinger && frame.timestampMs - this.lastRightClickAt >= this.thresholds.clickCooldownMs) {
        clickEvent = 'right';
        this.lastRightClickAt = frame.timestampMs;
      }
      this.wasTwoFinger = true;
      this.lastGesture = 'two_finger';
      return {
        gesture: 'two_finger',
        pointer,
        clickEvent,
        dragStart: false,
        dragEnd: false,
        timestampMs: frame.timestampMs,
      };
    }
    this.wasTwoFinger = false;

    // --- Pinch / drag state machine (hysteresis between close/open thresholds) ---
    return this.processPinchOrPointer(pose, pointer, scale, frame.timestampMs);
  }

  private processPinchOrPointer(
    pose: RawPoseResult,
    pointer: { x: number; y: number } | null,
    scale: number,
    timestampMs: number
  ): AirTouchGestureState {
    const { pinchCloseThreshold, pinchOpenThreshold, dragStartDistance, clickCooldownMs } = this.thresholds;

    switch (this.pinchPhase) {
      case 'open': {
        if (pose.pinchDistance <= pinchCloseThreshold) {
          this.pinchPhase = 'closed';
          this.pinchStartPoint = pointer;
          this.pinchStartHandScale = scale;
          let clickEvent: 'left' | null = null;
          if (timestampMs - this.lastLeftClickAt >= clickCooldownMs) {
            clickEvent = 'left';
            this.lastLeftClickAt = timestampMs;
          }
          this.lastGesture = 'pinch_start';
          return { gesture: 'pinch_start', pointer, clickEvent, dragStart: false, dragEnd: false, timestampMs };
        }
        this.lastGesture = pointer ? 'pointer' : 'none';
        return { gesture: this.lastGesture, pointer, clickEvent: null, dragStart: false, dragEnd: false, timestampMs };
      }

      case 'closed': {
        if (pose.pinchDistance >= pinchOpenThreshold) {
          this.pinchPhase = 'open';
          this.pinchStartPoint = null;
          this.lastGesture = 'pointer';
          return { gesture: 'pointer', pointer, clickEvent: null, dragStart: false, dragEnd: false, timestampMs };
        }

        // Movement normalized by the hand's scale at pinch-start, so the distance a
        // "real" drag-start movement represents stays consistent whether the hand is
        // close to or far from the camera - same rationale as handScale() itself.
        const movedEnough =
          pointer && this.pinchStartPoint
            ? Math.hypot(pointer.x - this.pinchStartPoint.x, pointer.y - this.pinchStartPoint.y) / this.pinchStartHandScale >=
              dragStartDistance
            : false;

        if (movedEnough) {
          this.pinchPhase = 'dragging';
          this.lastGesture = 'drag';
          return { gesture: 'drag', pointer, clickEvent: null, dragStart: true, dragEnd: false, timestampMs };
        }

        this.lastGesture = 'pinch_held';
        return { gesture: 'pinch_held', pointer, clickEvent: null, dragStart: false, dragEnd: false, timestampMs };
      }

      case 'dragging': {
        if (pose.pinchDistance >= pinchOpenThreshold) {
          this.pinchPhase = 'open';
          this.pinchStartPoint = null;
          this.lastGesture = 'pointer';
          return { gesture: 'pointer', pointer, clickEvent: null, dragStart: false, dragEnd: true, timestampMs };
        }
        this.lastGesture = 'drag';
        return { gesture: 'drag', pointer, clickEvent: null, dragStart: false, dragEnd: false, timestampMs };
      }

      default:
        return { gesture: 'none', pointer, clickEvent: null, dragStart: false, dragEnd: false, timestampMs };
    }
  }

  public getLastGesture(): AirTouchGesture {
    return this.lastGesture;
  }

  public reset() {
    this.pinchPhase = 'open';
    this.pinchStartPoint = null;
    this.lastLeftClickAt = -Infinity;
    this.lastRightClickAt = -Infinity;
    this.twoFingerStreak = 0;
    this.openPalmStreak = 0;
    this.fistStreak = 0;
    this.wasTwoFinger = false;
    this.lastGesture = 'none';
  }
}

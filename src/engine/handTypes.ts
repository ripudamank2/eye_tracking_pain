// Shared types for the Air Touch / Hand Control feature - kept separate from
// GazeProcessor.ts's types (Landmark, GazeResult, etc.) even though the shapes overlap,
// per the explicit instruction not to reuse/modify the gaze pipeline's code. This is an
// independent module that happens to consume a structurally similar (but functionally
// distinct - 21 hand points, not 478 face points) MediaPipe result.

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export type Handedness = 'Left' | 'Right' | 'Unknown';

/** One frame's raw hand-tracking input, before any gesture interpretation. */
export interface HandFrame {
  timestampMs: number;
  landmarks: HandLandmark[]; // 21 points, see docs/HAND_LANDMARK_MAPPING.md
  handedness: Handedness;
  /** Confidence of the handedness classification - not the same as detection confidence; MediaPipe's HandLandmarkerResult does not expose a single scalar "hand confidence", so this is the handedness category score, the closest available proxy (see HandTracker.ts). */
  confidence: number;
}

export type AirTouchGesture =
  | 'none' // no hand, or hand present but no recognized pose
  | 'pointer' // index finger extended, tracking cursor position
  | 'pinch_start' // this frame is the first frame of a new pinch
  | 'pinch_held' // pinch continuing from a previous frame
  | 'drag' // pinch held AND the index fingertip has moved beyond the drag-start threshold
  | 'two_finger' // index + middle extended together (right-click gesture)
  | 'open_palm' // all four fingers extended (pause)
  | 'fist'; // all four fingers curled (emergency stop)

export type AirTouchStatus = 'disabled' | 'tracking' | 'paused' | 'stopped' | 'no_hand';

export interface AirTouchGestureState {
  gesture: AirTouchGesture;
  /** Normalized (0..1) index fingertip position this frame - null when there is no reliable pointer position (e.g. fist, no hand). */
  pointer: { x: number; y: number } | null;
  /** True exactly on the frame a click should fire (pinch or two-finger) - a discrete edge, not a level, so a consumer summing "click frames" never double-counts a held gesture. */
  clickEvent: 'left' | 'right' | null;
  /** True exactly on the frame a drag should begin. */
  dragStart: boolean;
  /** True exactly on the frame a drag should end (pinch released while dragging). */
  dragEnd: boolean;
  timestampMs: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface CalibrationCorner {
  /** Raw normalized (0..1, pre-mirror) index-fingertip position captured during calibration. */
  camera: { x: number; y: number };
  /** The screen-space target this calibration point represents, normalized 0..1 within the calibration target area. */
  target: { x: number; y: number };
}

export interface AirTouchCalibration {
  topLeft: CalibrationCorner | null;
  topRight: CalibrationCorner | null;
  bottomLeft: CalibrationCorner | null;
  bottomRight: CalibrationCorner | null;
  center: CalibrationCorner | null;
}

export const EMPTY_AIR_TOUCH_CALIBRATION: AirTouchCalibration = {
  topLeft: null,
  topRight: null,
  bottomLeft: null,
  bottomRight: null,
  center: null,
};

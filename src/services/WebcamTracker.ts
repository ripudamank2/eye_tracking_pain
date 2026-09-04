// Webcam + MediaPipe hardware adapter. Owns getUserMedia, the MediaPipe FaceMesh/Camera
// lifecycle, and DOM video element - all the browser/hardware side effects that make this
// class impossible to unit-test directly. The actual gaze math lives in GazeProcessor
// (pure, unit-tested); this class's job is just to get real landmarks into it and real
// results out to the renderer.

import {
  GazeProcessor,
  computeEyeAperture,
  computeCalibration,
  validateLandmarkTopology,
  LANDMARK,
  type Landmark,
  type CalibrationPoint,
  type EyeApertureResult,
} from '../engine/GazeProcessor';
import { FaceLandmarkerWorkerClient } from './FaceLandmarkerWorkerClient';
import { DrowsinessDetector, computeMouthOpenRatio, type DrowsinessState, type DrowsinessThresholds } from '../engine/DrowsinessDetector';

export interface FacePosition {
  x: number;
  y: number;
  isTracking: boolean;
  rawX?: number;
  rawY?: number;
  irisLeftX?: number;
  irisLeftY?: number;
  irisRightX?: number;
  irisRightY?: number;
}

// AI Camera Gestures: discrete events derived from head motion, mouth shape, and per-eye closure.
export type CameraGesture = 'nod' | 'shake' | 'smile' | 'wink_left' | 'wink_right';

export interface GestureCallbacks {
  onGesture?: (gesture: CameraGesture) => void;
}

export type TrackerStatus =
  | 'idle'
  | 'starting'
  | 'tracking'
  | 'face_lost'
  | 'permission_denied'
  | 'device_not_found'
  | 'device_disconnected'
  | 'error';

export interface StatusCallbacks {
  onStatusChange?: (status: TrackerStatus, detail?: string) => void;
}

export interface TrackerDiagnostics {
  status: TrackerStatus;
  fps: number;
  frameTimeMs: number;
  droppedFrames: number;
  trackingConfidence: number;
  faceDetectionLossCount: number;
  gazeJitterPx: number;
  gazeLatencyMs: number;
  /** Time spent inside the Worker's detectForVideo() call itself - the metric that
   * isolates inference cost from the end-to-end gaze latency above. */
  inferenceTimeMs: number;
  calibrationErrorPx: number;
  framesHeldForBlink: number;
  blinkCount: number;
  gazeX: number | null;
  gazeY: number | null;
  // Drowsiness & Eye-Fatigue Guard (see DrowsinessDetector.ts) - null/0 whenever the
  // guard is disabled, distinct from the gaze pipeline's own blinkCount above (that one
  // feeds blink-gaze gating; these are the guard's independent, separately-thresholded
  // reading of the same underlying eye-aperture signal).
  drowsinessLevel: string | null;
  drowsinessScore: number;
  drowsinessEyeClosureMs: number;
  drowsinessRecentBlinkCount: number;
  drowsinessProlongedBlinkCount: number;
  drowsinessYawnCount: number;
}

const FACE_LOSS_GRACE_MS = 400; // brief occlusions (a hand passing, fast head turn) shouldn't flip status
const FRAME_HISTORY_SIZE = 60;

export class WebcamTracker {
  private videoElement: HTMLVideoElement | null = null;
  private workerClient: FaceLandmarkerWorkerClient | null = null;
  private stream: MediaStream | null = null;
  private isRunning = false;
  private captureLoopId: number | null = null;

  private gazeProcessor = new GazeProcessor();
  private referenceEyeSpan = 0.1;

  // Drowsiness & Eye-Fatigue Guard: a separate, independent consumer of the same
  // per-frame aperture/landmark data GazeProcessor and detectGestures already read -
  // does not participate in gaze computation, calibration, or blink-gaze gating in any
  // way. See src/engine/DrowsinessDetector.ts for the detector itself.
  private drowsinessDetector = new DrowsinessDetector();
  private drowsinessEnabled = false;

  public facePos: FacePosition = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    isTracking: false,
    rawX: 320,
    rawY: 240,
  };

  // AI Camera Gestures
  public gestureCallbacks: GestureCallbacks = {};
  public statusCallbacks: StatusCallbacks = {};
  private noseXHistory: number[] = [];
  private noseYHistory: number[] = [];
  private lastGestureTime = 0;
  private readonly gestureCooldownMs = 1200;
  private isSmiling = false;
  private isWinkingLeft = false;
  private isWinkingRight = false;

  // Status / recovery tracking
  private status: TrackerStatus = 'idle';
  private lastFaceSeenAt = 0;
  private faceDetectionLossCount = 0;

  // Diagnostics
  private frameTimestamps: number[] = [];
  private droppedFrames = 0;
  private lastFrameTime = 0;
  private lastAperture: EyeApertureResult | null = null;
  private lastRawOffset: { offsetX: number; offsetY: number } | null = null;
  private lastConfidence = 0;
  private lastGazeLatencyMs = 0;
  private lastInferenceTimeMs = 0;

  public async start(): Promise<boolean> {
    this.setStatus('starting');

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
    } catch (err) {
      // Distinguish failure modes so the UI (and diagnostics) can tell the user
      // something actionable instead of a generic "unavailable" - the previous
      // implementation collapsed all getUserMedia failures into one bare alert().
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        this.setStatus('permission_denied', 'Camera permission was denied.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        this.setStatus('device_not_found', 'No camera device was found.');
      } else {
        this.setStatus('error', err instanceof Error ? err.message : String(err));
      }
      return false;
    }

    // Detect the OS/browser revoking the camera mid-session (device unplugged,
    // another app took exclusive access, permission revoked after grant). Without
    // this listener the previous implementation had no way to notice - the UI would
    // keep showing "tracking active" indefinitely with a frozen last-known position.
    const videoTrack = this.stream.getVideoTracks()[0];
    videoTrack?.addEventListener('ended', () => {
      this.setStatus('device_disconnected', 'Camera was disconnected.');
      this.stop();
    });

    try {
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.stream;
      this.videoElement.width = 640;
      this.videoElement.height = 480;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
      await this.videoElement.play();

      this.recalibrate();

      // Face landmark inference runs in a dedicated Web Worker (see
      // FaceLandmarkerWorkerClient / workers/faceLandmarkerWorker.ts) so the WASM
      // inference cost never blocks the main thread's render loop - this replaces the
      // legacy @mediapipe/face_mesh library, which called document/window directly and
      // so could only ever run synchronously on the main thread. See
      // docs/LANDMARK_MAPPING.md for why the landmark indices this pipeline depends on
      // are unaffected by this change.
      this.workerClient = new FaceLandmarkerWorkerClient();

      const ready = await this.workerClient.start({
        onResult: (landmarks, inferenceTimeMs, frameTimestampMs) => {
          this.lastInferenceTimeMs = inferenceTimeMs;
          this.handleFaceMeshResults({ multiFaceLandmarks: landmarks });
          this.recordFrame(frameTimestampMs);
        },
        onNoFace: (frameTimestampMs, inferenceTimeMs) => {
          this.facePos.isTracking = false;
          this.lastInferenceTimeMs = inferenceTimeMs;
          this.recordFrame(frameTimestampMs);
        },
        onError: (message) => {
          console.warn('[WebcamTracker] FaceLandmarker Worker error:', message);
          this.setStatus('error', message);
        },
      });

      if (!ready) {
        this.setStatus('error', 'Face landmark model failed to initialize.');
        this.stop();
        return false;
      }

      this.isRunning = true;
      this.startCaptureLoop();
      return true;
    } catch (err) {
      this.setStatus('error', err instanceof Error ? err.message : String(err));
      this.stop();
      return false;
    }
  }

  /**
   * Drives frame capture independently of the app's render loop - this is the whole
   * point of moving inference to a Worker: rendering must never wait on it. Each tick
   * posts the current video frame to the Worker only if it isn't still busy with a
   * previous one (FaceLandmarkerWorkerClient.postFrame no-ops in that case rather than
   * queuing), so a slow inference tick simply results in fewer camera frames processed,
   * never a backlog and never a blocked render loop.
   */
  private startCaptureLoop() {
    const tick = () => {
      if (!this.isRunning || !this.videoElement || !this.workerClient) return;
      this.workerClient.postFrame(this.videoElement, performance.now());
      this.captureLoopId = requestAnimationFrame(tick);
    };
    this.captureLoopId = requestAnimationFrame(tick);
  }

  /**
   * Re-baselines the "neutral center" gaze offset. Previously this only ever ran once
   * at start() with no way for the user to trigger it again mid-session - if the
   * initial 15 frames caught a bad pose, or the user shifted position, the whole
   * session's accuracy was permanently off. Exposed publicly so the UI can offer a
   * "Recalibrate" action.
   */
  public recalibrate() {
    this.gazeProcessor.resetBaseline();
    this.gazeProcessor.resetFilters();
    this.gazeProcessor.resetBlinkCount();
    this.faceDetectionLossCount = 0;
    this.referenceEyeSpan = 0.1;
    this.hasCapturedReferenceEyeSpan = false;
    this.drowsinessDetector.reset(performance.now());
  }

  /** Enable/disable the Drowsiness & Eye-Fatigue Guard. Disabled by default - the user opts in. */
  public setDrowsinessGuardEnabled(enabled: boolean) {
    this.drowsinessEnabled = enabled;
    if (enabled) this.drowsinessDetector.reset(performance.now());
  }

  public isDrowsinessGuardEnabled(): boolean {
    return this.drowsinessEnabled;
  }

  public setDrowsinessThresholds(thresholds: Partial<DrowsinessThresholds>) {
    this.drowsinessDetector.setThresholds(thresholds);
  }

  public getDrowsinessState(): DrowsinessState {
    return this.drowsinessDetector.getState();
  }

  /**
   * Resets only the smoothing filter's internal state (screen-pixel space), without
   * touching calibration or the neutral-gaze baseline. Call this after a window
   * resize so the filter reprojects in one frame instead of visibly lagging toward
   * the newly-scaled target for several frames.
   */
  public resetGazeFilters() {
    this.gazeProcessor.resetFilters();
  }

  private hasCapturedReferenceEyeSpan = false;

  /**
   * Runs full multi-point calibration from a set of (screen target, observed gaze
   * offset) pairs. The caller is responsible for prompting the user to look at each
   * target and recording `getCurrentRawOffset()` at that moment - see
   * useEyeCalibration in App.tsx for the UI flow.
   */
  public applyCalibration(points: CalibrationPoint[], screenWidth: number, screenHeight: number) {
    const result = computeCalibration(points, screenWidth, screenHeight);
    this.gazeProcessor.setCalibration(result);
    return result;
  }

  public getCalibrationError(): number {
    return this.gazeProcessor.getCalibration().meanError;
  }

  /** User-facing manual gaze sensitivity multiplier (applied on top of calibration). */
  public get sensitivity(): number {
    return this.gazeProcessor.manualGainMultiplier;
  }

  public set sensitivity(value: number) {
    this.gazeProcessor.manualGainMultiplier = value;
  }

  public getStream(): MediaStream | null {
    return this.stream;
  }

  /**
   * Exposes the already-owned, already-playing video element so Air Touch's HandTracker
   * can drive its own independent capture loop over the SAME camera feed - deliberately
   * read-only access (no setter), so a second consumer can look but never take ownership
   * of the element's lifecycle (WebcamTracker alone creates/plays/pauses it, see
   * start()/stop()). This is what avoids a second getUserMedia() call for hand tracking.
   */
  public getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  public getStatus(): TrackerStatus {
    return this.status;
  }

  public stop() {
    this.isRunning = false;
    if (this.captureLoopId !== null) {
      cancelAnimationFrame(this.captureLoopId);
      this.captureLoopId = null;
    }
    if (this.workerClient) {
      this.workerClient.stop();
      this.workerClient = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
    this.facePos.isTracking = false;

    // Reset gesture-detection history so a stopped-then-restarted session (the
    // WebcamTracker instance is reused, not recreated) doesn't carry over stale nose
    // position history that could immediately fire a false gesture.
    this.noseXHistory = [];
    this.noseYHistory = [];
    this.isSmiling = false;
    this.isWinkingLeft = false;
    this.isWinkingRight = false;
    this.frameTimestamps = [];
    this.droppedFrames = 0;

    if (this.status !== 'permission_denied' && this.status !== 'device_not_found' && this.status !== 'device_disconnected') {
      this.setStatus('idle');
    }
  }

  private setStatus(status: TrackerStatus, detail?: string) {
    if (this.status === status) return;
    this.status = status;
    this.statusCallbacks.onStatusChange?.(status, detail);
  }

  private recordFrame(frameStartTime: number) {
    const now = performance.now();
    if (this.lastFrameTime > 0) {
      const gap = now - this.lastFrameTime;
      // A gap much larger than a single frame at a reasonable minimum rate (10fps)
      // means the pipeline stalled - count it as dropped frame(s) rather than
      // silently absorbing it into the FPS average.
      if (gap > 100) {
        this.droppedFrames += Math.floor(gap / 100) - 1;
      }
    }
    this.lastFrameTime = now;
    this.lastGazeLatencyMs = now - frameStartTime;

    this.frameTimestamps.push(now);
    if (this.frameTimestamps.length > FRAME_HISTORY_SIZE) this.frameTimestamps.shift();

    // Face-loss detection with a short grace window: a single dropped detection
    // (motion blur, brief occlusion) shouldn't immediately flip the UI to "lost" and
    // fall back to a stale mouse position - only a sustained loss should.
    if (this.facePos.isTracking) {
      this.lastFaceSeenAt = now;
    } else if (this.status === 'tracking' && now - this.lastFaceSeenAt > FACE_LOSS_GRACE_MS) {
      this.faceDetectionLossCount++;
      this.setStatus('face_lost');
    }
  }

  // Runtime validation that a landmark array actually has the topology this pipeline
  // depends on (478 points, valid iris/eyelid/nose indices with real numeric
  // coordinates) - added specifically because the inference backend changed (legacy
  // face_mesh -> tasks-vision FaceLandmarker in a Worker) and a silent topology
  // mismatch would otherwise show up only as subtly wrong gaze tracking, not a
  // reportable error. Runs once per result rather than assuming the migration's
  // landmark-index verification (docs/LANDMARK_MAPPING.md) holds forever - a future
  // model/library update could change this quietly.
  private hasWarnedTopology = false;

  private handleFaceMeshResults(results: { multiFaceLandmarks?: { x: number; y: number; z?: number }[][] }) {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      this.facePos.isTracking = false;
      // No face this frame - never let missing data read as "eyes closed" (see
      // DrowsinessDetector's face-loss handling doc).
      if (this.drowsinessEnabled) this.drowsinessDetector.notifyTrackingLost(performance.now());
      return;
    }

    const landmarks = results.multiFaceLandmarks[0];

    const topology = validateLandmarkTopology(landmarks);
    if (!topology.valid) {
      if (!this.hasWarnedTopology) {
        console.warn(`[WebcamTracker] ${topology.reason} See docs/LANDMARK_MAPPING.md.`);
        this.hasWarnedTopology = true;
      }
      // Fail safe: treat an incompatible result the same as "no face detected" rather
      // than risk computing a gaze position from wrong/missing landmarks.
      this.facePos.isTracking = false;
      this.setStatus('error', topology.reason ?? 'Face landmark output does not match the expected topology.');
      if (this.drowsinessEnabled) this.drowsinessDetector.notifyTrackingLost(performance.now());
      return;
    }

    const leftIris: Landmark = landmarks[LANDMARK.IRIS_LEFT];
    const rightIris: Landmark = landmarks[LANDMARK.IRIS_RIGHT];
    const noseTip: Landmark = landmarks[LANDMARK.NOSE_TIP] || landmarks[4];

    const eyeSpan = Math.abs(rightIris.x - leftIris.x) || 0.1;

    // Capture a reference distance on the first good frame after (re)calibration, so
    // later distance compensation has a "what distance was calibration done at"
    // baseline. Previously there was no distance compensation at all.
    if (!this.hasCapturedReferenceEyeSpan) {
      this.referenceEyeSpan = eyeSpan;
      this.hasCapturedReferenceEyeSpan = true;
    }

    const aperture = computeEyeAperture(landmarks, eyeSpan);
    this.lastAperture = aperture;

    const dt = this.frameTimestamps.length >= 2 ? (performance.now() - this.frameTimestamps[this.frameTimestamps.length - 1]) / 1000 : 1 / 30;

    const gazeResult = this.gazeProcessor.process({
      leftIris,
      rightIris,
      noseTip,
      eyeSpan,
      referenceEyeSpan: this.referenceEyeSpan,
      aperture,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      dt: Math.max(1 / 120, Math.min(1 / 5, dt)),
    });

    this.lastConfidence = gazeResult.confidence;
    this.lastRawOffset = { offsetX: gazeResult.rawOffsetX, offsetY: gazeResult.rawOffsetY };

    this.facePos = {
      x: gazeResult.x,
      y: gazeResult.y,
      rawX: (1.0 - (leftIris.x + rightIris.x) / 2) * 640,
      rawY: ((leftIris.y + rightIris.y) / 2) * 480,
      irisLeftX: leftIris.x * 640,
      irisLeftY: leftIris.y * 480,
      irisRightX: rightIris.x * 640,
      irisRightY: rightIris.y * 480,
      isTracking: true,
    };

    if (this.status !== 'tracking') this.setStatus('tracking');

    this.detectGestures(landmarks, noseTip, eyeSpan, aperture);

    if (this.drowsinessEnabled && aperture) {
      const mouthOpenRatio = computeMouthOpenRatio(landmarks, eyeSpan);
      this.drowsinessDetector.process({
        timestampMs: performance.now(),
        leftEyeAperture: aperture.leftAperture,
        rightEyeAperture: aperture.rightAperture,
        // Fall back to a closed-mouth-shaped ratio when mouth landmarks are
        // unavailable, rather than skipping the frame entirely - the eye-closure signal
        // this frame carries is still valid and worth feeding to the detector.
        mouthOpenRatio: mouthOpenRatio ?? 0,
        confidence: gazeResult.confidence,
        isTracking: true,
      });
    }
  }

  /** Real, landmark-derived blink level (0 open .. 1 closed) for the renderer's eyelids to follow. */
  public getBlinkLevel(): number {
    return this.lastAperture?.blinkLevel ?? 0;
  }

  /**
   * Snapshot of the most recent frame's raw (uncalibrated) gaze offset, for a
   * calibration UI to sample while the user looks at a known on-screen target - see
   * CalibrationModal.tsx. Returns null if no tracked frame has arrived yet.
   */
  public sampleRawOffset(): { offsetX: number; offsetY: number } | null {
    return this.lastRawOffset;
  }

  public getDiagnostics(): TrackerDiagnostics {
    const n = this.frameTimestamps.length;
    let fps = 0;
    if (n >= 2) {
      const spanMs = this.frameTimestamps[n - 1] - this.frameTimestamps[0];
      fps = spanMs > 0 ? ((n - 1) * 1000) / spanMs : 0;
    }
    const frameTimeMs = fps > 0 ? 1000 / fps : 0;
    const processorDiagnostics = this.gazeProcessor.getDiagnostics();
    const drowsiness = this.drowsinessEnabled ? this.drowsinessDetector.getState() : null;

    return {
      status: this.status,
      fps: Math.round(fps * 10) / 10,
      frameTimeMs: Math.round(frameTimeMs * 10) / 10,
      droppedFrames: this.droppedFrames,
      trackingConfidence: this.lastConfidence,
      faceDetectionLossCount: this.faceDetectionLossCount,
      gazeJitterPx: Math.round(processorDiagnostics.filteredJitter * 10) / 10,
      gazeLatencyMs: Math.round(this.lastGazeLatencyMs * 10) / 10,
      inferenceTimeMs: Math.round(this.lastInferenceTimeMs * 10) / 10,
      calibrationErrorPx: processorDiagnostics.calibrationError,
      framesHeldForBlink: processorDiagnostics.framesHeldForBlink,
      blinkCount: processorDiagnostics.blinkCount,
      gazeX: processorDiagnostics.lastGazeX,
      gazeY: processorDiagnostics.lastGazeY,
      drowsinessLevel: drowsiness?.level ?? null,
      drowsinessScore: drowsiness?.score ?? 0,
      drowsinessEyeClosureMs: drowsiness?.eyeClosureMs ?? 0,
      drowsinessRecentBlinkCount: drowsiness?.recentBlinkCount ?? 0,
      drowsinessProlongedBlinkCount: drowsiness?.prolongedBlinkCount ?? 0,
      drowsinessYawnCount: drowsiness?.yawnCount ?? 0,
    };
  }

  // AI Camera Gestures: head nod (confirm), head shake (cancel), smile (heart particles),
  // and left/right winks - all derived from the same 468-point mesh already being tracked.
  private detectGestures(
    landmarks: { x: number; y: number; z?: number }[],
    noseTip: { x: number; y: number },
    eyeSpan: number,
    aperture: EyeApertureResult | null
  ) {
    const now = Date.now();

    // --- Head Nod / Shake: track short-window nose position variance ---
    this.noseXHistory.push(noseTip.x);
    this.noseYHistory.push(noseTip.y);
    if (this.noseXHistory.length > 12) this.noseXHistory.shift();
    if (this.noseYHistory.length > 12) this.noseYHistory.shift();

    if (this.noseXHistory.length === 12 && now - this.lastGestureTime > this.gestureCooldownMs) {
      const xRange = Math.max(...this.noseXHistory) - Math.min(...this.noseXHistory);
      const yRange = Math.max(...this.noseYHistory) - Math.min(...this.noseYHistory);

      if (yRange > 0.035 && yRange > xRange * 1.4) {
        this.lastGestureTime = now;
        this.noseYHistory = [];
        this.gestureCallbacks.onGesture?.('nod');
      } else if (xRange > 0.045 && xRange > yRange * 1.4) {
        this.lastGestureTime = now;
        this.noseXHistory = [];
        this.gestureCallbacks.onGesture?.('shake');
      }
    }

    // --- Smile: mouth-corner-to-corner width vs vertical lip gap ---
    const mouthLeft = landmarks[61];
    const mouthRight = landmarks[291];
    const lipTop = landmarks[13];
    const lipBottom = landmarks[14];

    if (mouthLeft && mouthRight && lipTop && lipBottom) {
      const mouthWidth = Math.hypot(mouthRight.x - mouthLeft.x, mouthRight.y - mouthLeft.y);
      const lipGap = Math.hypot(lipBottom.x - lipTop.x, lipBottom.y - lipTop.y);
      const smileRatio = mouthWidth / (eyeSpan || 0.1);
      const nowSmiling = smileRatio > 2.35 && lipGap < eyeSpan * 0.5;

      if (nowSmiling && !this.isSmiling) {
        this.gestureCallbacks.onGesture?.('smile');
      }
      this.isSmiling = nowSmiling;
    }

    // --- Winks: reuse the same per-eye aperture GazeProcessor already computed for
    // blink-gating, so wink/blink classification and eyelid rendering can never
    // disagree with each other (previously these were three independent readings
    // of eye-openness: one for gaze gating [nonexistent], one for gestures, one
    // purely synthetic for rendering).
    if (aperture && !aperture.isBlinking) {
      const leftClosed = aperture.leftAperture < 0.12;
      const rightClosed = aperture.rightAperture < 0.12;

      if (leftClosed && !rightClosed && aperture.rightAperture > 0.2 && !this.isWinkingLeft) {
        this.gestureCallbacks.onGesture?.('wink_left');
      }
      if (rightClosed && !leftClosed && aperture.leftAperture > 0.2 && !this.isWinkingRight) {
        this.gestureCallbacks.onGesture?.('wink_right');
      }
      this.isWinkingLeft = leftClosed && !rightClosed;
      this.isWinkingRight = rightClosed && !leftClosed;
    } else {
      this.isWinkingLeft = false;
      this.isWinkingRight = false;
    }
  }
}

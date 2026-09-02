// High-Precision AI Iris & Pupil Gaze Tracker powered by Google MediaPipe Face Mesh

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

// Dynamically load MediaPipe CDN scripts to prevent Vite CJS bundling errors
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

export class WebcamTracker {
  private videoElement: HTMLVideoElement | null = null;
  private camera: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  private faceMesh: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  private stream: MediaStream | null = null;
  private isRunning = false;

  public facePos: FacePosition = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    isTracking: false,
    rawX: 320,
    rawY: 240,
  };

  // Tracking sensitivity multiplier (default: 4.0x)
  public sensitivity = 4.0;

  // Neutral Iris Baseline Calibration
  private baselineIrisX = 0.5;
  private baselineIrisY = 0.5;
  private isCalibrated = false;
  private calibrationFrames = 0;

  // Smoothed Screen Position
  private targetX = window.innerWidth / 2;
  private targetY = window.innerHeight / 2;
  private currentX = window.innerWidth / 2;
  private currentY = window.innerHeight / 2;

  // AI Camera Gestures
  public gestureCallbacks: GestureCallbacks = {};
  private noseXHistory: number[] = [];
  private noseYHistory: number[] = [];
  private lastGestureTime = 0;
  private readonly gestureCooldownMs = 1200;
  private isSmiling = false;
  private isWinkingLeft = false;
  private isWinkingRight = false;

  public async start(): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });

      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.stream;
      this.videoElement.width = 640;
      this.videoElement.height = 480;
      this.videoElement.play();

      this.recalibrate();

      // Load MediaPipe scripts dynamically if not present on window
      const win = window as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!win.FaceMesh) {
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');
      }
      if (!win.Camera) {
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
      }

      const FaceMeshConstructor = win.FaceMesh;
      const CameraConstructor = win.Camera;

      // Initialize MediaPipe Face Mesh Engine
      if (FaceMeshConstructor) {
        this.faceMesh = new FaceMeshConstructor({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });

        this.faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true, // Enables sub-pixel Iris Pupil tracking (landmarks 468-477)
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        this.faceMesh.onResults((results: any) => this.handleFaceMeshResults(results)); // eslint-disable-line @typescript-eslint/no-explicit-any
      }

      // Start Camera Processing Loop
      if (CameraConstructor && this.videoElement) {
        this.camera = new CameraConstructor(this.videoElement, {
          onFrame: async () => {
            if (this.isRunning && this.videoElement && this.faceMesh) {
              await this.faceMesh.send({ image: this.videoElement });
            }
          },
          width: 640,
          height: 480,
        });
        await this.camera.start();
      }

      this.isRunning = true;
      return true;
    } catch (err) {
      console.warn('MediaPipe Webcam Tracker initialization error:', err);
      return false;
    }
  }

  public recalibrate() {
    this.isCalibrated = false;
    this.calibrationFrames = 0;
    this.currentX = window.innerWidth / 2;
    this.currentY = window.innerHeight / 2;
  }

  public getStream(): MediaStream | null {
    return this.stream;
  }

  public stop() {
    this.isRunning = false;
    if (this.camera) {
      try { this.camera.stop(); } catch { /* ignore */ }
      this.camera = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.faceMesh) {
      try { this.faceMesh.close(); } catch { /* ignore */ }
      this.faceMesh = null;
    }
    this.facePos.isTracking = false;
  }

  private handleFaceMeshResults(results: { multiFaceLandmarks?: { x: number; y: number; z?: number }[][] }) {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      this.facePos.isTracking = false;
      return;
    }

    const landmarks = results.multiFaceLandmarks[0];

    // Landmark 468 = Left Iris Center, Landmark 473 = Right Iris Center
    const leftIris = landmarks[468] || landmarks[469] || landmarks[33];
    const rightIris = landmarks[473] || landmarks[474] || landmarks[263];
    const noseTip = landmarks[1] || landmarks[4];

    // Combined Iris Gaze Center (normalized 0.0 to 1.0)
    const irisAvgX = (leftIris.x + rightIris.x) / 2;
    const irisAvgY = (leftIris.y + rightIris.y) / 2;

    // Auto-calibrate neutral eye resting position (first 15 frames)
    if (!this.isCalibrated) {
      this.baselineIrisX = (this.baselineIrisX * this.calibrationFrames + irisAvgX) / (this.calibrationFrames + 1);
      this.baselineIrisY = (this.baselineIrisY * this.calibrationFrames + irisAvgY) / (this.calibrationFrames + 1);
      this.calibrationFrames++;
      if (this.calibrationFrames >= 15) {
        this.isCalibrated = true;
      }
    }

    // Gaze offset from baseline neutral center
    const gazeDeltaX = -(irisAvgX - this.baselineIrisX);
    const gazeDeltaY = irisAvgY - this.baselineIrisY;

    // Head orientation compensation using Nose Tip vs Eye Span
    const eyeSpan = Math.abs(rightIris.x - leftIris.x) || 0.1;
    const headYawOffset = (noseTip.x - (leftIris.x + rightIris.x) / 2) / eyeSpan;

    // Combine Iris Pupil movement + Head orientation vector
    const totalGazeX = gazeDeltaX + headYawOffset * 0.15;
    const totalGazeY = gazeDeltaY;

    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = window.innerHeight / 2;

    // Map to screen dimensions with sensitivity multiplier
    this.targetX = screenCenterX + totalGazeX * screenCenterX * this.sensitivity;
    this.targetY = screenCenterY + totalGazeY * screenCenterY * (this.sensitivity * 1.2);

    // Clamp to screen bounds
    this.targetX = Math.max(40, Math.min(window.innerWidth - 40, this.targetX));
    this.targetY = Math.max(40, Math.min(window.innerHeight - 40, this.targetY));

    // Smooth LERP interpolation (alpha = 0.2) for fast 60 FPS pupil response
    this.currentX += (this.targetX - this.currentX) * 0.2;
    this.currentY += (this.targetY - this.currentY) * 0.2;

    this.facePos = {
      x: this.currentX,
      y: this.currentY,
      rawX: (1.0 - irisAvgX) * 640,
      rawY: irisAvgY * 480,
      irisLeftX: leftIris.x * 640,
      irisLeftY: leftIris.y * 480,
      irisRightX: rightIris.x * 640,
      irisRightY: rightIris.y * 480,
      isTracking: true,
    };

    this.detectGestures(landmarks, noseTip, eyeSpan);
  }

  // AI Camera Gestures: head nod (confirm), head shake (cancel), smile (heart particles),
  // and left/right winks - all derived from the same 468-point mesh already being tracked.
  private detectGestures(
    landmarks: { x: number; y: number; z?: number }[],
    noseTip: { x: number; y: number },
    eyeSpan: number
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

      // Thresholds are normalized-coordinate deltas (face mesh space is 0..1).
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

    // --- Winks: per-eye vertical aperture (top/bottom lid landmarks) ---
    const leftTop = landmarks[159];
    const leftBottom = landmarks[145];
    const rightTop = landmarks[386];
    const rightBottom = landmarks[374];

    if (leftTop && leftBottom && rightTop && rightBottom) {
      const leftAperture = Math.abs(leftBottom.y - leftTop.y) / (eyeSpan || 0.1);
      const rightAperture = Math.abs(rightBottom.y - rightTop.y) / (eyeSpan || 0.1);

      const leftClosed = leftAperture < 0.12;
      const rightClosed = rightAperture < 0.12;

      // A wink is one eye closed while the other stays clearly open (excludes a full blink).
      if (leftClosed && !rightClosed && rightAperture > 0.2 && !this.isWinkingLeft) {
        this.gestureCallbacks.onGesture?.('wink_left');
      }
      if (rightClosed && !leftClosed && leftAperture > 0.2 && !this.isWinkingRight) {
        this.gestureCallbacks.onGesture?.('wink_right');
      }
      this.isWinkingLeft = leftClosed && !rightClosed;
      this.isWinkingRight = rightClosed && !leftClosed;
    }
  }
}

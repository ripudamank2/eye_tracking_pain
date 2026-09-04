// Runs MediaPipe HandLandmarker inference inside a dedicated Web Worker, off the main
// UI/render thread - the exact same architecture as faceLandmarkerWorker.ts (see that
// file's header for the full "why a Worker, why the ModuleFactory workaround" writeup;
// this file intentionally duplicates the pattern rather than trying to share code with
// it, since the two run independent MediaPipe task instances with different lifecycles
// and this repo has no existing precedent for a multi-task shared Worker).
//
// Protocol: identical shape to faceLandmarkerWorker's - the main thread posts a `frame`
// message containing an ImageBitmap (transferred, not copied) plus a timestamp; this
// worker runs detectForVideo and posts back only the small landmark-array result.

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export interface WorkerHandLandmark {
  x: number;
  y: number;
  z: number;
}

export type WorkerInboundMessage =
  | { type: 'init' }
  | { type: 'frame'; image: ImageBitmap; timestampMs: number }
  | { type: 'terminate' };

export type WorkerOutboundMessage =
  | { type: 'ready' }
  | { type: 'init_error'; message: string }
  | {
      type: 'result';
      landmarks: WorkerHandLandmark[][];
      handedness: { categoryName: string; score: number }[][];
      inferenceTimeMs: number;
      frameTimestampMs: number;
    }
  | { type: 'no_hand'; frameTimestampMs: number; inferenceTimeMs: number }
  | { type: 'frame_error'; message: string };

let handLandmarker: HandLandmarker | null = null;
let isInitializing = false;

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// Must match the installed @mediapipe/tasks-vision npm version (see package.json) - same
// reasoning as faceLandmarkerWorker.ts's identical constant.
const TASKS_VISION_VERSION = '1.0.1';

// Same real, currently-reproducing upstream bug and the same community-verified fix as
// faceLandmarkerWorker.ts's preloadWasmModuleFactory - see that file for the full
// explanation. Duplicated here (not imported) because Workers cannot share module-level
// mutable state or a running Wasm runtime instance across separate Worker globals - each
// Worker is a fully independent JS environment.
async function preloadWasmModuleFactory(wasmLoaderPath: string): Promise<void> {
  const response = await fetch(wasmLoaderPath);
  const scriptText = await response.text();
  // eslint-disable-next-line no-eval
  (0, eval)(scriptText);
}

async function createLandmarker(delegate: 'GPU' | 'CPU') {
  const vision = await FilesetResolver.forVisionTasks(
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`
  );

  await preloadWasmModuleFactory(vision.wasmLoaderPath);
  // @ts-expect-error - see faceLandmarkerWorker.ts's identical line for why this is deleted.
  delete vision.wasmLoaderPath;

  return HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO',
    numHands: 1,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

async function initialize() {
  if (handLandmarker || isInitializing) return;
  isInitializing = true;

  try {
    handLandmarker = await createLandmarker('GPU');
  } catch (gpuErr) {
    try {
      handLandmarker = await createLandmarker('CPU');
    } catch (cpuErr) {
      const msg: WorkerOutboundMessage = {
        type: 'init_error',
        message: `GPU delegate failed (${gpuErr instanceof Error ? gpuErr.message : gpuErr}); CPU fallback also failed (${cpuErr instanceof Error ? cpuErr.message : cpuErr})`,
      };
      self.postMessage(msg);
      isInitializing = false;
      return;
    }
  }

  const msg: WorkerOutboundMessage = { type: 'ready' };
  self.postMessage(msg);
  isInitializing = false;
}

self.onmessage = async (event: MessageEvent<WorkerInboundMessage>) => {
  const data = event.data;

  if (data.type === 'init') {
    await initialize();
    return;
  }

  if (data.type === 'terminate') {
    handLandmarker?.close();
    handLandmarker = null;
    self.close();
    return;
  }

  if (data.type === 'frame') {
    if (!handLandmarker) {
      data.image.close();
      const msg: WorkerOutboundMessage = { type: 'frame_error', message: 'HandLandmarker not initialized' };
      self.postMessage(msg);
      return;
    }

    try {
      const start = performance.now();
      const result = handLandmarker.detectForVideo(data.image, data.timestampMs);
      const inferenceTimeMs = performance.now() - start;

      // ImageBitmaps are not automatically freed - this Worker owns releasing the one
      // the main thread transferred, same contract as faceLandmarkerWorker.ts.
      data.image.close();

      if (!result.landmarks || result.landmarks.length === 0) {
        const msg: WorkerOutboundMessage = { type: 'no_hand', frameTimestampMs: data.timestampMs, inferenceTimeMs };
        self.postMessage(msg);
        return;
      }

      const landmarks: WorkerHandLandmark[][] = result.landmarks.map((hand) =>
        hand.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z }))
      );
      const handedness = result.handedness.map((hand) =>
        hand.map((cat) => ({ categoryName: cat.categoryName, score: cat.score }))
      );

      const msg: WorkerOutboundMessage = {
        type: 'result',
        landmarks,
        handedness,
        inferenceTimeMs,
        frameTimestampMs: data.timestampMs,
      };
      self.postMessage(msg);
    } catch (err) {
      data.image.close();
      const msg: WorkerOutboundMessage = { type: 'frame_error', message: err instanceof Error ? err.message : String(err) };
      self.postMessage(msg);
    }
  }
};

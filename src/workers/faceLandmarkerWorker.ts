// Runs MediaPipe FaceLandmarker inference inside a dedicated Web Worker, off the main
// UI/render thread. This is the fix for the measured main-thread contention (render FPS
// dropping from 60 to ~19-26 while the legacy @mediapipe/face_mesh library ran inference
// synchronously on the main thread - see KNOWN_ISSUES.md / PROJECT_STATUS.md).
//
// Why the legacy library couldn't do this: @mediapipe/face_mesh calls
// document.createElement/document.body.appendChild/window[...] unconditionally at
// construction time, which throw in a Worker's global scope (no `document`/`window`
// there). @mediapipe/tasks-vision's FaceLandmarker was built with Worker-context
// detection (checks `typeof importScripts` and `OffscreenCanvas` before ever touching
// `document`), so it can actually run here - verified in docs/LANDMARK_MAPPING.md rather
// than assumed.
//
// Protocol: the main thread posts a `frame` message containing an ImageBitmap
// (transferred, not copied - no serialization cost for the pixel data) plus a
// timestamp; this worker runs detectForVideo and posts back only the small
// landmark-array result, never the frame itself. Sending only the derived data (not
// echoing the image back) is deliberate - the whole point of the Worker is reducing
// main-thread work, so shipping a full-resolution image back across the boundary would
// partially defeat that.

import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

export interface WorkerLandmark {
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
  | { type: 'result'; landmarks: WorkerLandmark[][]; inferenceTimeMs: number; frameTimestampMs: number }
  | { type: 'no_face'; frameTimestampMs: number; inferenceTimeMs: number }
  | { type: 'frame_error'; message: string };

let faceLandmarker: FaceLandmarker | null = null;
let isInitializing = false;

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// This version string MUST match the installed @mediapipe/tasks-vision npm version
// (see package.json) - there is no version-negotiation between the CDN wasm assets and
// the bundled JS, so a mismatch is a real (if secondary) bug risk here.
const TASKS_VISION_VERSION = '1.0.1';

// --- "ModuleFactory not set." workaround --------------------------------------------
// A real, currently-still-reproducing bug, not a hypothetical: @mediapipe/tasks-vision
// (confirmed still present in the installed 1.0.1, despite an upstream maintainer
// stating 0.10.35+ fixed it - see google-ai-edge/mediapipe#5257) loads its WASM glue
// script via `importScripts()`, which throws a TypeError inside a module-type Worker
// (`new Worker(url, { type: 'module' })` - required here because this file itself uses
// ES `import` syntax to pull in FilesetResolver/FaceLandmarker). The library's own
// catch-and-fallback for that TypeError uses dynamic `import()` on the glue script -
// but that script is a classic script (`var ModuleFactory = ...`, no `export`
// statement), so importing it as an ES module produces an empty module namespace and
// `ModuleFactory` never actually gets attached to `self`, however you slice it.
//
// The fix used here (community-verified across multiple independent reports on the
// same GitHub issue): fetch the glue script's source as text and `eval` it directly,
// which executes it as a classic script in this Worker's global scope, correctly
// setting the real global `ModuleFactory` the same way `importScripts` would if it
// weren't blocked in a module Worker. `wasmLoaderPath` is then deleted from the
// fileset object so the library's own internal `$h()` loader sees it's already been
// handled and skips trying to load it again itself.
async function preloadWasmModuleFactory(wasmLoaderPath: string): Promise<void> {
  const response = await fetch(wasmLoaderPath);
  const scriptText = await response.text();
  // Indirect eval (the `(0, eval)` / `eval?.()` form) runs in global scope rather than
  // the enclosing function's local scope - required for `var ModuleFactory = ...` at
  // the top of the fetched script to actually attach to `self`. Necessary evil: the
  // fetched content is MediaPipe's own official WASM loader glue, served from the CDN
  // URL this worker itself requested via FilesetResolver - not third-party or
  // user-controlled input. See the comment above this function for why this is
  // required at all (a real, currently-open upstream MediaPipe/module-Worker bug).
  // eslint-disable-next-line no-eval
  (0, eval)(scriptText);
}

async function createLandmarker(delegate: 'GPU' | 'CPU') {
  const vision = await FilesetResolver.forVisionTasks(
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`
  );

  await preloadWasmModuleFactory(vision.wasmLoaderPath);
  // @ts-expect-error - deliberately clearing this so FaceLandmarker's internal loader
  // treats the WASM module factory as already provided and does not attempt to load
  // the (module-Worker-incompatible) script again itself.
  delete vision.wasmLoaderPath;

  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO',
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  });
}

async function initialize() {
  if (faceLandmarker || isInitializing) return;
  isInitializing = true;

  // Prefer GPU delegate for inference throughput, but this environment cannot verify
  // WebGL-in-Worker behavior across all target hardware/browsers - fall back to CPU
  // delegate rather than leaving tracking entirely broken if GPU init fails for any
  // reason (unsupported context, driver issue, etc).
  try {
    faceLandmarker = await createLandmarker('GPU');
  } catch (gpuErr) {
    try {
      faceLandmarker = await createLandmarker('CPU');
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
    faceLandmarker?.close();
    faceLandmarker = null;
    self.close();
    return;
  }

  if (data.type === 'frame') {
    if (!faceLandmarker) {
      data.image.close();
      const msg: WorkerOutboundMessage = { type: 'frame_error', message: 'FaceLandmarker not initialized' };
      self.postMessage(msg);
      return;
    }

    try {
      const start = performance.now();
      const result = faceLandmarker.detectForVideo(data.image, data.timestampMs);
      const inferenceTimeMs = performance.now() - start;

      // ImageBitmaps are not automatically freed - the caller (main thread) transferred
      // ownership here, so this Worker is responsible for releasing it once done.
      data.image.close();

      if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
        const msg: WorkerOutboundMessage = { type: 'no_face', frameTimestampMs: data.timestampMs, inferenceTimeMs };
        self.postMessage(msg);
        return;
      }

      // Strip `visibility` and re-pack as plain objects - keeps the postMessage payload
      // minimal (478 points x a few numbers, not MediaPipe's full internal result
      // object) per the "don't send large unnecessary objects" requirement.
      const landmarks: WorkerLandmark[][] = result.faceLandmarks.map((face) =>
        face.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z }))
      );

      const msg: WorkerOutboundMessage = { type: 'result', landmarks, inferenceTimeMs, frameTimestampMs: data.timestampMs };
      self.postMessage(msg);
    } catch (err) {
      data.image.close();
      const msg: WorkerOutboundMessage = { type: 'frame_error', message: err instanceof Error ? err.message : String(err) };
      self.postMessage(msg);
    }
  }
};

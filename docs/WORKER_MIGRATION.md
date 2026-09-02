# FaceLandmarker Web Worker Migration

Records what was done, measured, and found while moving MediaPipe face-landmark
inference off the main UI thread - the fix for the measured render-loop contention
documented in the engineering audit. See docs/LANDMARK_MAPPING.md for the landmark-index
verification performed before this migration touched any code.

## Why the legacy library couldn't do this

`@mediapipe/face_mesh` (the previous inference backend) calls `document.createElement`,
`document.body.appendChild`, and `window[a] = b` unconditionally at module-load and
construction time. None of those exist in a Worker's global scope, so the legacy library
throws immediately if constructed there - it was never built with Worker support.
`@mediapipe/tasks-vision`'s `FaceLandmarker` was built with Worker-context detection
(checks `typeof importScripts`/`OffscreenCanvas` before ever touching `document`), which
is what made this migration possible at all - verified by reading the installed
package's actual bundled source, not assumed from its marketing description.

## What changed

- **New:** `src/workers/faceLandmarkerWorker.ts` - runs `FaceLandmarker.detectForVideo()`
  inside a dedicated module Worker.
- **New:** `src/services/FaceLandmarkerWorkerClient.ts` - main-thread client that
  captures video frames as `ImageBitmap`s (via `OffscreenCanvas`) and transfers them into
  the Worker; posts a new frame only when the Worker isn't still busy with the previous
  one (no backlog queueing).
- **Changed:** `src/services/WebcamTracker.ts` - replaced the legacy
  `FaceMesh`/`Camera` construction and the `await faceMesh.send(...)` call (which
  blocked the main thread for the full inference duration) with the Worker client. Added
  a `validateLandmarkTopology` gate (in `GazeProcessor.ts`, unit-tested) that fails safe
  - treats an unexpected landmark shape the same as "no face detected" - rather than
  risk computing gaze from wrong/missing landmarks if a future library update changes
  the output topology.
- **Unchanged:** `GazeProcessor.ts`'s entire gaze/calibration/blink pipeline, every
  `LANDMARK.*` index, and all 45 existing unit tests. This is by design - see
  docs/LANDMARK_MAPPING.md for why the same indices are correct for both backends, and
  the "backend-equivalence" test added to `GazeProcessor.test.ts` that proves
  `GazeProcessor`'s output is identical whether fed landmark data shaped like the legacy
  API's or the new API's (the only structural difference being an extra `visibility`
  field tasks-vision includes that this pipeline never reads).

## A real bug hit and fixed during this migration: "ModuleFactory not set."

Not a hypothetical caveat - this fully blocked the Worker from initializing at first.
Root cause, in order of investigation:

1. `@mediapipe/tasks-vision`'s WASM loader script (`vision_wasm_internal.js`) is loaded
   via `importScripts()` internally - but `importScripts` is not available inside a
   **module**-type Worker (`new Worker(url, { type: 'module' })`), which this file
   requires because it uses ES `import` syntax to pull in `FilesetResolver`/
   `FaceLandmarker`.
2. The library's own code catches the resulting `TypeError` and falls back to dynamic
   `import()` of the same script - this is the officially-shipped fix (confirmed present
   in the installed `tasks-vision@1.0.1`, and matches the fix an upstream Google
   engineer described as resolving the issue as of `0.10.35`+ in
   [google-ai-edge/mediapipe#5257](https://github.com/google-ai-edge/mediapipe/issues/5257)).
3. **That fallback does not actually work for this asset.** The WASM loader script is a
   **classic script** (`var ModuleFactory = (() => {...})()`, no `export` statement).
   Dynamic `import()` parses its target as an ES module; a module's top-level `var`
   declarations are scoped to that module, not attached to the global object, and are
   never exposed without an explicit `export`. So `import()` "succeeds" (throws nothing)
   but produces a module namespace with nothing useful in it - `self.ModuleFactory`
   genuinely never gets set, which is exactly the error message describes. This was
   confirmed by fetching the actual script and inspecting it directly (see
   docs/LANDMARK_MAPPING.md's verification methodology), not inferred from the error
   message alone.
4. The actual, working fix - found via the same GitHub issue's comment thread, where
   multiple independent developers hit this same gap in the "official" fix and converged
   on the same workaround: fetch the loader script's source as **text**, then execute it
   with indirect `eval` (`(0, eval)(scriptText)`), which runs it as a genuine classic
   script in the Worker's global scope - correctly attaching `ModuleFactory` to `self`
   the same way `importScripts` would if it weren't blocked. See
   `preloadWasmModuleFactory()` in `faceLandmarkerWorker.ts` for the implementation and
   its inline documentation.

This is flagged as a maintenance risk, not just a solved problem: it depends on
`eval`-ing a remote script (mitigated by that script being MediaPipe's own official CDN
asset, fetched from a URL this code itself constructs - not user- or third-party-
controlled input) and on the current internal structure of that script (a classic,
non-module file) not changing in a future `@mediapipe/tasks-vision` release. If MediaPipe
ships a real fix upstream, this workaround should be removed - watch
[the GitHub issue](https://github.com/google-ai-edge/mediapipe/issues/5257) for further
updates, since it's marked closed but this migration's own testing shows the closure's
claimed fix version does not fully resolve it in practice.

## GPU delegate: requested, not confirmed running

`createLandmarker()` requests `delegate: 'GPU'` first, falling back to `'CPU'` only if
GPU initialization throws. In this sandboxed testing environment (software-rendered via
`--use-gl=swiftshader`, no real GPU), the GPU attempt did not throw at the JS level, but
MediaPipe's own internal graph runtime logged `Created TensorFlow Lite XNNPACK delegate
for CPU` - meaning it selected CPU inference regardless, likely because true GPU compute
isn't available under software rendering. **This means every FPS/latency number measured
in this pass reflects CPU-only inference in a heavily constrained sandbox.** A real
machine with a real GPU should perform measurably better; this was not and could not be
measured here. Don't read the numbers below as a ceiling - they're a floor.

## Measured results (before / after)

Both captured using this project's own `DiagnosticsRecorder` (Ctrl+Shift+D → Start →
~10s of activity with the webcam pipeline active against Chrome's synthetic fake-camera
device → Stop & Export), the same methodology, same synthetic input, same sandboxed
CPU-only environment - a fair, like-for-like comparison even though neither number
reflects real-hardware or real-face performance.

| Metric | Before (legacy face_mesh, main thread) | After (tasks-vision, Worker) |
|---|---|---|
| Avg render FPS | **19.1** | **50.1** (a separate run measured 53.5 - session variance) |
| Min render FPS | 15.1 | 48.3 |
| Avg frame time | 53.2 ms | 20.0 ms |
| p95 frame time | 100.1 ms | 33.5 ms |
| Dropped frames (~10-12s sample) | 643 | 125 |
| Avg camera/inference FPS | 15.1 | 17.5 |
| Avg gaze round-trip latency | 53.2 ms | 59.3 ms |

**Read honestly:** render FPS improved roughly 2.6-2.8x and dropped frames fell by
~80%, directly confirming the Worker migration achieves its goal of decoupling
rendering from inference. Gaze round-trip latency did **not** improve, and this pass's
one after-run measured it slightly higher (59.3ms vs. 53.2ms) - the `postMessage`
boundary in both directions plus `ImageBitmap` creation adds real overhead the legacy
synchronous call didn't have. This is an expected, acceptable tradeoff for the
architecture (60ms latency is still well within interactive-use range), not something to
paper over: **moving work off the main thread does not make that work faster or lower-
latency; it makes the thread that matters for rendering stop waiting for it.** Camera/
inference FPS (17.5Hz) is now genuinely decoupled from and no longer bottlenecks render
FPS - this project's `WebcamTracker` capture loop posts frames as fast as it can, and the
Worker processes them as fast as it can, with neither blocking the other.

## What this migration did NOT change, verify, or fix

- **Gaze accuracy against a real face** - not tested; no physical camera in this
  environment. Every number above comes from a synthetic geometric test pattern with no
  detectable face (confirmed by `avgTrackingConfidence: 0` and status staying
  `"starting"` throughout every capture) or from synthetic landmark fixtures in unit
  tests. See docs/REAL_CAMERA_VALIDATION.md - unchanged and still the required next step.
- **GPU-accelerated inference performance** - see above; only CPU delegate was actually
  exercised.
- **Native Electron behavior of this specific change** - the Worker/`OffscreenCanvas`/
  `ImageBitmap` APIs used here are standard Chromium APIs, so they should work
  identically inside Electron's renderer process, but this was not separately verified
  natively for this migration (see PROJECT_STATUS.md → Native Electron Verification for
  what native testing has and hasn't covered).
- **Long-running session behavior** (memory growth in the Worker over hours, WASM heap
  behavior, `ImageBitmap` lifecycle correctness across thousands of frames) - not tested
  at that scale this pass.

# Project Status

Tracks the README's feature roadmap against what's actually implemented and verified in
this repository. Updated 2026-09-02.

Legend: ✅ Complete &nbsp; 🟡 Partial &nbsp; 🔴 Not implemented &nbsp; ⚠️ Blocked &nbsp; 🔧 Needs verification

## Architecture (current)

- **Frontend:** React 19 + TypeScript, rendered on a single full-screen `<canvas>` inside
  [src/App.tsx](src/App.tsx). No routing, no backend, no persistence beyond
  `localStorage`-free in-memory state — this is a single-page desktop/browser overlay, not
  a client-server app, and does not need one for anything on the roadmap.
- **Rendering:** [src/engine/EyeEngine.ts](src/engine/EyeEngine.ts) (eyes, themes,
  expressions, eyebrows) and [src/engine/ParticleEngine.ts](src/engine/ParticleEngine.ts)
  (trails, particles, gravity wells, heatmaps) are plain classes driven by a single
  `requestAnimationFrame` loop in `App.tsx`. Adding a feature almost always means adding a
  case to one of these two classes plus a bit of state/wiring in `App.tsx`.
- **Gaze pipeline (new this pass):** [src/engine/GazeProcessor.ts](src/engine/GazeProcessor.ts)
  is a pure, unit-tested module owning all gaze signal processing — a One-Euro adaptive
  jitter filter, multi-point calibration (least-squares gain fit), head yaw+pitch
  compensation, distance compensation, and blink-aware gaze gating. `WebcamTracker` is now
  a thin hardware adapter that feeds it real landmarks; previously these concerns were all
  tangled together inside `WebcamTracker`'s MediaPipe results callback with no way to fix
  or test any one of them independently.
- **Diagnostics (new this pass):** [src/engine/RenderDiagnostics.ts](src/engine/RenderDiagnostics.ts)
  tracks render-loop FPS/frame-time/dropped-frames on a rolling window;
  `WebcamTracker.getDiagnostics()` reports camera-pipeline FPS, tracking confidence,
  face-loss count, gaze jitter, gaze latency, and calibration error. Surfaced in
  [DiagnosticsPanel.tsx](src/components/DiagnosticsPanel.tsx) via Ctrl+Shift+D. Both poll
  on a fixed low-frequency interval rather than pushing React state every render frame,
  specifically to avoid the diagnostics themselves becoming a performance problem.
- **Inference (rewritten):** face-landmark inference runs in a dedicated Web Worker
  ([src/workers/faceLandmarkerWorker.ts](src/workers/faceLandmarkerWorker.ts)) using
  `@mediapipe/tasks-vision`'s `FaceLandmarker`, replacing the legacy
  `@mediapipe/face_mesh` library that ran synchronously on the main thread and measurably
  blocked the render loop. [src/services/FaceLandmarkerWorkerClient.ts](src/services/FaceLandmarkerWorkerClient.ts)
  is the main-thread client (frame capture via `OffscreenCanvas`/`ImageBitmap`, transferred
  into the Worker). See docs/WORKER_MIGRATION.md for the full writeup, measured
  before/after numbers, and a real upstream MediaPipe bug that had to be worked around.
- **Services:** `src/services/*` wrap browser/OS capabilities behind small classes —
  `WebcamTracker` (now a thin adapter over the Worker client + gesture detection +
  calibration), `AudioSynth` (Web Audio SFX, theremin, music-reactive pulse),
  `VoiceController` (Web Speech API, multilingual), `GazeRecorder` (MediaRecorder canvas
  capture).
- **Desktop runtime:** two independent Electron entry points —
  [electron/main.cjs](electron/main.cjs) (full Studio window) and
  [electron/widget-main.cjs](electron/widget-main.cjs) (standalone always-on-top dock
  widget with its own IPC cursor stream). Both load the same React bundle via Vite's
  multi-entry build (`index.html` / `widget.html`).
- **Tests:** Vitest ([vitest.config.ts](vitest.config.ts)), covering `GazeProcessor`,
  `RenderDiagnostics`, and `DiagnosticsRecorder` — the modules whose logic is pure enough
  to test without a real camera. Run with `npm test`. 45 tests total.

This is deliberately *not* microservices, not a database-backed app, and has no
authentication — none of the roadmap features need that, and adding it would be scope
invented beyond what the product actually is.

## Active Feature Modules (pre-existing, confirmed working)

All items in the README's "Active Feature Modules" section were already implemented
before this pass: MediaPipe iris tracking, 7 base eye themes, organic blinking, tears +
eye-break lock, draggable eyes + 6 position presets, presenter spotlight, laser reticle,
particle trails/sprites, Web Audio SFX, voice commands (English), odometer analytics, and
the gaze target shooter mini-game.

## Master Feature & AI Roadmap — status

### 💖 Cute Emotion & Expression Engine
| Feature | Status |
|---|---|
| Crying eyes & eye-strain safety lock | ✅ (pre-existing) |
| Happy / Smiling eyes (`^ ^`) | ✅ — auto-detected on circular cursor motion or rapid click bursts, plus a manual trigger. `EyeEngine.drawHappySquint` |
| Love / Heart pupil mode | ✅ — manual trigger + auto-fires on AI camera smile gesture. `EyeEngine.drawLoveHeartPupil` |
| Animated eyebrows | ✅ — surprised/focused/sleepy moods, manual triggers in Studio Controls. `EyeEngine.drawEyebrow` |
| Gaze eye-contact reaction (blush/smile) | 🟡 — the smile-gesture → Love-mode reaction path exists; a dedicated "sustained eye contact" detector (as opposed to a discrete smile) was not built separately, since it would duplicate the same landmark signal without adding a distinct user-visible behavior |

### 🎨 Creative Eye Themes & Custom Designer
| Feature | Status |
|---|---|
| Anime Heart eyes | ✅ `EyeEngine.drawAnimeHeart` |
| Dragon / Reptile eyes | ✅ `EyeEngine.drawDragon` |
| Cosmic Galaxy eyes | ✅ `EyeEngine.drawGalaxy` |
| Matrix Code Rain eyes | ✅ `EyeEngine.drawMatrixRain` |
| Fiery Flame eyes | ✅ `EyeEngine.drawFlame` |
| In-App Custom Eye Studio | ✅ [EyeStudioModal.tsx](src/components/EyeStudioModal.tsx) — live pupil/iris/glow customizer backed by the `'custom'` theme |

### 🎵 Musical Eye Theremin & Audio Visualizer
| Feature | Status |
|---|---|
| Musical Eye Theremin | ✅ `AudioSynth.startTheremin/updateTheremin` — gaze X → pitch, Y → vibrato depth |
| Music Reactive Pupil Pulse | ✅ `AudioSynth.getMusicPulseLevel` (mic-based bass-band analysis) → pupil scale in `EyeEngine` |

### 🌈 Mood-Adaptive Trails & Black Hole Physics
| Feature | Status |
|---|---|
| Speed-Adaptive Particle Trails | ✅ `ParticleEngine.speedToColor` |
| Gravity Well Black Hole FX | ✅ `ParticleEngine.spawnGravityWell/drawGravityWells` |

### 📸 Gaze Screen Recorder & Multilingual Voice
| Feature | Status |
|---|---|
| Gaze Overlay GIF/MP4 Recorder | ✅ (WebM, not GIF/MP4 — see Known Issues) [GazeRecorder.ts](src/services/GazeRecorder.ts) |
| Multilingual Voice Commands | ✅ en/es/ja/fr/de/hi keyword maps in `VoiceController` |

### 🧠 Emotion AI & Mood Synchronization
| Feature | Status |
|---|---|
| AI Mood & Facial Expression Sync | 🟡 — heuristic version only (see Known Issues); full sentiment classification is ⚠️ blocked, needs a trained model beyond raw face-mesh geometry |
| AI Drowsiness & Yawn Safety Guard | 🔴 not implemented this pass — buildable as a heuristic (blink-rate + mouth-aperture over time) but not built; would extend `WebcamTracker.detectGestures` |

### 🎯 AI Intent Pointer & Smart Gestures
| Feature | Status |
|---|---|
| AI Target Snap-to-Button | ⚠️ Blocked — needs OS accessibility-tree access (AT-SPI/UI Automation/AX API), not available to a browser/Electron renderer. Interface stub: `AccessibilityTargetProvider` in [futureFeatures.ts](src/services/futureFeatures.ts) |
| AI Camera Gestures (nod/shake/smile/wink) | ✅ `WebcamTracker.detectGestures` |

### 🧠 Subconscious Pupillometry & Attention Analysis
| Feature | Status |
|---|---|
| Cognitive Load & Focus Heatmap | 🟡 — implemented as a gaze-**dwell-time** heatmap (`drawAttentionHeatmap` in App.tsx), which is the honest buildable proxy from cursor/gaze position alone. True pupillometry-based cognitive load needs dedicated eye-tracking hardware — a consumer webcam cannot measure pupil dilation reliably enough for this; not claimed as done |
| Reading Speed & Dyslexia Assistance | ⚠️ Blocked — auto-scrolling "any document on screen" needs either browser-extension-level DOM access to arbitrary pages or the same accessibility-tree access as above; out of reach for an overlay app |

### 🤖 Multimodal Vision AI
| Feature | Status |
|---|---|
| AI Gaze Scene Explainer | ⚠️ Blocked — needs a vision-capable LLM API (external service + API key). Interface stub: `SceneExplainerProvider` in `futureFeatures.ts` |
| AI Reading Assistant | ⚠️ Blocked — same dependency, plus arbitrary-page DOM access |

### 🔮 5-Year Vision Horizon
| Feature | Status |
|---|---|
| Spatial 3D Holographic Eyes (WebXR/AR/VR) | ⚠️ Blocked — needs AR/VR hardware (Vision Pro / Quest). Interface stub: `XrEyeRenderer` |
| Brain-Computer Interface Hybrid | ⚠️ Blocked — needs BCI hardware + vendor SDK. Interface stub: `BciInputProvider` |
| Autonomous AI Screen Companion | 🔴 Research-grade / open-ended — not a scoped feature; would need continuous screen understanding + an agent loop, well beyond "implement now" |

## Core Eye Engine Audit (this pass)

A prior pass added roadmap features; this pass paused new features to audit and fix the
underlying gaze-tracking pipeline. Full findings, fixes, and honest remaining gaps are in
the top-level engineering report below this file (see the conversation's final summary,
or ask for it to be re-published). Short version:

**Root causes found and fixed:**
- No landmark-level jitter filtering (only a fixed-alpha LERP on the final coordinate) →
  replaced with a One-Euro adaptive filter in `GazeProcessor`, verified in tests to
  measurably reduce jitter versus raw input.
- No blink-gaze gating → a blink's occluded iris landmarks used to feed straight into the
  tracked position; `GazeProcessor.process` now holds the last good position during a
  detected blink, verified in tests.
- Rendered eyelids were a fully synthetic, untracked timer animation → replaced with the
  real landmark-derived blink level (`EyeOptions.realBlinkLevel`) when webcam tracking is
  active; the synthetic animation remains as the mouse-only fallback (there's no eyelid
  signal to follow without a camera).
- Single-point, one-shot calibration with a hardcoded sensitivity constant → multi-point
  (5-point) calibration with a real least-squares gain fit, exposed as a UI flow
  (`CalibrationModal`), plus distance compensation via `eyeSpan` (previously nonexistent —
  sensitivity was correct only at whatever distance the user happened to calibrate at).
- Head compensation only handled yaw (left/right turn); pitch (up/down nod) was
  uncompensated, degrading Y-axis accuracy under normal head movement. Now compensates both.
- Camera failures collapsed into one generic `alert()`; disconnection mid-session (device
  unplugged, permission revoked) was undetectable. Now distinguishes
  permission-denied/no-device/disconnected via a `MediaStreamTrack 'ended'` listener, and
  tracking loss holds the last known gaze position instead of silently falling back to a
  potentially very stale mouse coordinate.
- Window resize left the smoothing filter's internal state (in old-size pixel space)
  briefly lagging toward the new scale; now resets on resize for a clean one-frame
  reprojection.
- `stop()` didn't reset gesture-detection history, risking a false gesture firing
  immediately on a restarted session.

**Diagnostics added:** FPS, frame time (avg/p95), dropped frames, tracking confidence,
face-detection-loss count, gaze jitter (px), gaze latency (ms), calibration error (px), JS
heap — see DiagnosticsPanel (Ctrl+Shift+D) and Architecture above.

**What this audit could NOT verify**, and does not claim to have fixed, because this
environment has no physical webcam: real-world gaze accuracy in degrees or pixels against
an actual human face, behavior across real lighting conditions, or accuracy across real
physical distances. All of the fixes above are architecturally sound and unit-tested
against synthetic landmark data, but "the math is correct" and "this is accurate enough
for a real user" are different claims — only the first is verified here. See "What Remains
Unreliable" below.

**A real, measured finding from that pass, since fixed:** MediaPipe face-mesh inference
ran synchronously on the same JS thread as the render loop, measurably dropping render
FPS from 60 to ~19-26 while tracking was active. Fixed in the follow-up pass below by
migrating inference to a Web Worker.

## Real-Camera Validation Tooling + Worker Migration (this pass)

Two things, per explicit instruction to fix the measured FPS problem properly (moving
inference off-thread) rather than hide it (e.g. by throttling), and to build real
validation tooling before claiming the gaze pipeline production-ready:

**1. Real-camera validation tooling** (this environment still has no physical webcam, so
this is tooling for a human to run, not a result this pass can produce itself):
- `DiagnosticsRecorder` ([src/engine/DiagnosticsRecorder.ts](src/engine/DiagnosticsRecorder.ts)) -
  timestamps diagnostics samples + discrete events into an exportable session (JSON +
  CSV), with objective summary stats including per-face-loss recovery time (measured
  from actual status transitions, not eyeballed).
- A 20-phase guided validation script built into `DiagnosticsPanel` (Start → step through
  center/left/right/up/down/diagonal gaze, head tilt, near/far distance, normal/rapid
  blinking, eye closure, face-loss recovery, lighting change → Stop & Export), each phase
  droppable as a timestamped marker so results can be sliced per-condition.
- Written protocol: [docs/REAL_CAMERA_VALIDATION.md](docs/REAL_CAMERA_VALIDATION.md) -
  what each phase tests and which specific fix it validates.
- **This tooling has not yet been run against a real face** - that's the next required
  step, not something this pass could complete without a camera.

**2. Web Worker migration for MediaPipe inference** (fixes the FPS finding above):
- Migrated from `@mediapipe/face_mesh` (main-thread only, no Worker support) to
  `@mediapipe/tasks-vision`'s `FaceLandmarker`, run inside a dedicated Worker. Full
  writeup: [docs/WORKER_MIGRATION.md](docs/WORKER_MIGRATION.md).
- **Landmark indices verified, not assumed**, against MediaPipe's own official reference
  diagram before any code changed - see [docs/LANDMARK_MAPPING.md](docs/LANDMARK_MAPPING.md).
  Conclusion: the existing indices (468/473 for iris, 159/145/386/374 for eyelids, etc.)
  are correct for both the old and new backend and required no changes; `GazeProcessor`'s
  45 existing tests plus 6 new migration-specific tests (topology validation +
  backend-equivalence) confirm this.
- **A real upstream MediaPipe bug was hit and fixed**: `FaceLandmarker` failed to
  initialize in a module-type Worker with "ModuleFactory not set." - a confirmed,
  still-reproducing issue even in the version an upstream Google engineer said fixed it.
  Worked around by fetching MediaPipe's own WASM loader script as text and executing it
  via indirect `eval` rather than the library's own (non-functional, for this specific
  asset) dynamic-`import()` fallback. See docs/WORKER_MIGRATION.md for the full
  investigation and why this is flagged as an ongoing maintenance risk, not a permanent fix.
- **Measured, not assumed, before/after** (same synthetic-fake-camera methodology,
  captured via this project's own DiagnosticsRecorder): avg render FPS **19.1 → 50-53**;
  p95 frame time **100.1ms → 33.5ms**; dropped frames **643 → 83-125** over a comparable
  ~10-12s sample. All measured under CPU-only inference (GPU delegate did not actually
  engage in this sandboxed environment) - a real GPU should do better, unmeasured here.
- **What did not improve:** gaze round-trip latency (one run measured it slightly worse,
  ~53ms → ~59ms) - the Worker `postMessage` boundary has real overhead. Accepted,
  expected tradeoff, not hidden.
- Runtime topology validation added (`validateLandmarkTopology` in `GazeProcessor.ts`) so
  a future silent landmark-shape change from either backend fails safe (treated as "no
  face detected") instead of silently computing wrong gaze positions.

## Native Electron Verification

An earlier session in this repo's history concluded Electron could not launch at all in
this environment after seeing every `BrowserWindow` creation attempt segfault. That
conclusion was wrong — the actual cause was a corrupted/incomplete Electron binary
extraction, unrelated to this app's code. After fixing the local Electron installation:

| Check | Status |
|---|---|
| App launches, window renders | ✅ Verified — real window at native desktop resolution (1857×1051), loaded from `file://`, eyes rendered correctly |
| Webcam permission grant | ✅ Verified — via Chrome's fake-camera-device flag + an auto-accepting permission handler |
| MediaPipe pipeline activates natively | ✅ Verified — `WebcamPreview`'s live crosshair tracked motion in the synthetic video feed; diagnostics correctly reported "Starting…" / 0% confidence against the non-face test pattern (did not claim tracking that wasn't happening) |
| New Calibration UI appears/gates correctly | ✅ Verified — "Calibrate Gaze" button correctly appears only once webcam is active |
| Standalone widget launches | 🟡 Partial — window opened, its own React app mounted and logged a correct first frame, but the capture used to confirm this was too small to visually verify eye rendering |
| Microphone permission | 🔴 Not tested this session |
| Global-cursor IPC in the widget | 🔴 Not tested this session (widget launched, but the specific IPC cursor stream wasn't separately exercised) |
| Real human face / real gaze accuracy | ⚠️ Cannot be tested — no physical webcam in this environment |
| Long-running session (memory growth, drift over hours) | 🔴 Not tested — would need a multi-hour unattended run this session didn't perform |

## Tests

Vitest, 26 tests across `GazeProcessor.test.ts` and `RenderDiagnostics.test.ts` — run with
`npm test`. Coverage: eye-aperture/blink classification (including missing-landmark and
zero-eyeSpan boundary cases), calibration curve fitting (including degenerate
zero-variance input), head yaw+pitch compensation, distance compensation direction, blink
hold/resume behavior, confidence degradation at extreme head yaw, NaN/Infinity safety
across degenerate inputs, and that the jitter filter measurably reduces jitter versus raw
noisy input (deterministic PRNG, not `Math.random()`, for reproducibility).

This does **not** cover: React component rendering (no `@testing-library/react`/jsdom
setup), real MediaPipe inference behavior, or anything requiring actual camera hardware.
See Known Issues → "Test coverage is real but narrow."

Also still true from the previous pass: `tsc --noEmit` and `npm run build` are clean;
`oxlint` shows only pre-existing warnings.

## Security

No new attack surface was introduced this pass beyond what a calibration UI and
diagnostics panel inherently are (no new IPC channels, no new network calls, no new
persisted data). The pre-existing Electron `nodeIntegration: true` / `contextIsolation:
false` configuration was not touched and remains a known hardening gap — see Known Issues.

## Remaining Work (priority order)

1. **Run the real-camera validation protocol against an actual human face** — the single
   highest-priority remaining item. All tooling exists
   (docs/REAL_CAMERA_VALIDATION.md, the 20-phase guided script, JSON/CSV export); it has
   not been run, because this environment has no physical webcam. Nothing else on this
   list matters if this reveals the underlying tracking is inaccurate.
2. Measure GPU-delegate performance on real hardware — every FPS/latency number from the
   Worker migration was measured under forced CPU-only inference in this sandbox.
3. **AI Drowsiness/Yawn Guard** (🔴, from the roadmap pass) — buildable as a heuristic
   extension of `WebcamTracker.detectGestures`; still not built.
4. Test the standalone widget's global-cursor IPC stream and microphone permission flow
   natively — not reached this session.
5. A multi-hour long-running session check for memory growth/drift, specifically
   including the new Worker (WASM heap growth, `ImageBitmap` lifecycle over thousands of
   frames) — not performed at that scale.
6. Watch [google-ai-edge/mediapipe#5257](https://github.com/google-ai-edge/mediapipe/issues/5257)
   for a real upstream fix to the module-Worker "ModuleFactory not set." bug, and remove
   the `eval`-based workaround in `faceLandmarkerWorker.ts` once one ships.
7. Electron `nodeIntegration`/`contextIsolation` hardening (pre-existing, not introduced by
   any pass so far, but worth a dedicated security pass).
8. C/D-tier roadmap items remain blocked on external dependencies as documented in
   ROADMAP.md and `src/services/futureFeatures.ts`.

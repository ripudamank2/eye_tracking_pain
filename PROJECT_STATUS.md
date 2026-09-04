# Project Status

Tracks the README's feature roadmap against what's actually implemented and verified in
this repository. Updated 2026-09-04.

Legend: ✅ Complete &nbsp; 🟡 Partial &nbsp; 🔴 Not implemented &nbsp; ⚠️ Blocked &nbsp; 🔧 Needs verification

**Core eye engine completion: ~72%.** Up slightly from a prior ~70% estimate that
predates any real-camera data. The math/architecture layer (filtering, calibration
model, head compensation, diagnostics) is sound and now has 48 unit tests plus, for the
first time, real evidence from an actual human face - which is what surfaced and got four
real bugs fixed this pass (silent calibration failure, contaminated session counters,
blink false-positive rate, render/camera FPS coupling). The percentage moved up modestly
because real bugs were found *and fixed*, not because accuracy has been proven - the one
number that would justify a much higher score (calibrated real-face gaze accuracy in
pixels/degrees) still has not been measured, because the only real-camera session run so
far had a silently-broken calibration. That re-run is the top remaining item (see
"Remaining Work" below) and is likely to move this number again, in either direction.

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
| Drowsiness & Eye-Fatigue Guard | ✅ Heuristic (see "Drowsiness & Eye-Fatigue Guard" section below) — **explicitly not a medical/sleep-diagnostic system**, framed in the UI as a wellness/productivity reminder |

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

## Drowsiness & Eye-Fatigue Guard (2026-09-04)

A heuristic wellness/productivity reminder, **not a medical device** — it does not
diagnose sleep disorders, fatigue disorders, or any medical condition. This is stated
explicitly in the UI (a visible disclaimer in the settings panel) and here.

**Architecture:** a new pure, timestamp-driven detector,
[src/engine/DrowsinessDetector.ts](src/engine/DrowsinessDetector.ts), consumes signals
the gaze pipeline already computes every frame (`computeEyeAperture`'s per-eye aperture,
already used for blink-gaze gating; the same mouth-corner/lip landmarks
`WebcamTracker.detectGestures` already uses for smile detection, normalized into a mouth-
open ratio against `eyeSpan`) — **no new MediaPipe model or inference pipeline was
added**. It is driven from a single new call inside
`WebcamTracker.handleFaceMeshResults`, immediately after the existing
`detectGestures(...)` call, and an explicit pause call on the existing no-face/topology-
failure early-return paths. `GazeProcessor.ts`, calibration, the One-Euro filter, gaze
coordinate mapping, head yaw/pitch compensation, `FaceLandmarkerWorkerClient.ts`,
`faceLandmarkerWorker.ts`, camera lifecycle, and blink-gaze gating were **not modified**.

**Signals and scoring:** continuous eye-closure duration, rolling-window blink frequency,
repeated long closures, and duration-gated yawn detection (open → sustained ≥700ms →
cooldown, filtering talking/laughing) feed a small additive score, mapped to
normal/attention/warning/critical via hysteresis (hold time required both to rise and to
fall) so noisy single frames can't flip the level. Face-loss and low-confidence frames are
explicitly excluded from scoring (`notifyTrackingLost`) rather than read as closed eyes.
No separate architecture doc was written for this feature — the detector file's own doc
comments and this section are the canonical explanation.

**Defaults** (Normal sensitivity — see `SENSITIVITY_PRESETS` in `useDrowsinessGuard.ts`
for Low/High): eye-closure warning 1200ms, critical 2500ms, long-blink 500ms, blink-rate
window 60s / threshold 35, yawn open-threshold ratio 0.55, yawn minimum duration 700ms,
yawn cooldown 5s, min-confidence gate 0.35, tracking-loss reset 4s. **These are explicit
product heuristics, not physiologically validated constants** — see Known Issues for what
still needs real-camera tuning (the same caveat this repo already applies to every other
webcam-heuristic feature).

**Product controls** (Studio Controls → Drowsiness & Eye-Fatigue Guard, or its own
settings panel): enable/disable (off by default), sensitivity (Low/Normal/High), voice
warning on/off, eye-break reminder on/off, automatic break on/off (**off by default** —
never auto-triggers the existing Eye Break/OS-lock system without the user opting in).
Reuses the existing `triggerEyeBreak`/`EyeBreakModal`/speech-synthesis infrastructure
rather than building a second lock system; notification side effects (voice, warning
banner) go through a per-level cooldown (warning 60s, critical 120s) in
`useDrowsinessGuard.ts` so a sustained state doesn't repeatedly re-fire.

**Diagnostics:** `WebcamTracker.getDiagnostics()` exposes `drowsinessLevel`, `-Score`,
`-EyeClosureMs`, `-RecentBlinkCount`, `-ProlongedBlinkCount`, `-YawnCount` (null/0 when
the guard is disabled). Threaded into both `DiagnosticsPanel` and the real-camera
`ValidationScreen`'s JSON/CSV export, with `drowsinessYawnCount` baselined at Start
Recording the same way `blinkCount`/`faceDetectionLossCount` already are — this is the
exact class of bug found and fixed in the first real-camera validation pass (see above);
applying that lesson here rather than repeating it.

**Tests:** 28 new unit tests in `DrowsinessDetector.test.ts` (eye closure incl. noise
rejection, blink frequency incl. rolling-window expiry, yawn detection incl. talking/
laughing false-positive rejection and cooldown, combined-signal scoring, face-loss/low-
confidence handling, hysteresis, and `computeMouthOpenRatio`). All pre-existing tests
(48) still pass — 76/76 total. Verified running end-to-end against a fake-camera device
(no physical webcam in this environment, same limitation as the rest of this project's
webcam-dependent code): the guard enables/disables correctly, the settings panel renders
correctly, and — critically — correctly reports "Normal" with zero readings the entire
time against a synthetic non-face test pattern, rather than fabricating a drowsy reading
from missing data.

**Known limitation, same as every other webcam heuristic in this project:** none of the
thresholds above have been tuned against a real human face yet — this needs a real-camera
validation pass (the tooling for that already exists, see "First Real-Camera Validation
Run" above) before any claim about false-positive/false-negative rate in practice.

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

## First Real-Camera Validation Run (2026-09-04) — findings and fixes

The guided validation screen (`ValidationScreen.tsx`, Ctrl+Shift+V) was run against a
real laptop webcam and a real human face for the first time — a ~108-second session
covering the full 22-phase guided script. This is the first data in this project's
history that isn't from a synthetic fake-camera device. It surfaced four real, distinct
bugs, all now fixed:

**1. Silent calibration failure (real, confirmed bug).** The exported
`calibrationErrorPx` was `null` for the entire session despite the user having run the 5-
point calibration flow beforehand. Root cause: `CalibrationModal`'s "Apply Calibration"
button is silently `disabled` (just visually dimmed) whenever fewer than 2 of the 5
points captured a valid sample — with no blocking message explaining why, a user can
walk through the full flow, believe they calibrated, and have it silently no-op. Fixed:
the modal now shows an explicit red "will NOT be applied" message when under 2 points are
collected, and an amber "applied but accuracy may be lower" message when some (but not
all) points were skipped. Also fixed a related data-quality bug: `sampleRawOffset()`
returned the last known offset even during `face_lost` status (never cleared), so a brief
tracking dropout during a target hold could silently bake a stale, wrong offset into that
point's average instead of being excluded — sampling now only accepts a point while
`getStatus() === 'tracking'`.

**2. Session-relative counters were actually tracker-lifetime-cumulative (bug introduced
by, and fixed within, this same pass).** `blinkCount`, `framesHeldForBlink`,
`faceDetectionLossCount`, and dropped-frame counts reset only when `WebcamTracker.start()`
runs, not when a validation recording starts — so a session that began recording after
webcam tracking had already been running for a while (e.g. through the "Get ready" phase)
had pre-recording activity baked into its very first exported sample (confirmed: the
first sample already showed `blinkCount: 74` at `t=94ms`). Fixed: `ValidationScreen` now
captures a baseline snapshot of these counters at "Start Recording" and reports/exports
deltas, matching what a validation session should actually measure.

**3. Blink false-positive rate too high (real, confirmed by the user against actual
blinking).** Even after correcting for finding #2, the corrected in-session rate was
~1 blink/1.3s - about 2-3x normal resting blink rate, confirmed too high by the user.
Root cause: `computeEyeAperture`'s `isBlinking` was a single-frame threshold
(`aperture < 0.12`) with no debounce, so a single noisy frame from real-camera landmark
jitter (never present in the synthetic fixtures this was tuned against) could register as
a full blink. Fixed in `GazeProcessor`: discrete blink *counting* now requires the closed-
aperture signal to hold for 2+ consecutive frames (`rawClosedFrameStreak`) before firing,
eliminating single-frame noise as a false positive. Gaze-position holding and confidence
still react to the raw per-frame aperture immediately (not debounced) - occluded landmarks
are unreliable the instant the aperture closes, and delaying that specifically let noisy
blink-time landmarks leak further into the smoothing filter than acceptable (caught by a
regression test during this fix, see `GazeProcessor.test.ts`).

**4. Render FPS coupled to camera FPS despite the Worker migration (real architectural
finding).** The Worker migration moved MediaPipe *inference* off the main thread, but
`FaceLandmarkerWorkerClient.postFrame()` still called `OffscreenCanvas` + `drawImage(video,
...)` synchronously on the main thread to *capture* each frame before sending it to the
Worker. Against the synthetic fake-camera test pattern (all prior FPS measurements), this
was cheap and invisible. Against a real webcam video stream, real-camera validation data
showed render FPS visibly sagging in lockstep with camera FPS - i.e. still coupled to
capture cost, not just inference. Fixed: `postFrame` now prefers `createImageBitmap(video)`
for capture, which browsers are permitted to (and Chromium does) decode off the main
thread, with the old `OffscreenCanvas`/`drawImage` path kept only as a fallback for
engines where `createImageBitmap` throws or is unavailable. Not yet re-measured against a
real camera (needs a follow-up validation run) - the fix is architecturally sound and
verified not to break the capture pipeline (checked via fake-camera end-to-end run:
webcam pipeline still activates, tracks, and produces landmarks correctly), but the actual
FPS improvement this produces on real hardware is unconfirmed.

**What this run could NOT validate, because calibration never actually applied (finding
#1) - a from-scratch clean re-run is required:** real gaze *accuracy* (calibrated
pixel/degree error), whether jitter/latency/dropped-frames look reasonable under
correctly-calibrated conditions, and whether the corrected blink-count fix produces a
plausible rate end-to-end. 19 face-loss events occurred in 108s with recovery times
ranging 205ms-5.4s (inconsistent, not yet root-caused - worth watching on the next run).
Recorded diagnostics genuinely worked end-to-end (JSON+CSV export, per-phase markers,
live HUD) and gave usable evidence for finding real bugs even from a session that turned
out to have a broken calibration state, which is itself a meaningful validation of the
tooling.

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

### Native Electron re-verification after the Worker migration (this pass)

The table above predates the Web Worker migration (`@mediapipe/tasks-vision` +
`FaceLandmarker`, see docs/WORKER_MIGRATION.md). Re-tested natively (real
`./node_modules/electron/dist/electron`, not headless Chrome) with a fake camera device:

| Check | Status |
|---|---|
| Worker-based inference initializes natively | ✅ Verified — same `XNNPACK delegate for CPU` log signature as the browser test, "AI Camera Eye Tracking: ON" reached, live crosshair tracking the fake video feed |
| Native render FPS with Worker active | ✅ Measured **156.9 FPS**, 6.4ms avg frame time, 6 dropped frames, 72.5Hz camera/inference rate, 13.9ms gaze latency — markedly better than the ~50-53fps measured in headless Chrome. Flagged as measured-but-not-fully-understood: this may reflect Electron's renderer not being vsync-throttled the same way a browser tab is under `capturePage()`-driven testing, not necessarily "Electron is 3x faster" as a general claim |
| Window resize | ✅ Verified — resized 1857×1051 → 1000×700 and back; page stayed responsive, DOM intact, no crash |
| Webcam stop → restart cycle within one session | ✅ Verified — toggled ON → OFF → ON; Worker correctly terminated and recreated each time with no stale-state crash |
| Application restart (fresh process, twice) | ✅ Verified — two consecutive clean 15s launch/shutdown cycles, zero errors in either |
| Microphone permission (`getUserMedia({audio:true})`) | ✅ Verified — real fake audio track returned (`"Fake Default Audio Input"`, `live` state) with no thrown error |
| Widget global-cursor IPC channel | 🟡 Partial — confirmed the channel is wired and fires (1 real event delivered when the OS cursor position first differs from the uninitialized baseline), but sustained streaming under actual cursor movement could not be verified: this environment has no OS-level input injection tool (`xdotool` not installed), and Playwright's `mouse.move()` only synthesizes DOM events, not real OS cursor motion, which is what the widget's `screen.getCursorScreenPoint()` polling reads |
| Real human face / real gaze accuracy | ⚠️ Still cannot be tested — no physical webcam in this environment (unchanged) |

## Long-Run Stability (this pass, bounded)

Not a multi-hour test — this session cannot run unattended for hours between turns, so
"long-run" here means the longest bounded automated soak achievable in one continuous
tool call: **~4 minutes (238s) of continuous simulated activity** (webcam tracking
active against a fake camera, particle-trail FX enabled, cursor moving continuously,
periodic clicks to spawn particle bursts) in the browser dev server.

**Result:** zero errors across the full run; JS heap oscillated between ~23MB and ~51MB
with no sustained upward trend (consistent with normal GC cycling, not a leak at this
timescale); canvas and app remained fully responsive at the end.

**A real bug found and fixed by this testing**, not by inspection: `DiagnosticsRecorder`'s
summary computation used `Math.max(...samples)` / `Math.min(...samples)` (spread syntax),
which throws `RangeError: Maximum call stack size exceeded` once the sample array is
large enough to exceed the JS engine's function-argument limit. This did not surface
during the 4-minute soak (too few samples), but was caught by a unit test written
specifically to exercise the newly-added 200,000-sample cap - meaning a real, sufficiently
long recording session would have crashed on `stop()`/export before this fix. Fixed by
replacing the spread-based `Math.max`/`Math.min` with `Array.reduce()`, which has no
argument-count limit. Also added the 200,000-sample cap itself (~14 hours at the default
poll rate) so an accidentally-forgotten multi-day recording cannot grow the in-memory
array without bound - previously there was no cap at all.

**What this does NOT verify:** actual multi-hour or multi-day behavior, WASM heap growth
inside the FaceLandmarker Worker specifically over very long real-camera sessions, or
`ImageBitmap` lifecycle correctness across the hundreds of thousands of frames a real
multi-hour session would produce. These remain genuinely untested.

## Tests

Vitest, **76 tests** across `GazeProcessor.test.ts`, `RenderDiagnostics.test.ts`,
`DiagnosticsRecorder.test.ts`, and `DrowsinessDetector.test.ts` (28 new tests, see
"Drowsiness & Eye-Fatigue Guard" above) — run with `npm test`. Coverage: eye-aperture/blink
classification (including missing-landmark and zero-eyeSpan boundary cases), calibration
curve fitting (including degenerate zero-variance input), head yaw+pitch compensation,
distance compensation direction, blink hold/resume behavior including the 2-frame
debounce for discrete blink *counting* versus immediate (non-debounced) position-hold and
confidence reaction to raw per-frame aperture (added this pass after real-camera
validation data showed a single-frame count gate produced an implausible blink rate),
confidence degradation at extreme head yaw, NaN/Infinity safety across degenerate inputs,
the jitter filter measurably reducing jitter versus raw noisy input (deterministic PRNG,
not `Math.random()`, for reproducibility), landmark-topology validation for the Worker
migration (including a backend-equivalence check proving `GazeProcessor` behaves
identically regardless of which MediaPipe API produced the landmarks), and
`DiagnosticsRecorder`'s recovery-time/time-in-status computation and sample-count cap —
the last of which caught a real `RangeError` (spread-based `Math.max`/`Math.min`
exceeding the JS engine's argument limit on a large array) before it could ship, see
Long-Run Stability above.

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

1. **Re-run the real-camera validation protocol against an actual human face, from a
   clean calibrated state.** The first real-camera run (2026-09-04, see above) found and
   fixed four real bugs, but never actually measured *calibrated* gaze accuracy — its
   calibration silently failed to apply due to bug #1 above. This is still the single
   highest-priority remaining item: nothing else matters if a correctly-calibrated
   session reveals the underlying tracking is inaccurate. Also re-check: whether the
   blink-count fix (#3 above) now produces a plausible rate, whether render FPS actually
   decouples from camera FPS with the `createImageBitmap` fix (#4 above), and the 19
   face-loss events / inconsistent recovery times (205ms-5.4s) from the first run, which
   were not root-caused.
2. Measure GPU-delegate performance on real hardware — every FPS/latency number from the
   Worker migration was measured under forced CPU-only inference in this sandbox (MediaPipe
   selected CPU/XNNPACK even when GPU was requested, likely because true GPU compute isn't
   available under this sandbox's software rendering).
3. A genuine multi-hour (not 4-minute) long-running session check, specifically watching
   the FaceLandmarker Worker's WASM heap over that timescale against a real camera feed -
   this pass's 4-minute automated soak found and fixed one real bug (see Long-Run
   Stability above) but cannot stand in for actual multi-hour behavior.
4. Watch [google-ai-edge/mediapipe#5257](https://github.com/google-ai-edge/mediapipe/issues/5257)
   for a real upstream fix to the module-Worker "ModuleFactory not set." bug, and remove
   the `eval`-based workaround in `faceLandmarkerWorker.ts` once one ships.
5. Verify the widget's global-cursor IPC stream under actual sustained cursor movement -
   this pass confirmed the channel is wired and fires (one real event), but this sandbox
   has no OS-level input injection tool (`xdotool` not installed) to move the real OS
   cursor and observe continuous streaming.
6. **Tune the Drowsiness & Eye-Fatigue Guard's thresholds against a real human face** (✅
   built this pass, see above) — every default (eye-closure warning/critical durations,
   blink-rate threshold, yawn duration/threshold) is a documented product heuristic, not
   validated against real blinking/yawning/lighting. Same real-camera validation tooling
   already built for the gaze pipeline applies here.
7. Electron `nodeIntegration`/`contextIsolation` hardening (pre-existing, not introduced by
   any pass so far, but worth a dedicated security pass).
8. C/D-tier roadmap items remain blocked on external dependencies as documented in
   ROADMAP.md and `src/services/futureFeatures.ts`.

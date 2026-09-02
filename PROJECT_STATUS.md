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
- **Services:** `src/services/*` wrap browser/OS capabilities behind small classes —
  `WebcamTracker` (MediaPipe face mesh + gestures + calibration adapter), `AudioSynth` (Web
  Audio SFX, theremin, music-reactive pulse), `VoiceController` (Web Speech API,
  multilingual), `GazeRecorder` (MediaRecorder canvas capture).
- **Desktop runtime:** two independent Electron entry points —
  [electron/main.cjs](electron/main.cjs) (full Studio window) and
  [electron/widget-main.cjs](electron/widget-main.cjs) (standalone always-on-top dock
  widget with its own IPC cursor stream). Both load the same React bundle via Vite's
  multi-entry build (`index.html` / `widget.html`).
- **Tests:** Vitest ([vitest.config.ts](vitest.config.ts)), covering `GazeProcessor` and
  `RenderDiagnostics` — the two modules whose logic is pure enough to test without a real
  camera. Run with `npm test`.

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

**A real, measured finding, not fixed this pass:** MediaPipe face-mesh inference runs
synchronously on the same JS thread as the render loop. With the diagnostics panel open
during active (fake-camera-driven) webcam tracking, render FPS measurably dropped from a
steady 60.0 to ~26 with dropped frames accumulating. The fix (running inference in a Web
Worker) is a real architectural change, not attempted here — see Known Issues.

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

1. **Move MediaPipe inference off the main thread** (Web Worker) — the one concretely
   measured performance problem from this pass's diagnostics; real architectural change,
   not started.
2. **Verify with a real human face and real camera hardware** — everything in this pass
   was validated against synthetic landmark fixtures (tests) or a synthetic fake-camera
   test pattern (native/browser runs). Real-world gaze accuracy is unverified.
3. **AI Drowsiness/Yawn Guard** (🔴, from the roadmap pass) — buildable as a heuristic
   extension of `WebcamTracker.detectGestures`; still not built.
4. Test the standalone widget's global-cursor IPC stream and microphone permission flow
   natively — not reached this session.
5. A multi-hour long-running session check for memory growth/drift — not performed.
6. Electron `nodeIntegration`/`contextIsolation` hardening (pre-existing, not introduced by
   either pass, but worth a dedicated security pass).
7. C/D-tier roadmap items remain blocked on external dependencies as documented in
   ROADMAP.md and `src/services/futureFeatures.ts`.

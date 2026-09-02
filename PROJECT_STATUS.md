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
- **Services:** `src/services/*` wrap browser/OS capabilities behind small classes —
  `WebcamTracker` (MediaPipe face mesh + gestures), `AudioSynth` (Web Audio SFX, theremin,
  music-reactive pulse), `VoiceController` (Web Speech API, multilingual), `GazeRecorder`
  (MediaRecorder canvas capture).
- **Desktop runtime:** two independent Electron entry points —
  [electron/main.cjs](electron/main.cjs) (full Studio window) and
  [electron/widget-main.cjs](electron/widget-main.cjs) (standalone always-on-top dock
  widget with its own IPC cursor stream). Both load the same React bundle via Vite's
  multi-entry build (`index.html` / `widget.html`).

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

## Tests

No test harness exists in this repository (no Jest/Vitest/Playwright config, no `test`
script in package.json). Verification for this pass was done by:
- `tsc --noEmit` (clean, zero errors) and `npm run build` (clean, multi-entry Vite build)
- `oxlint` (only pre-existing warnings, no new errors)
- Manual browser-driven verification via Playwright against the Vite dev server:
  screenshotted all 5 new themes, both new expressions, animated eyebrows (all 3 moods),
  the Eye Studio modal, speed-adaptive trails, gravity well FX, and a full
  start-record → stop-record → verify-downloaded-webm round trip. Zero console/page
  errors across all of the above.
- Voice/theremin/gesture code paths were verified by direct code review plus toggling
  them live in-browser to confirm no runtime errors from the Web Audio / Speech API graph
  construction; a *native* Electron desktop run to confirm actual global-cursor and
  camera-hardware behavior was not performed (see Known Issues — this repo's Electron
  build cannot be launched from this environment; needs verification on your machine).

Adding a real test harness (Vitest for the engine classes' pure logic, e.g.
`speedToColor`, `detectGestures` thresholds) is recommended future work but was out of
scope for "implement the roadmap features" — see Remaining Work.

## Security

No new attack surface was introduced: no new IPC channels, no new network calls, no new
persisted data. `GazeRecorder` and `AudioSynth`'s music-reactivity path request
camera/microphone permission through the standard browser prompt, same as the pre-existing
`WebcamTracker`. The pre-existing Electron `nodeIntegration: true` / `contextIsolation:
false` configuration (in both `main.cjs` and `widget-main.cjs`) was not touched by this
pass and remains a known hardening gap — see Known Issues.

## Remaining Work (priority order)

1. **Verify on a real desktop session.** This pass's browser-based verification is strong
   evidence the rendering/logic works, but the actual Electron app (global cursor IPC,
   camera permission dialog, mic permission dialog under Electron specifically) has not
   been run natively — see Known Issues for why.
2. **AI Drowsiness/Yawn Guard** (🔴) — buildable now as a heuristic extension of
   `WebcamTracker.detectGestures` (blink-rate over a rolling window + mouth-aperture
   check); not built this pass, next logical A-tier item.
3. Add a real test harness (Vitest) for the pure-logic pieces:
   `ParticleEngine.speedToColor`, `WebcamTracker.detectGestures` thresholds,
   `AudioSynth.getMusicPulseLevel` band math.
4. Electron `nodeIntegration`/`contextIsolation` hardening (pre-existing, not introduced
   by this pass, but worth a dedicated security pass — see Known Issues).
5. C/D-tier items remain blocked on external dependencies as documented above and in
   `src/services/futureFeatures.ts`; revisit if/when those dependencies become available
   (an LLM vision API key, AR/VR hardware for testing, BCI hardware).

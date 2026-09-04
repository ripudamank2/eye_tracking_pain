# Roadmap

This restates the README's feature roadmap classified by what's realistically buildable,
and points to [PROJECT_STATUS.md](PROJECT_STATUS.md) for current implementation state.
See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for caveats on what "done" means for a few items.

## Classification key

- **A — Buildable now:** fits the current Electron/React/TypeScript architecture, no new
  dependency needed.
- **B — Buildable with a dependency:** needs one reasonable added library, no architecture
  change.
- **C — Needs external hardware/platform/API:** blocked on something this app cannot
  supply itself (AR/VR headset, BCI device, a hosted vision-LLM API, an OS
  accessibility-tree API).
- **D — Future research:** not realistically buildable to production quality with today's
  consumer hardware/techniques.

## A/B backlog — implemented this pass

- Happy/Smiling eyes, Love/Heart pupil mode, Animated eyebrows *(A)*
- Cosmic Galaxy, Fiery Flame, Dragon/Reptile, Matrix Code Rain, Anime Heart themes *(A)*
- In-App Custom Eye Studio *(A)*
- Speed-Adaptive Trails, Gravity Well Black Hole FX *(A)*
- AI Camera Gestures: nod, shake, smile, wink *(A — reuses existing face-mesh landmarks)*
- Multilingual Voice Commands (en/es/ja/fr/de/hi) *(A — Web Speech API's `lang` covers all six natively)*
- Musical Eye Theremin, Music Reactive Pupil Pulse *(A — Web Audio API, no new dependency)*
- Gaze Overlay Screen Recorder *(A — native `MediaRecorder`, exports WebM; see Known Issues for GIF/MP4 gap)*
- Cognitive-Load/Focus Heatmap *(A, as a gaze-dwell-time proxy — see Known Issues for what this is not)*

## A/B backlog — implemented this pass (2)

- **Drowsiness & Eye-Fatigue Guard** *(A)* — heuristic prolonged-closure/blink-frequency/
  yawn detector with a temporal scoring model and hysteresis, in
  `src/engine/DrowsinessDetector.ts` (pure, unit-tested), driven from
  `WebcamTracker.handleFaceMeshResults`'s existing eye-aperture + mouth-landmark data —
  not a new inference pipeline. See PROJECT_STATUS.md for the full writeup and
  KNOWN_ISSUES.md for its heuristic-nature disclaimer. Explicitly **not** a medical/sleep
  diagnostic system — framed in the UI as a wellness/productivity reminder.

## A/B backlog — not yet built

- **Gaze eye-contact "sustained" reaction** *(A, minor)* — currently the smile gesture
  triggers Love mode; a distinct "held eye contact for N seconds" detector was not built
  separately since it would reuse the same signal without new user-visible behavior. Worth
  doing only if product feedback says the smile-triggered version isn't what people expect.
- **GIF/MP4 export for the screen recorder** *(B)* — needs `ffmpeg.wasm` or a native
  transcode step; not pulled in without confirming the WASM payload size is acceptable.

## C — blocked on external dependencies

Each has an integration-boundary interface already defined in
[src/services/futureFeatures.ts](src/services/futureFeatures.ts) so a real implementation
has a seam to plug into:

- **AI Gaze Scene Explainer / Reading Assistant** — needs a hosted vision-capable LLM API
  (API key + network dependency; a real product decision, not an engineering one).
- **AI Mood & Facial Expression Sync** (full classifier) — needs a trained sentiment model;
  the current heuristic gesture detection is the honest A-tier approximation.
- **AI Target Snap-to-Button** — needs OS accessibility-tree access (AT-SPI on Linux, UI
  Automation on Windows, AX API on macOS); not reachable from a browser/Electron renderer.
- **Reading Speed & Dyslexia Assistance** — needs the same accessibility-tree access, or
  browser-extension-level DOM access to arbitrary pages.
- **Spatial 3D Holographic Eyes (WebXR)** — needs AR/VR hardware (Vision Pro, Quest) to
  build and test against.
- **Brain-Computer Interface Hybrid** — needs BCI hardware + a vendor SDK.

## D — future research

- **Autonomous AI Screen Companion** — open-ended agent behavior (continuous screen
  understanding + conversational interaction + code-review suggestions). Not a scoped
  feature; would need its own product/architecture decision before "implementing" makes
  sense, not just more engineering time.
- **True subconscious pupillometry** — consumer webcams do not have the resolution or
  frame-rate consistency for genuine cognitive-load-from-pupil-dilation measurement; this
  needs dedicated eye-tracking hardware, not a software improvement.

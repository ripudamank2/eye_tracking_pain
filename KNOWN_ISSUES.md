# Known Issues

## Air Touch controls only Eye Tracker Studio's own window, not the real OS cursor

See PROJECT_STATUS.md → "Air Touch / Hand Control V1" for the full writeup. Short
version: this repository has no native OS input-injection capability on any platform
today (no `robotjs`/`nut-js`/similar dependency; the existing Electron window is
permanently click-through with only cursor *polling*, never injection). Air Touch V1's
`InAppSystemInputProvider` moves a virtual cursor and dispatches synthetic DOM events
within this app's own window - genuinely working, but not system-wide. Do not present
Air Touch as controlling the desktop or other applications until a real
`SystemInputProvider` backend is built per-platform (see PROJECT_STATUS.md's Platform
status table for what each of Windows/macOS/Linux X11/Linux Wayland would actually
require - Wayland in particular cannot be done the same way as the other three at all).

A future native backend must be wired through a dedicated `contextBridge`-isolated
preload script, not the existing `window.require('electron')` pattern the rest of the
app currently uses (see the next entry) - do not extend the unsafe pattern to cover
programmatic mouse/keyboard control, which is a meaningfully higher-risk capability to
expose to an unrestricted renderer than the app's existing IPC surface.

## Air Touch gesture thresholds are unvalidated heuristics

Same caveat as the Drowsiness & Eye-Fatigue Guard entry below and every other webcam
heuristic in this project: pinch-close/open distances, drag-start distance, and
confirm-frame counts in `HandGestureDetector.ts` are product starting points, not
validated against a real hand. Verified only against a synthetic fake-camera device in
this environment (no physical webcam) - confirmed the panel, toggle, HandLandmarker
Worker initialization, and calibration flow all work without error, but never confirmed
against real pinch/fist/palm gestures.

## Recorder exports WebM, not GIF/MP4

The README roadmap item is "Gaze Overlay GIF/MP4 Recorder". `GazeRecorder` uses the native
`MediaRecorder` + `canvas.captureStream()` APIs, which only produce WebM in Chromium-based
browsers (Electron's renderer included) without a transcoding library. WebM plays natively
in Discord and most modern platforms, but not everywhere Twitter/X does. Converting to
MP4/GIF client-side would need a new dependency (e.g. `ffmpeg.wasm`), which is a real
option but wasn't pulled in without confirming the added ~25MB WASM payload is
acceptable for this desktop app.

## AI Mood Sync is heuristic, not a trained classifier

`WebcamTracker.detectGestures` derives smile/wink/nod/shake from raw face-mesh landmark
geometry (mouth width ratio, eye aperture, nose position variance) with hand-tuned
thresholds. This is honest, working gesture detection — but it is not the "real-time
facial sentiment analysis" the README describes for full Happy/Surprised/Confused/
Focused/Tired mood classification. Confused and Tired in particular have no reliable
single-frame geometric signature; a real implementation needs a trained model. Do not
present the current heuristic as that feature — it covers a meaningfully smaller,
already-useful surface (discrete gestures), not general mood sync.

## Drowsiness & Eye-Fatigue Guard is a heuristic wellness reminder, not a medical device

`DrowsinessDetector` derives prolonged-eye-closure, blink-frequency, and yawn signals
from the same raw face-mesh landmark geometry (eye aperture, mouth-corner/lip distance)
already used elsewhere in this app, with hand-tuned duration/frequency thresholds — same
class of heuristic as the AI Mood Sync entry above, not a trained or medically validated
model. It does **not** diagnose sleep disorders, fatigue disorders, or any medical
condition, and the settings panel says so explicitly. Every threshold (eye-closure
warning/critical duration, blink-rate window/count, yawn open-threshold/duration/
cooldown) is a documented product heuristic requiring real-camera tuning — see
PROJECT_STATUS.md's "Drowsiness & Eye-Fatigue Guard" section for the full default list
and current unvalidated status. In particular: individual resting blink-rate varies
significantly person to person, so `highBlinkRateThreshold` (35/min default) may read
differently for different users; and there is no reliable way to distinguish a yawn from
an unusually long/wide mouth movement during speech or laughter purely from geometry —
duration + cooldown reduces false positives but cannot eliminate them. None of this has
been tested against a real human face (no physical webcam in this development
environment, same limitation as the rest of this project's webcam-dependent code) —
verified only against a synthetic fake-camera device, where it correctly reports "Normal"
throughout rather than fabricating a reading from the non-face test pattern.

## Update: native Electron launch was previously misdiagnosed as an environment limitation

An earlier pass in this repo's history concluded Electron could not run at all in this
development environment, after seeing a SIGSEGV on every `BrowserWindow` creation attempt
(including a minimal reproduction with none of this app's code). That diagnosis was
**wrong** — later investigation found the actual cause was a corrupted/incomplete
`node_modules/electron/dist/` (missing most of the extracted binary's supporting files),
left behind after an `npm install` that ran before its postinstall script had been
approved via `allowScripts`. After manually extracting a complete, cached Electron build,
the real desktop app launches natively without crashing: a live window opens at real
desktop resolution, loads the production build over `file://`, and the eye renderer draws
correctly (confirmed via `webContents.capturePage()` - see PROJECT_STATUS.md → Native
Electron Verification). Webcam permission + the MediaPipe pipeline were also confirmed
working natively via Chrome's fake-camera-device flag. If Electron appears to crash
immediately on `BrowserWindow` creation again, check `node_modules/electron/dist/` for a
complete extraction before assuming it's an environment-wide limitation.

## Native Electron verification is still partial

Native testing this session covered: app launch, window rendering, webcam permission
grant + MediaPipe pipeline activation (via a synthetic fake camera - no real face, so
tracking correctly reported 0% confidence rather than claiming to track). It did **not**
cover, because they need capabilities this sandbox doesn't have or wasn't safe to spend
further time chasing in this pass: a **real human face** for actual gaze-accuracy
measurement (only Chrome's synthetic test-pattern device was available), microphone
permission (untested this session), the global-cursor IPC stream in the standalone widget
(the widget launched and mounted its React app correctly, but the capture window was too
small to visually confirm eye rendering), and any multi-hour long-running-session check
(memory growth, drift). These remain genuinely unverified, not assumed-fine.

## RESOLVED: MediaPipe inference no longer runs on the main thread

Was: `WebcamTracker`'s camera loop called `await this.faceMesh.send({ image })`
synchronously inside MediaPipe's own frame callback, on the same thread as the render
loop, measurably dropping render FPS from 60 to ~19-26 while tracking was active (see
git history for the original finding).

Fixed by migrating the inference backend from `@mediapipe/face_mesh` to
`@mediapipe/tasks-vision`'s `FaceLandmarker`, run inside a dedicated Web Worker - see
docs/WORKER_MIGRATION.md for the full writeup, including a real upstream MediaPipe bug
("ModuleFactory not set.") that had to be worked around to get the Worker to initialize
at all. Measured result (same synthetic-fake-camera methodology, before/after): avg
render FPS 19.1 → 50-53, dropped frames ~643 → ~83-125 over a comparable sample window.

**What's still real and unresolved:**
- All of the above was measured with **CPU-only inference** (MediaPipe's GPU delegate
  did not actually engage in this software-rendered sandbox) - a real GPU should perform
  better, unmeasured here.
- Gaze round-trip latency did not improve (in one run, got slightly worse: ~53ms → ~59ms)
  - the Worker `postMessage` boundary has real overhead. This is an accepted, expected
    tradeoff for decoupling rendering from inference, not something hidden.
- None of this has been verified against a real human face - see
  docs/REAL_CAMERA_VALIDATION.md, still the required next step before any accuracy claim.
- The `eval`-based workaround for the ModuleFactory bug depends on the current internal
  structure of MediaPipe's CDN-hosted WASM loader script not changing - see
  docs/WORKER_MIGRATION.md's "maintenance risk" note.

## Pre-existing: Electron `nodeIntegration: true`, `contextIsolation: false`

Both `electron/main.cjs` and `electron/widget-main.cjs` run with Node integration enabled
and context isolation disabled in the renderer, which is how `src/App.tsx` reaches
`window.require('electron')` for the cursor-position IPC stream. This predates this pass
and was not changed by it. It's a real hardening gap or a security-review item (loading
any untrusted remote content in this renderer would be equivalent to full Node access) —
scoped as future work, not fixed here since it wasn't part of the requested roadmap
implementation and changing it would require re-plumbing the IPC boundary with a preload
script + `contextBridge`.

## Test coverage is real but narrow

Vitest now covers the pure gaze/blink/calibration/render-timing logic (26 tests, see
`src/engine/*.test.ts`) with synthetic landmark fixtures - this is genuine, checked-in
regression coverage, not a placeholder. It does not and cannot cover: real MediaPipe
inference behavior, real camera hardware quirks (varying lighting, actual human faces at
varying distances), or React component rendering (no `@testing-library/react` or jsdom
setup exists). "The pure math is tested" is a real, narrower claim than "the eye tracker
is tested" - both are true, but only the first is backed by these tests.

# Known Issues

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

## MediaPipe inference measurably contends with the render loop on the main thread

`WebcamTracker`'s camera loop calls `await this.faceMesh.send({ image })` synchronously
inside MediaPipe's own frame callback - this is pre-existing architecture, not something
this pass introduced, but this pass's new diagnostics are what surfaced it as a measured
number instead of a suspicion. With the diagnostics panel open while webcam tracking was
active (via a fake camera device, so this is representative of real inference cost, not
video decode cost), the render loop's FPS dropped from a steady 60.0 to ~26 with 156
dropped frames accumulating over a few seconds. Both MediaPipe's WASM inference and the
app's `requestAnimationFrame` render loop run on the same JS thread, so heavier inference
directly steals frame budget from rendering. This sandbox's software GPU rasterizer
(`--use-gl=swiftshader`) makes the render side of that contention worse than a real GPU
would, so the exact 26fps figure is not representative of real hardware - but the
underlying contention (one thread, two competing workloads) is architectural and will
reproduce to some degree on any machine, worse on lower-end ones. The real fix is running
MediaPipe inference in a Web Worker (MediaPipe's own examples support this) so it can
no longer block the paint thread; that is a nontrivial change and was not made in this
pass - it's the top item in ROADMAP.md's core-engine follow-up list.

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

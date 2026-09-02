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

## Electron desktop app could not be launched from this development environment

This pass's implementation work was verified by running the app as a **web page** (`npm
run dev` + Playwright against Chromium) rather than as the actual Electron desktop app.
Two independent environment problems blocked the Electron path here specifically:

1. `ELECTRON_RUN_AS_NODE=1` is set in this shell (inherited from the coding-assistant
   host process), which makes Electron execute any script as plain Node instead of
   launching the Electron runtime — `require('electron')` then returns a path string, not
   the API, and `app` is `undefined`.
2. After working around (1), Electron segfaults (SIGSEGV) creating any `BrowserWindow` in
   this specific container's display session, across every GPU/windowing backend tried
   (`--disable-gpu`, `--use-gl=swiftshader`, `--headless`, native Wayland). This reproduced
   even with a 20-line minimal Electron script containing none of this app's code, so it
   is an environment limitation, not a defect introduced by this work.

**Action needed:** run `npm run dev:electron`-equivalent (`npx electron electron/main.cjs`)
and `npm run widget` on your actual desktop session to confirm the global-cursor IPC
stream, camera permission dialog, and mic permission dialog behave correctly under
Electron specifically — the web-browser verification done in this pass is strong evidence
the feature logic is correct, but Electron's renderer sandbox and permission model can
differ from a plain browser tab.

## Pre-existing: Electron `nodeIntegration: true`, `contextIsolation: false`

Both `electron/main.cjs` and `electron/widget-main.cjs` run with Node integration enabled
and context isolation disabled in the renderer, which is how `src/App.tsx` reaches
`window.require('electron')` for the cursor-position IPC stream. This predates this pass
and was not changed by it. It's a real hardening gap or a security-review item (loading
any untrusted remote content in this renderer would be equivalent to full Node access) —
scoped as future work, not fixed here since it wasn't part of the requested roadmap
implementation and changing it would require re-plumbing the IPC boundary with a preload
script + `contextBridge`.

## No automated test suite

There is no Jest/Vitest/Playwright test config or `test` script in this repository.
Everything in this pass was verified manually (typecheck, lint, build, and live
Playwright-driven browser screenshots — see PROJECT_STATUS.md → Tests). This is
adequate evidence the shipped code works, but there's no regression safety net for future
changes.

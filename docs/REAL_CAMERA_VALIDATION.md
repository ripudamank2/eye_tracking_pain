# Real-Camera Gaze Validation Procedure

This is the structured test you (a human, with a real webcam and face) run to determine
whether the gaze pipeline is actually accurate — not just architecturally sound. Nothing
in this repository can substitute for this: every fix made in the engineering audit was
verified against synthetic landmark data or a fake camera device, neither of which can
tell you whether the eyes actually land where you're looking.

## Prerequisites

- Your laptop's built-in webcam (or any real webcam), reasonable lighting, and your
  actual face — not a fake/synthetic camera device.
- Run the app (`npm run dev` and open in a browser, or the Electron app via `npm run
  electron:dev` / `npm run widget`).
- Enable **AI Camera Eye Tracking** from the right-click Studio Controls menu.

## Step 1: Calibrate first

Before testing accuracy, calibrate — an uncalibrated session will fail every accuracy
check for a reason that has nothing to do with the pipeline's real quality.

1. Click **Calibrate Gaze (5-point)** in Studio Controls.
2. Look at each target as it appears (4 corners + center) and hold your gaze steady;
   each point auto-samples after a short delay.
3. Confirm the reported **mean error** is a number you can compare against future runs
   (not "not calibrated"). Note it down — it's your baseline calibration quality.

If calibration itself reports a large mean error (a rough guide: worse than ~150px on a
1920px-wide screen suggests something is off — bad lighting, camera too far away, glasses
glare), fix that condition before proceeding; testing gaze accuracy on top of a bad
calibration conflates two different problems.

## Step 2: Run the guided validation screen

Open **Real-Camera Validation** from the right-click Studio Controls menu (or press
`Ctrl+Shift+V`). This replaces the old workflow of reading this doc side-by-side with a
small diagnostics panel — it's a full-screen guided script that tells you exactly what to
do at each step, shows a real on-screen target dot to look at, shows your live tracked
gaze position as a red dot so you can see in real time whether it lands where you're
actually looking, and shows big, readable live numbers for every metric below the fold.

1. Click **Start Recording** at the bottom of the screen.
2. Work through each of the 22 phases in order, using **Next** / **Back** to navigate.
   Most phases with a fixed target (center, left, right, diagonals, etc.) auto-advance
   after you've had a couple of seconds to settle your gaze — you don't need to click
   through those. Phases with no fixed target (lighting change, moving out of frame)
   wait for you to click **Next** manually. Each phase change drops a timestamped marker
   into the recording so the exported data can be sliced per-condition afterward, rather
   than only giving you one session-wide average that hides which specific condition was
   the problem.
3. The final phase, **Continuous Tracking**, has no auto-advance — use the app normally
   (move your eyes, talk, look away and back) for **at least 10-15 minutes** to stress-test
   long-run stability; the on-screen timer counts up against a 15:00 target.
4. When done, click **Stop & Export**. Two files download:
   `gaze-validation-<timestamp>.json` (full fidelity — samples + events + summary) and
   `gaze-validation-<timestamp>.csv` (samples only, for spreadsheet analysis).

The live stat bar at the bottom of the validation screen shows, updated continuously:
**FPS, inference time, gaze latency, tracking confidence, gaze jitter, calibration error,
dropped frames, face-loss count, blink count, and tracking status** — so you can watch for
a problem the moment it happens instead of only finding it afterward in the export.

(The original small floating **Eye Engine Diagnostics** panel, `Ctrl+Shift+D`, still
exists for quick ad-hoc checks outside a formal validation run, and still supports its
own Start/Stop recording — but the guided full-screen flow above is the recommended way
to run this specific 22-phase protocol.)

### The 22 phases, and what each is checking

| # | Phase | What "good" looks like |
|---|---|---|
| 1 | Get ready (sit normally, no target) | Establishes a good starting pose before anything is measured |
| 2 | Center gaze, hold still | Eyes settle near the target and stay still — low jitter |
| 3 | Look left, hold ~2.5s | Eyes deflect left and stay there, not overshoot/oscillate |
| 4 | Look right, hold ~2.5s | Same, mirrored |
| 5 | Look up, hold ~2.5s | Y-axis deflection is comparable in magnitude to X-axis from phases 3-4 |
| 6 | Look down, hold ~2.5s | Same, mirrored |
| 7-10 | Diagonals (up-left, up-right, down-left, down-right) | Both axes deflect together, proportionally — a diagonal glance shouldn't look like a pure X or Y move |
| 11 | Slow eye movement (sweep left-right-left) | Smooth pursuit should track continuously without stepping/lag artifacts |
| 12 | Fast eye movement (quick flicks left/right) | Tests the One-Euro filter's fast-motion response — should track with low lag, not oscillate |
| 13 | Head movement, gaze fixed on center | Tests head-yaw/pitch compensation — the fixed gaze point shouldn't drift as the head moves if compensation is working |
| 14 | Normal blinking | Eyes should NOT visibly jump/spike during a blink — this is the direct test of the blink-gating fix. Blink count should increment normally |
| 15 | Rapid blinking (5-10 fast blinks) | Same, under stress — blink count and "frames held for blink" should climb, gaze position should not spike |
| 16 | Close eyes 3+ seconds | Tracking should show low confidence or hold position, not report a wild gaze position from a closed-eye landmark read |
| 17 | Move closer (~30cm), gaze center | Eyes stay near center — validates distance compensation |
| 18 | Move farther (~80cm), gaze center | Same, mirrored |
| 19 | Change lighting, gaze center | Confidence/jitter may degrade under poor lighting — note whether it degrades gracefully (still usable) or fails hard |
| 20 | Move face out of frame | Status should transition toward `face_lost` |
| 21 | Return & recover | Status should go back to `tracking`; this is the direct test of the recovery-time metric |
| 22 | Continuous tracking (≥10-15 min, free use) | Long-run stability — watch for FPS/latency drift, memory growth, or accumulating dropped frames over the full session |

## Step 3: Interpret the exported data

Open the JSON export. Key fields:

- **`summary.avgGazeJitterPx` / `maxGazeJitterPx`** — should be low (single digits to
  low tens of pixels) during the "hold still" phases (2-10, 13). High jitter during a
  hold-still phase means the One-Euro filter isn't doing its job for your specific setup
  (camera quality, lighting) and may need retuning (`GazeProcessor`'s `minCutoff`/`beta`
  constants).
- **`summary.avgGazeLatencyMs`** — time from camera frame capture to gaze result. Under
  ~50ms is good for interactive use; much higher suggests the main-thread contention
  problem (see Step 2 of the engineering work, or `KNOWN_ISSUES.md`).
- **`summary.recoveryTimesMs`** — one entry per face-loss-then-recovery cycle (phases
  20-21 should produce one). Fast recovery (a few hundred ms) is good; multi-second
  recovery suggests the `FACE_LOSS_GRACE_MS`/MediaPipe's own re-detection is too slow.
- **`summary.minTrackingConfidence`** — how low confidence dropped at its worst point.
  Expect low confidence during phase 16 (eyes closed) and phase 19 (bad lighting) — that's
  correct behavior (honest low confidence), not a bug. A low confidence during phase 2
  (center gaze, good conditions) would be a real problem.
- **`summary.totalBlinkCount`** — a discrete count of detected blinks (rising edges of
  the blink-aperture signal), distinct from the per-frame `framesHeldForBlink` count.
  Compare against how many times you actually blinked during phases 14-15 — undercounting
  suggests blinks are too fast for the camera's frame rate to catch; overcounting
  suggests the aperture threshold is too sensitive to normal eye-shape variation.
- **`summary.avgInferenceTimeMs`** — time spent inside the Worker's `detectForVideo()`
  call itself, isolating raw inference cost from the end-to-end `avgGazeLatencyMs` above
  (which also includes the `postMessage` round-trip). A large gap between the two points
  at Worker-boundary overhead rather than inference being slow.
- **`events`** array with `type: "annotation"` — your phase markers, with timestamps.
  Cross-reference against `samples` at nearby `t` values to see exactly what the pipeline
  reported during each specific phase, not just the whole-session average.
- **Gaze error** (accuracy in pixels/degrees against ground truth) is **not** captured
  automatically by this tooling, because that requires knowing where you were *actually*
  looking at each instant, which nothing in this app can independently verify. To measure
  it: during phase 2 (center) and the diagonal phases (7-10), watch the on-screen eye position
  relative to where you're actually looking, and note by eye whether it's within an
  acceptable margin (a few centimeters at arm's length is a reasonable bar for this kind
  of consumer webcam gaze tracking — this is not going to match dedicated eye-tracking
  hardware). This is the one metric in this procedure that is necessarily subjective,
  because no automated ground truth exists.

## What to do with the results

Compare the exported summary against the phase list above. If jitter/latency/confidence
look reasonable across most phases but one specific phase is clearly worse, that's a
targeted, fixable finding (e.g. "distance compensation still isn't right — phase 17/18
show high jitter") rather than a vague "tracking feels bad." Bring the exported JSON back
for further tuning of `GazeProcessor`'s constants if any phase performs poorly.

# Real-Camera Gaze Validation Procedure

This is the structured test you (a human, with a real webcam and face) run to determine
whether the gaze pipeline is actually accurate — not just architecturally sound. Nothing
in this repository can substitute for this: every fix made in the engineering audit was
verified against synthetic landmark data or a fake camera device, neither of which can
tell you whether the eyes actually land where you're looking.

## Prerequisites

- A real webcam, reasonable lighting, and your face.
- Run the app (`npm run dev` and open in a browser, or the Electron app via `npm run
  electron:dev` / `npm run widget`).
- Enable **AI Camera Eye Tracking** from the right-click Studio Controls menu.
- Open **Eye Engine Diagnostics** (`Ctrl+Shift+D`) — this is where you'll start/stop
  recording and step through the validation phases.

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

## Step 2: Record a full validation session

1. In the Diagnostics panel, click **Start** under "Validation Recording."
2. Work through each phase below **in order**. After completing each one, click **Mark
   Phase Complete → Next** — this drops a timestamped marker into the recording so the
   exported data can be sliced per-condition afterward, rather than only giving you one
   session-wide average that hides which specific condition was the problem.
3. When done, click **Stop & Export**. Two files download:
   `gaze-validation-<timestamp>.json` (full fidelity — samples + events + summary) and
   `gaze-validation-<timestamp>.csv` (samples only, for spreadsheet analysis).

### The 20 phases, and what each is checking

| # | Phase | What "good" looks like |
|---|---|---|
| 1 | Center gaze, hold still | Eyes settle near the target and stay still — low jitter |
| 2 | Look left, hold ~2s | Eyes deflect left and stay there, not overshoot/oscillate |
| 3 | Look right, hold ~2s | Same, mirrored |
| 4 | Look up, hold ~2s | Y-axis deflection is comparable in magnitude to X-axis from steps 2-3 |
| 5 | Look down, hold ~2s | Same, mirrored |
| 6-9 | Diagonals (up-left, up-right, down-left, down-right) | Both axes deflect together, proportionally — a diagonal glance shouldn't look like a pure X or Y move |
| 10 | Tilt head left ~20°, gaze center | Eyes should stay near center — this is what head-roll-independent gaze *should* look like, though note this pipeline does not explicitly compensate for roll (see Known Issues) |
| 11 | Tilt head right ~20°, gaze center | Same, mirrored |
| 12 | Move closer (~30cm), gaze center | Eyes stay near center — validates distance compensation. Before this pass's fix there was none; this phase is the direct test of that fix |
| 13 | Move farther (~80cm), gaze center | Same, mirrored |
| 14 | Normal blinking | Eyes should NOT visibly jump/spike during a blink — this is the direct test of the blink-gating fix |
| 15 | Rapid blinking (5-10 fast blinks) | Same, under stress — the "frames held for blink" diagnostic should climb, gaze position should not spike |
| 16 | Close eyes 3+ seconds | Tracking should show low confidence or hold position, not report a wild gaze position from a closed-eye landmark read |
| 17 | Move face out of frame, then back | Status should go `tracking` → `face_lost` → `tracking`; this is the direct test of the recovery-time metric |
| 18 | Move head side to side, gaze fixed | Tests head-yaw compensation — the fixed gaze point shouldn't drift as the head moves if compensation is working |
| 19 | Change lighting, gaze center | Confidence/jitter may degrade under poor lighting — note whether it degrades gracefully (still usable) or fails hard |
| 20 | Turn away, then return | Same as #17 but a more extreme angle — tests recovery from a harder loss condition |

## Step 3: Interpret the exported data

Open the JSON export. Key fields:

- **`summary.avgGazeJitterPx` / `maxGazeJitterPx`** — should be low (single digits to
  low tens of pixels) during the "hold still" phases (1-13). High jitter during a
  hold-still phase means the One-Euro filter isn't doing its job for your specific setup
  (camera quality, lighting) and may need retuning (`GazeProcessor`'s `minCutoff`/`beta`
  constants).
- **`summary.avgGazeLatencyMs`** — time from camera frame capture to gaze result. Under
  ~50ms is good for interactive use; much higher suggests the main-thread contention
  problem (see Step 2 of the engineering work, or `KNOWN_ISSUES.md`).
- **`summary.recoveryTimesMs`** — one entry per face-loss-then-recovery cycle (phases 17
  and 20 should each produce one). Fast recovery (a few hundred ms) is good; multi-second
  recovery suggests the `FACE_LOSS_GRACE_MS`/MediaPipe's own re-detection is too slow.
- **`summary.minTrackingConfidence`** — how low confidence dropped at its worst point.
  Expect low confidence during phases 16 (eyes closed) and 19 (bad lighting) — that's
  correct behavior (honest low confidence), not a bug. A low confidence during phase 1
  (center gaze, good conditions) would be a real problem.
- **`events`** array with `type: "annotation"` — your phase markers, with timestamps.
  Cross-reference against `samples` at nearby `t` values to see exactly what the pipeline
  reported during each specific phase, not just the whole-session average.
- **Gaze error** (accuracy in pixels/degrees against ground truth) is **not** captured
  automatically by this tooling, because that requires knowing where you were *actually*
  looking at each instant, which nothing in this app can independently verify. To measure
  it: during phase 1 (center) and the diagonal phases, watch the on-screen eye position
  relative to where you're actually looking, and note by eye whether it's within an
  acceptable margin (a few centimeters at arm's length is a reasonable bar for this kind
  of consumer webcam gaze tracking — this is not going to match dedicated eye-tracking
  hardware). This is the one metric in this procedure that is necessarily subjective,
  because no automated ground truth exists.

## What to do with the results

Compare the exported summary against the phase list above. If jitter/latency/confidence
look reasonable across most phases but one specific phase is clearly worse, that's a
targeted, fixable finding (e.g. "distance compensation still isn't right — phase 12/13
show high jitter") rather than a vague "tracking feels bad." Bring the exported JSON back
for further tuning of `GazeProcessor`'s constants if any phase performs poorly.

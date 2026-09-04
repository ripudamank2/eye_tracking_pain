# Hand Landmark Index Mapping (MediaPipe HandLandmarker)

Written before implementing gesture geometry, following the same discipline as
[LANDMARK_MAPPING.md](LANDMARK_MAPPING.md) (the face-landmark equivalent): verify the
indices this pipeline depends on against MediaPipe's own published topology rather than
guessing and finding out something is silently wrong.

## Topology

`HandLandmarker` (from `@mediapipe/tasks-vision`, already installed for face tracking -
confirmed present via `grep -n "class HandLandmarker" node_modules/@mediapipe/tasks-vision/vision.d.ts`,
no new dependency needed) outputs a fixed **21-point** hand landmark topology per
detected hand, normalized `{x, y, z}` coordinates in `[0, 1]` relative to the image
(same normalization convention as the face mesh `GazeProcessor` already consumes). This
is MediaPipe's standard, publicly documented hand landmark model (`hand_landmarker.task`)
- the same 21-point topology used across MediaPipe's Hand Landmarker task documentation
and samples.

| Index | Landmark |
|---|---|
| 0 | Wrist |
| 1-4 | Thumb: CMC, MCP, IP, **TIP (4)** |
| 5-8 | Index finger: MCP, PIP, DIP, **TIP (8)** |
| 9-12 | Middle finger: MCP, PIP, DIP, **TIP (12)** |
| 13-16 | Ring finger: MCP, PIP, DIP, **TIP (16)** |
| 17-20 | Pinky: MCP, PIP, DIP, **TIP (20)** |

## Indices this pipeline actually uses

| Index | Used for | Where |
|---|---|---|
| 0 | Wrist - hand-scale reference (palm size for normalization, mirrors `GazeProcessor`'s `eyeSpan` pattern) | `HandGestureDetector` |
| 4 | Thumb tip - pinch distance, pinch-gesture geometry | `HandGestureDetector` |
| 5, 9 | Index/middle MCP (knuckle) - "finger extended" test (tip further from wrist than MCP, tip further from palm than the corresponding PIP) | `HandGestureDetector` |
| 6, 10, 14, 18 | Index/middle/ring/pinky PIP joints - extended-finger test (each finger's tip-to-wrist distance vs. PIP-to-wrist distance determines curled vs. extended) | `HandGestureDetector` |
| 8 | Index fingertip - pointer position, pinch distance | `HandGestureDetector`, `ScreenMapper` |
| 12 | Middle fingertip - two-finger (right-click) gesture, curled-finger checks for pinch/fist | `HandGestureDetector` |
| 16 | Ring fingertip - curled-finger check for fist/open-palm classification | `HandGestureDetector` |
| 20 | Pinky fingertip - curled-finger check for fist/open-palm classification | `HandGestureDetector` |

## Handedness

`HandLandmarkerResult.handedness` (not `.handednesses`, which the type declarations mark
`@deprecated`) is an array of `Category[]` per detected hand, each with `categoryName`
(`"Left"` or `"Right"`) and a confidence `score`. V1 tracks a single hand (`numHands: 1`
in `handLandmarkerWorker.ts`) and does not currently branch behavior on handedness, but
it is captured and threaded through (`HandTracker`'s `onResult`) for future use (e.g. a
setting to prefer a specific hand) rather than discarded.

## Coordinate system

Per MediaPipe's documented convention (confirmed against the same `vision.d.ts` used for
face landmarks - `NormalizedLandmark` has identical `{x, y, z}` semantics for both tasks):
`x`/`y` are normalized to `[0, 1]` relative to the **input image** (not mirrored by
default - a hand on the right side of a selfie-style unmirrored camera feed reports a
larger `x`). Whether the camera preview itself is mirrored for display is a separate,
UI-level concern - see `ScreenMapper`'s `mirrorX` option, which is applied explicitly and
independently of anything MediaPipe reports.

## Verification method

Cross-checked the index table above against:
1. `node_modules/@mediapipe/tasks-vision`'s own `HandLandmarkerResult`/`NormalizedLandmark`
   type declarations (confirms the result shape: `landmarks: NormalizedLandmark[][]`,
   `handedness: Category[][]`, same per-point `{x,y,z}` shape as the face mesh).
2. MediaPipe's publicly documented 21-point hand landmark diagram (the same one referenced
   across MediaPipe's own Hand Landmarker documentation and samples) - wrist=0, each
   finger's 4 joints in MCP→PIP→DIP→TIP order, thumb using CMC in place of MCP.

No legacy (`@mediapipe/hands`) hand-tracking library existed in this repo before this
pass, so unlike the face-landmark migration there is no "old vs. new API" index
continuity to verify - this is a first-time integration, verified directly against the
installed package rather than assumed from memory.

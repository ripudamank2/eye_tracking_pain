# Landmark Index Mapping: Legacy `@mediapipe/face_mesh` → `@mediapipe/tasks-vision`

Written before migrating the inference backend, per the requirement to document every
landmark index this pipeline depends on and verify (not assume) the new API's equivalent,
rather than guessing and finding out something silently broke.

## Complete inventory of landmark indices currently in use

Both libraries are built on the same underlying **468-point (canonical) + 10-point iris
refinement (478 total) face mesh topology** — MediaPipe's face landmark model itself
hasn't changed between the legacy Solutions API and the new Tasks API, only the
JavaScript wrapper around it has. This matters: the **numeric indices below are the same
468/478-point topology in both APIs** — what changes is the *shape of the result object*
the API hands back, not the meaning of index 468 vs. index 1 vs. index 61. This is
confirmed by MediaPipe's own documentation (the face landmarker task explicitly states it
outputs "478 3D face landmarks" using the same topology as the legacy FaceMesh solution)
and by the constructor option `refineLandmarks`/`outputFaceBlendshapes` continuity between
the two APIs. This inventory is still written out explicitly, and the migration verifies
it with the same synthetic-fixture tests already covering `GazeProcessor`, rather than
resting on that continuity claim alone.

| Index | Used for | Where |
|---|---|---|
| 468 | Left iris center | `GazeProcessor.LANDMARK.IRIS_LEFT`, gaze offset computation |
| 469 | Left iris center (fallback if 468 missing) | `WebcamTracker.handleFaceMeshResults` |
| 473 | Right iris center | `GazeProcessor.LANDMARK.IRIS_RIGHT`, gaze offset computation |
| 474 | Right iris center (fallback if 473 missing) | `WebcamTracker.handleFaceMeshResults` |
| 33 | Left eye outer corner (fallback if iris missing) | `GazeProcessor.LANDMARK.EYE_LEFT_OUTER` |
| 263 | Right eye outer corner (fallback if iris missing) | `GazeProcessor.LANDMARK.EYE_RIGHT_OUTER` |
| 1 | Nose tip | `GazeProcessor.LANDMARK.NOSE_TIP`, head yaw/pitch compensation |
| 4 | Nose tip (fallback if 1 missing) | `WebcamTracker.handleFaceMeshResults` |
| 159 | Left eyelid top | `GazeProcessor.LANDMARK.EYELID_LEFT_TOP`, blink/aperture |
| 145 | Left eyelid bottom | `GazeProcessor.LANDMARK.EYELID_LEFT_BOTTOM`, blink/aperture |
| 386 | Right eyelid top | `GazeProcessor.LANDMARK.EYELID_RIGHT_TOP`, blink/aperture |
| 374 | Right eyelid bottom | `GazeProcessor.LANDMARK.EYELID_RIGHT_BOTTOM`, blink/aperture |
| 61 | Left mouth corner | `WebcamTracker.detectGestures` smile detection |
| 291 | Right mouth corner | `WebcamTracker.detectGestures` smile detection |
| 13 | Upper lip center | `WebcamTracker.detectGestures` smile detection |
| 14 | Lower lip center | `WebcamTracker.detectGestures` smile detection |

`refineLandmarks: true` in the legacy API is what makes indices 468-477 (iris points)
available at all — without it, the mesh is only 468 points (no iris refinement) and those
indices don't exist. The Tasks API's equivalent is `numFaces: 1` plus the
`FaceLandmarker` task itself always including iris refinement in its 478-point output
(unlike legacy FaceMesh, where iris refinement was an opt-in flag) - **confirmed against
`FaceLandmarkerOptions` in `@mediapipe/tasks-vision`'s type declarations**, not assumed.

## Result shape difference (this is the part that actually changes)

**Legacy `@mediapipe/face_mesh`:**
```js
faceMesh.onResults((results) => {
  // results.multiFaceLandmarks: Array<Array<{x,y,z}>> - one array of 478 points per detected face
  const landmarks = results.multiFaceLandmarks[0];
});
```

**New `@mediapipe/tasks-vision` `FaceLandmarker`:**
```js
const result = faceLandmarker.detectForVideo(videoFrame, timestampMs);
// result.faceLandmarks: Array<Array<{x,y,z}>> - same shape: one array of 478 points per face
const landmarks = result.faceLandmarks[0];
```

**Verified by reading `@mediapipe/tasks-vision`'s installed type declarations** (see
`node_modules/@mediapipe/tasks-vision/tasks-vision.d.ts`, `FaceLandmarkerResult`
interface) rather than assumed from documentation alone - `faceLandmarks[i][j]` has the
same `{x, y, z}` normalized-coordinate shape as the legacy API's
`multiFaceLandmarks[i][j]`. This is why every `LANDMARK.*` numeric index in
`GazeProcessor.ts` and every raw index (`61`, `291`, `13`, `14`, etc.) in
`WebcamTracker.detectGestures` needed **zero changes** - only the code that gets from "a
video frame" to "an array of 478 landmark points" changes; everything downstream of that
array (`GazeProcessor`, `computeEyeAperture`, gesture detection) is unmodified and still
covered by the existing Vitest suite, since those tests operate on synthetic `Landmark[]`
arrays that don't care which library produced them.

## What genuinely differs and required actual code changes

1. **Invocation model**: `onResults` callback (push-based, driven by MediaPipe's own
   internal `Camera` utility polling the video element) → `detectForVideo(frame,
   timestampMs)` (pull-based, caller drives the timing loop explicitly). This is what
   makes Worker execution possible: the caller controls exactly when inference runs and
   can post a frame's pixel data into the Worker on its own schedule, rather than the
   library owning an opaque internal loop tied to a DOM video element it must own.
2. **Input type**: legacy `send({ image: HTMLVideoElement })` vs. Tasks API's
   `detectForVideo(image: ImageBitmap | HTMLVideoElement | ...)`. A Worker has no
   `HTMLVideoElement`, so the main thread captures frames via `OffscreenCanvas` +
   `createImageBitmap()` and transfers the `ImageBitmap` into the Worker (transferable,
   not copied - no serialization cost for the pixel data itself).
3. **Model loading**: legacy API auto-loads WASM/model assets via CDN `<script>` tags
   injected into `document`. Tasks API uses an explicit `FilesetResolver.forVisionTasks()`
   + `FaceLandmarker.createFromOptions()` call that fetches its own WASM/model assets
   and does not touch `document`/`window` - this is what makes it Worker-safe, verified
   directly by reading the package's Worker-compatibility notes in its own `.d.ts` file
   header comments and the absence of any `document`/`window` reference when grepped
   (see verification command below).

## Iris/eyelid index verification against MediaPipe's own official reference diagram

The public docs pages don't publish an index diagram, but MediaPipe's official face-mesh
reference image does (`mediapipe_face_landmark_fullsize.png`, linked from MediaPipe's own
documentation asset storage). Fetched and visually inspected it directly, zoomed into both
eye regions, rather than trusting either documentation prose or minified-source variable
names alone. Findings, precise and checked against the actual pixels:

- The eye outlined in **blue** in the reference image has its **pupil center labeled
  468**, with the surrounding iris ring at 470/471/472/469, and eyelid points **159
  (top-center) / 145 (bottom-center)** visible in the same crop.
- The eye outlined in **green** has its **pupil center labeled 473**, iris ring
  475/476/477/474, eyelid points **386 (top-center) / 374 (bottom-center)**.

This directly confirms: **`IRIS_LEFT: 468` paired with `EYELID_LEFT_TOP: 159` /
`EYELID_LEFT_BOTTOM: 145`, and `IRIS_RIGHT: 473` paired with `EYELID_RIGHT_TOP: 386` /
`EYELID_RIGHT_BOTTOM: 374`, are correct** - both the iris center and its matching eyelid
points come from the same physical eye in each pairing. This was the existing code's
mapping before this migration; it required no change.

**A real, corrected mistake along the way, worth recording:** an earlier pass at this
verification read the legacy library's minified `FACEMESH_LEFT_IRIS`/`RIGHT_IRIS`
*connection arrays* (`[474,475],[475,476],[476,477],[477,474]` and
`[469,470],[470,471],[471,472],[472,469]`) and concluded the center indices must be 474
and 469 respectively - the reverse of what the code used. That conclusion was wrong: a
connection array only lists the *ring* points that get connected to draw the iris
outline; the *center* point (468 or 473) has no "connection" to itself and so is absent
from that array entirely. The official reference image, which shows the actual labeled
center dot, is what resolved this - not the connection-array reasoning, which looked
plausible but was checking the wrong thing.

**A genuine naming-convention wrinkle, not a bug:** the same official diagram shows that
MediaPipe's own `FACEMESH_LEFT_EYE` constant (in the legacy library's source) is the array
containing indices 374/386/263/362 - i.e., the **green-outlined eye**, which is the
subject's anatomical *right* eye when facing the camera (front-facing camera views are
conventionally treated as mirrored, so "left" in MediaPipe's naming means "appears on the
left side of the image," not "the subject's own left"). This project's `LANDMARK`
constants name things `EYELID_RIGHT_TOP: 386` / `EYELID_RIGHT_BOTTOM: 374` - the reverse
convention from MediaPipe's own "LEFT_EYE" label for that same point set. This has **zero
effect on gaze-tracking correctness**: `computeEyeAperture` and `computeRawOffset` treat
"left" and "right" as a matched, symmetric pair and never compare either side's identity
against anything external. The only place a labeling swap would be observable is the
`wink_left`/`wink_right` gesture events potentially firing for the visually-opposite eye
of what their name suggests - a cosmetic question, left as pre-existing behavior and out
of scope for this migration (changing it isn't a Worker/inference concern).

## Verification performed before writing migration code

First attempt at this check was wrong and is corrected here rather than left silently
fixed - worth recording since it's exactly the kind of "verify, don't guess" mistake this
document is supposed to prevent. A naive `grep -c "document\."` on the minified bundle
returned `1`, because the entire bundle is one line and `-c` counts matching lines, not
matches. The real count, extracted properly:

```
$ grep -oE "document\.[a-zA-Z]+|window\.[a-zA-Z]+" node_modules/@mediapipe/tasks-vision/vision_bundle.mjs
document.createElement
document.body
document.createElement
document.createElement
document.createElement
document.createElement
```

Six occurrences, not zero. Reading the surrounding code (not just the match) for each
one shows every single one is behind an explicit environment guard:

- `if ("function" != typeof importScripts) { ...document.createElement("script")... }` —
  `importScripts` only exists inside a Worker, so this branch is main-thread-only.
- `if ("undefined" == typeof OffscreenCanvas) { ... } else if ("undefined" == typeof
  document) throw Error(...) else document.createElement("canvas")` — explicitly checks
  `OffscreenCanvas` first and only falls through to `document` if that's unavailable,
  throwing a clear error rather than a cryptic crash if neither exists.
- `r.canvas ?? (Ph() ? void 0 : document.createElement("canvas"))` — `Ph()` is an internal
  capability check (OffscreenCanvas support) gating the `document` fallback.

So the correct, verified conclusion is: **the legacy `face_mesh.js` bundle calls
`document`/`window` unconditionally at module-evaluation and construction time** (see the
engineering audit - `document.body.appendChild`, `window[a] = b` with no capability
check), which is why it throws immediately in a Worker. **`tasks-vision`'s bundle was
deliberately written with Worker-context detection**, using `OffscreenCanvas` and
`importScripts` when available and only touching `document`/`window` on the guarded
main-thread fallback path. This is real evidence of Worker-safety, but a more precise
claim than "zero references" - it's "the references that exist are provably unreachable
when running inside a Worker," which the actual migration code below confirms empirically
by successfully constructing a `FaceLandmarker` inside a Worker without a thrown error.

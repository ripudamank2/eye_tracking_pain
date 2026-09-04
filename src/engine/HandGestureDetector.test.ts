import { describe, it, expect } from 'vitest';
import { HandGestureDetector, DEFAULT_HAND_GESTURE_THRESHOLDS } from './HandGestureDetector';
import type { HandFrame, HandLandmark } from './handTypes';

// Synthetic 21-point hand landmark builder - deliberately independent of GazeProcessor's
// makeLandmarks helper (different topology, different module). See
// docs/HAND_LANDMARK_MAPPING.md for index meanings.
function makeHand(overrides: Partial<Record<number, HandLandmark>> = {}): HandLandmark[] {
  const arr: HandLandmark[] = new Array(21).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0 }));
  arr[0] = { x: 0.5, y: 0.7, z: 0 }; // wrist
  arr[4] = { x: 0.45, y: 0.55, z: 0 }; // thumb tip
  arr[5] = { x: 0.48, y: 0.6, z: 0 }; // index MCP
  arr[6] = { x: 0.48, y: 0.5, z: 0 }; // index PIP
  arr[8] = { x: 0.48, y: 0.3, z: 0 }; // index tip (extended: far from wrist)
  arr[9] = { x: 0.5, y: 0.6, z: 0 }; // middle MCP
  arr[10] = { x: 0.5, y: 0.5, z: 0 }; // middle PIP
  arr[12] = { x: 0.5, y: 0.6, z: 0 }; // middle tip (curled by default: close to wrist)
  arr[14] = { x: 0.52, y: 0.5, z: 0 }; // ring PIP
  arr[16] = { x: 0.52, y: 0.6, z: 0 }; // ring tip (curled by default)
  arr[18] = { x: 0.54, y: 0.5, z: 0 }; // pinky PIP
  arr[20] = { x: 0.54, y: 0.6, z: 0 }; // pinky tip (curled by default)
  for (const [idx, lm] of Object.entries(overrides)) {
    arr[Number(idx)] = lm as HandLandmark;
  }
  return arr;
}

function extendFinger(landmarks: HandLandmark[], tipIdx: number, pipIdx: number, wristIdx = 0): HandLandmark[] {
  const next = landmarks.slice();
  const wrist = next[wristIdx];
  next[tipIdx] = { x: next[pipIdx].x, y: wrist.y - 0.45, z: 0 }; // far from wrist = extended
  return next;
}

function curlFinger(landmarks: HandLandmark[], tipIdx: number, pipIdx: number): HandLandmark[] {
  const next = landmarks.slice();
  next[tipIdx] = { x: next[pipIdx].x, y: next[pipIdx].y + 0.05, z: 0 }; // close to wrist-side = curled
  return next;
}

function frame(landmarks: HandLandmark[], overrides: Partial<HandFrame> = {}): HandFrame {
  return {
    timestampMs: 0,
    landmarks,
    handedness: 'Right',
    confidence: 0.9,
    ...overrides,
  };
}

// Base pose: index extended (pointer), everything else at makeHand()'s defaults
// (middle/ring/pinky curled, thumb far from index so no pinch).
function pointerHand(): HandLandmark[] {
  return extendFinger(makeHand(), 8, 6);
}

function pinchedHand(): HandLandmark[] {
  const hand = pointerHand();
  hand[4] = { x: hand[8].x, y: hand[8].y, z: 0 }; // thumb tip on top of index tip
  return hand;
}

function twoFingerHand(): HandLandmark[] {
  let hand = pointerHand();
  hand = extendFinger(hand, 12, 10);
  return hand;
}

function openPalmHand(): HandLandmark[] {
  let hand = pointerHand();
  hand = extendFinger(hand, 12, 10);
  hand = extendFinger(hand, 16, 14);
  hand = extendFinger(hand, 20, 18);
  return hand;
}

function fistHand(): HandLandmark[] {
  return curlFinger(makeHand(), 8, 6); // index curled too - makeHand()'s other fingers are already curled
}

describe('HandGestureDetector - pointer', () => {
  it('recognizes an extended index finger as a pointer with no click', () => {
    const d = new HandGestureDetector();
    d.process(frame(pointerHand(), { timestampMs: 0 }));
    const state = d.process(frame(pointerHand(), { timestampMs: 40 }));

    expect(state.gesture).toBe('pointer');
    expect(state.pointer).not.toBeNull();
    expect(state.clickEvent).toBeNull();
  });

  it('low confidence does not produce a pointer gesture', () => {
    const d = new HandGestureDetector();
    const state = d.process(frame(pointerHand(), { confidence: 0.05 }));
    expect(state.gesture).toBe('none');
    expect(state.pointer).toBeNull();
  });

  it('an ambiguous hand pose (fewer than 21 landmarks) is treated as no hand', () => {
    const d = new HandGestureDetector();
    const state = d.process(frame(pointerHand().slice(0, 10)));
    expect(state.gesture).toBe('none');
  });
});

describe('HandGestureDetector - pinch / click debounce', () => {
  it('pinch start produces exactly one click', () => {
    const d = new HandGestureDetector();
    d.process(frame(pointerHand(), { timestampMs: 0 }));
    const state = d.process(frame(pinchedHand(), { timestampMs: 40 }));

    expect(state.gesture).toBe('pinch_start');
    expect(state.clickEvent).toBe('left');
  });

  it('pinch held produces zero additional clicks', () => {
    const d = new HandGestureDetector();
    d.process(frame(pointerHand(), { timestampMs: 0 }));
    const start = d.process(frame(pinchedHand(), { timestampMs: 40 }));
    expect(start.clickEvent).toBe('left');

    let t = 40;
    for (let i = 0; i < 10; i++) {
      t += 40;
      const held = d.process(frame(pinchedHand(), { timestampMs: t }));
      expect(held.clickEvent).toBeNull();
      expect(held.gesture).toBe('pinch_held');
    }
  });

  it('pinch release resets to pointer with no click', () => {
    const d = new HandGestureDetector();
    d.process(frame(pointerHand(), { timestampMs: 0 }));
    d.process(frame(pinchedHand(), { timestampMs: 40 }));
    const released = d.process(frame(pointerHand(), { timestampMs: 80 }));

    expect(released.gesture).toBe('pointer');
    expect(released.clickEvent).toBeNull();
  });

  it('pinch again after release produces one new click', () => {
    const d = new HandGestureDetector();
    d.process(frame(pointerHand(), { timestampMs: 0 }));
    d.process(frame(pinchedHand(), { timestampMs: 40 }));
    d.process(frame(pointerHand(), { timestampMs: 80 }));

    // Advance past the click cooldown before pinching again.
    const t = 80 + DEFAULT_HAND_GESTURE_THRESHOLDS.clickCooldownMs + 40;
    const second = d.process(frame(pinchedHand(), { timestampMs: t }));

    expect(second.gesture).toBe('pinch_start');
    expect(second.clickEvent).toBe('left');
  });

  it('rapid pinch/release cycles within the cooldown do not produce extra clicks', () => {
    const d = new HandGestureDetector();
    d.process(frame(pointerHand(), { timestampMs: 0 }));
    const first = d.process(frame(pinchedHand(), { timestampMs: 40 }));
    expect(first.clickEvent).toBe('left');

    d.process(frame(pointerHand(), { timestampMs: 60 }));
    // Second pinch well within clickCooldownMs (350ms default) of the first.
    const second = d.process(frame(pinchedHand(), { timestampMs: 100 }));
    expect(second.gesture).toBe('pinch_start'); // state machine still sees a fresh pinch...
    expect(second.clickEvent).toBeNull(); // ...but the cooldown suppresses the click itself
  });
});

describe('HandGestureDetector - drag', () => {
  it('pinch start, movement, pinch release produces mouseDown/mouseUp-shaped events (dragStart then dragEnd)', () => {
    const d = new HandGestureDetector();
    d.process(frame(pointerHand(), { timestampMs: 0 }));
    const start = d.process(frame(pinchedHand(), { timestampMs: 40 }));
    expect(start.gesture).toBe('pinch_start');
    expect(start.dragStart).toBe(false);

    // Move the pinched hand significantly (index tip moves far from the pinch-start point).
    const movedHand = pinchedHand();
    movedHand[8] = { x: movedHand[8].x + 0.3, y: movedHand[8].y, z: 0 };
    movedHand[4] = { x: movedHand[8].x, y: movedHand[8].y, z: 0 }; // keep pinched while moving
    const dragging = d.process(frame(movedHand, { timestampMs: 80 }));

    expect(dragging.gesture).toBe('drag');
    expect(dragging.dragStart).toBe(true);

    // Continue holding - no repeated dragStart.
    const stillDragging = d.process(frame(movedHand, { timestampMs: 120 }));
    expect(stillDragging.gesture).toBe('drag');
    expect(stillDragging.dragStart).toBe(false);
    expect(stillDragging.dragEnd).toBe(false);

    // Release the pinch.
    const released = d.process(frame(pointerHand(), { timestampMs: 160 }));
    expect(released.dragEnd).toBe(true);
    expect(released.gesture).toBe('pointer');
  });

  it('a stationary pinch (no significant movement) never transitions to drag', () => {
    const d = new HandGestureDetector();
    d.process(frame(pointerHand(), { timestampMs: 0 }));
    d.process(frame(pinchedHand(), { timestampMs: 40 }));

    let t = 40;
    for (let i = 0; i < 10; i++) {
      t += 40;
      const state = d.process(frame(pinchedHand(), { timestampMs: t }));
      expect(state.gesture).toBe('pinch_held');
      expect(state.dragStart).toBe(false);
    }
  });
});

describe('HandGestureDetector - two-finger (right click)', () => {
  it('index + middle extended produces one right click', () => {
    const d = new HandGestureDetector();
    d.process(frame(pointerHand(), { timestampMs: 0 }));
    d.process(frame(twoFingerHand(), { timestampMs: 40 }));
    const state = d.process(frame(twoFingerHand(), { timestampMs: 80 }));

    expect(state.gesture).toBe('two_finger');
    expect(state.clickEvent).toBe('right');
  });

  it('holding the two-finger pose does not produce dozens of clicks', () => {
    const d = new HandGestureDetector();
    d.process(frame(pointerHand(), { timestampMs: 0 }));
    let t = 0;
    let clickCount = 0;
    for (let i = 0; i < 20; i++) {
      t += 40;
      const state = d.process(frame(twoFingerHand(), { timestampMs: t }));
      if (state.clickEvent === 'right') clickCount++;
    }
    expect(clickCount).toBe(1);
  });
});

describe('HandGestureDetector - open palm (pause)', () => {
  it('all four fingers extended is recognized as open_palm', () => {
    const d = new HandGestureDetector();
    d.process(frame(pointerHand(), { timestampMs: 0 }));
    d.process(frame(openPalmHand(), { timestampMs: 40 }));
    const state = d.process(frame(openPalmHand(), { timestampMs: 80 }));

    expect(state.gesture).toBe('open_palm');
    expect(state.clickEvent).toBeNull();
  });

  it('open palm reported every frame it persists (level-triggered, not edge)', () => {
    const d = new HandGestureDetector();
    d.process(frame(pointerHand(), { timestampMs: 0 }));
    // First open-palm frame only primes the confirm streak (confirmFrames=2 default) -
    // assert persistence starting from the second frame, once it's actually confirmed.
    d.process(frame(openPalmHand(), { timestampMs: 40 }));
    let t = 40;
    for (let i = 0; i < 5; i++) {
      t += 40;
      const state = d.process(frame(openPalmHand(), { timestampMs: t }));
      expect(state.gesture).toBe('open_palm');
    }
  });
});

describe('HandGestureDetector - fist (emergency stop)', () => {
  it('all fingers curled is recognized as fist', () => {
    const d = new HandGestureDetector();
    d.process(frame(pointerHand(), { timestampMs: 0 }));
    d.process(frame(fistHand(), { timestampMs: 40 }));
    const state = d.process(frame(fistHand(), { timestampMs: 80 }));

    expect(state.gesture).toBe('fist');
  });

  it('a fist during an active drag reports dragEnd so the caller releases the button', () => {
    const d = new HandGestureDetector();
    d.process(frame(pointerHand(), { timestampMs: 0 }));
    d.process(frame(pinchedHand(), { timestampMs: 40 }));
    const movedHand = pinchedHand();
    movedHand[8] = { x: movedHand[8].x + 0.3, y: movedHand[8].y, z: 0 };
    movedHand[4] = { x: movedHand[8].x, y: movedHand[8].y, z: 0 };
    const dragging = d.process(frame(movedHand, { timestampMs: 80 }));
    expect(dragging.gesture).toBe('drag');

    d.process(frame(fistHand(), { timestampMs: 120 }));
    const state = d.process(frame(fistHand(), { timestampMs: 160 }));
    expect(state.gesture).toBe('fist');
    // dragEnd fires on the transition frame (120), not necessarily every subsequent
    // fist frame - verify the transition frame specifically.
    const transition = new HandGestureDetector();
    transition.process(frame(pointerHand(), { timestampMs: 0 }));
    transition.process(frame(pinchedHand(), { timestampMs: 40 }));
    transition.process(frame(movedHand, { timestampMs: 80 }));
    const fistTransition = transition.process(frame(fistHand(), { timestampMs: 120 }));
    expect(fistTransition.dragEnd).toBe(true);
  });
});

describe('HandGestureDetector - noisy single-frame rejection', () => {
  it('a single noisy frame flickering to open-palm pose does not register the gesture', () => {
    const d = new HandGestureDetector();
    d.process(frame(pointerHand(), { timestampMs: 0 }));
    // One noisy frame only, then back to pointer - with confirmFrames=2 (default), a
    // single frame should never be enough to confirm open_palm.
    const noisy = d.process(frame(openPalmHand(), { timestampMs: 40 }));
    expect(noisy.gesture).not.toBe('open_palm');

    const after = d.process(frame(pointerHand(), { timestampMs: 80 }));
    expect(after.gesture).toBe('pointer');
  });
});

describe('HandGestureDetector - hand loss and recovery', () => {
  it('hand loss resets in-progress pinch state', () => {
    const d = new HandGestureDetector();
    d.process(frame(pointerHand(), { timestampMs: 0 }));
    d.process(frame(pinchedHand(), { timestampMs: 40 }));

    const lost = d.notifyHandLost(80);
    expect(lost.gesture).toBe('none');
    expect(lost.pointer).toBeNull();

    // A fresh pinch after recovery should start a brand-new pinch (and click), not
    // resume the old one. Recover well past the click cooldown from the first pinch (40)
    // so this second click isn't itself suppressed by the cooldown.
    const t = 40 + DEFAULT_HAND_GESTURE_THRESHOLDS.clickCooldownMs + 40;
    d.process(frame(pointerHand(), { timestampMs: t }));
    const state = d.process(frame(pinchedHand(), { timestampMs: t + 40 }));
    expect(state.gesture).toBe('pinch_start');
    expect(state.clickEvent).toBe('left');
  });

  it('hand loss during a drag reports dragEnd exactly once', () => {
    const d = new HandGestureDetector();
    d.process(frame(pointerHand(), { timestampMs: 0 }));
    d.process(frame(pinchedHand(), { timestampMs: 40 }));
    const movedHand = pinchedHand();
    movedHand[8] = { x: movedHand[8].x + 0.3, y: movedHand[8].y, z: 0 };
    movedHand[4] = { x: movedHand[8].x, y: movedHand[8].y, z: 0 };
    d.process(frame(movedHand, { timestampMs: 80 }));

    const lost = d.notifyHandLost(120);
    expect(lost.dragEnd).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { DrowsinessDetector, computeMouthOpenRatio, DEFAULT_DROWSINESS_THRESHOLDS } from './DrowsinessDetector';
import type { DrowsinessFrameInput } from './DrowsinessDetector';

// Deterministic timestamp helper - tests advance a fake clock explicitly rather than
// using Date.now()/performance.now(), per the project's existing testing convention
// (see GazeProcessor.test.ts / DiagnosticsRecorder.test.ts).
function frame(overrides: Partial<DrowsinessFrameInput> = {}): DrowsinessFrameInput {
  return {
    timestampMs: 0,
    leftEyeAperture: 0.3,
    rightEyeAperture: 0.3,
    mouthOpenRatio: 0.1,
    confidence: 0.9,
    isTracking: true,
    ...overrides,
  };
}

const OPEN = 0.3;
const CLOSED = 0.05; // below eyeClosedApertureThreshold (0.12)

describe('DrowsinessDetector - eye closure', () => {
  it('a normal blink (short closure) does not raise the level', () => {
    const d = new DrowsinessDetector();
    let t = 0;
    d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    t += 100;
    d.process(frame({ timestampMs: t, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED }));
    t += 100; // 100ms closure - a normal blink
    const state = d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));

    expect(state.level).toBe('normal');
  });

  it('a single noisy closed-aperture frame does not count as a closure event', () => {
    const d = new DrowsinessDetector();
    let t = 0;
    d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    t += 33; // one frame at ~30fps
    d.process(frame({ timestampMs: t, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED })); // noise
    t += 33;
    const state = d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));

    // A ~33ms closure is far below longBlinkMs (500ms) - should not register as a
    // "long" closure at all, just an ordinary blink.
    expect(state.prolongedBlinkCount).toBe(0);
    expect(state.level).toBe('normal');
  });

  it('a prolonged closure (>= eyeClosureWarningMs) raises the level toward warning', () => {
    const d = new DrowsinessDetector({ levelRiseConfirmMs: 0 });
    let t = 0;
    d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    t += DEFAULT_DROWSINESS_THRESHOLDS.eyeClosureWarningMs + 100;
    const state = d.process(frame({ timestampMs: t, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED }));

    expect(state.eyeClosureMs).toBeGreaterThanOrEqual(DEFAULT_DROWSINESS_THRESHOLDS.eyeClosureWarningMs);
    expect(state.level === 'warning' || state.level === 'attention' || state.level === 'critical').toBe(true);
    expect(state.reason).toBe('prolonged-closure');
  });

  it('a critical closure (>= eyeClosureCriticalMs) reaches the critical level', () => {
    const d = new DrowsinessDetector({ levelRiseConfirmMs: 0 });
    let t = 0;
    d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    t += DEFAULT_DROWSINESS_THRESHOLDS.eyeClosureCriticalMs + 100;
    const state = d.process(frame({ timestampMs: t, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED }));

    expect(state.level).toBe('critical');
  });

  it('closure recovery: reopening eyes eventually returns the level to normal', () => {
    const d = new DrowsinessDetector({ levelRiseConfirmMs: 0, levelFallConfirmMs: 500 });
    let t = 0;
    d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    t += DEFAULT_DROWSINESS_THRESHOLDS.eyeClosureCriticalMs + 100;
    const critical = d.process(frame({ timestampMs: t, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED }));
    expect(critical.level).toBe('critical');

    t += 50;
    d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    t += 600; // past levelFallConfirmMs of sustained open/normal evidence
    const recovered = d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));

    expect(recovered.level).toBe('normal');
  });
});

describe('DrowsinessDetector - blink frequency', () => {
  it('a normal blink rate does not trigger frequent-blinking', () => {
    const d = new DrowsinessDetector();
    let t = 0;
    // 5 short blinks over a minute - well under highBlinkRateThreshold (35)
    for (let i = 0; i < 5; i++) {
      d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
      t += 100;
      d.process(frame({ timestampMs: t, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED }));
      t += 150;
      d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
      t += 10_000;
    }
    const state = d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    expect(state.recentBlinkCount).toBeLessThan(DEFAULT_DROWSINESS_THRESHOLDS.highBlinkRateThreshold);
    expect(state.reason).not.toBe('frequent-blinking');
  });

  it('a high blink rate within the rolling window is tracked as frequent blinking', () => {
    const d = new DrowsinessDetector({ levelRiseConfirmMs: 0 });
    let t = 0;
    d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    for (let i = 0; i < DEFAULT_DROWSINESS_THRESHOLDS.highBlinkRateThreshold + 5; i++) {
      t += 300;
      d.process(frame({ timestampMs: t, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED }));
      t += 100;
      d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    }
    const state = d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));

    expect(state.recentBlinkCount).toBeGreaterThanOrEqual(DEFAULT_DROWSINESS_THRESHOLDS.highBlinkRateThreshold);
  });

  it('the rolling window expires old blinks', () => {
    const d = new DrowsinessDetector();
    let t = 0;
    d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    t += 100;
    d.process(frame({ timestampMs: t, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED }));
    t += 150;
    d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));

    // Jump forward well past the blink window - the earlier blink should no longer count.
    t += DEFAULT_DROWSINESS_THRESHOLDS.blinkWindowMs + 1000;
    const state = d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));

    expect(state.recentBlinkCount).toBe(0);
  });

  it('a high blink rate alone (no prolonged closures) does not immediately reach critical', () => {
    const d = new DrowsinessDetector({ levelRiseConfirmMs: 0 });
    let t = 0;
    d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    for (let i = 0; i < DEFAULT_DROWSINESS_THRESHOLDS.highBlinkRateThreshold + 10; i++) {
      t += 300;
      d.process(frame({ timestampMs: t, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED }));
      t += 100; // short blinks only, never long enough to be "prolonged"
      d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    }
    const state = d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));

    expect(state.level).not.toBe('critical');
  });
});

describe('DrowsinessDetector - yawn detection', () => {
  it('a short mouth opening does not trigger a yawn', () => {
    const d = new DrowsinessDetector();
    let t = 0;
    d.process(frame({ timestampMs: t, mouthOpenRatio: 0.1 }));
    t += 100;
    d.process(frame({ timestampMs: t, mouthOpenRatio: 0.7 })); // open
    t += 200; // well under yawnMinimumDurationMs (700ms)
    const state = d.process(frame({ timestampMs: t, mouthOpenRatio: 0.1 }));

    expect(state.yawnCount).toBe(0);
  });

  it('a sustained mouth opening triggers a confirmed yawn', () => {
    const d = new DrowsinessDetector();
    let t = 0;
    d.process(frame({ timestampMs: t, mouthOpenRatio: 0.1 }));
    t += 100;
    d.process(frame({ timestampMs: t, mouthOpenRatio: 0.7 }));
    t += DEFAULT_DROWSINESS_THRESHOLDS.yawnMinimumDurationMs + 100;
    const state = d.process(frame({ timestampMs: t, mouthOpenRatio: 0.7 }));

    expect(state.yawnCount).toBe(1);
    expect(state.lastYawnAt).toBe(t);
  });

  it('repeated rapid mouth movement (talking) does not spam yawn events', () => {
    const d = new DrowsinessDetector();
    let t = 0;
    // Simulate talking: mouth opens and closes rapidly, never staying open long enough.
    for (let i = 0; i < 20; i++) {
      d.process(frame({ timestampMs: t, mouthOpenRatio: 0.7 }));
      t += 150; // under yawnMinimumDurationMs each time
      d.process(frame({ timestampMs: t, mouthOpenRatio: 0.1 }));
      t += 150;
    }
    const state = d.process(frame({ timestampMs: t, mouthOpenRatio: 0.1 }));

    expect(state.yawnCount).toBe(0);
  });

  it('the yawn cooldown prevents a second yawn immediately after the first', () => {
    const d = new DrowsinessDetector();
    let t = 0;
    d.process(frame({ timestampMs: t, mouthOpenRatio: 0.1 }));
    t += 100;
    d.process(frame({ timestampMs: t, mouthOpenRatio: 0.7 }));
    t += DEFAULT_DROWSINESS_THRESHOLDS.yawnMinimumDurationMs + 50;
    const first = d.process(frame({ timestampMs: t, mouthOpenRatio: 0.7 }));
    expect(first.yawnCount).toBe(1);

    // Close and reopen quickly, well inside the cooldown window.
    t += 100;
    d.process(frame({ timestampMs: t, mouthOpenRatio: 0.1 }));
    t += 100;
    d.process(frame({ timestampMs: t, mouthOpenRatio: 0.7 }));
    t += DEFAULT_DROWSINESS_THRESHOLDS.yawnMinimumDurationMs + 50;
    const second = d.process(frame({ timestampMs: t, mouthOpenRatio: 0.7 }));

    expect(second.yawnCount).toBe(1); // still 1 - cooldown blocked the second

    // Now advance past the cooldown and confirm a genuine third yawn can fire.
    t += DEFAULT_DROWSINESS_THRESHOLDS.yawnCooldownMs + 100;
    d.process(frame({ timestampMs: t, mouthOpenRatio: 0.1 }));
    t += 100;
    d.process(frame({ timestampMs: t, mouthOpenRatio: 0.7 }));
    t += DEFAULT_DROWSINESS_THRESHOLDS.yawnMinimumDurationMs + 50;
    const third = d.process(frame({ timestampMs: t, mouthOpenRatio: 0.7 }));

    expect(third.yawnCount).toBe(2);
  });
});

describe('DrowsinessDetector - combined signals', () => {
  it('a prolonged closure plus a recent yawn scores higher than either alone', () => {
    const closureOnly = new DrowsinessDetector({ levelRiseConfirmMs: 0 });
    let t = 0;
    closureOnly.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    t += DEFAULT_DROWSINESS_THRESHOLDS.eyeClosureWarningMs + 50;
    const closureOnlyState = closureOnly.process(
      frame({ timestampMs: t, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED })
    );

    const combined = new DrowsinessDetector({ levelRiseConfirmMs: 0 });
    let t2 = 0;
    combined.process(frame({ timestampMs: t2, mouthOpenRatio: 0.1 }));
    t2 += 100;
    combined.process(frame({ timestampMs: t2, mouthOpenRatio: 0.7 }));
    t2 += DEFAULT_DROWSINESS_THRESHOLDS.yawnMinimumDurationMs + 50;
    combined.process(frame({ timestampMs: t2, mouthOpenRatio: 0.7, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    t2 += DEFAULT_DROWSINESS_THRESHOLDS.eyeClosureWarningMs + 50;
    const combinedState = combined.process(
      frame({ timestampMs: t2, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED, mouthOpenRatio: 0.1 })
    );

    expect(combinedState.score).toBeGreaterThan(closureOnlyState.score);
    expect(combinedState.reason).toBe('combined');
  });

  it('repeated long closures increase the score beyond a single long closure', () => {
    const d = new DrowsinessDetector({ levelRiseConfirmMs: 0 });
    let t = 0;
    d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));

    // Three separate long-but-not-warning-level closures (each >= longBlinkMs, well
    // under eyeClosureWarningMs individually).
    for (let i = 0; i < 3; i++) {
      t += DEFAULT_DROWSINESS_THRESHOLDS.longBlinkMs + 50;
      d.process(frame({ timestampMs: t, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED }));
      t += 50;
      d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
      t += 200;
    }

    const state = d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    expect(state.prolongedBlinkCount).toBeGreaterThanOrEqual(DEFAULT_DROWSINESS_THRESHOLDS.repeatedLongClosureCount);
    expect(state.score).toBeGreaterThan(0);
  });

  it('score transitions correctly from normal through attention to warning as evidence accumulates', () => {
    const d = new DrowsinessDetector({ levelRiseConfirmMs: 0 });
    let t = 0;
    const normal = d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    expect(normal.level).toBe('normal');

    t += DEFAULT_DROWSINESS_THRESHOLDS.longBlinkMs + 50;
    const afterLongBlink = d.process(frame({ timestampMs: t, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED }));
    // A single long-but-not-warning blink alone should not reach 'warning'.
    expect(afterLongBlink.level).not.toBe('warning');

    t += 50;
    d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    t += DEFAULT_DROWSINESS_THRESHOLDS.eyeClosureWarningMs + 50;
    const afterProlonged = d.process(frame({ timestampMs: t, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED }));
    expect(afterProlonged.level === 'warning' || afterProlonged.level === 'critical').toBe(true);
  });
});

describe('DrowsinessDetector - tracking loss handling', () => {
  it('a missing face (isTracking: false) does not count as eye closure', () => {
    const d = new DrowsinessDetector();
    let t = 0;
    d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    t += DEFAULT_DROWSINESS_THRESHOLDS.eyeClosureCriticalMs + 500;
    // Face lost for the entire duration that would otherwise be a critical closure.
    const state = d.process(frame({ timestampMs: t, isTracking: false }));

    expect(state.level).not.toBe('critical');
    expect(state.eyeClosureMs).toBe(0);
  });

  it('low confidence does not trigger a false drowsiness event', () => {
    const d = new DrowsinessDetector();
    let t = 0;
    d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    t += DEFAULT_DROWSINESS_THRESHOLDS.eyeClosureCriticalMs + 500;
    const state = d.process(
      frame({ timestampMs: t, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED, confidence: 0.1 })
    );

    expect(state.level).not.toBe('critical');
  });

  it('using notifyTrackingLost explicitly pauses the detector the same way', () => {
    const d = new DrowsinessDetector();
    let t = 0;
    d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    t += 500;
    d.process(frame({ timestampMs: t, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED }));
    t += 1000; // partway into what would become a long closure
    d.notifyTrackingLost(t);
    t += DEFAULT_DROWSINESS_THRESHOLDS.eyeClosureCriticalMs;
    // Tracking resumes with eyes still reading closed - should not inherit the
    // pre-loss closure start time and immediately report a critical closure.
    const state = d.process(frame({ timestampMs: t, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED }));

    expect(state.level).not.toBe('critical');
  });

  it('recovery resumes correctly after tracking loss ends', () => {
    const d = new DrowsinessDetector();
    let t = 0;
    d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    t += 200;
    d.notifyTrackingLost(t);
    t += 300; // short gap, under trackingLossResetMs
    const state = d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));

    expect(state.level).toBe('normal');
    expect(state.confidence).toBeCloseTo(0.9, 1);
  });

  it('a long tracking-loss gap resets to a clean baseline rather than resuming stale state', () => {
    const d = new DrowsinessDetector({ levelRiseConfirmMs: 0 });
    let t = 0;
    d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    // Build up some blink history.
    for (let i = 0; i < 10; i++) {
      t += 300;
      d.process(frame({ timestampMs: t, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED }));
      t += 100;
      d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    }
    const beforeLoss = d.getState();
    expect(beforeLoss.recentBlinkCount).toBeGreaterThan(0);

    // Simulate an actual tracking-loss gap (not just a large timestamp jump between two
    // still-"tracking" frames, which would mean something different - real camera
    // frames captured 5s apart with tracking never lost).
    t += DEFAULT_DROWSINESS_THRESHOLDS.trackingLossResetMs + 1000;
    d.notifyTrackingLost(t);
    const afterLongLoss = d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));

    expect(afterLongLoss.recentBlinkCount).toBe(0);
    expect(afterLongLoss.level).toBe('normal');
  });
});

describe('DrowsinessDetector - hysteresis', () => {
  it('does not oscillate between normal and warning on alternating noisy frames', () => {
    const d = new DrowsinessDetector(); // default hysteresis timings
    let t = 0;
    const levels: string[] = [];
    for (let i = 0; i < 30; i++) {
      const closed = i % 2 === 0;
      t += 40;
      const state = d.process(
        frame({
          timestampMs: t,
          leftEyeAperture: closed ? CLOSED : OPEN,
          rightEyeAperture: closed ? CLOSED : OPEN,
        })
      );
      levels.push(state.level);
    }
    // Rapidly alternating open/closed every ~40ms never produces a sustained closure
    // long enough to matter, and levelRiseConfirmMs further requires consistent
    // evidence - the level should never leave 'normal' under this noise pattern.
    expect(levels.every((l) => l === 'normal')).toBe(true);
  });

  it('requires sustained evidence before rising, and sustained recovery before falling', () => {
    const d = new DrowsinessDetector({ levelRiseConfirmMs: 500, levelFallConfirmMs: 500 });
    let t = 0;
    d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));

    t += DEFAULT_DROWSINESS_THRESHOLDS.eyeClosureWarningMs + 10;
    const justCrossed = d.process(frame({ timestampMs: t, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED }));
    // Evidence just started supporting a rise - not yet confirmed (rise-confirm window hasn't elapsed).
    expect(justCrossed.level).toBe('normal');

    t += 600; // past levelRiseConfirmMs while still closed
    const confirmed = d.process(frame({ timestampMs: t, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED }));
    expect(confirmed.level).not.toBe('normal');
  });
});

describe('DrowsinessDetector - notification cooldown (consumer-side pattern)', () => {
  // The detector itself is a pure state machine and does not fire side effects - cooldown
  // for *notifications* (voice/visual) is the consumer's responsibility (see
  // useDrowsinessGuard), gated on level + a timestamp the consumer tracks. This test
  // documents that the detector's own state is stable enough (thanks to hysteresis) to
  // build such a cooldown on top of, by confirming repeated processing at a sustained
  // level does not itself change lastYawnAt/score in a way that would defeat a
  // level-change-triggered notification.
  it('state.level remains stable across repeated frames once confirmed, enabling edge-triggered notification logic', () => {
    const d = new DrowsinessDetector({ levelRiseConfirmMs: 0 });
    let t = 0;
    d.process(frame({ timestampMs: t, leftEyeAperture: OPEN, rightEyeAperture: OPEN }));
    t += DEFAULT_DROWSINESS_THRESHOLDS.eyeClosureCriticalMs + 100;
    const first = d.process(frame({ timestampMs: t, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED }));
    expect(first.level).toBe('critical');

    for (let i = 0; i < 5; i++) {
      t += 100;
      const state = d.process(frame({ timestampMs: t, leftEyeAperture: CLOSED, rightEyeAperture: CLOSED }));
      expect(state.level).toBe('critical');
    }
  });
});

describe('computeMouthOpenRatio', () => {
  const eyeSpan = 0.1;

  it('returns null when required mouth landmarks are missing', () => {
    const landmarks: { x: number; y: number }[] = [];
    expect(computeMouthOpenRatio(landmarks, eyeSpan)).toBeNull();
  });

  it('returns a small ratio for a closed mouth', () => {
    const landmarks: { x: number; y: number }[] = [];
    landmarks[61] = { x: 0.45, y: 0.7 };
    landmarks[291] = { x: 0.55, y: 0.7 };
    landmarks[13] = { x: 0.5, y: 0.69 };
    landmarks[14] = { x: 0.5, y: 0.695 }; // small lip gap

    const ratio = computeMouthOpenRatio(landmarks, eyeSpan);
    expect(ratio).not.toBeNull();
    expect(ratio as number).toBeLessThan(0.3);
  });

  it('returns a larger ratio for an open mouth', () => {
    const landmarks: { x: number; y: number }[] = [];
    landmarks[61] = { x: 0.45, y: 0.7 };
    landmarks[291] = { x: 0.55, y: 0.7 };
    landmarks[13] = { x: 0.5, y: 0.68 };
    landmarks[14] = { x: 0.5, y: 0.75 }; // large lip gap

    const ratio = computeMouthOpenRatio(landmarks, eyeSpan);
    expect(ratio).not.toBeNull();
    expect(ratio as number).toBeGreaterThan(0.4);
  });

  it('falls back to a default span when eyeSpan is zero (matches computeEyeAperture convention)', () => {
    const landmarks: { x: number; y: number }[] = [];
    landmarks[61] = { x: 0.45, y: 0.7 };
    landmarks[291] = { x: 0.55, y: 0.7 };
    landmarks[13] = { x: 0.5, y: 0.69 };
    landmarks[14] = { x: 0.5, y: 0.7 };

    expect(() => computeMouthOpenRatio(landmarks, 0)).not.toThrow();
    expect(Number.isFinite(computeMouthOpenRatio(landmarks, 0))).toBe(true);
  });
});

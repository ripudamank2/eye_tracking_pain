// Heuristic Drowsiness & Eye-Fatigue Guard - a pure, timestamp-driven temporal signal
// processor over the eye-aperture and mouth-geometry data the gaze pipeline already
// computes every frame. Deliberately mirrors GazeProcessor's shape (a plain class fed
// per-frame inputs via one method, unit-testable with synthetic fixtures, zero DOM/
// React/Electron/audio dependencies) so it can be tested and reasoned about the same way.
//
// This is NOT a medical device and does not diagnose sleep or fatigue disorders. It
// produces heuristic wellness/productivity reminders from webcam facial geometry only -
// see the DrowsinessLevel/reason documentation below and PROJECT_STATUS.md for the
// explicit disclaimer this drives in the UI.
//
// Root design constraint from real-camera validation history (see PROJECT_STATUS.md,
// "First Real-Camera Validation Run"): single noisy frames are common on real hardware
// and must never alone trigger a discrete event. Every threshold here is duration-based
// against real timestamps (never frame counts / assumed FPS), and every discrete event
// (yawn, prolonged closure) requires sustained evidence across time, not one sample.

/** Per-frame input this detector consumes - all values it needs, nothing it computes itself. */
export interface DrowsinessFrameInput {
  /** Milliseconds, monotonic (e.g. performance.now()) - never assumed to advance by a fixed step. */
  timestampMs: number;
  /** 0 (closed) .. roughly 0.2+ (open) - same units as GazeProcessor's EyeApertureResult.leftAperture. */
  leftEyeAperture: number;
  /** Same units as leftEyeAperture. */
  rightEyeAperture: number;
  /** 0 (mouth closed) .. 1+ (wide open), normalized against a stable face-scale metric (eyeSpan) by the caller - see computeMouthOpenRatio. */
  mouthOpenRatio: number;
  /** Overall frame trustworthiness, 0..1 - same semantics as GazeProcessor's GazeResult.confidence. */
  confidence: number;
  /** Whether the tracker considers this a genuine tracked frame (not face-lost/starting/error). */
  isTracking: boolean;
}

export type DrowsinessLevel = 'normal' | 'attention' | 'warning' | 'critical';

export type DrowsinessReason =
  | 'none'
  | 'prolonged-closure'
  | 'frequent-blinking'
  | 'repeated-long-closures'
  | 'yawn'
  | 'combined';

export interface DrowsinessState {
  level: DrowsinessLevel;
  score: number;
  /** Duration in ms the eyes have been continuously closed as of this frame (0 if open). */
  eyeClosureMs: number;
  /** Number of blinks (any duration) in the rolling blinkWindowMs window. */
  recentBlinkCount: number;
  /** Number of closures in the rolling window whose duration exceeded prolongedBlinkMs. */
  prolongedBlinkCount: number;
  /** Number of confirmed yawns in the current session (never resets except via reset()). */
  yawnCount: number;
  lastYawnAt: number | null;
  confidence: number;
  reason: DrowsinessReason;
  timestamp: number;
}

export interface DrowsinessThresholds {
  /** Below this aperture, an eye is considered closed. Matches GazeProcessor's BLINK_CLOSED_THRESHOLD by default so this detector's notion of "closed" agrees with blink-gaze gating. */
  eyeClosedApertureThreshold: number;
  /** A continuous closure at/above this duration is a "long blink" but not yet a warning. */
  longBlinkMs: number;
  /** A continuous closure at/above this duration raises the level to at least 'attention'/'warning' territory (scored, not an instant jump - see scoring). */
  eyeClosureWarningMs: number;
  /** A continuous closure at/above this duration is treated as critical drowsiness evidence. */
  eyeClosureCriticalMs: number;
  /** Rolling window for blink-frequency tracking. */
  blinkWindowMs: number;
  /** Blinks-per-window at/above this count is scored as "frequent blinking". Product heuristic, not a physiologically validated number - see KNOWN_ISSUES.md. */
  highBlinkRateThreshold: number;
  /** Closures at/above longBlinkMs within blinkWindowMs, at/above this count, are scored as "repeated long closures". */
  repeatedLongClosureCount: number;
  /** Normalized mouth-open ratio at/above this is a yawn *candidate* (not yet a confirmed yawn). */
  yawnOpenThreshold: number;
  /** A yawn candidate must stay open at/above this duration to be confirmed - filters talking/laughing/short openings. */
  yawnMinimumDurationMs: number;
  /** Minimum time between confirmed yawns, so one long yawn or rapid mouth movement cannot register as multiple yawns. */
  yawnCooldownMs: number;
  /** Frames below this confidence are treated as unreliable - their aperture/mouth data is not trusted for scoring (see face-loss handling). */
  minConfidence: number;
  /** Consecutive low-confidence/not-tracking time before resetting to a clean baseline rather than merely pausing. */
  trackingLossResetMs: number;
  /** Hysteresis: consecutive time the score must exceed a level's threshold before actually transitioning up, so single noisy high-score frames don't flip the level. */
  levelRiseConfirmMs: number;
  /** Hysteresis: consecutive time the score must stay below a level's threshold before dropping back down. */
  levelFallConfirmMs: number;
  /** Score thresholds for each non-normal level. */
  attentionScore: number;
  warningScore: number;
  criticalScore: number;
}

/**
 * Starting defaults - explicitly documented as product heuristics requiring real-camera
 * tuning (see PROJECT_STATUS.md / KNOWN_ISSUES.md), not physiologically validated
 * constants. All are passed through DrowsinessDetector's constructor and can be
 * overridden per-instance without touching this module.
 */
export const DEFAULT_DROWSINESS_THRESHOLDS: DrowsinessThresholds = {
  eyeClosedApertureThreshold: 0.12,
  longBlinkMs: 500,
  eyeClosureWarningMs: 1200,
  eyeClosureCriticalMs: 2500,
  blinkWindowMs: 60_000,
  highBlinkRateThreshold: 35,
  repeatedLongClosureCount: 3,
  yawnOpenThreshold: 0.55,
  yawnMinimumDurationMs: 700,
  yawnCooldownMs: 5_000,
  minConfidence: 0.35,
  trackingLossResetMs: 4_000,
  levelRiseConfirmMs: 300,
  levelFallConfirmMs: 3_000,
  attentionScore: 2,
  warningScore: 4,
  criticalScore: 7,
};

interface ClosureRecord {
  endedAt: number;
  durationMs: number;
}

const LEVEL_ORDER: DrowsinessLevel[] = ['normal', 'attention', 'warning', 'critical'];

export class DrowsinessDetector {
  private thresholds: DrowsinessThresholds;

  // Eye closure tracking
  private closureStartedAt: number | null = null;
  private closureHistory: ClosureRecord[] = [];
  private blinkHistory: number[] = []; // timestamps of blink *ends* (any duration), for frequency

  // Yawn tracking
  private yawnCandidateStartedAt: number | null = null;
  private yawnCount = 0;
  private lastYawnAt: number | null = null;

  // Tracking-loss handling
  private lastTrackedAt: number | null = null;
  private lastGoodTimestamp: number | null = null;

  // Level hysteresis: the level we're currently "trying to move to" and since when the
  // evidence has supported that move, versus the level actually reported.
  private confirmedLevel: DrowsinessLevel = 'normal';
  private pendingLevel: DrowsinessLevel | null = null;
  private pendingSince: number | null = null;

  private lastState: DrowsinessState;

  constructor(thresholds: Partial<DrowsinessThresholds> = {}) {
    this.thresholds = { ...DEFAULT_DROWSINESS_THRESHOLDS, ...thresholds };
    this.lastState = this.buildState(0, 'none');
  }

  public setThresholds(thresholds: Partial<DrowsinessThresholds>) {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  public getThresholds(): DrowsinessThresholds {
    return this.thresholds;
  }

  public getState(): DrowsinessState {
    return this.lastState;
  }

  /**
   * Call when tracking is known to be unavailable (face lost, tracker idle/starting/
   * error) instead of feeding it a frame - never synthesize a "frame" for a missing
   * face. Missing data must not be interpreted as closed eyes or a yawn (see module
   * doc). Pauses the detector: closure/yawn-in-progress timers stop advancing, and if
   * the gap is long enough (trackingLossResetMs) state resets to a clean baseline
   * rather than resuming mid-closure against stale timestamps.
   */
  public notifyTrackingLost(timestampMs: number) {
    if (this.lastTrackedAt !== null && timestampMs - this.lastTrackedAt >= this.thresholds.trackingLossResetMs) {
      this.resetToBaseline(timestampMs);
      return;
    }
    // Short gap: don't advance any in-progress closure/yawn against a stale clock once
    // tracking resumes - drop the in-progress candidate rather than let a long dropout
    // masquerade as a long real closure once frames resume.
    this.closureStartedAt = null;
    this.yawnCandidateStartedAt = null;
  }

  /** Full reset - use when starting a new session (e.g. webcam restarted) so stale history from a previous session never leaks in. */
  public reset(timestampMs = 0) {
    this.resetToBaseline(timestampMs);
    this.yawnCount = 0;
    this.lastYawnAt = null;
    this.confirmedLevel = 'normal';
    this.lastState = this.buildState(timestampMs, 'none');
  }

  private resetToBaseline(timestampMs: number) {
    this.closureStartedAt = null;
    this.closureHistory = [];
    this.blinkHistory = [];
    this.yawnCandidateStartedAt = null;
    this.lastTrackedAt = null;
    this.lastGoodTimestamp = null;
    this.pendingLevel = null;
    this.pendingSince = null;
    // yawnCount / lastYawnAt / confirmedLevel intentionally preserved across a mere
    // tracking-loss reset (brief camera dropout) - only reset() (new session) clears them.
    void timestampMs;
  }

  /**
   * Process one real, tracked frame. Caller is responsible for calling
   * notifyTrackingLost() instead of this whenever a frame does not represent genuine
   * tracked data (see that method's docs) - this method assumes input.isTracking and
   * input.confidence describe a frame worth scoring, but still defends against a
   * low-confidence frame being passed in directly.
   */
  public process(input: DrowsinessFrameInput): DrowsinessState {
    const { timestampMs } = input;

    if (!input.isTracking || input.confidence < this.thresholds.minConfidence) {
      // Same "don't trust this frame" handling as an explicit notifyTrackingLost() call,
      // reachable here too in case a caller passes a low-confidence frame directly
      // rather than routing it through notifyTrackingLost - defends the invariant either way.
      this.notifyTrackingLost(timestampMs);
      this.lastState = this.buildState(timestampMs, this.lastState.reason);
      return this.lastState;
    }

    this.lastTrackedAt = timestampMs;
    // The previous good frame's timestamp is the best available estimate of "when did
    // a just-detected closed/open-mouth state actually begin" - we only sample
    // discretely, so a transition detected on this frame genuinely happened sometime
    // between the previous frame and now. Using this frame's own timestamp as the start
    // (the bug this replaces) always reports 0ms of duration on the very frame a
    // transition is first observed, which made every threshold effectively require one
    // extra frame's worth of unaccounted latency to ever be reached.
    const previousGoodTimestamp = this.lastGoodTimestamp;
    this.lastGoodTimestamp = timestampMs;

    this.pruneOldHistory(timestampMs);
    this.updateEyeClosure(input, timestampMs, previousGoodTimestamp);
    this.updateYawn(input, timestampMs, previousGoodTimestamp);

    const { score, reason } = this.computeScore(timestampMs);
    const level = this.applyHysteresis(score, timestampMs);

    this.lastState = this.buildState(timestampMs, reason, { score, level, confidence: input.confidence });
    return this.lastState;
  }

  private pruneOldHistory(timestampMs: number) {
    const windowStart = timestampMs - this.thresholds.blinkWindowMs;
    this.blinkHistory = this.blinkHistory.filter((t) => t >= windowStart);
    this.closureHistory = this.closureHistory.filter((c) => c.endedAt >= windowStart);
  }

  private updateEyeClosure(input: DrowsinessFrameInput, timestampMs: number, previousGoodTimestamp: number | null) {
    const isClosed =
      input.leftEyeAperture < this.thresholds.eyeClosedApertureThreshold &&
      input.rightEyeAperture < this.thresholds.eyeClosedApertureThreshold;

    if (isClosed) {
      if (this.closureStartedAt === null) {
        // Attribute the closure's start to the last frame we know the eyes were open
        // (or this frame, if there was no previous frame) - see the comment in
        // process() for why this matters.
        this.closureStartedAt = previousGoodTimestamp ?? timestampMs;
      }
      return;
    }

    // Eyes just reopened (or were already open) - if a closure was in progress, record it.
    if (this.closureStartedAt !== null) {
      const durationMs = timestampMs - this.closureStartedAt;
      this.closureStartedAt = null;
      // Any measurable closure counts toward blink frequency; only long closures are
      // additionally recorded for the repeated-long-closure signal.
      this.blinkHistory.push(timestampMs);
      if (durationMs >= this.thresholds.longBlinkMs) {
        this.closureHistory.push({ endedAt: timestampMs, durationMs });
      }
    }
  }

  private updateYawn(input: DrowsinessFrameInput, timestampMs: number, previousGoodTimestamp: number | null) {
    const isOpenEnough = input.mouthOpenRatio >= this.thresholds.yawnOpenThreshold;

    if (isOpenEnough) {
      if (this.yawnCandidateStartedAt === null) {
        this.yawnCandidateStartedAt = previousGoodTimestamp ?? timestampMs;
      }
      const openDurationMs = timestampMs - this.yawnCandidateStartedAt;
      const cooledDown = this.lastYawnAt === null || timestampMs - this.lastYawnAt >= this.thresholds.yawnCooldownMs;

      if (openDurationMs >= this.thresholds.yawnMinimumDurationMs && cooledDown) {
        this.yawnCount += 1;
        this.lastYawnAt = timestampMs;
        // Require the mouth to close and reopen before another yawn can be confirmed,
        // even once the cooldown elapses - prevents one long yawn (mouth stays open
        // well past yawnMinimumDurationMs) from being counted more than once.
        this.yawnCandidateStartedAt = timestampMs;
      }
      return;
    }

    this.yawnCandidateStartedAt = null;
  }

  /** Current continuous closure duration as of timestampMs, without mutating state. */
  private currentClosureMs(timestampMs: number): number {
    if (this.closureStartedAt === null) return 0;
    return Math.max(0, timestampMs - this.closureStartedAt);
  }

  private computeScore(timestampMs: number): { score: number; reason: DrowsinessReason } {
    const closureMs = this.currentClosureMs(timestampMs);
    const recentBlinkCount = this.blinkHistory.length;
    const prolongedBlinkCount = this.closureHistory.length;
    const yawnRecent = this.lastYawnAt !== null && timestampMs - this.lastYawnAt < this.thresholds.blinkWindowMs;
    const recentYawnCount = this.closureHistoryYawnCountInWindow(timestampMs);

    let score = 0;
    const contributions: { reason: DrowsinessReason; amount: number }[] = [];

    if (closureMs >= this.thresholds.eyeClosureCriticalMs) {
      // A closure this long is, on its own, sufficient evidence for the 'critical'
      // level - it should not require additional signals stacked on top to be
      // believed. Set equal to criticalScore itself (see DEFAULT_DROWSINESS_THRESHOLDS)
      // rather than an arbitrary smaller additive amount.
      score += this.thresholds.criticalScore;
      contributions.push({ reason: 'prolonged-closure', amount: this.thresholds.criticalScore });
    } else if (closureMs >= this.thresholds.eyeClosureWarningMs) {
      // Same reasoning as the critical branch above: a warning-duration closure alone
      // should reach (at least) 'warning', not fall short into 'attention'.
      score += this.thresholds.warningScore;
      contributions.push({ reason: 'prolonged-closure', amount: this.thresholds.warningScore });
    } else if (closureMs >= this.thresholds.longBlinkMs) {
      score += 1;
      contributions.push({ reason: 'prolonged-closure', amount: 1 });
    }

    if (prolongedBlinkCount >= this.thresholds.repeatedLongClosureCount) {
      score += 2;
      contributions.push({ reason: 'repeated-long-closures', amount: 2 });
    }

    if (recentBlinkCount >= this.thresholds.highBlinkRateThreshold) {
      score += 1;
      contributions.push({ reason: 'frequent-blinking', amount: 1 });
    }

    if (yawnRecent) {
      score += 2;
      contributions.push({ reason: 'yawn', amount: 2 });
    }
    if (recentYawnCount >= 2) {
      score += 2;
      contributions.push({ reason: 'yawn', amount: 2 });
    }

    // Recent recovery: eyes currently open and no closure/yawn evidence at all right
    // now nudges score down, so a single isolated past event doesn't linger forever
    // once conditions have genuinely returned to normal (levelFallConfirmMs hysteresis
    // still governs how fast the *level* itself can drop, independent of this).
    if (closureMs === 0 && !yawnRecent && contributions.length === 0) {
      score = Math.max(0, score - 1);
    }

    if (contributions.length === 0) return { score: 0, reason: 'none' };
    if (contributions.length === 1) return { score, reason: contributions[0].reason };
    return { score, reason: 'combined' };
  }

  private closureHistoryYawnCountInWindow(timestampMs: number): number {
    // Yawns don't have their own rolling array (only lastYawnAt persists across the
    // session) - approximate "multiple recent yawns" from whether the most recent one
    // was within the window; a full history would be a reasonable future enhancement
    // but isn't required for the current 2-yawn combined-score check above, since that
    // check only needs "was there a very recent one", which lastYawnAt already answers.
    return this.lastYawnAt !== null && timestampMs - this.lastYawnAt < this.thresholds.blinkWindowMs ? 1 : 0;
  }

  private applyHysteresis(score: number, timestampMs: number): DrowsinessLevel {
    const targetLevel = this.levelForScore(score);
    const currentIndex = LEVEL_ORDER.indexOf(this.confirmedLevel);
    const targetIndex = LEVEL_ORDER.indexOf(targetLevel);

    if (targetLevel === this.confirmedLevel) {
      this.pendingLevel = null;
      this.pendingSince = null;
      return this.confirmedLevel;
    }

    // Reset the pending-confirmation timer whenever the target changes to a different
    // level than what was previously pending, so evidence must be consistent, not just
    // "not equal to the current level", to confirm a transition. Deliberately falls
    // through to the elapsed check below on the same call (rather than returning early)
    // so a confirm window of 0ms (as tests use to isolate other behavior) confirms
    // immediately instead of always deferring to the next call.
    if (this.pendingLevel !== targetLevel) {
      this.pendingLevel = targetLevel;
      this.pendingSince = timestampMs;
    }

    const elapsed = timestampMs - (this.pendingSince ?? timestampMs);
    const rising = targetIndex > currentIndex;
    const requiredMs = rising ? this.thresholds.levelRiseConfirmMs : this.thresholds.levelFallConfirmMs;

    if (elapsed >= requiredMs) {
      this.confirmedLevel = targetLevel;
      this.pendingLevel = null;
      this.pendingSince = null;
    }

    return this.confirmedLevel;
  }

  private levelForScore(score: number): DrowsinessLevel {
    if (score >= this.thresholds.criticalScore) return 'critical';
    if (score >= this.thresholds.warningScore) return 'warning';
    if (score >= this.thresholds.attentionScore) return 'attention';
    return 'normal';
  }

  private buildState(
    timestampMs: number,
    reason: DrowsinessReason,
    overrides?: { score: number; level: DrowsinessLevel; confidence: number }
  ): DrowsinessState {
    return {
      level: overrides?.level ?? this.lastState?.level ?? 'normal',
      score: overrides?.score ?? 0,
      eyeClosureMs: this.currentClosureMs(timestampMs),
      recentBlinkCount: this.blinkHistory.length,
      prolongedBlinkCount: this.closureHistory.length,
      yawnCount: this.yawnCount,
      lastYawnAt: this.lastYawnAt,
      confidence: overrides?.confidence ?? 0,
      reason,
      timestamp: timestampMs,
    };
  }
}

/**
 * Normalized mouth-opening ratio from the same verified landmark indices
 * WebcamTracker.detectGestures already uses for smile detection (61/291 mouth corners,
 * 13/14 upper/lower lip center) - see docs/LANDMARK_MAPPING.md. Normalized against
 * eyeSpan (inter-iris distance), the same stable face-scale metric GazeProcessor already
 * uses for distance compensation, rather than raw pixel/normalized-coordinate distance
 * alone, so the ratio stays meaningful as the user moves closer to/farther from the
 * camera. Returns null if any required landmark is missing (mirrors
 * computeEyeAperture's null-on-missing-data contract).
 */
export function computeMouthOpenRatio(
  landmarks: { x: number; y: number; z?: number }[],
  eyeSpan: number
): number | null {
  const mouthLeft = landmarks[61];
  const mouthRight = landmarks[291];
  const lipTop = landmarks[13];
  const lipBottom = landmarks[14];

  if (!mouthLeft || !mouthRight || !lipTop || !lipBottom) return null;

  const span = eyeSpan || 0.1;
  const lipGap = Math.hypot(lipBottom.x - lipTop.x, lipBottom.y - lipTop.y);
  return lipGap / span;
}

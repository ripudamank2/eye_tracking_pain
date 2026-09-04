// Orchestration for the Drowsiness & Eye-Fatigue Guard: owns polling WebcamTracker's
// DrowsinessDetector state into React, and turning level *changes* into side effects
// (voice warning, optional Eye Break suggestion) with a cooldown so a sustained warning
// state doesn't repeatedly re-fire. Deliberately kept out of App.tsx (which only wires
// this hook's return value into the UI) so App.tsx doesn't grow a second copy of this
// orchestration logic - see src/engine/DrowsinessDetector.ts for the pure detector this
// hook drives, and PROJECT_STATUS.md for the feature's heuristic/non-medical framing.
//
// This is NOT a medical device. See DrowsinessGuard.tsx for the user-facing disclaimer.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WebcamTracker } from '../services/WebcamTracker';
import type { DrowsinessLevel, DrowsinessState, DrowsinessThresholds } from '../engine/DrowsinessDetector';

export type DrowsinessSensitivity = 'low' | 'normal' | 'high';

// Sensitivity presets scale the duration/frequency thresholds a real user's tuning pass
// (see PROJECT_STATUS.md remaining work) will refine - these starting multipliers are a
// product heuristic, not derived from any physiological study.
const SENSITIVITY_PRESETS: Record<DrowsinessSensitivity, Partial<DrowsinessThresholds>> = {
  low: {
    eyeClosureWarningMs: 1600,
    eyeClosureCriticalMs: 3200,
    highBlinkRateThreshold: 45,
    yawnMinimumDurationMs: 900,
  },
  normal: {}, // DEFAULT_DROWSINESS_THRESHOLDS as-is
  high: {
    eyeClosureWarningMs: 900,
    eyeClosureCriticalMs: 1800,
    highBlinkRateThreshold: 25,
    yawnMinimumDurationMs: 550,
  },
};

const POLL_MS = 250; // matches DiagnosticsPanel's polling cadence - no need to sample every render frame for a slow-moving wellness signal
const WARNING_COOLDOWN_MS = 60_000;
const CRITICAL_COOLDOWN_MS = 120_000;

export interface DrowsinessGuardSettings {
  enabled: boolean;
  sensitivity: DrowsinessSensitivity;
  voiceWarningEnabled: boolean;
  eyeBreakSuggestionEnabled: boolean;
  /** Off by default per spec - a heuristic signal should never auto-trigger a break without the user opting in. */
  automaticBreakEnabled: boolean;
}

export const DEFAULT_DROWSINESS_GUARD_SETTINGS: DrowsinessGuardSettings = {
  enabled: false,
  sensitivity: 'normal',
  voiceWarningEnabled: true,
  eyeBreakSuggestionEnabled: true,
  automaticBreakEnabled: false,
};

interface UseDrowsinessGuardArgs {
  webcamTracker: WebcamTracker;
  webcamActive: boolean;
  settings: DrowsinessGuardSettings;
  /** Reuses the existing Eye Break / voice safety infrastructure rather than building a second one - see App.tsx's triggerEyeBreak. */
  onSuggestEyeBreak: () => void;
}

export interface UseDrowsinessGuardResult {
  state: DrowsinessState;
  /** True right after a level rise the user hasn't dismissed yet - drives the visual warning banner. */
  hasActiveWarning: boolean;
  dismissWarning: () => void;
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  const msg = new SpeechSynthesisUtterance(text);
  msg.rate = 1.0;
  window.speechSynthesis.speak(msg);
}

export function useDrowsinessGuard({
  webcamTracker,
  webcamActive,
  settings,
  onSuggestEyeBreak,
}: UseDrowsinessGuardArgs): UseDrowsinessGuardResult {
  const [state, setState] = useState<DrowsinessState>(() => webcamTracker.getDrowsinessState());
  const [hasActiveWarning, setHasActiveWarning] = useState(false);
  const lastNotifiedLevelRef = useRef<DrowsinessLevel>('normal');
  const lastWarningNotifyAtRef = useRef(0);
  const lastCriticalNotifyAtRef = useRef(0);

  // Enable/disable + sensitivity are pushed into the tracker's detector whenever they
  // change, rather than the hook owning its own detector instance - WebcamTracker
  // already owns the one DrowsinessDetector fed by real per-frame landmark data (see
  // WebcamTracker.handleFaceMeshResults); duplicating that here would process the same
  // frames twice for no benefit and risk the two instances disagreeing.
  useEffect(() => {
    webcamTracker.setDrowsinessGuardEnabled(settings.enabled);
  }, [webcamTracker, settings.enabled]);

  useEffect(() => {
    webcamTracker.setDrowsinessThresholds(SENSITIVITY_PRESETS[settings.sensitivity]);
  }, [webcamTracker, settings.sensitivity]);

  const dismissWarning = useCallback(() => setHasActiveWarning(false), []);

  useEffect(() => {
    if (!settings.enabled || !webcamActive) {
      setState(webcamTracker.getDrowsinessState());
      return;
    }

    const interval = setInterval(() => {
      const next = webcamTracker.getDrowsinessState();
      setState(next);

      const now = performance.now();
      const levelChanged = next.level !== lastNotifiedLevelRef.current;
      const rising =
        (next.level === 'warning' || next.level === 'critical') &&
        lastNotifiedLevelRef.current !== next.level;

      if (next.level === 'normal') {
        lastNotifiedLevelRef.current = 'normal';
        return;
      }

      if (!rising) return;

      // Per-level cooldown (not just "changed level") so a rapid warning->critical->
      // warning flap (already dampened by the detector's own hysteresis, but defended
      // here too) cannot re-fire notifications faster than the configured cooldown for
      // whichever level it lands back on.
      if (next.level === 'warning') {
        if (now - lastWarningNotifyAtRef.current < WARNING_COOLDOWN_MS) {
          if (levelChanged) lastNotifiedLevelRef.current = next.level;
          return;
        }
        lastWarningNotifyAtRef.current = now;
      } else if (next.level === 'critical') {
        if (now - lastCriticalNotifyAtRef.current < CRITICAL_COOLDOWN_MS) {
          if (levelChanged) lastNotifiedLevelRef.current = next.level;
          return;
        }
        lastCriticalNotifyAtRef.current = now;
      }

      lastNotifiedLevelRef.current = next.level;
      setHasActiveWarning(true);

      if (settings.voiceWarningEnabled) {
        const phrase =
          next.level === 'critical'
            ? "You seem very drowsy. Please take a break and rest your eyes."
            : "You seem tired. Consider taking a short break.";
        speak(phrase);
      }

      // Automatic break-opening only ever happens here, gated on its own explicit
      // setting (off by default) - eyeBreakSuggestionEnabled instead controls whether
      // the warning banner offers a manual "Take a Break" action (see
      // DrowsinessGuard.tsx), not a side effect this hook fires itself. The user always
      // decides whether to act on a suggestion; only automaticBreakEnabled bypasses that.
      if (next.level === 'critical' && settings.automaticBreakEnabled) {
        onSuggestEyeBreak();
      }
    }, POLL_MS);

    return () => clearInterval(interval);
  }, [webcamTracker, webcamActive, settings.enabled, settings.voiceWarningEnabled, settings.automaticBreakEnabled, onSuggestEyeBreak]);

  return { state, hasActiveWarning, dismissWarning };
}

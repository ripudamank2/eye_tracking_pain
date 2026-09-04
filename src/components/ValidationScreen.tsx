import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Circle, Square, Download, ChevronRight, X, Eye } from 'lucide-react';
import type { WebcamTracker } from '../services/WebcamTracker';
import type { RenderDiagnostics } from '../engine/RenderDiagnostics';
import { DiagnosticsRecorder } from '../engine/DiagnosticsRecorder';

interface ValidationScreenProps {
  isOpen: boolean;
  onClose: () => void;
  webcamTracker: WebcamTracker;
  renderDiagnostics: RenderDiagnostics;
  webcamActive: boolean;
}

// Normalized (0..1) screen position for each phase's target, or null for phases with
// no fixed point to look at (free head movement, lighting change, face-out-of-frame).
interface ValidationPhase {
  title: string;
  instruction: string;
  target: { x: number; y: number } | null;
  /** Auto-advance after this many ms once the phase starts; null = wait for manual "Next". */
  autoAdvanceMs: number | null;
  /** Free-run phase: shows an elapsed timer instead of a target/auto-advance, no cap. */
  freeRun?: boolean;
}

const HOLD_MS = 2500;
const SLOW_MS = 4000;
const FAST_MS = 3000;

const PHASES: ValidationPhase[] = [
  {
    title: 'Get ready',
    instruction: 'Sit normally in front of the laptop, about arm\'s length from the screen. Make sure your face is well lit and centered in the webcam preview.',
    target: null,
    autoAdvanceMs: null,
  },
  { title: 'Center', instruction: 'Look at the center dot and hold still.', target: { x: 0.5, y: 0.5 }, autoAdvanceMs: HOLD_MS },
  { title: 'Look Left', instruction: 'Look at the dot and hold.', target: { x: 0.06, y: 0.5 }, autoAdvanceMs: HOLD_MS },
  { title: 'Look Right', instruction: 'Look at the dot and hold.', target: { x: 0.94, y: 0.5 }, autoAdvanceMs: HOLD_MS },
  { title: 'Look Up', instruction: 'Look at the dot and hold.', target: { x: 0.5, y: 0.08 }, autoAdvanceMs: HOLD_MS },
  { title: 'Look Down', instruction: 'Look at the dot and hold.', target: { x: 0.5, y: 0.92 }, autoAdvanceMs: HOLD_MS },
  { title: 'Diagonal: Up-Left', instruction: 'Look at the dot and hold.', target: { x: 0.08, y: 0.1 }, autoAdvanceMs: HOLD_MS },
  { title: 'Diagonal: Up-Right', instruction: 'Look at the dot and hold.', target: { x: 0.92, y: 0.1 }, autoAdvanceMs: HOLD_MS },
  { title: 'Diagonal: Down-Left', instruction: 'Look at the dot and hold.', target: { x: 0.08, y: 0.9 }, autoAdvanceMs: HOLD_MS },
  { title: 'Diagonal: Down-Right', instruction: 'Look at the dot and hold.', target: { x: 0.92, y: 0.9 }, autoAdvanceMs: HOLD_MS },
  {
    title: 'Slow Eye Movement',
    instruction: 'Slowly sweep your gaze left → right → left, following an imaginary line across the screen. Take about 4 seconds per pass.',
    target: null,
    autoAdvanceMs: SLOW_MS,
  },
  {
    title: 'Fast Eye Movement',
    instruction: 'Flick your gaze quickly between the left and right edges of the screen, several times.',
    target: null,
    autoAdvanceMs: FAST_MS,
  },
  {
    title: 'Head Movement, Fixed Gaze',
    instruction: 'Keep looking at the center dot. Slowly move your head left, right, up, and down while your eyes stay locked on the dot.',
    target: { x: 0.5, y: 0.5 },
    autoAdvanceMs: 5000,
  },
  {
    title: 'Normal Blinking',
    instruction: 'Look at the center dot and blink at your normal, natural pace.',
    target: { x: 0.5, y: 0.5 },
    autoAdvanceMs: 4000,
  },
  {
    title: 'Rapid Blinking',
    instruction: 'Blink rapidly, 5–10 times in a row.',
    target: { x: 0.5, y: 0.5 },
    autoAdvanceMs: 4000,
  },
  {
    title: 'Temporary Eye Closure',
    instruction: 'Close your eyes and keep them closed for 3+ seconds, then open them.',
    target: { x: 0.5, y: 0.5 },
    autoAdvanceMs: 5000,
  },
  {
    title: 'Move Closer',
    instruction: 'Lean in closer to the camera (~30cm away), still looking at the dot.',
    target: { x: 0.5, y: 0.5 },
    autoAdvanceMs: 4000,
  },
  {
    title: 'Move Farther',
    instruction: 'Lean back, farther from the camera (~80cm away), still looking at the dot.',
    target: { x: 0.5, y: 0.5 },
    autoAdvanceMs: 4000,
  },
  {
    title: 'Lighting Change',
    instruction: 'Change the lighting in the room — dim it or add a light — while looking at the dot.',
    target: { x: 0.5, y: 0.5 },
    autoAdvanceMs: null,
  },
  {
    title: 'Move Out of Frame',
    instruction: 'Move your face completely out of the webcam\'s view (lean out of frame, or turn away).',
    target: null,
    autoAdvanceMs: null,
  },
  {
    title: 'Return & Recover',
    instruction: 'Move back into frame and look at the center dot. Watch how quickly tracking recovers.',
    target: { x: 0.5, y: 0.5 },
    autoAdvanceMs: null,
  },
  {
    title: 'Continuous Tracking',
    instruction: 'Guided phases are done. Use the app normally now — move your eyes, talk, look away and back — for at least 10–15 minutes to stress-test long-run stability. Click Stop & Export when finished.',
    target: null,
    autoAdvanceMs: null,
    freeRun: true,
  },
];

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Tile({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex flex-col items-center px-3 py-2 min-w-[92px]">
      <span className={`text-lg font-mono font-bold tabular-nums ${warn ? 'text-amber-400' : 'text-slate-100'}`}>{value}</span>
      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mt-0.5">{label}</span>
    </div>
  );
}

const POLL_MS = 200;

export const ValidationScreen: React.FC<ValidationScreenProps> = ({
  isOpen,
  onClose,
  webcamTracker,
  renderDiagnostics,
  webcamActive,
}) => {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [phaseElapsedMs, setPhaseElapsedMs] = useState(0);
  const [snapshot, setSnapshot] = useState(webcamTracker.getDiagnostics());
  const [exportSummary, setExportSummary] = useState<string | null>(null);
  const recorderRef = useRef(new DiagnosticsRecorder());
  // Real start time is set by the isOpen effect below on every open; this initial
  // value is never actually read as a timing baseline before that runs.
  const phaseStartRef = useRef(0);
  // WebcamTracker's blink/face-loss/dropped-frame counters are cumulative since the
  // tracker started (webcamTracker.start()), not since this recording started - without
  // baselining them here, a session that began recording after webcam tracking had
  // already been running for a while (e.g. through the "Get ready" phase) would have
  // pre-recording activity baked into its very first sample. Captured at Start Recording.
  // State (not a ref) specifically so the HUD tiles below can read it during render
  // without tripping the "refs shouldn't be read during render" rule - it only changes
  // on handleStart, which already triggers a re-render via setIsRecording.
  // drowsinessYawnCount joins the same baselining (see above) - it's cumulative since
  // the guard was last enabled/reset, not since this recording started.
  const [baseline, setBaseline] = useState({ blinkCount: 0, framesHeldForBlink: 0, faceDetectionLossCount: 0, droppedFrames: 0, cameraDroppedFrames: 0, drowsinessYawnCount: 0 });

  const phase = PHASES[phaseIndex];

  // Reset to phase 0 fresh each time the screen is opened, so a re-open doesn't
  // resume a stale mid-session phase index from a previous validation attempt.
  useEffect(() => {
    if (isOpen) {
      setPhaseIndex(0);
      phaseStartRef.current = performance.now();
      setPhaseElapsedMs(0);
      setExportSummary(null);
    }
  }, [isOpen]);

  const goToPhase = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(PHASES.length - 1, index));
    setPhaseIndex(clamped);
    phaseStartRef.current = performance.now();
    setPhaseElapsedMs(0);
    if (recorderRef.current.isRecording) {
      recorderRef.current.markPhase(PHASES[clamped].title);
    }
  }, []);

  const handleNext = useCallback(() => goToPhase(phaseIndex + 1), [phaseIndex, goToPhase]);
  const handleBack = useCallback(() => goToPhase(phaseIndex - 1), [phaseIndex, goToPhase]);

  const handleStart = () => {
    const tSnap = webcamTracker.getDiagnostics();
    const rSnap = renderDiagnostics.getSnapshot();
    setBaseline({
      blinkCount: tSnap.blinkCount,
      framesHeldForBlink: tSnap.framesHeldForBlink,
      faceDetectionLossCount: tSnap.faceDetectionLossCount,
      droppedFrames: rSnap.droppedFrames,
      cameraDroppedFrames: tSnap.droppedFrames,
      drowsinessYawnCount: tSnap.drowsinessYawnCount,
    });
    recorderRef.current.start();
    recorderRef.current.markPhase(PHASES[0].title);
    setIsRecording(true);
    setExportSummary(null);
  };

  const handleStopAndExport = () => {
    const result = recorderRef.current.stop();
    setIsRecording(false);
    if (!result) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadText(`gaze-validation-${stamp}.json`, JSON.stringify(result, null, 2), 'application/json');
    downloadText(`gaze-validation-${stamp}.csv`, recorderRef.current.toCSV(), 'text/csv');
    setExportSummary(
      `${result.summary.sampleCount} samples over ${(result.durationMs / 1000 / 60).toFixed(1)} min — ` +
        `avg FPS ${result.summary.avgFps.toFixed(1)}, avg confidence ${(result.summary.avgTrackingConfidence * 100).toFixed(0)}%, ` +
        `${result.summary.totalBlinkCount} blinks, ${result.summary.faceDetectionLossCount} face-loss events`
    );
  };

  // Polls diagnostics + pushes recorder samples + drives phase timers + auto-advance,
  // all on one fixed-interval tick rather than the 60fps render loop - same rationale
  // as DiagnosticsPanel: pushing React state every render frame is itself a perf cost.
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      const tSnap = webcamTracker.getDiagnostics();
      const rSnap = renderDiagnostics.getSnapshot();
      setSnapshot(tSnap);

      const elapsed = performance.now() - phaseStartRef.current;
      setPhaseElapsedMs(elapsed);

      if (recorderRef.current.isRecording) {
        const b = baseline;
        recorderRef.current.pushSample({
          fps: rSnap.fps,
          frameTimeMs: rSnap.frameTimeMs,
          p95FrameTimeMs: rSnap.p95FrameTimeMs,
          droppedFrames: Math.max(0, rSnap.droppedFrames - b.droppedFrames),
          cameraFps: tSnap.fps,
          cameraFrameTimeMs: tSnap.frameTimeMs,
          cameraDroppedFrames: Math.max(0, tSnap.droppedFrames - b.cameraDroppedFrames),
          trackingStatus: tSnap.status,
          trackingConfidence: tSnap.trackingConfidence,
          faceDetectionLossCount: Math.max(0, tSnap.faceDetectionLossCount - b.faceDetectionLossCount),
          gazeJitterPx: tSnap.gazeJitterPx,
          gazeLatencyMs: tSnap.gazeLatencyMs,
          inferenceTimeMs: tSnap.inferenceTimeMs,
          calibrationErrorPx: tSnap.calibrationErrorPx,
          framesHeldForBlink: Math.max(0, tSnap.framesHeldForBlink - b.framesHeldForBlink),
          blinkCount: Math.max(0, tSnap.blinkCount - b.blinkCount),
          gazeX: tSnap.gazeX,
          gazeY: tSnap.gazeY,
          jsHeapMb: null,
          drowsinessLevel: tSnap.drowsinessLevel,
          drowsinessScore: tSnap.drowsinessScore,
          drowsinessEyeClosureMs: tSnap.drowsinessEyeClosureMs,
          drowsinessRecentBlinkCount: tSnap.drowsinessRecentBlinkCount,
          drowsinessProlongedBlinkCount: tSnap.drowsinessProlongedBlinkCount,
          drowsinessYawnCount: Math.max(0, tSnap.drowsinessYawnCount - b.drowsinessYawnCount),
        });
      }

      const current = PHASES[phaseIndex];
      if (current.autoAdvanceMs !== null && elapsed >= current.autoAdvanceMs && phaseIndex < PHASES.length - 1) {
        goToPhase(phaseIndex + 1);
      }
    }, POLL_MS);

    return () => clearInterval(interval);
  }, [isOpen, phaseIndex, webcamTracker, renderDiagnostics, goToPhase, baseline]);

  if (!isOpen) return null;

  const progressPct = phase.autoAdvanceMs ? Math.min(100, (phaseElapsedMs / phase.autoAdvanceMs) * 100) : 0;
  const gazeX = snapshot.gazeX;
  const gazeY = snapshot.gazeY;
  const hasLiveGaze = webcamActive && snapshot.status === 'tracking' && gazeX !== null && gazeY !== null;

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950 text-slate-100 overflow-hidden select-none">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-white bg-slate-900/60 rounded-full"
        title="Close validation"
      >
        <X className="w-5 h-5" />
      </button>

      {!webcamActive && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/95">
          <div className="text-center max-w-md px-6">
            <Eye className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <p className="text-sm font-mono text-slate-200 font-bold">AI Camera Eye Tracking is off</p>
            <p className="text-xs font-mono text-slate-500 mt-2">
              Enable webcam tracking from Studio Controls before running real-camera validation —
              this test needs your laptop's actual webcam, not mouse fallback.
            </p>
          </div>
        </div>
      )}

      {/* Progress bar across the very top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800 z-20">
        <div
          className="h-full bg-cyan-400 transition-all"
          style={{ width: `${((phaseIndex + (phase.autoAdvanceMs ? progressPct / 100 : 0)) / PHASES.length) * 100}%` }}
        />
      </div>

      {/* Target dot */}
      {phase.target && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
          style={{ left: `${phase.target.x * 100}%`, top: `${phase.target.y * 100}%` }}
        >
          <div className="w-6 h-6 rounded-full bg-cyan-400 shadow-[0_0_20px_6px_rgba(34,211,238,0.5)] animate-pulse" />
        </div>
      )}

      {/* Live gaze dot - where the pipeline actually thinks you're looking */}
      {hasLiveGaze && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none"
          style={{ left: gazeX!, top: gazeY! }}
        >
          <div className="w-3 h-3 rounded-full bg-rose-400/90 shadow-[0_0_10px_3px_rgba(251,113,133,0.6)]" />
        </div>
      )}

      {/* Instruction block */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 text-center max-w-xl px-6">
        <p className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
          Phase {phaseIndex + 1}/{PHASES.length}
        </p>
        <h2 className="text-xl font-bold mt-1">{phase.title}</h2>
        <p className="text-sm font-mono text-slate-300 mt-2 leading-relaxed">{phase.instruction}</p>
        {phase.autoAdvanceMs !== null && !phase.freeRun && (
          <div className="w-48 h-1 bg-slate-800 rounded-full mx-auto mt-3 overflow-hidden">
            <div className="h-full bg-cyan-400/70" style={{ width: `${progressPct}%` }} />
          </div>
        )}
        {phase.freeRun && (
          <p className="text-2xl font-mono font-bold text-cyan-300 mt-3 tabular-nums">
            {Math.floor(phaseElapsedMs / 60000)
              .toString()
              .padStart(2, '0')}
            :{Math.floor((phaseElapsedMs % 60000) / 1000).toString().padStart(2, '0')}
            <span className="text-sm text-slate-500 font-normal"> / 15:00 target</span>
          </p>
        )}
      </div>

      {/* Nav controls */}
      <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
        <button
          onClick={handleBack}
          disabled={phaseIndex === 0}
          className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 text-xs font-bold rounded-xl font-mono"
        >
          Back
        </button>
        {!phase.freeRun && (
          <button
            onClick={handleNext}
            disabled={phaseIndex === PHASES.length - 1}
            className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 text-xs font-bold rounded-xl font-mono flex items-center gap-1"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Recording controls + live stat HUD, bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-slate-900/95 border-t border-cyan-500/20 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {!isRecording ? (
              <button
                onClick={handleStart}
                className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-mono font-bold flex items-center gap-1.5"
              >
                <Circle className="w-3.5 h-3.5 fill-current" /> Start Recording
              </button>
            ) : (
              <button
                onClick={handleStopAndExport}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-200 text-xs font-mono font-bold flex items-center gap-1.5"
              >
                <Square className="w-3.5 h-3.5" /> Stop & Export
              </button>
            )}
            {exportSummary && (
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-300">
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span className="max-w-[420px]">{exportSummary}</span>
              </div>
            )}
          </div>

          <div className="flex items-center divide-x divide-slate-800">
            <Tile label="FPS" value={snapshot.status === 'idle' ? '—' : renderDiagnostics.getSnapshot().fps.toFixed(0)} warn={renderDiagnostics.getSnapshot().fps < 50 && renderDiagnostics.getSnapshot().fps > 0} />
            <Tile label="Infer ms" value={snapshot.inferenceTimeMs.toFixed(0)} />
            <Tile label="Gaze Lat" value={`${snapshot.gazeLatencyMs.toFixed(0)}ms`} />
            <Tile label="Confidence" value={`${Math.round(snapshot.trackingConfidence * 100)}%`} warn={snapshot.trackingConfidence < 0.5} />
            <Tile label="Jitter" value={`${snapshot.gazeJitterPx.toFixed(1)}px`} warn={snapshot.gazeJitterPx > 15} />
            <Tile label="Cal. Error" value={Number.isFinite(snapshot.calibrationErrorPx) ? `${snapshot.calibrationErrorPx.toFixed(0)}px` : '—'} warn={snapshot.calibrationErrorPx > 80} />
            <Tile label="Dropped" value={String(Math.max(0, snapshot.droppedFrames - baseline.cameraDroppedFrames))} warn={snapshot.droppedFrames > baseline.cameraDroppedFrames} />
            <Tile label="Face Loss" value={String(Math.max(0, snapshot.faceDetectionLossCount - baseline.faceDetectionLossCount))} warn={snapshot.faceDetectionLossCount > baseline.faceDetectionLossCount} />
            <Tile label="Blinks" value={String(Math.max(0, snapshot.blinkCount - baseline.blinkCount))} />
            <Tile label="Status" value={snapshot.status.replace('_', ' ')} warn={snapshot.status !== 'tracking'} />
          </div>
        </div>
      </div>
    </div>
  );
};

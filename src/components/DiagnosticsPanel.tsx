import React, { useEffect, useRef, useState } from 'react';
import { Activity, X, Gauge, Eye, Camera, Circle, Square, Download, Flag } from 'lucide-react';
import type { RenderDiagnostics } from '../engine/RenderDiagnostics';
import type { WebcamTracker } from '../services/WebcamTracker';
import { DiagnosticsRecorder } from '../engine/DiagnosticsRecorder';

interface DiagnosticsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  renderDiagnostics: RenderDiagnostics;
  webcamTracker: WebcamTracker;
  webcamActive: boolean;
}

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Guided real-camera validation script (Step 1). Each phase is a manual marker recorded
// into the session export so results can be sliced per-condition afterward - e.g. "what
// was the jitter specifically during rapid blinking" rather than one session-wide average.
const VALIDATION_PHASES = [
  'Center gaze (look at screen center, hold still)',
  'Look left (hold ~2s)',
  'Look right (hold ~2s)',
  'Look up (hold ~2s)',
  'Look down (hold ~2s)',
  'Diagonal: up-left',
  'Diagonal: up-right',
  'Diagonal: down-left',
  'Diagonal: down-right',
  'Tilt head left ~20°, gaze center',
  'Tilt head right ~20°, gaze center',
  'Move closer to camera (~30cm), gaze center',
  'Move farther from camera (~80cm), gaze center',
  'Normal blinking (natural pace)',
  'Rapid blinking (5-10 fast blinks)',
  'Close eyes for 3+ seconds (temporary closure)',
  'Move face out of frame, then back (tracking recovery)',
  'Move head side to side while gazing at a fixed point',
  'Change lighting (dim the room or add a light), gaze center',
  'Turn away from camera briefly, then return (partial face loss)',
];

// Polls diagnostics on a fixed low-frequency interval rather than every render frame -
// see RenderDiagnostics.ts for why pushing React state from inside the 60fps rAF loop
// would itself be a performance problem.
const POLL_INTERVAL_MS = 250;

function StatRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-0">
      <span className="text-[11px] text-slate-400 font-mono">{label}</span>
      <span className={`text-[11px] font-mono font-bold ${warn ? 'text-amber-400' : 'text-slate-200'}`}>{value}</span>
    </div>
  );
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  isOpen,
  onClose,
  renderDiagnostics,
  webcamTracker,
  webcamActive,
}) => {
  const [renderSnapshot, setRenderSnapshot] = useState(renderDiagnostics.getSnapshot());
  const [trackerSnapshot, setTrackerSnapshot] = useState(webcamTracker.getDiagnostics());
  const [memoryMb, setMemoryMb] = useState<number | null>(null);
  const recorderRef = useRef(new DiagnosticsRecorder());
  const [isRecording, setIsRecording] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [lastExportSummary, setLastExportSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      const rSnap = renderDiagnostics.getSnapshot();
      const tSnap = webcamTracker.getDiagnostics();
      setRenderSnapshot(rSnap);
      setTrackerSnapshot(tSnap);

      // performance.memory is Chromium-only (and only exposed on non-strict-isolated
      // pages) - report "unavailable" honestly elsewhere rather than fabricating a number.
      const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
      const heapMb = perf.memory ? Math.round((perf.memory.usedJSHeapSize / 1024 / 1024) * 10) / 10 : null;
      if (heapMb !== null) setMemoryMb(heapMb);

      if (recorderRef.current.isRecording) {
        recorderRef.current.pushSample({
          fps: rSnap.fps,
          frameTimeMs: rSnap.frameTimeMs,
          p95FrameTimeMs: rSnap.p95FrameTimeMs,
          droppedFrames: rSnap.droppedFrames,
          cameraFps: tSnap.fps,
          cameraFrameTimeMs: tSnap.frameTimeMs,
          cameraDroppedFrames: tSnap.droppedFrames,
          trackingStatus: tSnap.status,
          trackingConfidence: tSnap.trackingConfidence,
          faceDetectionLossCount: tSnap.faceDetectionLossCount,
          gazeJitterPx: tSnap.gazeJitterPx,
          gazeLatencyMs: tSnap.gazeLatencyMs,
          inferenceTimeMs: tSnap.inferenceTimeMs,
          calibrationErrorPx: tSnap.calibrationErrorPx,
          framesHeldForBlink: tSnap.framesHeldForBlink,
          blinkCount: tSnap.blinkCount,
          gazeX: tSnap.gazeX,
          gazeY: tSnap.gazeY,
          jsHeapMb: heapMb,
          drowsinessLevel: tSnap.drowsinessLevel,
          drowsinessScore: tSnap.drowsinessScore,
          drowsinessEyeClosureMs: tSnap.drowsinessEyeClosureMs,
          drowsinessRecentBlinkCount: tSnap.drowsinessRecentBlinkCount,
          drowsinessProlongedBlinkCount: tSnap.drowsinessProlongedBlinkCount,
          drowsinessYawnCount: tSnap.drowsinessYawnCount,
        });
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isOpen, renderDiagnostics, webcamTracker]);

  const handleStartRecording = () => {
    recorderRef.current.start();
    setIsRecording(true);
    setPhaseIndex(0);
    setLastExportSummary(null);
  };

  const handleStopAndExport = () => {
    const result = recorderRef.current.stop();
    setIsRecording(false);
    if (!result) return;

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadText(`gaze-validation-${stamp}.json`, JSON.stringify(result, null, 2), 'application/json');
    downloadText(`gaze-validation-${stamp}.csv`, recorderRef.current.toCSV(), 'text/csv');

    setLastExportSummary(
      `${result.summary.sampleCount} samples over ${(result.durationMs / 1000).toFixed(1)}s — ` +
        `avg FPS ${result.summary.avgFps.toFixed(1)}, avg confidence ${(result.summary.avgTrackingConfidence * 100).toFixed(0)}%, ` +
        `${result.summary.faceDetectionLossCount} face-loss events`
    );
  };

  const handleMarkPhase = () => {
    if (!recorderRef.current.isRecording) return;
    recorderRef.current.markPhase(VALIDATION_PHASES[phaseIndex]);
    setPhaseIndex((prev) => Math.min(prev + 1, VALIDATION_PHASES.length - 1));
  };

  if (!isOpen) return null;

  const statusLabels: Record<string, string> = {
    idle: 'Idle',
    starting: 'Starting…',
    tracking: 'Tracking',
    face_lost: 'Face lost',
    permission_denied: 'Permission denied',
    device_not_found: 'No device',
    device_disconnected: 'Disconnected',
    error: 'Error',
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 w-72 bg-slate-900/95 border border-cyan-500/30 rounded-2xl shadow-2xl backdrop-blur-xl text-slate-100 animate-in fade-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider">Eye Engine Diagnostics</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
        {/* Session Recording - Step 1 real-camera validation support */}
        <div className="pb-3 border-b border-slate-800">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono uppercase mb-2">
            Validation Recording
          </div>
          <div className="flex gap-1.5">
            {!isRecording ? (
              <button
                onClick={handleStartRecording}
                className="flex-1 py-1.5 px-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-[11px] font-mono font-bold flex items-center justify-center gap-1.5"
              >
                <Circle className="w-3 h-3 fill-current" /> Start
              </button>
            ) : (
              <button
                onClick={handleStopAndExport}
                className="flex-1 py-1.5 px-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-200 text-[11px] font-mono font-bold flex items-center justify-center gap-1.5"
              >
                <Square className="w-3 h-3" /> Stop & Export
              </button>
            )}
          </div>

          {isRecording && (
            <div className="mt-2 p-2 bg-slate-950/60 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 font-mono mb-1">
                Phase {phaseIndex + 1}/{VALIDATION_PHASES.length}
              </div>
              <div className="text-[11px] text-slate-200 font-mono mb-2">{VALIDATION_PHASES[phaseIndex]}</div>
              <button
                onClick={handleMarkPhase}
                className="w-full py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[11px] font-mono font-bold flex items-center justify-center gap-1.5"
              >
                <Flag className="w-3 h-3" /> Mark Phase Complete → Next
              </button>
            </div>
          )}

          {lastExportSummary && (
            <div className="mt-2 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-[10px] font-mono text-emerald-300 flex items-start gap-1.5">
              <Download className="w-3 h-3 mt-0.5 shrink-0" />
              <span>Exported: {lastExportSummary}</span>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono uppercase mb-1">
            <Gauge className="w-3 h-3" /> Render Loop
          </div>
          <StatRow label="FPS" value={renderSnapshot.fps.toFixed(1)} warn={renderSnapshot.fps < 50 && renderSnapshot.fps > 0} />
          <StatRow label="Frame time (avg)" value={`${renderSnapshot.frameTimeMs.toFixed(1)} ms`} />
          <StatRow label="Frame time (p95)" value={`${renderSnapshot.p95FrameTimeMs.toFixed(1)} ms`} warn={renderSnapshot.p95FrameTimeMs > 33} />
          <StatRow label="Dropped frames" value={String(renderSnapshot.droppedFrames)} warn={renderSnapshot.droppedFrames > 0} />
          <StatRow label="JS heap" value={memoryMb !== null ? `${memoryMb} MB` : 'unavailable'} />
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono uppercase mb-1 mt-2">
            <Camera className="w-3 h-3" /> Webcam Pipeline
          </div>
          {!webcamActive ? (
            <div className="text-[11px] text-slate-500 font-mono py-1">Camera tracking is off</div>
          ) : (
            <>
              <StatRow
                label="Status"
                value={statusLabels[trackerSnapshot.status] ?? trackerSnapshot.status}
                warn={trackerSnapshot.status !== 'tracking'}
              />
              <StatRow label="Camera FPS" value={trackerSnapshot.fps.toFixed(1)} warn={trackerSnapshot.fps > 0 && trackerSnapshot.fps < 15} />
              <StatRow label="Camera frame time" value={`${trackerSnapshot.frameTimeMs.toFixed(1)} ms`} />
              <StatRow label="Dropped camera frames" value={String(trackerSnapshot.droppedFrames)} warn={trackerSnapshot.droppedFrames > 0} />
              <StatRow label="Gaze latency" value={`${trackerSnapshot.gazeLatencyMs.toFixed(1)} ms`} />
            </>
          )}
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono uppercase mb-1 mt-2">
            <Eye className="w-3 h-3" /> Tracking Quality
          </div>
          {!webcamActive ? (
            <div className="text-[11px] text-slate-500 font-mono py-1">n/a (mouse mode)</div>
          ) : (
            <>
              <StatRow
                label="Confidence"
                value={`${Math.round(trackerSnapshot.trackingConfidence * 100)}%`}
                warn={trackerSnapshot.trackingConfidence < 0.5}
              />
              <StatRow label="Face-loss events" value={String(trackerSnapshot.faceDetectionLossCount)} warn={trackerSnapshot.faceDetectionLossCount > 0} />
              <StatRow label="Gaze jitter" value={`${trackerSnapshot.gazeJitterPx.toFixed(1)} px`} warn={trackerSnapshot.gazeJitterPx > 15} />
              <StatRow label="Blinks" value={String(trackerSnapshot.blinkCount)} />
              <StatRow label="Frames held (blink)" value={String(trackerSnapshot.framesHeldForBlink)} />
              <StatRow
                label="Calibration error"
                value={Number.isFinite(trackerSnapshot.calibrationErrorPx) ? `${trackerSnapshot.calibrationErrorPx.toFixed(1)} px` : 'not calibrated'}
                warn={trackerSnapshot.calibrationErrorPx > 80}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Activity, X, Gauge, Eye, Camera } from 'lucide-react';
import type { RenderDiagnostics } from '../engine/RenderDiagnostics';
import type { WebcamTracker } from '../services/WebcamTracker';

interface DiagnosticsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  renderDiagnostics: RenderDiagnostics;
  webcamTracker: WebcamTracker;
  webcamActive: boolean;
}

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

  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setRenderSnapshot(renderDiagnostics.getSnapshot());
      setTrackerSnapshot(webcamTracker.getDiagnostics());

      // performance.memory is Chromium-only (and only exposed on non-strict-isolated
      // pages) - report "unavailable" honestly elsewhere rather than fabricating a number.
      const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
      if (perf.memory) {
        setMemoryMb(Math.round((perf.memory.usedJSHeapSize / 1024 / 1024) * 10) / 10);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isOpen, renderDiagnostics, webcamTracker]);

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

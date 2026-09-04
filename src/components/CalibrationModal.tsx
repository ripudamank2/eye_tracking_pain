import React, { useState, useCallback } from 'react';
import { Target, X } from 'lucide-react';
import type { WebcamTracker } from '../services/WebcamTracker';
import type { CalibrationPoint } from '../engine/GazeProcessor';

interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  webcamTracker: WebcamTracker;
  onComplete: (meanErrorPx: number) => void;
}

// 5-point calibration: four corners plus center, inset from the true screen edges so
// the target is always fully visible regardless of window chrome. This is the minimum
// point count that lets computeCalibration fit both a center offset and a per-axis
// gain (a single center-only calibration, the previous behavior, cannot correct for
// per-user sensitivity differences - see GazeProcessor.ts).
const TARGET_POSITIONS = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.5, y: 0.5 },
  { x: 0.1, y: 0.9 },
  { x: 0.9, y: 0.9 },
];

const SAMPLE_DELAY_MS = 800; // let the user's gaze settle on the new target before sampling
const SAMPLES_PER_POINT = 10;
const SAMPLE_INTERVAL_MS = 50;

export const CalibrationModal: React.FC<CalibrationModalProps> = ({ isOpen, onClose, webcamTracker, onComplete }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [isSampling, setIsSampling] = useState(false);
  const [collectedPoints, setCollectedPoints] = useState<CalibrationPoint[]>([]);

  const runStep = useCallback(() => {
    setIsSampling(true);

    setTimeout(() => {
      const samples: { offsetX: number; offsetY: number }[] = [];
      let sampleCount = 0;

      const sampleTimer = setInterval(() => {
        // Only accept a sample while actually tracking - sampleRawOffset() returns the
        // last known offset even during face_lost (it's never cleared), so without this
        // gate a brief tracking dropout during a target hold would silently bake a
        // stale, wrong offset into this point's average instead of being excluded.
        const raw = webcamTracker.getStatus() === 'tracking' ? webcamTracker.sampleRawOffset() : null;
        if (raw) samples.push(raw);
        sampleCount++;

        if (sampleCount >= SAMPLES_PER_POINT) {
          clearInterval(sampleTimer);

          if (samples.length > 0) {
            const avgX = samples.reduce((a, s) => a + s.offsetX, 0) / samples.length;
            const avgY = samples.reduce((a, s) => a + s.offsetY, 0) / samples.length;
            const target = TARGET_POSITIONS[stepIndex];

            setCollectedPoints((prev) => [
              ...prev,
              {
                screenX: target.x * window.innerWidth,
                screenY: target.y * window.innerHeight,
                gazeOffsetX: avgX,
                gazeOffsetY: avgY,
              },
            ]);
          }

          setIsSampling(false);
          if (stepIndex < TARGET_POSITIONS.length - 1) {
            setStepIndex((prev) => prev + 1);
          } else {
            setStepIndex((prev) => prev + 1); // triggers the "done" branch below
          }
        }
      }, SAMPLE_INTERVAL_MS);
    }, SAMPLE_DELAY_MS);
  }, [stepIndex, webcamTracker]);

  const isDone = stepIndex >= TARGET_POSITIONS.length;

  const handleFinish = () => {
    const result = webcamTracker.applyCalibration(collectedPoints, window.innerWidth, window.innerHeight);
    onComplete(result.meanError);
    setStepIndex(0);
    setCollectedPoints([]);
    onClose();
  };

  const handleCancel = () => {
    setStepIndex(0);
    setCollectedPoints([]);
    setIsSampling(false);
    onClose();
  };

  if (!isOpen) return null;

  const currentTarget = !isDone ? TARGET_POSITIONS[stepIndex] : null;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/95 backdrop-blur-sm">
      <button onClick={handleCancel} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white z-10">
        <X className="w-6 h-6" />
      </button>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center">
        <p className="text-sm font-mono text-slate-300">
          {isDone ? 'Calibration complete' : `Look at the target (${stepIndex + 1}/${TARGET_POSITIONS.length})`}
        </p>
        <p className="text-[11px] font-mono text-slate-500 mt-1">
          {isDone ? 'Review below and apply, or cancel to discard.' : 'Hold your gaze steady until it advances automatically.'}
        </p>
      </div>

      {currentTarget && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${currentTarget.x * 100}%`, top: `${currentTarget.y * 100}%` }}
        >
          <div className={`relative ${isSampling ? 'animate-pulse' : ''}`}>
            <Target className="w-10 h-10 text-cyan-400" />
          </div>
        </div>
      )}

      {isDone ? (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 max-w-md text-center">
          <p className="text-xs font-mono text-slate-400">
            Collected {collectedPoints.length} of {TARGET_POSITIONS.length} points
          </p>
          {collectedPoints.length < 2 ? (
            <p className="text-xs font-mono text-rose-300 bg-rose-500/10 border border-rose-500/40 rounded-lg px-3 py-2">
              Not enough points tracked to calibrate ({collectedPoints.length}/2 minimum) — Apply is
              disabled. This means calibration will NOT be applied. Move closer to the camera,
              improve lighting, and retry.
            </p>
          ) : collectedPoints.length < TARGET_POSITIONS.length ? (
            <p className="text-xs font-mono text-amber-300 bg-amber-500/10 border border-amber-500/40 rounded-lg px-3 py-2">
              {TARGET_POSITIONS.length - collectedPoints.length} point(s) had no tracked face and
              were skipped. You can still apply with the {collectedPoints.length} good points, but
              accuracy will be lower — retry for best results.
            </p>
          ) : (
            <p className="text-xs font-mono text-emerald-300">All points tracked cleanly.</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
            >
              Discard
            </button>
            <button
              onClick={handleFinish}
              disabled={collectedPoints.length < 2}
              className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-bold rounded-xl"
            >
              Apply Calibration
            </button>
          </div>
        </div>
      ) : (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2">
          <button
            onClick={runStep}
            disabled={isSampling}
            className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl"
          >
            {isSampling ? 'Sampling…' : stepIndex === 0 ? 'Start' : 'Sample This Point'}
          </button>
        </div>
      )}
    </div>
  );
};

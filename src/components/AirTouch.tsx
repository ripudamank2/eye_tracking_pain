import React from 'react';
import { Hand, X, AlertTriangle, Target, RotateCcw } from 'lucide-react';
import type { AirTouchControllerState, AirTouchInputStatus } from '../services/AirTouchController';
import type { HandTrackerDiagnostics } from '../services/HandTracker';
import type { AirTouchSettings, AirTouchSensitivity, AirTouchCalibrationStep } from '../hooks/useAirTouch';
import type { AirTouchGesture } from '../engine/handTypes';

interface AirTouchProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AirTouchSettings;
  setSettings: (settings: AirTouchSettings) => void;
  controllerState: AirTouchControllerState;
  handDiagnostics: HandTrackerDiagnostics;
  webcamActive: boolean;
  isCalibrated: boolean;
  calibrationErrorNorm: number | null;
  clearEmergencyStop: () => void;
  calibrationStepIndex: number | null;
  startCalibration: () => void;
  captureCalibrationPoint: () => void;
  cancelCalibration: () => void;
  resetCalibration: () => void;
}

const STATUS_LABEL: Record<AirTouchInputStatus, string> = {
  disabled: 'Disabled',
  tracking: 'Tracking',
  paused: 'Paused',
  stopped: 'Stopped',
  no_hand: 'No Hand Detected',
};

const STATUS_COLOR: Record<AirTouchInputStatus, string> = {
  disabled: 'text-slate-500',
  tracking: 'text-emerald-400',
  paused: 'text-amber-300',
  stopped: 'text-rose-400',
  no_hand: 'text-slate-400',
};

const STATUS_DOT: Record<AirTouchInputStatus, string> = {
  disabled: 'bg-slate-600',
  tracking: 'bg-emerald-400',
  paused: 'bg-amber-300',
  stopped: 'bg-rose-400',
  no_hand: 'bg-slate-500',
};

const GESTURE_LABEL: Record<AirTouchGesture, string> = {
  none: '—',
  pointer: 'Index Pointer',
  pinch_start: 'Pinch',
  pinch_held: 'Pinch (held)',
  drag: 'Drag',
  two_finger: 'Right Click',
  open_palm: 'Open Palm',
  fist: 'Fist',
};

const CALIBRATION_STEP_LABELS: Record<AirTouchCalibrationStep, string> = {
  top_left: 'top-left corner',
  top_right: 'top-right corner',
  bottom_left: 'bottom-left corner',
  bottom_right: 'bottom-right corner',
  center: 'center',
};
const CALIBRATION_STEPS_ORDER: AirTouchCalibrationStep[] = ['top_left', 'top_right', 'bottom_left', 'bottom_right', 'center'];

function SensitivityOption({
  value,
  current,
  onSelect,
  label,
}: {
  value: AirTouchSensitivity;
  current: AirTouchSensitivity;
  onSelect: (v: AirTouchSensitivity) => void;
  label: string;
}) {
  const selected = value === current;
  return (
    <button
      onClick={() => onSelect(value)}
      className={`flex-1 py-2 px-3 rounded-xl text-xs font-mono font-bold border transition-colors ${
        selected
          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
          : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => onChange(!checked)} className="w-full flex items-center justify-between py-2 px-1 text-left">
      <span className="text-xs font-mono text-slate-300">{label}</span>
      <span
        className={`w-9 h-5 rounded-full border transition-colors relative shrink-0 ${
          checked ? 'bg-cyan-500/80 border-cyan-400' : 'bg-slate-800 border-slate-700'
        }`}
      >
        <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
    </button>
  );
}

function Slider({ value, onChange, min = 0, max = 1, step = 0.05 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-cyan-500"
    />
  );
}

export const AirTouch: React.FC<AirTouchProps> = ({
  isOpen,
  onClose,
  settings,
  setSettings,
  controllerState,
  handDiagnostics,
  webcamActive,
  isCalibrated,
  calibrationErrorNorm,
  clearEmergencyStop,
  calibrationStepIndex,
  startCalibration,
  captureCalibrationPoint,
  cancelCalibration,
  resetCalibration,
}) => {
  if (!isOpen) return null;

  const isCalibrating = calibrationStepIndex !== null;
  const calibrationStep = isCalibrating ? CALIBRATION_STEPS_ORDER[calibrationStepIndex!] : null;

  if (isCalibrating && calibrationStep) {
    return (
      <div className="fixed inset-0 z-[60] bg-slate-950/95 backdrop-blur-sm">
        <button onClick={cancelCalibration} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white z-10">
          <X className="w-6 h-6" />
        </button>

        <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center">
          <p className="text-sm font-mono text-slate-300">
            Air Touch Calibration ({calibrationStepIndex! + 1}/{CALIBRATION_STEPS_ORDER.length})
          </p>
          <p className="text-[11px] font-mono text-slate-500 mt-1">
            Point your index finger at the {CALIBRATION_STEP_LABELS[calibrationStep]} of your screen, then click Capture.
          </p>
        </div>

        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
          <button
            onClick={captureCalibrationPoint}
            className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl"
          >
            Capture Point
          </button>
          <button onClick={cancelCalibration} className="text-[11px] font-mono text-slate-500 hover:text-slate-300">
            Cancel calibration
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-2xl border border-cyan-500/30">
              <Hand className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Air Touch</h2>
              <p className="text-[11px] text-slate-500">Hand-tracking cursor control (in-app)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[10px] text-amber-200/80 leading-relaxed">
            V1 controls a virtual cursor and clicks within Eye Tracker Studio's own window only - it does
            not move the real OS cursor or control other applications yet.
          </p>
        </div>

        {!webcamActive ? (
          <p className="text-xs font-mono text-slate-500 mt-4 py-2">Enable AI Camera Eye Tracking to use Air Touch.</p>
        ) : (
          <div className="mt-4 p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-500 uppercase">Status</span>
              <span className={`flex items-center gap-1.5 text-xs font-mono font-bold ${STATUS_COLOR[controllerState.status]}`}>
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[controllerState.status]}`} />
                {STATUS_LABEL[controllerState.status]}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-500">Gesture</span>
              <span className="text-[11px] font-mono text-slate-300">{GESTURE_LABEL[controllerState.lastGesture]}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-500">Hand confidence</span>
              <span className="text-[11px] font-mono text-slate-300">{Math.round(handDiagnostics.confidence * 100)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-500">Cursor</span>
              <span className="text-[11px] font-mono text-slate-300">
                {controllerState.cursor ? `X: ${Math.round(controllerState.cursor.x)}  Y: ${Math.round(controllerState.cursor.y)}` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-500">Calibration</span>
              <span className="text-[11px] font-mono text-slate-300">
                {isCalibrated ? `Applied (err ${((calibrationErrorNorm ?? 0) * 100).toFixed(1)}%)` : 'Not calibrated'}
              </span>
            </div>

            {controllerState.status === 'stopped' && (
              <button
                onClick={clearEmergencyStop}
                className="w-full mt-2 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-[11px] font-mono font-bold"
              >
                AIR TOUCH STOPPED — Click to Re-enable
              </button>
            )}
            {controllerState.status === 'paused' && (
              <p className="text-[11px] font-mono text-amber-300 text-center mt-1">AIR TOUCH PAUSED (open palm)</p>
            )}
          </div>
        )}

        <div className="mt-4">
          <Toggle checked={settings.enabled} onChange={(enabled) => setSettings({ ...settings, enabled })} label="Enable Air Touch" />
        </div>

        {settings.enabled && (
          <>
            <div className="mt-3">
              <p className="text-[10px] font-mono text-slate-500 uppercase mb-1.5">Sensitivity</p>
              <div className="flex gap-2">
                <SensitivityOption value="low" current={settings.sensitivity} onSelect={(sensitivity) => setSettings({ ...settings, sensitivity })} label="Low" />
                <SensitivityOption value="normal" current={settings.sensitivity} onSelect={(sensitivity) => setSettings({ ...settings, sensitivity })} label="Normal" />
                <SensitivityOption value="high" current={settings.sensitivity} onSelect={(sensitivity) => setSettings({ ...settings, sensitivity })} label="High" />
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Cursor Smoothing</span>
                  <span className="text-[10px] font-mono text-slate-400">{Math.round(settings.smoothingStrength * 100)}%</span>
                </div>
                <Slider value={settings.smoothingStrength} onChange={(smoothingStrength) => setSettings({ ...settings, smoothingStrength })} />
              </div>
            </div>

            <div className="mt-3 border-t border-slate-800 pt-2">
              <Toggle checked={settings.mirrorCamera} onChange={(mirrorCamera) => setSettings({ ...settings, mirrorCamera })} label="Mirror camera" />
            </div>

            <div className="mt-3 border-t border-slate-800 pt-3 flex gap-2">
              <button
                onClick={startCalibration}
                disabled={!webcamActive}
                className="flex-1 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed border border-cyan-500/40 text-cyan-300 text-[11px] font-mono font-bold flex items-center justify-center gap-1.5"
              >
                <Target className="w-3.5 h-3.5" /> Calibrate
              </button>
              <button
                onClick={resetCalibration}
                disabled={!isCalibrated}
                className="py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700/60 text-slate-300 text-[11px] font-mono font-bold flex items-center justify-center gap-1.5"
                title="Reset calibration"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => setSettings({ ...settings, enabled: false })}
              className="w-full mt-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 text-[11px] font-mono font-bold"
            >
              Disable Air Touch
            </button>
          </>
        )}
      </div>
    </div>
  );
};

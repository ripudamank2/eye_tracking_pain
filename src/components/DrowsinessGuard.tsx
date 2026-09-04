import React from 'react';
import { Brain, X, Coffee, AlertTriangle } from 'lucide-react';
import type { DrowsinessState } from '../engine/DrowsinessDetector';
import type { DrowsinessGuardSettings, DrowsinessSensitivity } from '../hooks/useDrowsinessGuard';

interface DrowsinessGuardProps {
  isOpen: boolean;
  onClose: () => void;
  settings: DrowsinessGuardSettings;
  setSettings: (settings: DrowsinessGuardSettings) => void;
  state: DrowsinessState;
  webcamActive: boolean;
}

const LEVEL_LABEL: Record<DrowsinessState['level'], string> = {
  normal: 'Normal',
  attention: 'Attention',
  warning: 'Warning',
  critical: 'Critical',
};

const LEVEL_COLOR: Record<DrowsinessState['level'], string> = {
  normal: 'text-emerald-400',
  attention: 'text-amber-300',
  warning: 'text-orange-400',
  critical: 'text-rose-400',
};

const LEVEL_DOT: Record<DrowsinessState['level'], string> = {
  normal: 'bg-emerald-400',
  attention: 'bg-amber-300',
  warning: 'bg-orange-400',
  critical: 'bg-rose-400',
};

function SensitivityOption({
  value,
  current,
  onSelect,
  label,
}: {
  value: DrowsinessSensitivity;
  current: DrowsinessSensitivity;
  onSelect: (v: DrowsinessSensitivity) => void;
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
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between py-2 px-1 text-left"
    >
      <span className="text-xs font-mono text-slate-300">{label}</span>
      <span
        className={`w-9 h-5 rounded-full border transition-colors relative shrink-0 ${
          checked ? 'bg-cyan-500/80 border-cyan-400' : 'bg-slate-800 border-slate-700'
        }`}
      >
        <span
          className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

export const DrowsinessGuard: React.FC<DrowsinessGuardProps> = ({
  isOpen,
  onClose,
  settings,
  setSettings,
  state,
  webcamActive,
}) => {
  if (!isOpen) return null;

  const eyeClosureSeconds = (state.eyeClosureMs / 1000).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-500/20 text-violet-400 rounded-2xl border border-violet-500/30">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Drowsiness & Eye-Fatigue Guard</h2>
              <p className="text-[11px] text-slate-500">Heuristic webcam wellness reminder</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[10px] text-amber-200/80 leading-relaxed">
            This is a wellness/productivity reminder based on webcam facial signals. It is not a
            medical or sleep-diagnostic system and does not detect fatigue or sleep disorders.
          </p>
        </div>

        {!webcamActive ? (
          <p className="text-xs font-mono text-slate-500 mt-4 py-2">
            Enable AI Camera Eye Tracking to use this feature.
          </p>
        ) : (
          <div className="mt-4 p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-500 uppercase">Status</span>
              <span className={`flex items-center gap-1.5 text-xs font-mono font-bold ${LEVEL_COLOR[state.level]}`}>
                <span className={`w-2 h-2 rounded-full ${LEVEL_DOT[state.level]}`} />
                {LEVEL_LABEL[state.level]}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-500">Eye closure</span>
              <span className="text-[11px] font-mono text-slate-300">{eyeClosureSeconds}s</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-500">Recent blinks</span>
              <span className="text-[11px] font-mono text-slate-300">{state.recentBlinkCount} / min</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-500">Yawns (session)</span>
              <span className="text-[11px] font-mono text-slate-300">{state.yawnCount}</span>
            </div>
          </div>
        )}

        <div className="mt-4">
          <Toggle
            checked={settings.enabled}
            onChange={(enabled) => setSettings({ ...settings, enabled })}
            label="Enable guard"
          />
        </div>

        {settings.enabled && (
          <>
            <div className="mt-3">
              <p className="text-[10px] font-mono text-slate-500 uppercase mb-1.5">Sensitivity</p>
              <div className="flex gap-2">
                <SensitivityOption
                  value="low"
                  current={settings.sensitivity}
                  onSelect={(sensitivity) => setSettings({ ...settings, sensitivity })}
                  label="Low"
                />
                <SensitivityOption
                  value="normal"
                  current={settings.sensitivity}
                  onSelect={(sensitivity) => setSettings({ ...settings, sensitivity })}
                  label="Normal"
                />
                <SensitivityOption
                  value="high"
                  current={settings.sensitivity}
                  onSelect={(sensitivity) => setSettings({ ...settings, sensitivity })}
                  label="High"
                />
              </div>
            </div>

            <div className="mt-3 divide-y divide-slate-800/60 border-t border-slate-800 pt-1">
              <Toggle
                checked={settings.voiceWarningEnabled}
                onChange={(voiceWarningEnabled) => setSettings({ ...settings, voiceWarningEnabled })}
                label="Voice warning"
              />
              <Toggle
                checked={settings.eyeBreakSuggestionEnabled}
                onChange={(eyeBreakSuggestionEnabled) => setSettings({ ...settings, eyeBreakSuggestionEnabled })}
                label="Eye-break reminder"
              />
              <Toggle
                checked={settings.automaticBreakEnabled}
                onChange={(automaticBreakEnabled) => setSettings({ ...settings, automaticBreakEnabled })}
                label="Automatic break"
              />
            </div>
            {settings.automaticBreakEnabled && (
              <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
                <Coffee className="w-3 h-3 shrink-0" /> A critical reading will open Eye Break automatically.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

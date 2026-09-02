import React from 'react';
import { X, Palette } from 'lucide-react';
import type { CustomEyeStyle } from '../engine/EyeEngine';

interface EyeStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  style: CustomEyeStyle;
  setStyle: (style: CustomEyeStyle) => void;
  onApply: () => void;
}

export const EyeStudioModal: React.FC<EyeStudioModalProps> = ({
  isOpen,
  onClose,
  style,
  setStyle,
  onApply,
}) => {
  if (!isOpen) return null;

  const update = (patch: Partial<CustomEyeStyle>) => setStyle({ ...style, ...patch });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-500/20 text-violet-400 rounded-2xl border border-violet-500/30">
              <Palette className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Custom Eye Studio</h2>
              <p className="text-xs text-slate-400">Tune pupil color, iris gradient & glow intensity</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5 my-6">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono text-slate-300">Pupil Color</label>
            <input
              type="color"
              value={style.pupilColor}
              onChange={(e) => update({ pupilColor: e.target.value })}
              className="w-12 h-8 rounded-lg border border-slate-700 bg-transparent cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs font-mono text-slate-300">Iris Color (Inner)</label>
            <input
              type="color"
              value={style.irisColorInner}
              onChange={(e) => update({ irisColorInner: e.target.value })}
              className="w-12 h-8 rounded-lg border border-slate-700 bg-transparent cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs font-mono text-slate-300">Iris Color (Outer)</label>
            <input
              type="color"
              value={style.irisColorOuter}
              onChange={(e) => update({ irisColorOuter: e.target.value })}
              className="w-12 h-8 rounded-lg border border-slate-700 bg-transparent cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono text-slate-300">Glow Intensity</label>
              <span className="text-[10px] font-mono text-slate-500">{Math.round(style.glowIntensity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={style.glowIntensity}
              onChange={(e) => update({ glowIntensity: parseFloat(e.target.value) })}
              className="w-full accent-violet-500"
            />
          </div>

          {/* Live Preview */}
          <div className="flex items-center justify-center py-6 bg-slate-950/60 rounded-2xl border border-slate-800">
            <div
              className="w-16 h-16 rounded-full border-2 flex items-center justify-center"
              style={{
                borderColor: style.irisColorOuter,
                background: `radial-gradient(circle at 35% 35%, ${style.irisColorInner}, ${style.irisColorOuter})`,
                boxShadow: style.glowIntensity > 0 ? `0 0 ${style.glowIntensity * 30}px ${style.irisColorInner}` : 'none',
              }}
            >
              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: style.pupilColor }} />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
          >
            Close
          </button>
          <button
            onClick={() => {
              onApply();
              onClose();
            }}
            className="px-5 py-2 bg-violet-500 hover:bg-violet-400 text-slate-950 text-xs font-bold rounded-xl"
          >
            Apply Custom Theme
          </button>
        </div>
      </div>
    </div>
  );
};

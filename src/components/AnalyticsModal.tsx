import React from 'react';
import { X, Gauge, Footprints, MousePointerClick, ShieldCheck } from 'lucide-react';

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  distanceMeters: number;
  clickCount: number;
  currentSpeedPx: number;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({
  isOpen,
  onClose,
  distanceMeters,
  clickCount,
  currentSpeedPx,
}) => {
  if (!isOpen) return null;

  const distanceKm = (distanceMeters / 1000).toFixed(3);
  const distanceMiles = (distanceMeters * 0.000621371).toFixed(3);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
              <Gauge className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Live Analytics & Stats</h2>
              <p className="text-xs text-slate-400">Mouse Odometer & Desktop Activity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 my-6">
          {/* Distance Odometer */}
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Footprints className="w-4 h-4" />
              <span>Mouse Odometer</span>
            </div>
            <div className="text-2xl font-black text-slate-100 font-mono">
              {distanceMeters.toFixed(1)} <span className="text-sm font-normal text-slate-400">m</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {distanceKm} km | {distanceMiles} mi
            </div>
          </div>

          {/* Speedometer */}
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Gauge className="w-4 h-4" />
              <span>Cursor Speed</span>
            </div>
            <div className="text-2xl font-black text-slate-100 font-mono">
              {Math.round(currentSpeedPx)}{' '}
              <span className="text-sm font-normal text-slate-400">px/s</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {currentSpeedPx > 1200 ? '⚡ High Speed (Dizzy Eyes)' : 'Normal Motion'}
            </div>
          </div>

          {/* Total Click Counter */}
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <MousePointerClick className="w-4 h-4" />
              <span>Total Clicks</span>
            </div>
            <div className="text-2xl font-black text-slate-100 font-mono">{clickCount}</div>
            <div className="text-xs text-slate-400 mt-1">Mouse Clicks Tracked</div>
          </div>

          {/* Eye Strain Protection */}
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Ergonomic Status</span>
            </div>
            <div className="text-sm font-bold text-emerald-400 mt-1">Rest Reminder Active</div>
            <div className="text-xs text-slate-400 mt-1">20/20/20 Eye Strain Protection</div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

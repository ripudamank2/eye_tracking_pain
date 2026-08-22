import React from 'react';
import { Camera, Activity, Zap, Sparkles, Target, Gamepad2, Volume2, VolumeX, Sun, SlidersHorizontal, X, Mic, ShieldAlert, Move, LayoutGrid } from 'lucide-react';
import type { EyeTheme } from '../engine/EyeEngine';
import type { EyePresetPosition } from '../App';

interface ContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  currentTheme: EyeTheme;
  setTheme: (theme: EyeTheme) => void;
  webcamActive: boolean;
  toggleWebcam: () => void;
  voiceListening: boolean;
  toggleVoice: () => void;
  laserMode: boolean;
  setLaserMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  trailMode: boolean;
  setTrailMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  spotlightMode: boolean;
  setSpotlightMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  soundEnabled: boolean;
  setSoundEnabled: (val: boolean) => void;
  openGame: () => void;
  openSprites: () => void;
  openAnalytics: () => void;
  eyeCount: number;
  setEyeCount: (count: number) => void;
  showFullNavbar: boolean;
  setShowFullNavbar: (val: boolean) => void;
  triggerEyeBreak: () => void;
  eyePreset: EyePresetPosition;
  setEyePreset: (preset: EyePresetPosition) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  isOpen,
  onClose,
  currentTheme,
  setTheme,
  webcamActive,
  toggleWebcam,
  voiceListening,
  toggleVoice,
  laserMode,
  setLaserMode,
  trailMode,
  setTrailMode,
  spotlightMode,
  setSpotlightMode,
  soundEnabled,
  setSoundEnabled,
  openGame,
  openSprites,
  openAnalytics,
  eyeCount,
  setEyeCount,
  showFullNavbar,
  setShowFullNavbar,
  triggerEyeBreak,
  eyePreset,
  setEyePreset,
}) => {
  if (!isOpen) return null;

  // Keep menu inside viewport boundaries
  const adjustedX = Math.min(x, window.innerWidth - 300);
  const adjustedY = Math.min(y, window.innerHeight - 560);

  const themes: { id: EyeTheme; label: string; icon: string }[] = [
    { id: 'cute', label: 'Cute Anime', icon: '💖' },
    { id: 'cyberpunk', label: 'Cyberpunk', icon: '⚡' },
    { id: 'cat', label: 'Neeko Cat', icon: '🐱' },
    { id: 'robot', label: 'Mecha Bot', icon: '🤖' },
    { id: 'googly', label: '3D Googly', icon: '👀' },
    { id: 'pixel', label: 'Pixel Retro', icon: '👾' },
  ];

  const presets: { id: EyePresetPosition; label: string }[] = [
    { id: 'top_center', label: '📌 Top Center' },
    { id: 'top_left', label: '↖ Top-Left' },
    { id: 'top_right', label: '↗ Top-Right' },
    { id: 'center', label: '🎯 Center' },
    { id: 'bottom_left', label: '↙ Bottom-Left' },
    { id: 'bottom_right', label: '↘ Bottom-Right' },
  ];

  return (
    <div
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-50 w-72 bg-slate-900/95 border border-cyan-500/30 rounded-2xl p-4 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 context-menu-container select-none text-slate-100"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            Studio Controls
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {/* Eye Position Preset Picker */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-2">
            <span className="flex items-center gap-1">
              <Move className="w-3.5 h-3.5 text-cyan-400" />
              <span>EYE SCREEN POSITION</span>
            </span>
            <span className="text-[10px] text-slate-500 font-sans">Drag or Select</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
            {presets.map((p) => (
              <button
                key={p.id}
                onClick={() => setEyePreset(p.id)}
                className={`py-1.5 px-2 rounded-xl text-left font-semibold transition-all cursor-pointer ${
                  eyePreset === p.id
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-bold'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Theme Picker */}
        <div>
          <span className="text-[11px] text-slate-400 font-mono uppercase tracking-wider block mb-2">
            Eye Themes & Styles
          </span>
          <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`py-1.5 px-2.5 rounded-xl text-left flex items-center gap-2 transition-all cursor-pointer ${
                  currentTheme === t.id
                    ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                }`}
              >
                <span>{t.icon}</span>
                <span className="truncate">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Trigger Crying Eyes & Eye Rest Lock Test */}
        <div>
          <button
            onClick={() => {
              onClose();
              triggerEyeBreak();
            }}
            className="w-full py-2.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-xl text-xs font-mono font-bold text-rose-300 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-rose-500/10"
          >
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>😭 Crying Eyes & Break Lock</span>
          </button>
        </div>

        {/* Interactive Tools & AI Tracking */}
        <div>
          <span className="text-[11px] text-slate-400 font-mono uppercase tracking-wider block mb-2">
            AI & Interactive Features
          </span>
          <div className="space-y-1.5 text-xs">
            <button
              onClick={toggleWebcam}
              className={`w-full py-2 px-3 rounded-xl font-mono flex items-center justify-between transition-all cursor-pointer ${
                webcamActive
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                <span>AI Camera Eye Tracking</span>
              </div>
              <span className="text-[10px] uppercase font-bold">{webcamActive ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={toggleVoice}
              className={`w-full py-2 px-3 rounded-xl font-mono flex items-center justify-between transition-all cursor-pointer ${
                voiceListening
                  ? 'bg-rose-500 text-white font-bold shadow-md shadow-rose-500/20 animate-pulse'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4" />
                <span>AI Voice Commands</span>
              </div>
              <span className="text-[10px] uppercase font-bold">{voiceListening ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={() => setShowFullNavbar(!showFullNavbar)}
              className={`w-full py-2 px-3 rounded-xl font-mono flex items-center justify-between transition-all cursor-pointer ${
                showFullNavbar
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" />
                <span>Full Web Navbar Mode</span>
              </div>
              <span className="text-[10px] uppercase font-bold">{showFullNavbar ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={() => setLaserMode((prev) => !prev)}
              className={`w-full py-2 px-3 rounded-xl font-mono flex items-center justify-between transition-all cursor-pointer ${
                laserMode
                  ? 'bg-rose-500 text-white font-bold shadow-md shadow-rose-500/20'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span>Laser Gaze Pointer</span>
              </div>
              <span className="text-[10px] uppercase font-bold">{laserMode ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={() => setTrailMode((prev) => !prev)}
              className={`w-full py-2 px-3 rounded-xl font-mono flex items-center justify-between transition-all cursor-pointer ${
                trailMode
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span>Sparkle Cursor Trail</span>
              </div>
              <span className="text-[10px] uppercase font-bold">{trailMode ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={() => setSpotlightMode((prev) => !prev)}
              className={`w-full py-2 px-3 rounded-xl font-mono flex items-center justify-between transition-all cursor-pointer ${
                spotlightMode
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sun className="w-4 h-4" />
                <span>Presenter Spotlight Mode</span>
              </div>
              <span className="text-[10px] uppercase font-bold">{spotlightMode ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Eye Quantity Selector */}
        <div>
          <span className="text-[11px] text-slate-400 font-mono uppercase tracking-wider block mb-2">
            Eye Quantity: {eyeCount} Eyes
          </span>
          <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
            {[1, 2, 4, 6].map((num) => (
              <button
                key={num}
                onClick={() => setEyeCount(num)}
                className={`py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  eyeCount === num
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                }`}
              >
                {num} {num === 1 ? 'Eye' : 'Eyes'}
              </button>
            ))}
          </div>
        </div>

        {/* Modals & Games */}
        <div>
          <span className="text-[11px] text-slate-400 font-mono uppercase tracking-wider block mb-2">
            Apps & Analytics
          </span>
          <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
            <button
              onClick={() => {
                onClose();
                openGame();
              }}
              className="py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700/60 flex flex-col items-center gap-1 transition-all cursor-pointer"
            >
              <Gamepad2 className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px]">Gaze Game</span>
            </button>

            <button
              onClick={() => {
                onClose();
                openSprites();
              }}
              className="py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700/60 flex flex-col items-center gap-1 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span className="text-[10px]">Particle Art</span>
            </button>

            <button
              onClick={() => {
                onClose();
                openAnalytics();
              }}
              className="py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700/60 flex flex-col items-center gap-1 transition-all cursor-pointer"
            >
              <Activity className="w-4 h-4 text-amber-400" />
              <span className="text-[10px]">Analytics</span>
            </button>
          </div>
        </div>

        {/* Audio Toggle */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">Sound Effects</span>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      </div>
    </div>
  );
};

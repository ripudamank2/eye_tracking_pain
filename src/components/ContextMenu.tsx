import React from 'react';
import { Camera, Activity, Zap, Sparkles, Target, Gamepad2, Volume2, VolumeX, Sun, SlidersHorizontal, X, Mic, ShieldAlert } from 'lucide-react';
import type { EyeTheme } from '../engine/EyeEngine';

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
}) => {
  if (!isOpen) return null;

  const themes: { id: EyeTheme; label: string; icon: string }[] = [
    { id: 'cute', label: 'Cute Sparkle', icon: '✨' },
    { id: 'natural', label: 'Natural', icon: '👁️' },
    { id: 'cyberpunk', label: 'Cyberpunk', icon: '⚡' },
    { id: 'cat', label: 'Cat Slit', icon: '🐱' },
    { id: 'googly', label: 'Googly', icon: '👀' },
    { id: 'pixel', label: 'Pixel', icon: '👾' },
    { id: 'robot', label: 'Robot', icon: '🤖' },
  ];

  const adjustedX = Math.min(x, window.innerWidth - 280);
  const adjustedY = Math.min(y, window.innerHeight - 520);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-transparent"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />

      {/* Main Context Menu Modal Container */}
      <div
        className="context-menu-container fixed z-50 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl w-64 p-3 text-slate-100 animate-in fade-in zoom-in-95 duration-100"
        style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-black tracking-wider text-cyan-300 uppercase">Studio Controls</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Theme Selector Grid */}
        <div className="mb-3">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-1.5">Eye Theme</span>
          <div className="grid grid-cols-3 gap-1">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTheme(t.id);
                }}
                className={`px-2 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  currentTheme === t.id
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20 scale-105'
                    : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span>{t.icon}</span>
                <span className="text-[11px] truncate">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Primary Actions List */}
        <div className="space-y-1 mb-3">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-1">Features</span>

          <button
            onClick={() => {
              triggerEyeBreak();
              onClose();
            }}
            className="w-full px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 flex items-center justify-between transition-all cursor-pointer shadow-md shadow-rose-500/10"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>😭 Crying Eyes & Break Lock</span>
            </div>
            <span className="text-[10px] font-mono font-bold">TEST</span>
          </button>

          <button
            onClick={() => {
              toggleWebcam();
              onClose();
            }}
            className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
              webcamActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800/40 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span>AI Webcam Tracking</span>
            </div>
            <span className="text-[10px] font-mono opacity-80">{webcamActive ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => {
              toggleVoice();
              onClose();
            }}
            className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
              voiceListening ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse' : 'bg-slate-800/40 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Mic className="w-3.5 h-3.5 text-rose-400" />
              <span>AI Voice Commands</span>
            </div>
            <span className="text-[10px] font-mono">{voiceListening ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => {
              openGame();
              onClose();
            }}
            className="w-full px-2.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-500/20 to-amber-500/20 hover:from-rose-500/30 hover:to-amber-500/30 text-rose-300 border border-rose-500/30 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Gamepad2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Play Target Shooter</span>
          </button>

          <button
            onClick={() => setSpotlightMode((prev) => !prev)}
            className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
              spotlightMode ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800/40 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>Presenter Spotlight</span>
            </div>
            <span className="text-[10px] font-mono">{spotlightMode ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => setLaserMode((prev) => !prev)}
            className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
              laserMode ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-800/40 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-rose-400" />
              <span>Laser Reticle</span>
            </div>
            <span className="text-[10px] font-mono">{laserMode ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => setTrailMode((prev) => !prev)}
            className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
              trailMode ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800/40 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>Cursor Trail</span>
            </div>
            <span className="text-[10px] font-mono">{trailMode ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => {
              openSprites();
              onClose();
            }}
            className="w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800/40 text-slate-300 hover:bg-slate-800 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
            <span>Particle FX Shapes</span>
          </button>

          <button
            onClick={() => {
              openAnalytics();
              onClose();
            }}
            className="w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span>Odometer Analytics</span>
          </button>
        </div>

        {/* Quick Toggles */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono text-slate-400 mr-1">Eyes:</span>
            {[1, 2, 3].map((count) => (
              <button
                key={count}
                onClick={() => setEyeCount(count)}
                className={`w-5 h-5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  eyeCount === count ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {count}
              </button>
            ))}
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
            title="Toggle Audio"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
          </button>

          <button
            onClick={() => {
              setShowFullNavbar(!showFullNavbar);
              onClose();
            }}
            className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-mono text-cyan-300 hover:bg-slate-700 cursor-pointer"
          >
            {showFullNavbar ? 'Hide Navbar' : 'Show Navbar'}
          </button>
        </div>
      </div>
    </>
  );
};

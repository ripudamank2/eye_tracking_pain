import React from 'react';
import { Eye, Camera, Activity, Zap, Sparkles, Target, Mic, Gamepad2, Volume2, VolumeX, Sun, Pin, Flame } from 'lucide-react';
import type { EyeTheme } from '../engine/EyeEngine';

interface NavbarProps {
  currentTheme: EyeTheme;
  setTheme: (theme: EyeTheme) => void;
  webcamActive: boolean;
  toggleWebcam: () => void;
  laserMode: boolean;
  setLaserMode: (val: boolean) => void;
  trailMode: boolean;
  setTrailMode: (val: boolean) => void;
  particlesMode: boolean;
  showHeatmap: boolean;
  setShowHeatmap: (val: boolean) => void;
  spotlightMode: boolean;
  setSpotlightMode: (val: boolean) => void;
  soundEnabled: boolean;
  setSoundEnabled: (val: boolean) => void;
  voiceListening: boolean;
  toggleVoice: () => void;
  openGame: () => void;
  openSprites: () => void;
  openAnalytics: () => void;
  topBarWidgetMode: boolean;
  toggleTopBarWidgetMode: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTheme,
  setTheme,
  webcamActive,
  toggleWebcam,
  laserMode,
  setLaserMode,
  trailMode,
  setTrailMode,
  showHeatmap,
  setShowHeatmap,
  spotlightMode,
  setSpotlightMode,
  soundEnabled,
  setSoundEnabled,
  voiceListening,
  toggleVoice,
  openGame,
  openSprites,
  openAnalytics,
  topBarWidgetMode,
  toggleTopBarWidgetMode,
}) => {
  const themes: { id: EyeTheme; label: string; icon: string }[] = [
    { id: 'cute', label: 'Cute Sparkle', icon: '✨' },
    { id: 'natural', label: 'Natural', icon: '👁️' },
    { id: 'cyberpunk', label: 'Cyberpunk', icon: '⚡' },
    { id: 'cat', label: 'Cat Slit', icon: '🐱' },
    { id: 'googly', label: 'Googly', icon: '👀' },
    { id: 'pixel', label: 'Pixel', icon: '👾' },
    { id: 'robot', label: 'Robot', icon: '🤖' },
  ];

  if (topBarWidgetMode) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/95 border-b border-cyan-500/40 px-4 py-1.5 flex items-center justify-between shadow-2xl animate-in fade-in">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-cyan-500/20 text-cyan-400 rounded-lg">
            <Eye className="w-4 h-4 animate-pulse" />
          </div>
          <span className="text-xs font-black text-slate-100 tracking-tight">OS Top Bar Eye Tracker Widget</span>
        </div>

        {/* Theme Pills */}
        <div className="flex items-center gap-1">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`p-1 rounded-lg text-xs transition-all ${
                currentTheme === t.id ? 'bg-cyan-500 text-slate-950 font-bold scale-110' : 'text-slate-400 hover:text-slate-200'
              }`}
              title={t.label}
            >
              <span>{t.icon}</span>
            </button>
          ))}
        </div>

        {/* Restore Full Window */}
        <button
          onClick={toggleTopBarWidgetMode}
          className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1 shadow-lg shadow-cyan-500/30 transition-all"
          title="Restore Full Studio Window"
        >
          <Pin className="w-3.5 h-3.5" />
          <span>Full App</span>
        </button>
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/85 backdrop-blur-md border-b border-slate-800 px-5 py-2.5 flex items-center justify-between shadow-2xl">
      {/* Brand Logo */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl text-black shadow-lg shadow-cyan-500/20">
          <Eye className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
            Eye Tracker Studio
          </h1>
          <p className="text-[10px] text-slate-400 font-mono">Cross-Platform 60 FPS Visualizer</p>
        </div>
      </div>

      {/* Theme Selector Pills */}
      <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-2xl border border-slate-800">
        {themes.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
              currentTheme === t.id
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>{t.icon}</span>
            <span className="hidden md:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Action Toolbar */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={toggleTopBarWidgetMode}
          className="p-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex items-center gap-1.5 transition-all"
          title="Pin Animated Eyes to OS Top Status Bar (like GNOME/Tray widget)"
        >
          <Pin className="w-4 h-4" />
          <span className="hidden lg:inline">OS Top Bar Widget</span>
        </button>

        <button
          onClick={openGame}
          className="p-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:scale-105 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-500/20 transition-all"
          title="Play Gaze Target Shooter Mini-game"
        >
          <Gamepad2 className="w-4 h-4" />
          <span className="hidden lg:inline">Mini-Game</span>
        </button>

        <button
          onClick={toggleVoice}
          className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
            voiceListening
              ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse'
              : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle AI Voice Commands"
        >
          <Mic className="w-4 h-4" />
          <span className="hidden lg:inline">{voiceListening ? 'Listening...' : 'Voice'}</span>
        </button>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`p-2 rounded-xl border text-xs font-bold transition-all ${
            soundEnabled
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
              : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Sound FX"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        <button
          onClick={toggleWebcam}
          className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
            webcamActive
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
              : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle AI Webcam Tracking"
        >
          <Camera className="w-4 h-4" />
        </button>

        <button
          onClick={() => setSpotlightMode(!spotlightMode)}
          className={`p-2 rounded-xl border text-xs font-bold transition-all ${
            spotlightMode
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-lg shadow-amber-500/20'
              : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Presenter Focus Spotlight"
        >
          <Sun className="w-4 h-4" />
        </button>

        <button
          onClick={() => setLaserMode(!laserMode)}
          className={`p-2 rounded-xl border text-xs font-bold transition-all ${
            laserMode
              ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
              : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Laser Reticle Mode"
        >
          <Target className="w-4 h-4" />
        </button>

        <button
          onClick={() => setTrailMode(!trailMode)}
          className={`p-2 rounded-xl border text-xs font-bold transition-all ${
            trailMode
              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
              : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Cursor Trail"
        >
          <Zap className="w-4 h-4" />
        </button>

        <button
          onClick={openSprites}
          className="p-2 rounded-xl border border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200 text-xs font-bold transition-all"
          title="Custom Particle FX Sprites"
        >
          <Sparkles className="w-4 h-4" />
        </button>

        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`p-2 rounded-xl border text-xs font-bold transition-all ${
            showHeatmap
              ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
              : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Click Heatmap"
        >
          <Flame className="w-4 h-4" />
        </button>

        <button
          onClick={openAnalytics}
          className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 shadow-lg shadow-indigo-500/30 transition-all"
          title="Open Odometer & Speed Analytics"
        >
          <Activity className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

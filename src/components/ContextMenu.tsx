import React from 'react';
import { Camera, Activity, Zap, Sparkles, Target, Gamepad2, Volume2, VolumeX, Sun, SlidersHorizontal, X, Mic, ShieldAlert, Move, LayoutGrid, Smile, Heart, Palette, Wind, CircleDot, Radar, Music, AudioWaveform, Video, Languages, Brain, Hand } from 'lucide-react';
import type { EyeTheme } from '../engine/EyeEngine';
import type { EyePresetPosition } from '../App';
import type { VoiceLanguage } from '../services/VoiceController';

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
  openEyeStudio: () => void;
  eyeCount: number;
  setEyeCount: (count: number) => void;
  showFullNavbar: boolean;
  setShowFullNavbar: (val: boolean) => void;
  triggerEyeBreak: () => void;
  eyePreset: EyePresetPosition;
  setEyePreset: (preset: EyePresetPosition) => void;
  showEyebrows: boolean;
  setShowEyebrows: (val: boolean) => void;
  speedAdaptiveTrails: boolean;
  setSpeedAdaptiveTrails: (val: boolean) => void;
  gravityWellMode: boolean;
  setGravityWellMode: (val: boolean) => void;
  showAttentionHeatmap: boolean;
  setShowAttentionHeatmap: (val: boolean) => void;
  thereminMode: boolean;
  setThereminMode: (val: boolean) => void;
  musicReactiveMode: boolean;
  setMusicReactiveMode: (val: boolean) => void;
  isRecording: boolean;
  toggleRecording: () => void;
  voiceLanguage: VoiceLanguage;
  setVoiceLanguage: (lang: VoiceLanguage) => void;
  triggerHappy: () => void;
  triggerLove: () => void;
  triggerSurprised: () => void;
  triggerFocused: () => void;
  triggerSleepy: () => void;
  debugModeOpen: boolean;
  setDebugModeOpen: (val: boolean) => void;
  openCalibration: () => void;
  openValidation: () => void;
  openDrowsinessGuard: () => void;
  drowsinessGuardEnabled: boolean;
  openAirTouch: () => void;
  airTouchEnabled: boolean;
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
  openEyeStudio,
  eyeCount,
  setEyeCount,
  showFullNavbar,
  setShowFullNavbar,
  triggerEyeBreak,
  eyePreset,
  setEyePreset,
  showEyebrows,
  setShowEyebrows,
  speedAdaptiveTrails,
  setSpeedAdaptiveTrails,
  gravityWellMode,
  setGravityWellMode,
  showAttentionHeatmap,
  setShowAttentionHeatmap,
  thereminMode,
  setThereminMode,
  musicReactiveMode,
  setMusicReactiveMode,
  isRecording,
  toggleRecording,
  voiceLanguage,
  setVoiceLanguage,
  triggerHappy,
  triggerLove,
  triggerSurprised,
  triggerFocused,
  triggerSleepy,
  debugModeOpen,
  setDebugModeOpen,
  openCalibration,
  openValidation,
  openDrowsinessGuard,
  drowsinessGuardEnabled,
  openAirTouch,
  airTouchEnabled,
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
    { id: 'galaxy', label: 'Cosmic Galaxy', icon: '🌌' },
    { id: 'flame', label: 'Fiery Flame', icon: '🔥' },
    { id: 'dragon', label: 'Dragon Eye', icon: '🐉' },
    { id: 'matrix', label: 'Matrix Rain', icon: '💻' },
    { id: 'animeheart', label: 'Anime Heart', icon: '💕' },
  ];

  const voiceLanguages: { id: VoiceLanguage; label: string }[] = [
    { id: 'en-US', label: '🇺🇸 English' },
    { id: 'es-ES', label: '🇪🇸 Español' },
    { id: 'ja-JP', label: '🇯🇵 日本語' },
    { id: 'fr-FR', label: '🇫🇷 Français' },
    { id: 'de-DE', label: '🇩🇪 Deutsch' },
    { id: 'hi-IN', label: '🇮🇳 हिन्दी' },
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

            {webcamActive && (
              <button
                onClick={openCalibration}
                className="w-full py-2 px-3 rounded-xl font-mono flex items-center justify-between transition-all cursor-pointer bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60"
              >
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  <span>Calibrate Gaze (5-point)</span>
                </div>
              </button>
            )}

            <button
              onClick={() => setDebugModeOpen(!debugModeOpen)}
              className={`w-full py-2 px-3 rounded-xl font-mono flex items-center justify-between transition-all cursor-pointer ${
                debugModeOpen
                  ? 'bg-lime-500 text-slate-950 font-bold shadow-md shadow-lime-500/20'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              }`}
              title="Ctrl+Shift+D"
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span>Eye Engine Diagnostics</span>
              </div>
              <span className="text-[10px] uppercase font-bold">{debugModeOpen ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={openValidation}
              className="w-full py-2 px-3 rounded-xl font-mono flex items-center justify-between transition-all cursor-pointer bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60"
              title="Ctrl+Shift+V"
            >
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span>Real-Camera Validation</span>
              </div>
            </button>

            <button
              onClick={openDrowsinessGuard}
              className={`w-full py-2 px-3 rounded-xl font-mono flex items-center justify-between transition-all cursor-pointer ${
                drowsinessGuardEnabled
                  ? 'bg-violet-500/20 text-violet-300 font-bold shadow-md shadow-violet-500/10 border border-violet-500/40'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4" />
                <span>Drowsiness & Eye-Fatigue Guard</span>
              </div>
              <span className="text-[10px] uppercase font-bold">{drowsinessGuardEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={openAirTouch}
              className={`w-full py-2 px-3 rounded-xl font-mono flex items-center justify-between transition-all cursor-pointer ${
                airTouchEnabled
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold shadow-md shadow-cyan-500/10 border border-cyan-500/40'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              }`}
              title="Ctrl+Shift+H"
            >
              <div className="flex items-center gap-2">
                <Hand className="w-4 h-4" />
                <span>Air Touch (Hand Control)</span>
              </div>
              <span className="text-[10px] uppercase font-bold">{airTouchEnabled ? 'ON' : 'OFF'}</span>
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

        {/* Emotion & Expression Engine */}
        <div>
          <span className="text-[11px] text-slate-400 font-mono uppercase tracking-wider block mb-2">
            Emotion & Expression Engine
          </span>
          <div className="grid grid-cols-2 gap-1.5 text-xs font-mono mb-1.5">
            <button
              onClick={triggerHappy}
              className="py-2 px-3 rounded-xl font-mono flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-slate-700/60 transition-all cursor-pointer"
            >
              <Smile className="w-4 h-4" />
              <span>Happy ^_^</span>
            </button>
            <button
              onClick={triggerLove}
              className="py-2 px-3 rounded-xl font-mono flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-pink-500/20 text-slate-300 hover:text-pink-300 border border-slate-700/60 transition-all cursor-pointer"
            >
              <Heart className="w-4 h-4" />
              <span>Love Mode</span>
            </button>
          </div>
          <button
            onClick={() => setShowEyebrows(!showEyebrows)}
            className={`w-full py-2 px-3 rounded-xl font-mono flex items-center justify-between transition-all cursor-pointer ${
              showEyebrows
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              <span>Animated Eyebrows</span>
            </div>
            <span className="text-[10px] uppercase font-bold">{showEyebrows ? 'ON' : 'OFF'}</span>
          </button>
          {showEyebrows && (
            <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono mt-1.5">
              <button
                onClick={triggerSurprised}
                className="py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-all cursor-pointer"
              >
                😮 Surprised
              </button>
              <button
                onClick={triggerFocused}
                className="py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-all cursor-pointer"
              >
                🧐 Focused
              </button>
              <button
                onClick={triggerSleepy}
                className="py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-all cursor-pointer"
              >
                😴 Sleepy
              </button>
            </div>
          )}
          <button
            onClick={openEyeStudio}
            className="w-full mt-1.5 py-2 px-3 rounded-xl font-mono flex items-center justify-between transition-all cursor-pointer bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-300"
          >
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              <span>Custom Eye Studio</span>
            </div>
          </button>
        </div>

        {/* Particle & Trail FX */}
        <div>
          <span className="text-[11px] text-slate-400 font-mono uppercase tracking-wider block mb-2">
            Mood-Adaptive Trails & Black Hole FX
          </span>
          <div className="space-y-1.5 text-xs">
            <button
              onClick={() => setSpeedAdaptiveTrails(!speedAdaptiveTrails)}
              className={`w-full py-2 px-3 rounded-xl font-mono flex items-center justify-between transition-all cursor-pointer ${
                speedAdaptiveTrails
                  ? 'bg-orange-500 text-slate-950 font-bold shadow-md shadow-orange-500/20'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4" />
                <span>Speed-Adaptive Trail Colors</span>
              </div>
              <span className="text-[10px] uppercase font-bold">{speedAdaptiveTrails ? 'ON' : 'OFF'}</span>
            </button>
            <button
              onClick={() => setGravityWellMode(!gravityWellMode)}
              className={`w-full py-2 px-3 rounded-xl font-mono flex items-center justify-between transition-all cursor-pointer ${
                gravityWellMode
                  ? 'bg-violet-500 text-white font-bold shadow-md shadow-violet-500/20'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <CircleDot className="w-4 h-4" />
                <span>Gravity Well Black Hole FX</span>
              </div>
              <span className="text-[10px] uppercase font-bold">{gravityWellMode ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Attention & Audio Features */}
        <div>
          <span className="text-[11px] text-slate-400 font-mono uppercase tracking-wider block mb-2">
            Attention, Audio & Recording
          </span>
          <div className="space-y-1.5 text-xs">
            <button
              onClick={() => setShowAttentionHeatmap(!showAttentionHeatmap)}
              className={`w-full py-2 px-3 rounded-xl font-mono flex items-center justify-between transition-all cursor-pointer ${
                showAttentionHeatmap
                  ? 'bg-purple-500 text-white font-bold shadow-md shadow-purple-500/20'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Radar className="w-4 h-4" />
                <span>Focus / Attention Heatmap</span>
              </div>
              <span className="text-[10px] uppercase font-bold">{showAttentionHeatmap ? 'ON' : 'OFF'}</span>
            </button>
            <button
              onClick={() => setThereminMode(!thereminMode)}
              className={`w-full py-2 px-3 rounded-xl font-mono flex items-center justify-between transition-all cursor-pointer ${
                thereminMode
                  ? 'bg-indigo-500 text-white font-bold shadow-md shadow-indigo-500/20'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4" />
                <span>Musical Eye Theremin</span>
              </div>
              <span className="text-[10px] uppercase font-bold">{thereminMode ? 'ON' : 'OFF'}</span>
            </button>
            <button
              onClick={() => setMusicReactiveMode(!musicReactiveMode)}
              className={`w-full py-2 px-3 rounded-xl font-mono flex items-center justify-between transition-all cursor-pointer ${
                musicReactiveMode
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              }`}
              title="Pupils pulse to mic-captured audio bass"
            >
              <div className="flex items-center gap-2">
                <AudioWaveform className="w-4 h-4" />
                <span>Music Reactive Pupils</span>
              </div>
              <span className="text-[10px] uppercase font-bold">{musicReactiveMode ? 'ON' : 'OFF'}</span>
            </button>
            <button
              onClick={toggleRecording}
              className={`w-full py-2 px-3 rounded-xl font-mono flex items-center justify-between transition-all cursor-pointer ${
                isRecording
                  ? 'bg-rose-500 text-white font-bold shadow-md shadow-rose-500/20 animate-pulse'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4" />
                <span>Gaze Overlay Recorder</span>
              </div>
              <span className="text-[10px] uppercase font-bold">{isRecording ? 'REC' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Multilingual Voice Commands */}
        <div>
          <span className="text-[11px] text-slate-400 font-mono uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <Languages className="w-3.5 h-3.5 text-cyan-400" />
            Voice Command Language
          </span>
          <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
            {voiceLanguages.map((l) => (
              <button
                key={l.id}
                onClick={() => setVoiceLanguage(l.id)}
                className={`py-1.5 px-2 rounded-xl text-left font-semibold transition-all cursor-pointer ${
                  voiceLanguage === l.id
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-bold'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                }`}
              >
                {l.label}
              </button>
            ))}
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

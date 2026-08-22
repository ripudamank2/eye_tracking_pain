import { useEffect, useRef, useState } from 'react';
import { Navbar } from './components/Navbar';
import { ContextMenu } from './components/ContextMenu';
import { AnalyticsModal } from './components/AnalyticsModal';
import { GazeGameModal } from './components/GazeGameModal';
import { CustomSpriteModal } from './components/CustomSpriteModal';
import { EyeBreakModal } from './components/EyeBreakModal';
import { WebcamPreview } from './components/WebcamPreview';
import { EyeEngine } from './engine/EyeEngine';
import type { EyeTheme } from './engine/EyeEngine';
import { ParticleEngine } from './engine/ParticleEngine';
import type { ParticleShape } from './engine/ParticleEngine';
import { WebcamTracker } from './services/WebcamTracker';
import { AudioSynth } from './services/AudioSynth';
import { VoiceController } from './services/VoiceController';
import { Mic, SlidersHorizontal, Move } from 'lucide-react';

export type EyePresetPosition = 'top_center' | 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right' | 'center' | 'custom';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // App State
  const [theme, setTheme] = useState<EyeTheme>('cute');
  const [webcamActive, setWebcamActive] = useState(false);
  const [laserMode, setLaserMode] = useState(false);
  const [trailMode, setTrailMode] = useState(true);
  const [particlesMode] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [spotlightMode, setSpotlightMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [particleShape, setParticleShape] = useState<ParticleShape>('default');

  // Eye Screen Positioning & Direct Mouse Drag State
  const [eyePreset, setEyePreset] = useState<EyePresetPosition>('top_center');
  const [customEyePos, setCustomEyePos] = useState<{ x: number; y: number } | null>(null);
  const isDraggingEyesRef = useRef(false);

  // Display Mode: Defaults to Clean OS Top Status-Bar Widget Panel!
  const [showFullNavbar, setShowFullNavbar] = useState(false);
  const [topBarWidgetMode, setTopBarWidgetMode] = useState(true);

  // Right-Click Context Menu State
  const [contextMenuState, setContextMenuState] = useState<{ x: number; y: number; isOpen: boolean }>({
    x: 0,
    y: 0,
    isOpen: false,
  });

  // Modals & Voice State
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isGameOpen, setIsGameOpen] = useState(false);
  const [isSpritesOpen, setIsSpritesOpen] = useState(false);
  const [isEyeBreakOpen, setIsEyeBreakOpen] = useState(false);
  const [isCrying, setIsCrying] = useState(false);

  const [voiceListening, setVoiceListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [micVolume, setMicVolume] = useState(0);

  // Tracking Stats
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [clickCount, setClickCount] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);

  // Eye Instances
  const [eyeCount, setEyeCount] = useState(2);

  // Services & Engines
  const eyeEngineRef = useRef(new EyeEngine());
  const particleEngineRef = useRef(new ParticleEngine());
  const webcamTrackerRef = useRef(new WebcamTracker());
  const audioSynthRef = useRef(new AudioSynth());
  const voiceControllerRef = useRef<VoiceController | null>(null);

  // Input State & Screen Time Timers
  const mousePosRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const lastMousePosRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const lastTimeRef = useRef(performance.now());
  const lastMotionTimeRef = useRef(performance.now());
  const continuousActiveSecondsRef = useRef(0);
  const clickBurstRef = useRef(0);
  const isWinkingRef = useRef(false);

  // Computed Base Position of Eyes
  const getEyeCenterCoordinates = (width: number, height: number) => {
    if (isCrying || isEyeBreakOpen) {
      // Center eyes when crying or break modal is open
      return { x: width / 2, y: height / 2 - 160 };
    }

    if (eyePreset === 'custom' && customEyePos) {
      return customEyePos;
    }

    switch (eyePreset) {
      case 'top_left':
        return { x: 120, y: 54 };
      case 'top_right':
        return { x: width - 120, y: 54 };
      case 'bottom_left':
        return { x: 120, y: height - 60 };
      case 'bottom_right':
        return { x: width - 120, y: height - 60 };
      case 'center':
        return { x: width / 2, y: height / 2 };
      case 'top_center':
      default:
        return { x: width / 2, y: topBarWidgetMode ? 26 : 120 };
    }
  };

  // Trigger Eye Break
  const triggerEyeBreak = () => {
    setIsCrying(true);
    setIsEyeBreakOpen(true);
    continuousActiveSecondsRef.current = 0;
  };

  // Continuous Active Screen Time Tracking
  useEffect(() => {
    const timer = setInterval(() => {
      const timeSinceLastMotion = performance.now() - lastMotionTimeRef.current;
      if (timeSinceLastMotion < 60000) {
        continuousActiveSecondsRef.current += 1;
        if (continuousActiveSecondsRef.current >= 1200 && !isEyeBreakOpen) {
          triggerEyeBreak();
        }
      } else {
        continuousActiveSecondsRef.current = 0;
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isEyeBreakOpen]);

  // Notify Electron when Right-Click Menu or Modals open/close
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (win.require) {
      try {
        const { ipcRenderer } = win.require('electron');
        ipcRenderer.send('expand-window-for-menu', contextMenuState.isOpen || isGameOpen || isAnalyticsOpen || isSpritesOpen || isEyeBreakOpen || webcamActive);
      } catch {
        /* ignore */
      }
    }
  }, [contextMenuState.isOpen, isGameOpen, isAnalyticsOpen, isSpritesOpen, isEyeBreakOpen, webcamActive]);

  // Toggle OS Top Bar Widget Mode
  const toggleTopBarWidgetMode = () => {
    const nextState = !topBarWidgetMode;
    setTopBarWidgetMode(nextState);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (win.require) {
      try {
        const { ipcRenderer } = win.require('electron');
        ipcRenderer.send('toggle-widget-mode', nextState);
      } catch {
        /* ignore */
      }
    }
  };

  // Sync Audio Synth state
  useEffect(() => {
    audioSynthRef.current.enabled = soundEnabled;
  }, [soundEnabled]);

  // Sync Particle Shape state
  useEffect(() => {
    particleEngineRef.current.currentShape = particleShape;
  }, [particleShape]);

  const handleVoiceCommand = (cmd: string) => {
    audioSynthRef.current.playPop();
    if (cmd === 'laser') setLaserMode((prev) => !prev);
    else if (cmd === 'trail') setTrailMode((prev) => !prev);
    else if (cmd === 'cyberpunk') setTheme('cyberpunk');
    else if (cmd === 'cat') setTheme('cat');
    else if (cmd === 'robot') setTheme('robot');
    else if (cmd === 'googly') setTheme('googly');
    else if (cmd === 'pixel') setTheme('pixel');
    else if (cmd === 'cute') setTheme('cute');
    else if (cmd === 'game') setIsGameOpen(true);
    else if (cmd === 'analytics') setIsAnalyticsOpen(true);
    else if (cmd === 'break') triggerEyeBreak();
  };

  // Initialize Voice Controller
  useEffect(() => {
    voiceControllerRef.current = new VoiceController({
      onTranscript: (text) => {
        setLiveTranscript(text);
      },
      onVolume: (vol) => {
        setMicVolume(vol);
      },
      onCommand: handleVoiceCommand,
    });
  }, []);

  const toggleVoice = async () => {
    if (!voiceControllerRef.current) return;
    if (voiceListening) {
      voiceControllerRef.current.stop();
      setVoiceListening(false);
      setLiveTranscript('');
      setMicVolume(0);
    } else {
      const ok = await voiceControllerRef.current.start();
      setVoiceListening(ok);
    }
  };

  // Main 60 FPS Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const render = (time: number) => {
      const dt = Math.max(0.001, (time - lastTimeRef.current) / 1000);
      lastTimeRef.current = time;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let targetX = mousePosRef.current.x;
      let targetY = mousePosRef.current.y;

      if (webcamActive && webcamTrackerRef.current.facePos.isTracking) {
        targetX = webcamTrackerRef.current.facePos.x;
        targetY = webcamTrackerRef.current.facePos.y;
      }

      const dx = targetX - lastMousePosRef.current.x;
      const dy = targetY - lastMousePosRef.current.y;
      const distPx = Math.sqrt(dx * dx + dy * dy);

      if (distPx > 1.0) {
        lastMotionTimeRef.current = time;
        const distM = distPx * 0.0002645833;
        setDistanceMeters((prev) => prev + distM);

        if (trailMode) {
          particleEngineRef.current.addTrailPoint(targetX, targetY);
        }
      }

      const speed = distPx / dt;
      setCurrentSpeed(speed);
      lastMousePosRef.current = { x: targetX, y: targetY };

      const isIdle = time - lastMotionTimeRef.current > 25000;

      particleEngineRef.current.update(dt);

      if (spotlightMode) {
        particleEngineRef.current.drawSpotlight(ctx, canvas.width, canvas.height, targetX, targetY);
      }

      if (showHeatmap) {
        particleEngineRef.current.drawHeatmap(ctx);
      }

      if (trailMode) {
        particleEngineRef.current.drawTrail(ctx);
      }

      // Compute Eye Positions based on Preset / Drag
      const radius = topBarWidgetMode && eyePreset === 'top_center' ? 14 : 28;
      const spacing = topBarWidgetMode && eyePreset === 'top_center' ? 36 : 64;

      const centerPos = getEyeCenterCoordinates(canvas.width, canvas.height);
      const startX = centerPos.x - ((eyeCount - 1) * spacing) / 2;
      const startY = centerPos.y;

      eyeEngineRef.current.update(
        {
          theme,
          x: startX,
          y: startY,
          radius,
          targetX,
          targetY,
          isIdle,
          velocity: speed,
          clickBurstCount: clickBurstRef.current,
          isWinking: isWinkingRef.current,
          isCrying,
        },
        dt
      );

      for (let i = 0; i < eyeCount; i++) {
        const eyeX = startX + i * spacing;
        eyeEngineRef.current.draw(ctx, {
          theme,
          x: eyeX,
          y: startY,
          radius,
          targetX,
          targetY,
          isIdle,
          velocity: speed,
          clickBurstCount: clickBurstRef.current,
          isWinking: isWinkingRef.current,
          isCrying,
        });
      }

      particleEngineRef.current.drawParticles(ctx);
      particleEngineRef.current.drawBadges(ctx);

      if (laserMode) {
        particleEngineRef.current.drawLaserReticle(ctx, targetX, targetY);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme, webcamActive, laserMode, trailMode, particlesMode, showHeatmap, spotlightMode, eyeCount, topBarWidgetMode, isCrying, eyePreset, customEyePos]);

  // Event Listeners for Mouse Motion, Direct Eye Dragging & Clicks
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };

      if (isDraggingEyesRef.current) {
        setEyePreset('custom');
        setCustomEyePos({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const targetEl = e.target as HTMLElement | null;
      if (targetEl && targetEl.closest('.context-menu-container')) {
        return;
      }

      // Check if clicking near eyes to start Dragging Anywhere!
      const centerPos = getEyeCenterCoordinates(window.innerWidth, window.innerHeight);
      const distToEyes = Math.hypot(e.clientX - centerPos.x, e.clientY - centerPos.y);

      if (distToEyes < 60 && e.button === 0) {
        isDraggingEyesRef.current = true;
        setEyePreset('custom');
        setCustomEyePos({ x: e.clientX, y: e.clientY });
        return;
      }

      if (e.button === 0) {
        setClickCount((prev) => prev + 1);
        clickBurstRef.current += 1;

        if (laserMode) audioSynthRef.current.playLaser();
        else audioSynthRef.current.playPop();

        setTimeout(() => {
          clickBurstRef.current = Math.max(0, clickBurstRef.current - 1);
        }, 800);

        if (particlesMode) {
          const colors = ['#06b6d4', '#ec4899', '#f59e0b', '#10b981'];
          const randomColor = colors[Math.floor(Math.random() * colors.length)];
          particleEngineRef.current.spawnBurst(e.clientX, e.clientY, randomColor);
        }

        particleEngineRef.current.recordClick(e.clientX, e.clientY);

        const modifiers: string[] = [];
        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.shiftKey) modifiers.push('Shift');
        if (e.altKey) modifiers.push('Alt');
        if (modifiers.length > 0) {
          particleEngineRef.current.addBadge(e.clientX, e.clientY, modifiers.join('+'));
        }
      }
    };

    const handleMouseUp = () => {
      isDraggingEyesRef.current = false;
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setContextMenuState({
        x: e.clientX,
        y: e.clientY,
        isOpen: true,
      });
      audioSynthRef.current.playPop();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [particlesMode, laserMode, eyePreset, customEyePos, isCrying, isEyeBreakOpen, topBarWidgetMode]);

  const toggleWebcam = async () => {
    if (webcamActive) {
      webcamTrackerRef.current.stop();
      setWebcamActive(false);
    } else {
      const success = await webcamTrackerRef.current.start();
      if (success) setWebcamActive(true);
      else alert('Webcam permission denied or unavailable.');
    }
  };

  return (
    <div className="relative w-screen h-screen bg-transparent text-slate-100 overflow-hidden select-none">
      {/* Optional Top Navbar */}
      {showFullNavbar && (
        <Navbar
          currentTheme={theme}
          setTheme={setTheme}
          webcamActive={webcamActive}
          toggleWebcam={toggleWebcam}
          laserMode={laserMode}
          setLaserMode={setLaserMode}
          trailMode={trailMode}
          setTrailMode={setTrailMode}
          particlesMode={particlesMode}
          showHeatmap={showHeatmap}
          setShowHeatmap={setShowHeatmap}
          spotlightMode={spotlightMode}
          setSpotlightMode={setSpotlightMode}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          voiceListening={voiceListening}
          toggleVoice={toggleVoice}
          openGame={() => setIsGameOpen(true)}
          openSprites={() => setIsSpritesOpen(true)}
          openAnalytics={() => setIsAnalyticsOpen(true)}
          topBarWidgetMode={topBarWidgetMode}
          toggleTopBarWidgetMode={toggleTopBarWidgetMode}
        />
      )}

      {/* Floating Top Right Quick Menu Hint */}
      {!showFullNavbar && !topBarWidgetMode && (
        <div className="absolute top-3 right-4 z-40 flex items-center gap-2">
          <button
            onClick={(e) => {
              setContextMenuState({ x: e.clientX - 240, y: e.clientY + 10, isOpen: !contextMenuState.isOpen });
            }}
            className="px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-mono font-bold text-cyan-400 flex items-center gap-1.5 shadow-xl backdrop-blur-md transition-all cursor-pointer"
            title="Right click anywhere or click here for Studio Menu"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Right-Click for Studio Menu</span>
          </button>
        </div>
      )}

      {/* Live Drag Hint Pill when custom dragging */}
      {eyePreset === 'custom' && (
        <div className="absolute top-3 left-4 z-40 bg-slate-900/90 border border-cyan-500/40 rounded-xl px-3 py-1 flex items-center gap-1.5 text-[11px] font-mono text-cyan-300 shadow-xl backdrop-blur-md">
          <Move className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>Custom Eyes Position (Click & Drag Eyes)</span>
          <button
            onClick={() => setEyePreset('top_center')}
            className="ml-2 px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 rounded border border-slate-700 transition-colors"
          >
            Reset
          </button>
        </div>
      )}

      {/* Live Voice Transcript Banner */}
      {voiceListening && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 border border-rose-500/50 backdrop-blur-md px-5 py-2.5 rounded-2xl flex items-center gap-3 shadow-2xl animate-in fade-in">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-rose-400 animate-pulse" />
            <div className="w-12 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-rose-500 transition-all duration-100"
                style={{ width: `${micVolume}%` }}
              />
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-slate-200">
            {liveTranscript || 'Listening... Say "break", "cute", "laser", "game":'}
          </span>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-1">
            {['break', 'cute', 'laser', 'game'].map((cmd) => (
              <button
                key={cmd}
                onClick={() => handleVoiceCommand(cmd)}
                className="px-2 py-0.5 bg-slate-800 hover:bg-rose-500/20 text-[10px] font-mono text-slate-300 hover:text-rose-300 rounded-md border border-slate-700 transition-all"
              >
                "{cmd}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Interactive Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 z-10 cursor-crosshair" />

      {/* Right-Click Context Menu */}
      <ContextMenu
        x={contextMenuState.x}
        y={contextMenuState.y}
        isOpen={contextMenuState.isOpen}
        onClose={() => setContextMenuState((prev) => ({ ...prev, isOpen: false }))}
        currentTheme={theme}
        setTheme={setTheme}
        webcamActive={webcamActive}
        toggleWebcam={toggleWebcam}
        voiceListening={voiceListening}
        toggleVoice={toggleVoice}
        laserMode={laserMode}
        setLaserMode={setLaserMode}
        trailMode={trailMode}
        setTrailMode={setTrailMode}
        spotlightMode={spotlightMode}
        setSpotlightMode={setSpotlightMode}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        openGame={() => setIsGameOpen(true)}
        openSprites={() => setIsSpritesOpen(true)}
        openAnalytics={() => setIsAnalyticsOpen(true)}
        eyeCount={eyeCount}
        setEyeCount={setEyeCount}
        showFullNavbar={showFullNavbar}
        setShowFullNavbar={setShowFullNavbar}
        triggerEyeBreak={triggerEyeBreak}
        eyePreset={eyePreset}
        setEyePreset={setEyePreset}
      />

      {/* Eye Rest Break Safety Lock Modal */}
      <EyeBreakModal
        isOpen={isEyeBreakOpen}
        onUnlock={() => {
          setIsEyeBreakOpen(false);
          setIsCrying(false);
          continuousActiveSecondsRef.current = 0;
        }}
      />

      {/* Analytics Modal */}
      <AnalyticsModal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        distanceMeters={distanceMeters}
        clickCount={clickCount}
        currentSpeedPx={currentSpeed}
      />

      {/* Gaze Mini-Game Modal */}
      <GazeGameModal
        isOpen={isGameOpen}
        onClose={() => setIsGameOpen(false)}
        audioSynth={audioSynthRef.current}
      />

      {/* Custom Sprites Modal */}
      <CustomSpriteModal
        isOpen={isSpritesOpen}
        onClose={() => setIsSpritesOpen(false)}
        currentShape={particleShape}
        setShape={setParticleShape}
      />

      {/* Live Camera PIP Preview */}
      <WebcamPreview
        webcamTracker={webcamTrackerRef.current}
        isOpen={webcamActive}
        onClose={toggleWebcam}
      />
    </div>
  );
}

export default App;

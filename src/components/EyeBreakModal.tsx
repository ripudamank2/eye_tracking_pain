import React, { useEffect, useState, useRef } from 'react';
import { Sparkles, CheckCircle2, Lock, MonitorCheck } from 'lucide-react';

export type LockModeOption = 'virtual_app' | 'native_os';

interface EyeBreakModalProps {
  isOpen: boolean;
  onUnlock: () => void;
  breakDurationSeconds?: number;
}

export const EyeBreakModal: React.FC<EyeBreakModalProps> = ({
  isOpen,
  onUnlock,
  breakDurationSeconds = 120, // 2-minute eye rest break by default
}) => {
  const [timeLeft, setTimeLeft] = useState(breakDurationSeconds);
  const [lockMode, setLockMode] = useState<LockModeOption>('virtual_app');
  const hasSpokenRef = useRef(false);

  const lockOsScreen = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (win.require) {
      try {
        const { ipcRenderer } = win.require('electron');
        ipcRenderer.send('lock-os-screen');
      } catch {
        /* ignore */
      }
    }
  };

  // Speech Alert Effect: Plays clearly once when opened, stops cleanly when closed
  useEffect(() => {
    if (isOpen && !hasSpokenRef.current) {
      hasSpokenRef.current = true;
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        setTimeout(() => {
          const speakPhrase = (countRemaining: number) => {
            if (!isOpen && !hasSpokenRef.current) return;
            const msg = new SpeechSynthesisUtterance("You've been staring at the screen for too long! Please take an eye break now.");
            msg.rate = 1.0;
            
            if (countRemaining > 1) {
              msg.onend = () => {
                setTimeout(() => {
                  if ('speechSynthesis' in window) {
                    const msg2 = new SpeechSynthesisUtterance("Please rest your eyes now.");
                    msg2.rate = 1.0;
                    window.speechSynthesis.speak(msg2);
                  }
                }, 1200);
              };
            }
            
            window.speechSynthesis.speak(msg);
          };

          speakPhrase(2);
        }, 50);
      }
    }

    if (!isOpen) {
      hasSpokenRef.current = false;
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
  }, [isOpen]);

  // Countdown Timer & OS Lock Effect
  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(breakDurationSeconds);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
          }
          onUnlock();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, breakDurationSeconds, onUnlock]);

  if (!isOpen) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200 select-none">
      <div className="bg-slate-900/95 border border-cyan-500/50 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden">
        {/* Background Radial Glow */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-rose-500/20 rounded-full blur-3xl" />

        {/* Crying Eye Icon */}
        <div className="relative mx-auto w-24 h-24 mb-4 flex items-center justify-center bg-slate-800/80 border border-slate-700 rounded-3xl shadow-xl">
          <div className="text-5xl animate-bounce">😭</div>
          <div className="absolute -bottom-2 px-3 py-0.5 bg-rose-500/30 text-rose-300 border border-rose-500/50 text-[10px] font-mono font-bold rounded-full">
            Tears Dripping!
          </div>
        </div>

        <h2 className="text-2xl font-black text-slate-100 tracking-tight mb-2">
          Eye Strain Safety Lock!
        </h2>
        <p className="text-xs text-slate-300 mb-5 leading-relaxed">
          The eyes are crying! You have been looking at the screen for too long. Take a 2-minute break to relax your eyes.
        </p>

        {/* Lock Mode Chooser */}
        <div className="bg-slate-950/80 border border-slate-800 p-1.5 rounded-2xl mb-5 grid grid-cols-2 gap-1 text-xs">
          <button
            onClick={() => setLockMode('virtual_app')}
            className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              lockMode === 'virtual_app'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <MonitorCheck className="w-4 h-4" />
            <span>Virtual Auto-Unlock</span>
          </button>

          <button
            onClick={() => {
              setLockMode('native_os');
              lockOsScreen();
            }}
            className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              lockMode === 'native_os'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Native OS Lock</span>
          </button>
        </div>

        {/* 2-Minute Countdown Timer Card */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 mb-5 shadow-inner">
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 block mb-1">
            {lockMode === 'virtual_app' ? 'Auto-Unlocks In' : 'Eye Rest Break Timer'}
          </span>
          <div className="text-4xl font-black font-mono bg-gradient-to-r from-cyan-400 via-sky-300 to-rose-400 bg-clip-text text-transparent">
            {formattedTime}
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-rose-500 transition-all duration-1000"
              style={{ width: `${((breakDurationSeconds - timeLeft) / breakDurationSeconds) * 100}%` }}
            />
          </div>
        </div>

        {/* Relaxation Instructions */}
        <div className="space-y-2 text-left bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/60 mb-5">
          <div className="flex items-center gap-2 text-xs text-cyan-300 font-semibold">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>20-20-20 Rule Exercise:</span>
          </div>
          <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside font-mono">
            <li>Look at an object 20 feet (6m) away.</li>
            <li>Blink smoothly 10 times to rehydrate eyes.</li>
            <li>Roll your shoulders and relax your neck.</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={() => {
              if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
              }
              onUnlock();
            }}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-mono text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>I Rested My Eyes (Unlock Now)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

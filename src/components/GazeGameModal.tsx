import React, { useState, useEffect } from 'react';
import { X, Target, Trophy, RotateCcw, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AudioSynth } from '../services/AudioSynth';

interface TargetItem {
  id: number;
  x: number;
  y: number;
  size: number;
}

interface GazeGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioSynth: AudioSynth;
}

export const GazeGameModal: React.FC<GazeGameModalProps> = ({ isOpen, onClose, audioSynth }) => {
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [targets, setTargets] = useState<TargetItem[]>([]);

  // Start Mini-game
  const startGame = () => {
    setScore(0);
    setCombo(1);
    setTimeLeft(30);
    setIsPlaying(true);
    setGameOver(false);
    spawnTarget();
  };

  const spawnTarget = () => {
    const newTarget: TargetItem = {
      id: Date.now(),
      x: 10 + Math.random() * 80,
      y: 15 + Math.random() * 70,
      size: 40 + Math.random() * 20,
    };
    setTargets([newTarget]);
  };

  // Timer countdown loop
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isPlaying && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (isPlaying && timeLeft === 0) {
      setIsPlaying(false);
      setGameOver(true);
      audioSynth.playFanfare();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
    return () => clearInterval(timer);
  }, [isPlaying, timeLeft, audioSynth]);

  // Click Target
  const handleHitTarget = (id: number) => {
    if (!isPlaying) return;
    audioSynth.playHit();
    setScore((prev) => prev + 10 * combo);
    setCombo((prev) => prev + 1);
    setTargets((prev) => prev.filter((t) => t.id !== id));
    spawnTarget();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full h-[550px] relative overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Gaze Target Shooter Challenge</h2>
              <p className="text-xs text-slate-400">Aim with your cursor/gaze & destroy targets!</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 font-mono text-xs">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Score: {score}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 font-mono text-xs">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>Combo: x{combo}</span>
            </div>
            <div className="bg-rose-500/20 text-rose-300 px-3 py-1.5 rounded-xl font-mono text-xs border border-rose-500/40 font-bold">
              ⏱️ {timeLeft}s
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Game Playing Area */}
        <div className="flex-1 relative bg-slate-950/70 bg-grid-pattern overflow-hidden">
          {!isPlaying && !gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <Target className="w-16 h-16 text-rose-400 mb-4 animate-bounce" />
              <h3 className="text-2xl font-black text-slate-100 mb-2">Ready to Test Your Gaze?</h3>
              <p className="text-xs text-slate-400 max-w-sm mb-6">
                Move your cursor or webcam gaze to pop targets before the 30-second clock expires!
              </p>
              <button
                onClick={startGame}
                className="px-8 py-3 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-rose-500/30 scale-105 transition-all"
              >
                Start Challenge 🎯
              </button>
            </div>
          )}

          {gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <Trophy className="w-20 h-20 text-amber-400 mb-4 animate-pulse" />
              <h3 className="text-3xl font-black text-slate-100 mb-1">Time's Up!</h3>
              <p className="text-sm text-slate-400 mb-4">Final Score:</p>
              <div className="text-5xl font-black text-amber-400 font-mono mb-6">{score} pts</div>
              <button
                onClick={startGame}
                className="px-8 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-2xl shadow-xl flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Play Again
              </button>
            </div>
          )}

          {isPlaying &&
            targets.map((t) => (
              <button
                key={t.id}
                onClick={() => handleHitTarget(t.id)}
                style={{
                  left: `${t.x}%`,
                  top: `${t.y}%`,
                  width: `${t.size}px`,
                  height: `${t.size}px`,
                }}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-400 p-1.5 shadow-2xl shadow-rose-500/50 animate-pulse cursor-pointer hover:scale-110 transition-transform"
              >
                <div className="w-full h-full border-2 border-dashed border-white/80 rounded-full flex items-center justify-center">
                  <Target className="w-5 h-5 text-white" />
                </div>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { X, Sparkles, Heart, Star, Coins, Terminal } from 'lucide-react';
import type { ParticleShape } from '../engine/ParticleEngine';

interface CustomSpriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentShape: ParticleShape;
  setShape: (shape: ParticleShape) => void;
}

export const CustomSpriteModal: React.FC<CustomSpriteModalProps> = ({
  isOpen,
  onClose,
  currentShape,
  setShape,
}) => {
  if (!isOpen) return null;

  const shapes: { id: ParticleShape; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'default', label: 'Sparkles', icon: <Sparkles className="w-5 h-5" />, color: 'text-amber-400' },
    { id: 'stars', label: 'Gold Stars', icon: <Star className="w-5 h-5" />, color: 'text-yellow-400' },
    { id: 'hearts', label: 'Love Hearts', icon: <Heart className="w-5 h-5" />, color: 'text-pink-400' },
    { id: 'coins', label: 'Retro Coins', icon: <Coins className="w-5 h-5" />, color: 'text-amber-300' },
    { id: 'matrix', label: 'Matrix Code', icon: <Terminal className="w-5 h-5" />, color: 'text-emerald-400' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Particle FX & Sprite Customizer</h2>
              <p className="text-xs text-slate-400">Choose custom particle shapes and effects</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 my-6">
          {shapes.map((s) => (
            <button
              key={s.id}
              onClick={() => setShape(s.id)}
              className={`p-4 rounded-2xl border flex items-center gap-3 transition-all ${
                currentShape === s.id
                  ? 'bg-cyan-500/20 border-cyan-500/50 shadow-lg shadow-cyan-500/20 scale-102'
                  : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <div className={s.color}>{s.icon}</div>
              <span className="text-xs font-bold text-slate-200">{s.label}</span>
            </button>
          ))}
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};

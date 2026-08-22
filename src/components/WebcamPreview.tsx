import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RotateCcw, Sliders, Minimize2, Maximize2, Sparkles } from 'lucide-react';
import { WebcamTracker } from '../services/WebcamTracker';

interface WebcamPreviewProps {
  webcamTracker: WebcamTracker;
  isOpen: boolean;
  onClose: () => void;
}

export const WebcamPreview: React.FC<WebcamPreviewProps> = ({ webcamTracker, isOpen, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [sensitivity, setSensitivity] = useState(4.0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [trackingPos, setTrackingPos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    if (!isOpen) return;

    const stream = webcamTracker.getStream();
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }

    const interval = setInterval(() => {
      if (webcamTracker.facePos.rawX && webcamTracker.facePos.rawY) {
        // Map raw 640x480 coordinates to 0..100 percentage inside PIP video box
        const pctX = (webcamTracker.facePos.rawX / 640) * 100;
        const pctY = (webcamTracker.facePos.rawY / 480) * 100;
        setTrackingPos({ x: pctX, y: pctY });
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isOpen, webcamTracker]);

  const handleSensitivityChange = (val: number) => {
    setSensitivity(val);
    webcamTracker.sensitivity = val;
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed bottom-20 right-6 z-40 bg-slate-900/95 border border-emerald-500/40 backdrop-blur-md rounded-3xl shadow-2xl transition-all duration-300 ${
        isMinimized ? 'w-64 h-14' : 'w-72 sm:w-80 h-auto'
      }`}
    >
      {/* Header Bar */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 rounded-t-3xl">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1">
              MediaPipe Iris Gaze AI <Sparkles className="w-3 h-3 text-amber-400" />
            </h4>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-slate-400 hover:text-slate-200"
            title={isMinimized ? 'Expand Preview' : 'Minimize Preview'}
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200" title="Close Preview">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video Stream & Tracking Overlay */}
      {!isMinimized && (
        <div className="p-3 space-y-3">
          <div className="relative w-full h-44 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
            {/* Live Video Feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100 opacity-80"
            />

            {/* Tracking Target Crosshair */}
            <div
              style={{ left: `${trackingPos.x}%`, top: `${trackingPos.y}%` }}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-75"
            >
              <div className="w-8 h-8 rounded-full border-2 border-emerald-400 animate-ping opacity-75" />
              <div className="w-4 h-4 rounded-full bg-emerald-400 border-2 border-white shadow-lg absolute inset-0 m-auto" />
            </div>

            {/* Grid Overlay */}
            <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />
            <div className="absolute bottom-2 left-2 bg-slate-950/80 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/30">
              MediaPipe 468-Landmark Iris AI: Active
            </div>
          </div>

          {/* Controls Bar */}
          <div className="space-y-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-slate-300 font-semibold">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                Gaze Multiplier: {sensitivity}x
              </span>
              <button
                onClick={() => webcamTracker.recalibrate()}
                className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                Recalibrate Iris
              </button>
            </div>
            <input
              type="range"
              min="1.0"
              max="8.0"
              step="0.5"
              value={sensitivity}
              onChange={(e) => handleSensitivityChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
          </div>
        </div>
      )}
    </div>
  );
};

import { useEffect, useRef } from 'react';
import { EyeEngine } from '../engine/EyeEngine';
import type { EyeTheme } from '../engine/EyeEngine';

interface WidgetSettings {
  theme: EyeTheme;
  eyeCount: number;
  radius: number;
}

// Minimal desktop-widget renderer: eyes only. No navbar, no trail, no drag pill,
// no modals. The window itself is click-through, so there is nothing to interact with.
export function WidgetEyes() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef(new EyeEngine());
  const loggedRef = useRef(false);

  // Cursor position in *desktop* coordinates, streamed from the main process.
  const cursorRef = useRef({ x: 0, y: 0 });

  // Where this widget window sits on the desktop, so we can convert the global
  // cursor into coordinates relative to our own tiny canvas.
  const originRef = useRef({ x: 0, y: 0 });

  const settingsRef = useRef<WidgetSettings>({
    theme: 'cute',
    eyeCount: 2,
    radius: 12,
  });

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (!win.require) return;

    const { ipcRenderer } = win.require('electron');

    const onCursor = (_e: unknown, pos: { x: number; y: number }) => {
      cursorRef.current = pos;
    };

    const onOrigin = (_e: unknown, pos: { x: number; y: number }) => {
      originRef.current = pos;
    };

    const onSettings = (_e: unknown, s: Partial<WidgetSettings>) => {
      settingsRef.current = { ...settingsRef.current, ...s };
    };

    ipcRenderer.on('cursor-position', onCursor);
    ipcRenderer.on('widget-origin', onOrigin);
    ipcRenderer.on('widget-settings', onSettings);
    ipcRenderer.send('widget-ready');

    return () => {
      ipcRenderer.removeListener('cursor-position', onCursor);
      ipcRenderer.removeListener('widget-origin', onOrigin);
      ipcRenderer.removeListener('widget-settings', onSettings);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    let lastTime = performance.now();

    let cssW = 0;
    let cssH = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      // Fall back to the window box if layout has not settled yet; a zero-sized
      // canvas draws nothing at all and is the classic "blank widget" cause.
      const w = canvas.clientWidth || window.innerWidth || 84;
      const h = canvas.clientHeight || window.innerHeight || 34;

      if (w === cssW && h === cssH) return;
      cssW = w;
      cssH = h;

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const render = (time: number) => {
      const dt = Math.max(0.001, (time - lastTime) / 1000);
      lastTime = time;

      resize();
      const w = cssW;
      const h = cssH;
      const { theme, eyeCount, radius } = settingsRef.current;

      ctx.clearRect(0, 0, w, h);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).__EYE_DEBUG__) {
        ctx.fillStyle = 'magenta';
        ctx.fillRect(0, 0, w, h);
      }

      // Convert the desktop cursor into this window's local coordinate space so
      // the pupils aim at the real pointer wherever it is on screen.
      const hasCursor = cursorRef.current.x !== 0 || cursorRef.current.y !== 0;
      const targetX = hasCursor ? cursorRef.current.x - originRef.current.x : w / 2;
      const targetY = hasCursor ? cursorRef.current.y - originRef.current.y : h / 2;

      const spacing = radius * 2.6;
      const startX = w / 2 - ((eyeCount - 1) * spacing) / 2;
      const centerY = h / 2;

      const opts = {
        theme,
        x: startX,
        y: centerY,
        radius,
        targetX,
        targetY,
        isIdle: false,
        velocity: 0,
        clickBurstCount: 0,
        isWinking: false,
        isCrying: false,
      };

      if (!loggedRef.current) {
        loggedRef.current = true;
        console.log(
          `[widget] first frame: w=${w} h=${h} theme=${theme} eyes=${eyeCount} ` +
          `r=${radius} startX=${startX} centerY=${centerY} target=${targetX},${targetY} ` +
          `clientBox=${canvas.clientWidth}x${canvas.clientHeight}`
        );
      }

      engineRef.current.update(opts, dt);

      for (let i = 0; i < eyeCount; i++) {
        engineRef.current.draw(ctx, { ...opts, x: startX + i * spacing });
      }

      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);

    console.log(
      `[widget] mounted. innerSize=${window.innerWidth}x${window.innerHeight} ` +
      `canvas=${canvas.width}x${canvas.height} dpr=${window.devicePixelRatio}`
    );

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frameId);
    };
  }, []);

  return <canvas ref={canvasRef} />;
}

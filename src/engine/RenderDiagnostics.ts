// Tracks render-loop frame timing (separate from WebcamTracker's camera-pipeline
// diagnostics, since the two run at independent rates - MediaPipe inference is
// typically much slower than the 60Hz rAF paint loop). Deliberately does not touch
// React state on every frame: pushing a setState from inside a 60fps rAF callback
// would itself cause the performance problem it's trying to measure. The UI polls
// getSnapshot() on its own low-frequency interval instead (see DiagnosticsPanel).
export interface RenderDiagnosticsSnapshot {
  fps: number;
  frameTimeMs: number;
  p95FrameTimeMs: number;
  droppedFrames: number;
}

const HISTORY_SIZE = 120; // 2s of history at 60fps
const EXPECTED_FRAME_MS = 1000 / 60;
// A frame is "dropped" if it took meaningfully longer than one 60fps tick - i.e. the
// loop missed at least one vsync. 1.5x gives headroom for normal jitter (~16.7ms vs
// 17-20ms is fine) while still catching real stalls.
const DROPPED_FRAME_THRESHOLD_MS = EXPECTED_FRAME_MS * 1.5;

export class RenderDiagnostics {
  private frameTimes: number[] = [];
  private droppedFrames = 0;

  public recordFrame(frameTimeMs: number) {
    this.frameTimes.push(frameTimeMs);
    if (this.frameTimes.length > HISTORY_SIZE) this.frameTimes.shift();

    if (frameTimeMs > DROPPED_FRAME_THRESHOLD_MS) {
      this.droppedFrames += Math.round(frameTimeMs / EXPECTED_FRAME_MS) - 1;
    }
  }

  public getSnapshot(): RenderDiagnosticsSnapshot {
    const n = this.frameTimes.length;
    if (n === 0) {
      return { fps: 0, frameTimeMs: 0, p95FrameTimeMs: 0, droppedFrames: this.droppedFrames };
    }

    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / n;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const p95Index = Math.min(n - 1, Math.floor(n * 0.95));

    return {
      fps: avgFrameTime > 0 ? Math.round((1000 / avgFrameTime) * 10) / 10 : 0,
      frameTimeMs: Math.round(avgFrameTime * 10) / 10,
      p95FrameTimeMs: Math.round(sorted[p95Index] * 10) / 10,
      droppedFrames: this.droppedFrames,
    };
  }

  public reset() {
    this.frameTimes = [];
    this.droppedFrames = 0;
  }
}

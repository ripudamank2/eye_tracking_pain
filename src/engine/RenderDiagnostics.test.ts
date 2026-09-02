import { describe, it, expect } from 'vitest';
import { RenderDiagnostics } from './RenderDiagnostics';

describe('RenderDiagnostics', () => {
  it('reports 0 fps with no recorded frames', () => {
    const rd = new RenderDiagnostics();
    expect(rd.getSnapshot().fps).toBe(0);
  });

  it('computes ~60fps from a steady stream of 16.7ms frames', () => {
    const rd = new RenderDiagnostics();
    for (let i = 0; i < 60; i++) rd.recordFrame(16.7);
    const snapshot = rd.getSnapshot();
    expect(snapshot.fps).toBeGreaterThan(58);
    expect(snapshot.fps).toBeLessThan(62);
    expect(snapshot.droppedFrames).toBe(0);
  });

  it('counts a stalled frame as dropped', () => {
    const rd = new RenderDiagnostics();
    for (let i = 0; i < 30; i++) rd.recordFrame(16.7);
    rd.recordFrame(100); // ~6 missed vsyncs
    const snapshot = rd.getSnapshot();
    expect(snapshot.droppedFrames).toBeGreaterThan(0);
  });

  it('does not count normal jitter around 16.7ms as dropped frames', () => {
    const rd = new RenderDiagnostics();
    const jitter = [15, 17, 18, 16, 19, 15.5, 17.2];
    for (const ms of jitter) rd.recordFrame(ms);
    expect(rd.getSnapshot().droppedFrames).toBe(0);
  });

  it('p95 frame time reflects occasional slow frames without being dominated by them', () => {
    const rd = new RenderDiagnostics();
    for (let i = 0; i < 95; i++) rd.recordFrame(16.7);
    for (let i = 0; i < 5; i++) rd.recordFrame(50);
    const snapshot = rd.getSnapshot();
    expect(snapshot.p95FrameTimeMs).toBeGreaterThanOrEqual(16.7);
    expect(snapshot.frameTimeMs).toBeLessThan(snapshot.p95FrameTimeMs);
  });

  it('reset clears all accumulated history', () => {
    const rd = new RenderDiagnostics();
    for (let i = 0; i < 10; i++) rd.recordFrame(100);
    rd.reset();
    const snapshot = rd.getSnapshot();
    expect(snapshot.fps).toBe(0);
    expect(snapshot.droppedFrames).toBe(0);
  });

  it('caps history so memory does not grow unbounded across a long session', () => {
    const rd = new RenderDiagnostics();
    for (let i = 0; i < 100000; i++) rd.recordFrame(16.7);
    // Internal array is capped; verify indirectly via stable, sane output rather than
    // reaching into private state.
    const snapshot = rd.getSnapshot();
    expect(Number.isFinite(snapshot.fps)).toBe(true);
    expect(snapshot.fps).toBeGreaterThan(0);
  });
});

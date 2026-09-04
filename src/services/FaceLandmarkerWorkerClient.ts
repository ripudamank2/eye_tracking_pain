// Main-thread client for the FaceLandmarker Web Worker (see
// src/workers/faceLandmarkerWorker.ts). Owns capturing video frames as ImageBitmaps
// and transferring them into the Worker, and exposes the Worker's landmark results as a
// simple callback - this is the seam that lets WebcamTracker swap from the old
// synchronous, main-thread-blocking `faceMesh.send()` call to fully async, off-thread
// inference without changing anything downstream of "here are this frame's landmarks."
//
// Deliberately keeps rendering paced independently of inference: capturing and posting a
// frame does not block waiting for the Worker's response. The Worker processes frames as
// fast as it can and posts results back whenever ready; if a frame is still being
// processed when the next one would be sent, that next capture is skipped rather than
// queued, so the Worker never accumulates a backlog of stale frames to catch up on.

import type { WorkerInboundMessage, WorkerOutboundMessage, WorkerLandmark } from '../workers/faceLandmarkerWorker';

export interface FaceLandmarkerCallbacks {
  onResult?: (landmarks: WorkerLandmark[][], inferenceTimeMs: number, frameTimestampMs: number) => void;
  onNoFace?: (frameTimestampMs: number, inferenceTimeMs: number) => void;
  onError?: (message: string) => void;
}

export class FaceLandmarkerWorkerClient {
  private worker: Worker | null = null;
  private isReady = false;
  private isBusy = false;
  private callbacks: FaceLandmarkerCallbacks = {};
  // Only used as a fallback if createImageBitmap(video) is unavailable (see postFrame).
  private offscreenCanvas: OffscreenCanvas | null = null;
  private offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;

  public async start(callbacks: FaceLandmarkerCallbacks): Promise<boolean> {
    this.callbacks = callbacks;

    try {
      // Vite's `new URL(..., import.meta.url)` + `{ type: 'module' }` pattern is the
      // standard way to get a properly bundled Worker script reference that works both
      // in dev (served) and in the production build (emitted as its own chunk).
      this.worker = new Worker(new URL('../workers/faceLandmarkerWorker.ts', import.meta.url), { type: 'module' });
    } catch (err) {
      this.callbacks.onError?.(`Failed to construct Worker: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }

    return new Promise((resolve) => {
      if (!this.worker) {
        resolve(false);
        return;
      }

      const timeout = setTimeout(() => {
        this.callbacks.onError?.('FaceLandmarker Worker initialization timed out');
        resolve(false);
      }, 20000);

      this.worker.onmessage = (event: MessageEvent<WorkerOutboundMessage>) => {
        const data = event.data;

        if (data.type === 'ready') {
          clearTimeout(timeout);
          this.isReady = true;
          resolve(true);
          return;
        }

        if (data.type === 'init_error') {
          clearTimeout(timeout);
          this.callbacks.onError?.(data.message);
          resolve(false);
          return;
        }

        if (data.type === 'result') {
          this.isBusy = false;
          this.callbacks.onResult?.(data.landmarks, data.inferenceTimeMs, data.frameTimestampMs);
        } else if (data.type === 'no_face') {
          this.isBusy = false;
          this.callbacks.onNoFace?.(data.frameTimestampMs, data.inferenceTimeMs);
        } else if (data.type === 'frame_error') {
          this.isBusy = false;
          this.callbacks.onError?.(data.message);
        }
      };

      this.worker.onerror = (event) => {
        clearTimeout(timeout);
        this.callbacks.onError?.(`Worker error: ${event.message}`);
        resolve(false);
      };

      const initMsg: WorkerInboundMessage = { type: 'init' };
      this.worker.postMessage(initMsg);
    });
  }

  /**
   * Captures the current frame from a video element and posts it to the Worker for
   * inference. No-ops (does not queue) if the Worker is still processing a previous
   * frame - keeping rendering paced independently of inference means the render loop
   * calling this every frame should never build a backlog if inference is slower than
   * the render rate.
   *
   * Capture path: prefers `createImageBitmap(video)`, which browsers are permitted to
   * (and Chromium does) decode off the main thread - unlike the previous
   * `OffscreenCanvas` + `drawImage(video, ...)` blit, which is a synchronous main-thread
   * video decode/copy. That cost was invisible when measured against a synthetic
   * fake-camera test pattern (cheap, static) but real-camera validation data showed
   * render FPS sagging in lockstep with camera FPS - i.e. still coupled to capture cost
   * despite inference itself already running in the Worker. `createImageBitmap` isn't
   * guaranteed async-off-main-thread by spec in every engine, so the OffscreenCanvas
   * path remains as a fallback for browsers where it throws or is unavailable.
   */
  public postFrame(video: HTMLVideoElement, timestampMs: number) {
    if (!this.worker || !this.isReady || this.isBusy) return;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    this.isBusy = true;

    if (typeof createImageBitmap === 'function') {
      createImageBitmap(video)
        .then((bitmap) => this.sendBitmap(bitmap, timestampMs))
        .catch(() => {
          this.isBusy = false;
          this.postFrameViaCanvasFallback(video, timestampMs);
        });
      return;
    }

    this.postFrameViaCanvasFallback(video, timestampMs);
  }

  // Caller is responsible for setting isBusy = true before calling this (postFrame
  // already does, on both the "no createImageBitmap" path and the catch-fallback path).
  private postFrameViaCanvasFallback(video: HTMLVideoElement, timestampMs: number) {
    if (!this.worker || !this.isReady) {
      this.isBusy = false;
      return;
    }

    if (!this.offscreenCanvas || this.offscreenCanvas.width !== video.videoWidth || this.offscreenCanvas.height !== video.videoHeight) {
      this.offscreenCanvas = new OffscreenCanvas(video.videoWidth, video.videoHeight);
      this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    }
    if (!this.offscreenCtx || !this.offscreenCanvas) {
      this.isBusy = false;
      return;
    }

    this.offscreenCtx.drawImage(video, 0, 0);
    const bitmap = this.offscreenCanvas.transferToImageBitmap();
    this.sendBitmap(bitmap, timestampMs);
  }

  private sendBitmap(bitmap: ImageBitmap, timestampMs: number) {
    if (!this.worker || !this.isReady) {
      bitmap.close();
      this.isBusy = false;
      return;
    }
    const msg: WorkerInboundMessage = { type: 'frame', image: bitmap, timestampMs };
    this.worker.postMessage(msg, [bitmap]);
  }

  public stop() {
    if (this.worker) {
      const msg: WorkerInboundMessage = { type: 'terminate' };
      try {
        this.worker.postMessage(msg);
      } catch {
        /* worker may already be gone */
      }
      this.worker.terminate();
      this.worker = null;
    }
    this.isReady = false;
    this.isBusy = false;
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
  }
}

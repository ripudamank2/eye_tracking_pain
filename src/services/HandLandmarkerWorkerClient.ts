// Main-thread client for the HandLandmarker Web Worker (see
// src/workers/handLandmarkerWorker.ts) - structurally identical to
// FaceLandmarkerWorkerClient.ts (frame capture via createImageBitmap, transferred
// ImageBitmaps, isBusy backpressure so the Worker never accumulates a backlog). See that
// file's doc comments for the full reasoning; not shared/imported because each client
// owns an independent Worker instance and independent isBusy/isReady state.

import type { WorkerInboundMessage, WorkerOutboundMessage, WorkerHandLandmark } from '../workers/handLandmarkerWorker';

export interface HandLandmarkerCallbacks {
  onResult?: (
    landmarks: WorkerHandLandmark[][],
    handedness: { categoryName: string; score: number }[][],
    inferenceTimeMs: number,
    frameTimestampMs: number
  ) => void;
  onNoHand?: (frameTimestampMs: number, inferenceTimeMs: number) => void;
  onError?: (message: string) => void;
}

export class HandLandmarkerWorkerClient {
  private worker: Worker | null = null;
  private isReady = false;
  private isBusy = false;
  private callbacks: HandLandmarkerCallbacks = {};
  private offscreenCanvas: OffscreenCanvas | null = null;
  private offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;

  public async start(callbacks: HandLandmarkerCallbacks): Promise<boolean> {
    this.callbacks = callbacks;

    try {
      this.worker = new Worker(new URL('../workers/handLandmarkerWorker.ts', import.meta.url), { type: 'module' });
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
        this.callbacks.onError?.('HandLandmarker Worker initialization timed out');
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
          this.callbacks.onResult?.(data.landmarks, data.handedness, data.inferenceTimeMs, data.frameTimestampMs);
        } else if (data.type === 'no_hand') {
          this.isBusy = false;
          this.callbacks.onNoHand?.(data.frameTimestampMs, data.inferenceTimeMs);
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
   * Captures the current frame from a shared video element and posts it to the Worker.
   * Deliberately takes the SAME HTMLVideoElement WebcamTracker already owns and drives
   * its own independent capture loop over it (see HandTracker.ts) rather than opening a
   * second getUserMedia stream - createImageBitmap(video) is a stateless snapshot read,
   * safe to call independently and concurrently with WebcamTracker's own capture loop
   * against the same element.
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

// Hardware adapter for Air Touch hand tracking - owns the HandLandmarker Worker client
// and its own independent capture loop, driven by the SAME HTMLVideoElement
// WebcamTracker already owns and plays (see WebcamTracker.getVideoElement()). This
// class does NOT call getUserMedia itself and does NOT touch the eye-tracking pipeline
// in any way - it is a read-only consumer of the shared camera feed, following the same
// structural pattern as WebcamTracker (capture loop -> Worker client -> status/callback)
// without importing or modifying any of WebcamTracker's own code.

import { HandLandmarkerWorkerClient } from './HandLandmarkerWorkerClient';
import type { WorkerHandLandmark } from '../workers/handLandmarkerWorker';
import type { HandFrame, Handedness } from '../engine/handTypes';

export type HandTrackerStatus = 'idle' | 'starting' | 'tracking' | 'no_hand' | 'error';

export interface HandTrackerCallbacks {
  onFrame?: (frame: HandFrame) => void;
  onNoHand?: (timestampMs: number) => void;
  onStatusChange?: (status: HandTrackerStatus, detail?: string) => void;
}

export interface HandTrackerDiagnostics {
  status: HandTrackerStatus;
  fps: number;
  inferenceTimeMs: number;
  handDetected: boolean;
  confidence: number;
  handedness: Handedness;
}

const FRAME_HISTORY_SIZE = 30;

export class HandTracker {
  private workerClient: HandLandmarkerWorkerClient | null = null;
  private captureLoopId: number | null = null;
  private isRunning = false;
  private status: HandTrackerStatus = 'idle';
  private callbacks: HandTrackerCallbacks = {};

  private frameTimestamps: number[] = [];
  private lastInferenceTimeMs = 0;
  private lastConfidence = 0;
  private lastHandedness: Handedness = 'Unknown';
  private lastHandDetected = false;

  /**
   * Starts hand inference against an already-playing video element - the caller
   * (useAirTouch, see AirTouch.tsx wiring) is responsible for getting that element from
   * WebcamTracker.getVideoElement() once eye-tracking webcam access is active; this
   * class never opens its own camera stream.
   */
  public async start(videoElement: HTMLVideoElement, callbacks: HandTrackerCallbacks): Promise<boolean> {
    this.callbacks = callbacks;
    this.setStatus('starting');

    this.workerClient = new HandLandmarkerWorkerClient();
    const ready = await this.workerClient.start({
      onResult: (landmarks, handedness, inferenceTimeMs, frameTimestampMs) => {
        this.lastInferenceTimeMs = inferenceTimeMs;
        this.handleResult(landmarks, handedness, frameTimestampMs);
      },
      onNoHand: (frameTimestampMs, inferenceTimeMs) => {
        this.lastInferenceTimeMs = inferenceTimeMs;
        this.lastHandDetected = false;
        this.recordFrame(frameTimestampMs);
        if (this.status !== 'no_hand') this.setStatus('no_hand');
        this.callbacks.onNoHand?.(frameTimestampMs);
      },
      onError: (message) => {
        console.warn('[HandTracker] HandLandmarker Worker error:', message);
        this.setStatus('error', message);
      },
    });

    if (!ready) {
      this.setStatus('error', 'Hand landmark model failed to initialize.');
      this.stop();
      return false;
    }

    this.isRunning = true;
    this.startCaptureLoop(videoElement);
    return true;
  }

  private startCaptureLoop(videoElement: HTMLVideoElement) {
    const tick = () => {
      if (!this.isRunning || !this.workerClient) return;
      this.workerClient.postFrame(videoElement, performance.now());
      this.captureLoopId = requestAnimationFrame(tick);
    };
    this.captureLoopId = requestAnimationFrame(tick);
  }

  private handleResult(landmarks: WorkerHandLandmark[][], handedness: { categoryName: string; score: number }[][], frameTimestampMs: number) {
    if (landmarks.length === 0) {
      this.lastHandDetected = false;
      this.recordFrame(frameTimestampMs);
      if (this.status !== 'no_hand') this.setStatus('no_hand');
      this.callbacks.onNoHand?.(frameTimestampMs);
      return;
    }

    const firstHand = landmarks[0];
    const firstHandedness = handedness[0]?.[0];
    const category: Handedness =
      firstHandedness?.categoryName === 'Left' ? 'Left' : firstHandedness?.categoryName === 'Right' ? 'Right' : 'Unknown';

    this.lastHandDetected = true;
    this.lastConfidence = firstHandedness?.score ?? 0;
    this.lastHandedness = category;
    this.recordFrame(frameTimestampMs);
    if (this.status !== 'tracking') this.setStatus('tracking');

    const frame: HandFrame = {
      timestampMs: frameTimestampMs,
      landmarks: firstHand.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z })),
      handedness: category,
      confidence: this.lastConfidence,
    };
    this.callbacks.onFrame?.(frame);
  }

  private recordFrame(timestampMs: number) {
    this.frameTimestamps.push(timestampMs);
    if (this.frameTimestamps.length > FRAME_HISTORY_SIZE) this.frameTimestamps.shift();
  }

  private setStatus(status: HandTrackerStatus, detail?: string) {
    if (this.status === status) return;
    this.status = status;
    this.callbacks.onStatusChange?.(status, detail);
  }

  public getStatus(): HandTrackerStatus {
    return this.status;
  }

  public getDiagnostics(): HandTrackerDiagnostics {
    const n = this.frameTimestamps.length;
    let fps = 0;
    if (n >= 2) {
      const spanMs = this.frameTimestamps[n - 1] - this.frameTimestamps[0];
      fps = spanMs > 0 ? ((n - 1) * 1000) / spanMs : 0;
    }
    return {
      status: this.status,
      fps: Math.round(fps * 10) / 10,
      inferenceTimeMs: Math.round(this.lastInferenceTimeMs * 10) / 10,
      handDetected: this.lastHandDetected,
      confidence: Math.round(this.lastConfidence * 100) / 100,
      handedness: this.lastHandedness,
    };
  }

  public stop() {
    this.isRunning = false;
    if (this.captureLoopId !== null) {
      cancelAnimationFrame(this.captureLoopId);
      this.captureLoopId = null;
    }
    if (this.workerClient) {
      this.workerClient.stop();
      this.workerClient = null;
    }
    this.frameTimestamps = [];
    this.lastHandDetected = false;
    this.lastConfidence = 0;
    this.lastHandedness = 'Unknown';
    this.setStatus('idle');
  }
}

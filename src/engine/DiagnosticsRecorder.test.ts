import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiagnosticsRecorder, type DiagnosticsSample } from './DiagnosticsRecorder';

function sample(overrides: Partial<DiagnosticsSample> = {}): Omit<DiagnosticsSample, 't'> {
  return {
    fps: 60,
    frameTimeMs: 16.7,
    p95FrameTimeMs: 16.7,
    droppedFrames: 0,
    cameraFps: 15,
    cameraFrameTimeMs: 66,
    cameraDroppedFrames: 0,
    trackingStatus: 'tracking',
    trackingConfidence: 0.9,
    faceDetectionLossCount: 0,
    gazeJitterPx: 2,
    gazeLatencyMs: 30,
    inferenceTimeMs: 12,
    calibrationErrorPx: 10,
    framesHeldForBlink: 0,
    blinkCount: 0,
    gazeX: 960,
    gazeY: 540,
    jsHeapMb: 25,
    drowsinessLevel: null,
    drowsinessScore: 0,
    drowsinessEyeClosureMs: 0,
    drowsinessRecentBlinkCount: 0,
    drowsinessProlongedBlinkCount: 0,
    drowsinessYawnCount: 0,
    ...overrides,
  };
}

describe('DiagnosticsRecorder', () => {
  let now = 0;

  beforeEach(() => {
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is not recording before start() and pushSample is a no-op', () => {
    const rec = new DiagnosticsRecorder();
    expect(rec.isRecording).toBe(false);
    rec.pushSample(sample());
    expect(rec.stop()).toBeNull();
  });

  it('records samples with monotonically increasing relative timestamps', () => {
    const rec = new DiagnosticsRecorder();
    rec.start();
    now = 100;
    rec.pushSample(sample());
    now = 250;
    rec.pushSample(sample());
    const exported = rec.stop();

    expect(exported!.samples).toHaveLength(2);
    expect(exported!.samples[0].t).toBe(100);
    expect(exported!.samples[1].t).toBe(250);
  });

  it('logs a status_change event when tracking status transitions', () => {
    const rec = new DiagnosticsRecorder();
    rec.start();
    now = 10;
    rec.pushSample(sample({ trackingStatus: 'starting' }));
    now = 20;
    rec.pushSample(sample({ trackingStatus: 'tracking' }));
    now = 30;
    rec.pushSample(sample({ trackingStatus: 'face_lost' }));
    const exported = rec.stop();

    const transitions = exported!.events.filter((e) => e.type === 'status_change').map((e) => e.detail);
    expect(transitions).toEqual(['starting -> tracking', 'tracking -> face_lost']);
  });

  it('computes recovery time as the duration between face_lost and the next tracking status', () => {
    const rec = new DiagnosticsRecorder();
    rec.start();
    now = 0;
    rec.pushSample(sample({ trackingStatus: 'tracking' }));
    now = 1000;
    rec.pushSample(sample({ trackingStatus: 'face_lost' }));
    now = 1750; // 750ms of lost tracking
    rec.pushSample(sample({ trackingStatus: 'tracking' }));
    const exported = rec.stop();

    expect(exported!.summary.recoveryTimesMs).toEqual([750]);
  });

  it('records multiple independent recovery events across a session', () => {
    const rec = new DiagnosticsRecorder();
    rec.start();
    const sequence: [number, string][] = [
      [0, 'tracking'], [500, 'face_lost'], [900, 'tracking'], // 400ms lost
      [2000, 'face_lost'], [2300, 'tracking'], // 300ms lost
    ];
    for (const [t, status] of sequence) {
      now = t;
      rec.pushSample(sample({ trackingStatus: status }));
    }
    const exported = rec.stop();

    expect(exported!.summary.recoveryTimesMs).toEqual([400, 300]);
  });

  it('does not record a recovery time for a face_lost period that never recovers within the session', () => {
    const rec = new DiagnosticsRecorder();
    rec.start();
    now = 0;
    rec.pushSample(sample({ trackingStatus: 'tracking' }));
    now = 500;
    rec.pushSample(sample({ trackingStatus: 'face_lost' }));
    const exported = rec.stop();

    expect(exported!.summary.recoveryTimesMs).toEqual([]);
  });

  it('computes time-in-status as a breakdown that sums to the session duration', () => {
    const rec = new DiagnosticsRecorder();
    rec.start();
    now = 0;
    rec.pushSample(sample({ trackingStatus: 'tracking' }));
    now = 1000;
    rec.pushSample(sample({ trackingStatus: 'tracking' }));
    now = 1200;
    rec.pushSample(sample({ trackingStatus: 'face_lost' }));
    const exported = rec.stop();

    const total = Object.values(exported!.summary.timeInStatusMs).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1200, 5);
    expect(exported!.summary.timeInStatusMs.tracking).toBeCloseTo(1200, 5);
  });

  it('computes summary averages/extremes correctly across a mixed set of samples', () => {
    const rec = new DiagnosticsRecorder();
    rec.start();
    now = 0;
    rec.pushSample(sample({ fps: 60, gazeJitterPx: 1 }));
    now = 100;
    rec.pushSample(sample({ fps: 30, gazeJitterPx: 5 }));
    now = 200;
    rec.pushSample(sample({ fps: 45, gazeJitterPx: 3 }));
    const exported = rec.stop();

    expect(exported!.summary.avgFps).toBeCloseTo(45, 5);
    expect(exported!.summary.minFps).toBe(30);
    expect(exported!.summary.avgGazeJitterPx).toBeCloseTo(3, 5);
    expect(exported!.summary.maxGazeJitterPx).toBe(5);
  });

  it('markPhase records a labeled annotation event usable to segment a guided validation script', () => {
    const rec = new DiagnosticsRecorder();
    rec.start();
    now = 500;
    rec.markPhase('looking left');
    now = 1500;
    rec.markPhase('looking right');
    const exported = rec.stop();

    const annotations = exported!.events.filter((e) => e.type === 'annotation');
    expect(annotations.map((a) => a.detail)).toEqual(['looking left', 'looking right']);
    expect(annotations[0].t).toBe(500);
    expect(annotations[1].t).toBe(1500);
  });

  it('produces valid, parseable JSON export', () => {
    const rec = new DiagnosticsRecorder();
    rec.start();
    now = 100;
    rec.pushSample(sample());
    rec.stop();

    const json = rec.toJSON();
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.samples).toHaveLength(1);
  });

  it('produces CSV export with a header row and one row per sample', () => {
    const rec = new DiagnosticsRecorder();
    rec.start();
    now = 0;
    rec.pushSample(sample());
    now = 100;
    rec.pushSample(sample());
    rec.stop();

    const csv = rec.toCSV();
    const lines = csv.split('\n');
    expect(lines[0]).toContain('fps');
    expect(lines).toHaveLength(3); // header + 2 samples
  });

  it('renders NaN/non-finite numeric fields (e.g. uncalibrated calibrationErrorPx) as blank, not the string "NaN"', () => {
    const rec = new DiagnosticsRecorder();
    rec.start();
    now = 0;
    rec.pushSample(sample({ calibrationErrorPx: NaN }));
    rec.stop();

    const csv = rec.toCSV();
    expect(csv).not.toContain('NaN');
    const [headerRow, dataRow] = csv.split('\n');
    const columnIndex = headerRow.split(',').indexOf('calibrationErrorPx');
    const calibrationErrorCell = dataRow.split(',')[columnIndex];
    expect(calibrationErrorCell).toBe('');
  });

  it('starting a new recording discards the previous session state', () => {
    const rec = new DiagnosticsRecorder();
    rec.start();
    now = 100;
    rec.pushSample(sample());
    rec.stop();

    rec.start();
    const csv = rec.toCSV();
    expect(csv.split('\n')).toHaveLength(1); // header only, no leftover samples
  });

  // Ensures an accidentally days-long recording (e.g. a long real-camera validation
  // session someone forgot to stop) cannot grow the in-memory sample array without
  // bound - a real gap found and fixed during Step 4 long-run testing (a 4-minute
  // automated soak did not hit this, but nothing previously stopped a much longer one
  // from growing indefinitely).
  it('caps sample growth at a fixed ceiling rather than growing without bound', () => {
    const rec = new DiagnosticsRecorder();
    rec.start();

    const CAP = 200_000;
    for (let i = 0; i < CAP + 50; i++) {
      now = i;
      rec.pushSample(sample());
    }

    const exported = rec.stop();
    expect(exported!.samples.length).toBe(CAP);
  });
});

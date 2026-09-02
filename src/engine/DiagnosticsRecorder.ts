// Records a timestamped session of diagnostics snapshots + discrete events (status
// changes, calibration runs, tracking loss/recovery) so a real-camera validation session
// can be evaluated objectively afterward instead of relying on "it looked fine while I
// was watching it." Exports to JSON (full fidelity) and CSV (for spreadsheet analysis).
//
// Deliberately has zero dependency on React/DOM state - it's fed snapshots by whatever
// is already polling RenderDiagnostics/WebcamTracker (see DiagnosticsPanel), so recording
// a session costs one extra push() call per poll tick, not a new polling loop.

export interface DiagnosticsSample {
  /** Milliseconds since recording started. */
  t: number;
  fps: number;
  frameTimeMs: number;
  p95FrameTimeMs: number;
  droppedFrames: number;
  cameraFps: number;
  cameraFrameTimeMs: number;
  cameraDroppedFrames: number;
  trackingStatus: string;
  trackingConfidence: number;
  faceDetectionLossCount: number;
  gazeJitterPx: number;
  gazeLatencyMs: number;
  calibrationErrorPx: number;
  framesHeldForBlink: number;
  jsHeapMb: number | null;
}

export type DiagnosticsEventType =
  | 'session_start'
  | 'session_stop'
  | 'status_change'
  | 'calibration_applied'
  | 'gesture'
  | 'annotation'; // manual marker, e.g. "started looking left" - see markPhase()

export interface DiagnosticsEvent {
  t: number;
  type: DiagnosticsEventType;
  detail: string;
}

export interface DiagnosticsSessionExport {
  startedAt: string; // ISO timestamp
  durationMs: number;
  samples: DiagnosticsSample[];
  events: DiagnosticsEvent[];
  summary: DiagnosticsSummary;
}

export interface DiagnosticsSummary {
  sampleCount: number;
  avgFps: number;
  minFps: number;
  avgFrameTimeMs: number;
  p95FrameTimeMs: number;
  totalDroppedFrames: number;
  avgCameraFps: number;
  avgTrackingConfidence: number;
  minTrackingConfidence: number;
  faceDetectionLossCount: number;
  avgGazeJitterPx: number;
  maxGazeJitterPx: number;
  avgGazeLatencyMs: number;
  maxGazeLatencyMs: number;
  finalCalibrationErrorPx: number | null;
  /** Time-in-status breakdown, ms - answers "how much of the session was actually tracking vs lost/starting". */
  timeInStatusMs: Record<string, number>;
  /** Each face_lost -> tracking transition's duration, ms - the recovery-time metric requested for Step 1. */
  recoveryTimesMs: number[];
}

export class DiagnosticsRecorder {
  private startTime: number | null = null;
  private samples: DiagnosticsSample[] = [];
  private events: DiagnosticsEvent[] = [];
  private lastStatus: string | null = null;

  public get isRecording(): boolean {
    return this.startTime !== null;
  }

  public start() {
    this.startTime = performance.now();
    this.samples = [];
    this.events = [];
    this.lastStatus = null;
    this.hasWarnedSampleLimit = false;
    this.logEvent('session_start', 'Recording started');
  }

  public stop(): DiagnosticsSessionExport | null {
    if (this.startTime === null) return null;
    this.logEvent('session_stop', 'Recording stopped');
    const result = this.buildExport();
    this.startTime = null;
    return result;
  }

  private now(): number {
    return this.startTime !== null ? performance.now() - this.startTime : 0;
  }

  // A validation recording is meant to capture the whole session for later export, so
  // samples are not silently trimmed the way RenderDiagnostics' rolling window is - a
  // long real-camera validation run needs its early phases in the export just as much
  // as its later ones. Instead, a generous ceiling (at the default 250ms poll interval,
  // ~14 hours) stops growth and warns once, rather than letting an accidentally
  // days-long forgotten recording grow without bound.
  private static readonly MAX_SAMPLES = 200_000;
  private hasWarnedSampleLimit = false;

  public pushSample(sample: Omit<DiagnosticsSample, 't'>) {
    if (this.startTime === null) return;
    const t = this.now();

    if (this.lastStatus !== null && this.lastStatus !== sample.trackingStatus) {
      this.logEvent('status_change', `${this.lastStatus} -> ${sample.trackingStatus}`);
    }
    this.lastStatus = sample.trackingStatus;

    if (this.samples.length >= DiagnosticsRecorder.MAX_SAMPLES) {
      if (!this.hasWarnedSampleLimit) {
        console.warn(`[DiagnosticsRecorder] Sample limit (${DiagnosticsRecorder.MAX_SAMPLES}) reached - further samples are dropped. Stop and export the current recording.`);
        this.hasWarnedSampleLimit = true;
      }
      return;
    }

    this.samples.push({ ...sample, t });
  }

  public logEvent(type: DiagnosticsEventType, detail: string) {
    if (this.startTime === null && type !== 'session_start') return;
    this.events.push({ t: this.now(), type, detail });
  }

  /** Manual phase marker for a guided validation script - e.g. "center gaze", "looking left". */
  public markPhase(label: string) {
    this.logEvent('annotation', label);
  }

  private buildExport(): DiagnosticsSessionExport {
    const durationMs = this.samples.length > 0 ? this.samples[this.samples.length - 1].t : 0;
    return {
      startedAt: new Date(Date.now() - durationMs).toISOString(),
      durationMs,
      samples: this.samples,
      events: this.events,
      summary: this.computeSummary(),
    };
  }

  private computeSummary(): DiagnosticsSummary {
    const s = this.samples;
    const n = s.length;

    // Math.max(...xs)/Math.min(...xs) blow the JS engine's argument-count limit on a
    // large array (confirmed: a 200k-element spread throws "Maximum call stack size
    // exceeded") - reduce() has no such limit since it never spreads the array into a
    // single call's arguments.
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const max = (xs: number[]) => (xs.length ? xs.reduce((a, b) => Math.max(a, b)) : 0);
    const min = (xs: number[]) => (xs.length ? xs.reduce((a, b) => Math.min(a, b)) : 0);

    // Each interval [s[i-1].t, s[i].t] was spent in whatever status was true at the
    // START of the interval (s[i-1]'s status), not the status the next sample
    // happens to observe - that status only takes effect starting at s[i].t.
    const timeInStatusMs: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      if (i === 0) continue;
      const dt = s[i].t - s[i - 1].t;
      timeInStatusMs[s[i - 1].trackingStatus] = (timeInStatusMs[s[i - 1].trackingStatus] ?? 0) + dt;
    }
    // The final sample's status persists from its own timestamp until the session end
    // (the last sample IS the session end here, so nothing further to attribute) -
    // but do attribute the time from t=0 to the first sample to that first status,
    // matching a session that started already in that state.
    if (n > 0) {
      timeInStatusMs[s[0].trackingStatus] = (timeInStatusMs[s[0].trackingStatus] ?? 0) + s[0].t;
    }

    // Recovery time: for each face_lost -> tracking transition recorded in events,
    // measure how long the lost period lasted. This directly answers Step 1's
    // "recovery time" measurement requirement.
    const recoveryTimesMs: number[] = [];
    let lostAt: number | null = null;
    for (const e of this.events) {
      if (e.type === 'status_change' && e.detail.endsWith('-> face_lost')) {
        lostAt = e.t;
      } else if (e.type === 'status_change' && e.detail.endsWith('-> tracking') && lostAt !== null) {
        recoveryTimesMs.push(e.t - lostAt);
        lostAt = null;
      }
    }

    const finalCalibrated = [...s].reverse().find((x) => Number.isFinite(x.calibrationErrorPx));

    return {
      sampleCount: n,
      avgFps: avg(s.map((x) => x.fps)),
      minFps: n ? min(s.map((x) => x.fps)) : 0,
      avgFrameTimeMs: avg(s.map((x) => x.frameTimeMs)),
      p95FrameTimeMs: max(s.map((x) => x.p95FrameTimeMs)),
      totalDroppedFrames: n ? s[n - 1].droppedFrames : 0,
      avgCameraFps: avg(s.map((x) => x.cameraFps).filter((v) => v > 0)),
      avgTrackingConfidence: avg(s.map((x) => x.trackingConfidence)),
      minTrackingConfidence: n ? min(s.map((x) => x.trackingConfidence)) : 0,
      faceDetectionLossCount: n ? s[n - 1].faceDetectionLossCount : 0,
      avgGazeJitterPx: avg(s.map((x) => x.gazeJitterPx)),
      maxGazeJitterPx: max(s.map((x) => x.gazeJitterPx)),
      avgGazeLatencyMs: avg(s.map((x) => x.gazeLatencyMs)),
      maxGazeLatencyMs: max(s.map((x) => x.gazeLatencyMs)),
      finalCalibrationErrorPx: finalCalibrated ? finalCalibrated.calibrationErrorPx : null,
      timeInStatusMs,
      recoveryTimesMs,
    };
  }

  public toJSON(): string {
    const data = this.startTime !== null ? this.buildExport() : { samples: this.samples, events: this.events, summary: this.computeSummary() };
    return JSON.stringify(data, null, 2);
  }

  public toCSV(): string {
    const headers: (keyof DiagnosticsSample)[] = [
      't', 'fps', 'frameTimeMs', 'p95FrameTimeMs', 'droppedFrames',
      'cameraFps', 'cameraFrameTimeMs', 'cameraDroppedFrames',
      'trackingStatus', 'trackingConfidence', 'faceDetectionLossCount',
      'gazeJitterPx', 'gazeLatencyMs', 'calibrationErrorPx', 'framesHeldForBlink', 'jsHeapMb',
    ];
    // Normalize NaN/non-finite numeric fields (e.g. calibration error before any
    // calibration has run) to blank rather than the literal "NaN" string, which is
    // not standard CSV and trips up some spreadsheet tools' numeric column parsing.
    const cell = (value: unknown) => {
      if (typeof value === 'number' && !Number.isFinite(value)) return '';
      return value ?? '';
    };
    const rows = this.samples.map((s) => headers.map((h) => cell(s[h])).join(','));
    return [headers.join(','), ...rows].join('\n');
  }
}

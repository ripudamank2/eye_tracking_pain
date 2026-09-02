// Procedural Web Audio API Sound FX Synthesizer

export class AudioSynth {
  private ctx: AudioContext | null = null;
  public enabled = true;

  // Musical Eye Theremin: a sustained oscillator whose pitch/vibrato are driven by gaze position.
  private thereminOsc: OscillatorNode | null = null;
  private thereminGain: GainNode | null = null;
  private thereminVibratoOsc: OscillatorNode | null = null;
  private thereminVibratoGain: GainNode | null = null;

  // Music Reactive Pupil Pulse: analyses whatever audio is currently playing through this context.
  private analyser: AnalyserNode | null = null;
  private analyserData: Uint8Array | null = null;

  private init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playPop() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  public playLaser() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  public playHit() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  public playFanfare() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + idx * 0.08 + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(this.ctx.currentTime + idx * 0.08);
      osc.stop(this.ctx.currentTime + idx * 0.08 + 0.2);
    });
  }

  // --- Musical Eye Theremin ---
  // X-axis (0..1 across screen) controls pitch, Y-axis (0..1) controls vibrato depth.
  public startTheremin() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || this.thereminOsc) return;

    this.thereminOsc = this.ctx.createOscillator();
    this.thereminGain = this.ctx.createGain();
    this.thereminOsc.type = 'sine';
    this.thereminOsc.frequency.value = 440;

    // Vibrato: a slow LFO modulating the main oscillator's frequency.
    this.thereminVibratoOsc = this.ctx.createOscillator();
    this.thereminVibratoGain = this.ctx.createGain();
    this.thereminVibratoOsc.type = 'sine';
    this.thereminVibratoOsc.frequency.value = 5.5;
    this.thereminVibratoGain.gain.value = 0;

    this.thereminVibratoOsc.connect(this.thereminVibratoGain);
    this.thereminVibratoGain.connect(this.thereminOsc.frequency);

    this.thereminGain.gain.value = 0;
    this.thereminOsc.connect(this.thereminGain);
    this.thereminGain.connect(this.ctx.destination);

    this.thereminOsc.start();
    this.thereminVibratoOsc.start();
    this.thereminGain.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 0.15);
  }

  public updateTheremin(normX: number, normY: number) {
    if (!this.ctx || !this.thereminOsc || !this.thereminVibratoGain) return;
    const clampedX = Math.max(0, Math.min(1, normX));
    const clampedY = Math.max(0, Math.min(1, normY));

    // Two octaves, A3 (220Hz) to A5 (880Hz).
    const freq = 220 * Math.pow(4, clampedX);
    this.thereminOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.03);
    this.thereminVibratoGain.gain.setTargetAtTime(clampedY * 18, this.ctx.currentTime, 0.05);
  }

  public stopTheremin() {
    if (!this.ctx || !this.thereminOsc || !this.thereminGain) return;
    const osc = this.thereminOsc;
    const vibOsc = this.thereminVibratoOsc;
    const gain = this.thereminGain;

    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
    osc.stop(this.ctx.currentTime + 0.12);
    vibOsc?.stop(this.ctx.currentTime + 0.12);

    this.thereminOsc = null;
    this.thereminGain = null;
    this.thereminVibratoOsc = null;
    this.thereminVibratoGain = null;
  }

  public get isThereminActive(): boolean {
    return this.thereminOsc !== null;
  }

  // --- Music Reactive Pupil Pulse ---
  // Taps the shared AudioContext's destination-bound nodes to report a 0..1 bass-band pulse level.
  public getMusicPulseLevel(): number {
    if (!this.ctx || !this.analyser || !this.analyserData) return 0;
    this.analyser.getByteFrequencyData(this.analyserData as Uint8Array<ArrayBuffer>);

    // Bass band: roughly the first ~8% of frequency bins.
    const bassBins = Math.max(1, Math.floor(this.analyserData.length * 0.08));
    let sum = 0;
    for (let i = 0; i < bassBins; i++) sum += this.analyserData[i];
    return Math.min(1, sum / bassBins / 255);
  }

  public async enableMusicReactivity(): Promise<boolean> {
    this.init();
    if (!this.ctx) return false;
    if (this.analyser) return true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.ctx.createMediaStreamSource(stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyserData = new Uint8Array(this.analyser.frequencyBinCount);
      source.connect(this.analyser);
      return true;
    } catch {
      return false;
    }
  }
}

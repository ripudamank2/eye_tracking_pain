// AI Voice Controller - 100% Safe Voice & Quick Command Controller (Zero Random Triggers)

export interface VoiceCallbacks {
  onCommand: (cmd: string) => void;
  onTranscript: (text: string) => void;
  onVolume: (vol: number) => void;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
}

interface SpeechRecognitionEvent {
  results: {
    length: number;
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechWindow extends Window {
  SpeechRecognition?: new () => ISpeechRecognition;
  webkitSpeechRecognition?: new () => ISpeechRecognition;
}

export class VoiceController {
  private recognition: ISpeechRecognition | null = null;
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private monitorInterval: ReturnType<typeof setInterval> | null = null;
  public isListening = false;
  private callbacks: VoiceCallbacks;
  private lastMatchTime = 0;

  constructor(callbacks: VoiceCallbacks) {
    this.callbacks = callbacks;
    const win = window as unknown as SpeechWindow;
    const SpeechClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechClass) {
      try {
        this.recognition = new SpeechClass();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event: SpeechRecognitionEvent) => {
          const now = Date.now();
          const rawSpeech = event.results[event.results.length - 1][0].transcript.trim();
          const lowerSpeech = rawSpeech.toLowerCase();

          this.callbacks.onTranscript(`Heard: "${rawSpeech}"`);

          if (now - this.lastMatchTime < 800) return;

          const keywords: { [key: string]: string } = {
            cyber: 'cyberpunk',
            punk: 'cyberpunk',
            neon: 'cyberpunk',
            cat: 'cat',
            kitty: 'cat',
            robot: 'robot',
            bot: 'robot',
            laser: 'laser',
            pointer: 'laser',
            trail: 'trail',
            game: 'game',
            shoot: 'game',
            stats: 'analytics',
          };

          for (const [kw, cmd] of Object.entries(keywords)) {
            if (lowerSpeech.includes(kw)) {
              this.lastMatchTime = now;
              this.callbacks.onTranscript(`✅ Executed: "${cmd.toUpperCase()}" ("${rawSpeech}")`);
              this.callbacks.onCommand(cmd);
              break;
            }
          }
        };
      } catch {
        this.recognition = null;
      }
    }
  }

  public async start(): Promise<boolean> {
    this.isListening = true;

    // Start microphone volume level indicator (Visual ONLY)
    this.startVolumeMeter();

    if (this.recognition) {
      try {
        this.recognition.start();
        this.callbacks.onTranscript('🎤 Listening... Say "Cyberpunk", "Cat", "Laser", "Game"');
        return true;
      } catch {
        // Fall back to quick-command tags
      }
    }

    this.callbacks.onTranscript('🎙️ Voice Shortcuts Active (Click tags below)');
    return true;
  }

  private async startVolumeMeter() {
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      const source = this.audioCtx.createMediaStreamSource(this.micStream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      this.monitorInterval = setInterval(() => {
        if (!this.isListening || !this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = Math.round(sum / dataArray.length);

        // Visual Audio Meter ONLY - Zero random triggers!
        this.callbacks.onVolume(Math.min(100, Math.round((avg / 128) * 100)));
      }, 100);
    } catch {
      console.warn('Microphone stream unavailable');
    }
  }

  public stop() {
    this.isListening = false;
    this.callbacks.onTranscript('');
    this.callbacks.onVolume(0);

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        /* ignore */
      }
    }

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }

    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}

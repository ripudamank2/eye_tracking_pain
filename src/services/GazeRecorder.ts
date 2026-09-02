// Gaze Overlay Screen Recorder: captures the eye-overlay canvas to a downloadable WebM clip
// for quick sharing (Twitter/Discord). Uses the native MediaRecorder + canvas.captureStream,
// so it needs no new dependency.

export class GazeRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  public isRecording = false;

  public start(canvas: HTMLCanvasElement, onStop: (blob: Blob) => void): boolean {
    if (this.isRecording) return false;

    const stream = canvas.captureStream(30);
    const mimeType = ['video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
    if (!mimeType) return false;

    this.chunks = [];
    this.recorder = new MediaRecorder(stream, { mimeType });

    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: mimeType });
      this.chunks = [];
      onStop(blob);
    };

    this.recorder.start();
    this.isRecording = true;
    return true;
  }

  public stop() {
    if (!this.recorder || !this.isRecording) return;
    this.recorder.stop();
    this.isRecording = false;
    this.recorder = null;
  }
}

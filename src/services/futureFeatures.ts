// Integration boundaries for roadmap features that need an external dependency this
// project cannot supply on its own (a vision-capable LLM API, AR/VR hardware, an
// accessibility-tree API, or BCI hardware/SDKs). Each interface below is the seam a real
// implementation would plug into; nothing here fakes the underlying capability.
//
// See PROJECT_STATUS.md for what is blocked on each and why.

// --- AI Gaze Scene Explainer / Reading Assistant (blocked: needs a vision-capable LLM API) ---
export interface SceneExplainerProvider {
  // Given a captured screen region and the gaze dwell point, return a short natural-language
  // summary of what's on screen there. A real implementation calls an external vision API.
  explainRegion(imageDataUrl: string, gazeX: number, gazeY: number): Promise<string>;
}

// --- AI Mood & Facial Expression Sync (blocked: needs a trained sentiment-analysis model) ---
// The heuristic landmark-based smile/gesture detection in WebcamTracker.detectGestures is the
// buildable-now approximation; full mood classification (Happy/Surprised/Confused/Focused/Tired)
// needs a model beyond raw face-mesh geometry.
export type MoodLabel = 'happy' | 'surprised' | 'confused' | 'focused' | 'tired';

export interface MoodClassifierProvider {
  classify(landmarks: { x: number; y: number; z?: number }[]): Promise<MoodLabel | null>;
}

// --- AI Target Snap-to-Button (blocked: needs OS accessibility-tree access) ---
// Snapping the reticle to "the intended button" requires knowing where interactive UI
// elements are on screen across arbitrary desktop apps - that's an OS accessibility API
// (AT-SPI on Linux, UI Automation on Windows, AX API on macOS), not something a browser
// or Electron renderer can query today.
export interface AccessibilityTargetProvider {
  getInteractiveTargetsNear(x: number, y: number, radius: number): Promise<{ x: number; y: number; width: number; height: number }[]>;
}

// --- WebXR 3D Holographic Eyes (blocked: needs AR/VR hardware) ---
export interface XrEyeRenderer {
  isSupported(): Promise<boolean>;
  requestSession(): Promise<unknown>;
}

// --- Brain-Computer Interface Hybrid (blocked: needs BCI hardware + vendor SDK) ---
export interface BciInputProvider {
  connect(): Promise<boolean>;
  onIntent(callback: (intent: { type: string; confidence: number }) => void): void;
  disconnect(): void;
}

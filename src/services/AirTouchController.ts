// Orchestrates cursor movement, clicks, and drag for Air Touch - the ONLY place that
// calls into a SystemInputProvider. Deliberately separate from HandGestureDetector (pure
// gesture recognition) and ScreenMapper/HandSmoother (pure geometry): this class owns
// input *side effects* and, critically, input *safety* - see releaseAllInput() and the
// invariant it enforces below.
//
// Safety invariant this class exists to guarantee: a mouse button must never remain
// held down after Air Touch stops controlling input, for any reason - disabling the
// feature, the hand disappearing mid-drag, a fist (emergency stop), a thrown exception
// anywhere in the per-frame update path, or the app shutting down. Every path that can
// end a drag calls releaseAllInput(); update() is wrapped in try/finally so an exception
// mid-frame cannot skip that cleanup.

import type { AirTouchGestureState, ScreenPoint } from '../engine/handTypes';
import type { SystemInputProvider } from './SystemInputProvider';

export type AirTouchInputStatus = 'disabled' | 'tracking' | 'paused' | 'stopped' | 'no_hand';

export interface AirTouchControllerState {
  status: AirTouchInputStatus;
  cursor: ScreenPoint | null;
  isDragging: boolean;
  lastGesture: AirTouchGestureState['gesture'];
  lastClickAt: number | null;
  lastClickButton: 'left' | 'right' | null;
}

export class AirTouchController {
  private inputProvider: SystemInputProvider;
  private enabled = false;
  private status: AirTouchInputStatus = 'disabled';
  private isDragging = false;
  private lastCursor: ScreenPoint | null = null;
  private lastGesture: AirTouchGestureState['gesture'] = 'none';
  private lastClickAt: number | null = null;
  private lastClickButton: 'left' | 'right' | null = null;
  // 'stopped' (fist / emergency stop) latches until explicitly cleared - matches the
  // spec's "user must explicitly re-enable Air Touch" requirement for a fist, distinct
  // from 'paused' (open palm), which clears itself the moment the palm pose ends.
  private isEmergencyStopped = false;

  constructor(inputProvider: SystemInputProvider) {
    this.inputProvider = inputProvider;
  }

  public setInputProvider(provider: SystemInputProvider) {
    // Never swap providers mid-drag without releasing on the old one first - a stuck
    // button on a provider this controller is about to stop talking to would be
    // invisible to every subsequent releaseAllInput() call.
    if (this.isDragging) this.inputProvider.releaseAll();
    this.isDragging = false;
    this.inputProvider = provider;
  }

  public setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.releaseAllInput();
      this.status = 'disabled';
      this.isEmergencyStopped = false;
    } else {
      this.status = 'no_hand';
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /** Clears a latched emergency stop (fist) - the explicit user action the spec requires before Air Touch will act on gestures again. */
  public clearEmergencyStop() {
    this.isEmergencyStopped = false;
  }

  public getState(): AirTouchControllerState {
    return {
      status: this.status,
      cursor: this.lastCursor,
      isDragging: this.isDragging,
      lastGesture: this.lastGesture,
      lastClickAt: this.lastClickAt,
      lastClickButton: this.lastClickButton,
    };
  }

  /**
   * Feed one frame's gesture state + already-mapped screen cursor position. Safe to
   * call every frame regardless of enabled state (no-ops cleanly when disabled or
   * emergency-stopped) and wrapped so no exception here can skip releasing a held
   * button - see the module doc comment's safety invariant.
   */
  public update(gestureState: AirTouchGestureState, screenCursor: ScreenPoint | null): void {
    try {
      this.updateInner(gestureState, screenCursor);
    } catch (err) {
      // A crash mid-update must not leave a button stuck down - release unconditionally
      // and re-throw so the error is still visible (e.g. to an error boundary/console),
      // rather than silently swallowing it.
      this.releaseAllInput();
      throw err;
    }
  }

  private updateInner(gestureState: AirTouchGestureState, screenCursor: ScreenPoint | null): void {
    this.lastGesture = gestureState.gesture;

    if (!this.enabled) {
      this.status = 'disabled';
      return;
    }

    if (gestureState.gesture === 'fist') {
      this.isEmergencyStopped = true;
    }

    if (this.isEmergencyStopped) {
      this.status = 'stopped';
      if (this.isDragging) this.releaseAllInput();
      return;
    }

    if (gestureState.gesture === 'open_palm') {
      this.status = 'paused';
      if (this.isDragging) this.releaseAllInput();
      return;
    }

    // Drag end takes priority over everything else this frame, checked before the
    // no-hand branch below - always honor a release signal even when the hand has just
    // been lost (HandGestureDetector's notifyHandLost sets dragEnd:true exactly for
    // this case), so a vanishing hand mid-drag can never leave the button held waiting
    // for a "good" frame that will never come.
    if (gestureState.dragEnd && this.isDragging) {
      this.inputProvider.mouseUp('left');
      this.isDragging = false;
    }

    if (gestureState.gesture === 'none') {
      this.status = 'no_hand';
      return;
    }

    this.status = 'tracking';

    if (screenCursor) {
      this.inputProvider.moveCursor(screenCursor.x, screenCursor.y);
      this.lastCursor = screenCursor;
    }

    if (gestureState.clickEvent === 'left') {
      this.inputProvider.click('left');
      this.lastClickAt = gestureState.timestampMs;
      this.lastClickButton = 'left';
    } else if (gestureState.clickEvent === 'right') {
      this.inputProvider.click('right');
      this.lastClickAt = gestureState.timestampMs;
      this.lastClickButton = 'right';
    }

    if (gestureState.dragStart && !this.isDragging) {
      this.inputProvider.mouseDown('left');
      this.isDragging = true;
    }
  }

  /** Unconditionally releases any held input and clears drag state - the single method every safety path funnels through. Safe to call repeatedly / when nothing is held. */
  public releaseAllInput(): void {
    this.inputProvider.releaseAll();
    this.isDragging = false;
  }

  /** Full teardown - call when the feature is being torn down (component unmount, app shutdown) so no button can remain held past the controller's own lifetime. */
  public destroy(): void {
    this.releaseAllInput();
    this.enabled = false;
    this.status = 'disabled';
  }
}

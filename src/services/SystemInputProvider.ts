// Abstraction over "what actually moves the cursor and clicks" for Air Touch, so
// AirTouchController never talks to a specific input mechanism directly. This exists
// because real OS-wide mouse injection is genuinely platform-specific (see the
// per-platform notes below) and this repository currently has NO native input
// capability at all - no robotjs/nut-js/similar dependency, and the existing Electron
// main window is permanently click-through (setIgnoreMouseEvents(true), see
// electron/main.cjs) with only cursor *polling* (reading OS position), never cursor or
// click *injection*. Building a real native injector is out of scope for this pass (see
// PROJECT_STATUS.md's Air Touch section for the full reasoning) - V1 ships
// InAppSystemInputProvider (moves a virtual cursor drawn in this app's own window and
// dispatches synthetic pointer events to elements under it) as the default and only
// working implementation, with this interface ready for a real platform-specific
// backend to be dropped in later without changing AirTouchController at all.
//
// PLATFORM STATUS (V1):
//   Windows  - not implemented. Would need a native Node addon (e.g. a robotjs/nut-js-
//              class dependency) calling SendInput/mouse_event via the Win32 API.
//   macOS    - not implemented. Would additionally need the user to grant Accessibility
//              and/or Input Monitoring permission (System Settings -> Privacy &
//              Security) before any native injection call would even be allowed to run.
//   Linux/X11 - not implemented, but the most tractable of the three: XTest extension
//              (what xdotool itself uses) can synthesize input given a real X11
//              connection. This project's own PROJECT_STATUS.md already documents that
//              even xdotool is unavailable in the current sandbox, so this remains
//              unverified even if implemented.
//   Linux/Wayland - cannot be implemented the same way. Wayland compositors deliberately
//              do not allow arbitrary applications to inject global input for security
//              reasons; only a small set of privileged/portal-mediated mechanisms exist
//              (e.g. the libei/RemoteDesktop XDG portal), which is a materially
//              different, heavier integration than X11/Windows/macOS. Do not claim
//              Wayland system-wide support without that specific integration.

export type SystemInputBackend = 'in_app' | 'native_stub';

export interface SystemInputProvider {
  readonly backend: SystemInputBackend;
  /** Human-readable description of what this backend can actually do, for the settings UI - never claim more than the backend really does. */
  readonly capabilityDescription: string;
  moveCursor(x: number, y: number): void;
  mouseDown(button: 'left' | 'right'): void;
  mouseUp(button: 'left' | 'right'): void;
  click(button: 'left' | 'right'): void;
  /** Must be safe to call at any time, including when nothing is pressed - releases any button this provider believes is currently held. This is the last line of defense against a stuck mouse button (see AirTouchController's cleanup). */
  releaseAll(): void;
}

/**
 * V1's only real implementation: does not touch OS-level input at all. Moves an
 * in-app virtual cursor (owned by the caller - this class just tracks target position
 * for AirTouch.tsx to render) and, on click/mouseDown, dispatches synthetic
 * PointerEvent/MouseEvent sequences to whatever DOM element is currently under that
 * position within THIS application's own window. This lets Air Touch's gestures
 * genuinely click buttons and drag elements inside Eye Tracker Studio's own UI today,
 * without any native dependency or OS permission - and without ever pretending to
 * control the rest of the desktop.
 */
export class InAppSystemInputProvider implements SystemInputProvider {
  public readonly backend: SystemInputBackend = 'in_app';
  public readonly capabilityDescription =
    'Controls a virtual cursor within Eye Tracker Studio only - does not move the real OS cursor or click other applications.';

  private cursorX = 0;
  private cursorY = 0;
  private heldButtons = new Set<'left' | 'right'>();
  private onCursorMove?: (x: number, y: number) => void;

  constructor(onCursorMove?: (x: number, y: number) => void) {
    this.onCursorMove = onCursorMove;
  }

  public moveCursor(x: number, y: number): void {
    this.cursorX = x;
    this.cursorY = y;
    this.onCursorMove?.(x, y);

    if (this.heldButtons.size > 0) {
      this.dispatchToElementUnder(x, y, 'pointermove');
    }
  }

  public mouseDown(button: 'left' | 'right'): void {
    this.heldButtons.add(button);
    this.dispatchToElementUnder(this.cursorX, this.cursorY, 'pointerdown', button);
  }

  public mouseUp(button: 'left' | 'right'): void {
    if (!this.heldButtons.has(button)) return;
    this.heldButtons.delete(button);
    this.dispatchToElementUnder(this.cursorX, this.cursorY, 'pointerup', button);
  }

  public click(button: 'left' | 'right'): void {
    this.dispatchToElementUnder(this.cursorX, this.cursorY, 'pointerdown', button);
    this.dispatchToElementUnder(this.cursorX, this.cursorY, 'pointerup', button);
    if (button === 'left') {
      this.dispatchToElementUnder(this.cursorX, this.cursorY, 'click', button);
    } else {
      this.dispatchToElementUnder(this.cursorX, this.cursorY, 'contextmenu', button);
    }
  }

  public releaseAll(): void {
    for (const button of Array.from(this.heldButtons)) {
      this.mouseUp(button);
    }
    this.heldButtons.clear();
  }

  private dispatchToElementUnder(x: number, y: number, type: string, button?: 'left' | 'right') {
    if (typeof document === 'undefined') return; // safe no-op outside a DOM (e.g. under a non-browser test runner)
    const target = document.elementFromPoint(x, y);
    if (!target) return;

    const buttonCode = button === 'right' ? 2 : 0;

    if (type === 'click' || type === 'contextmenu') {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: buttonCode });
      target.dispatchEvent(event);
      return;
    }

    const event = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: buttonCode,
      pointerType: 'pen', // reads as a real pointer device to :hover/:active-style consumers, distinct from 'mouse' or 'touch' in case UI ever wants to branch on Air Touch input specifically
    });
    target.dispatchEvent(event);
  }
}

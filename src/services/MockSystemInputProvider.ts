// Deterministic, DOM-free SystemInputProvider for unit tests - lets AirTouchController's
// safety/click/drag logic be tested without a browser DOM or a real webcam, per the
// explicit "test without hardware" requirement. Records every call so tests can assert
// on exact call sequences (e.g. "pinch start -> exactly one click", "hand loss during
// drag -> mouseUp called") rather than only on final state.

import type { SystemInputProvider, SystemInputBackend } from './SystemInputProvider';

export type MockInputCall =
  | { type: 'moveCursor'; x: number; y: number }
  | { type: 'mouseDown'; button: 'left' | 'right' }
  | { type: 'mouseUp'; button: 'left' | 'right' }
  | { type: 'click'; button: 'left' | 'right' }
  | { type: 'releaseAll' };

export class MockSystemInputProvider implements SystemInputProvider {
  public readonly backend: SystemInputBackend = 'native_stub';
  public readonly capabilityDescription = 'Test double - records calls, performs no real input.';

  public calls: MockInputCall[] = [];
  public heldButtons = new Set<'left' | 'right'>();
  public cursorX = 0;
  public cursorY = 0;

  public moveCursor(x: number, y: number): void {
    this.cursorX = x;
    this.cursorY = y;
    this.calls.push({ type: 'moveCursor', x, y });
  }

  public mouseDown(button: 'left' | 'right'): void {
    this.heldButtons.add(button);
    this.calls.push({ type: 'mouseDown', button });
  }

  public mouseUp(button: 'left' | 'right'): void {
    this.heldButtons.delete(button);
    this.calls.push({ type: 'mouseUp', button });
  }

  public click(button: 'left' | 'right'): void {
    this.calls.push({ type: 'click', button });
  }

  public releaseAll(): void {
    this.heldButtons.clear();
    this.calls.push({ type: 'releaseAll' });
  }

  public reset() {
    this.calls = [];
    this.heldButtons.clear();
    this.cursorX = 0;
    this.cursorY = 0;
  }

  public clickCount(button: 'left' | 'right'): number {
    return this.calls.filter((c) => c.type === 'click' && c.button === button).length;
  }

  public mouseDownCount(button: 'left' | 'right'): number {
    return this.calls.filter((c) => c.type === 'mouseDown' && c.button === button).length;
  }

  public mouseUpCount(button: 'left' | 'right'): number {
    return this.calls.filter((c) => c.type === 'mouseUp' && c.button === button).length;
  }
}

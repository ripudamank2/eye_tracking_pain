import { describe, it, expect } from 'vitest';
import { AirTouchController } from './AirTouchController';
import { MockSystemInputProvider } from './MockSystemInputProvider';
import type { AirTouchGestureState } from '../engine/handTypes';

function state(overrides: Partial<AirTouchGestureState> = {}): AirTouchGestureState {
  return {
    gesture: 'pointer',
    pointer: { x: 0.5, y: 0.5 },
    clickEvent: null,
    dragStart: false,
    dragEnd: false,
    timestampMs: 0,
    ...overrides,
  };
}

const CURSOR = { x: 500, y: 300 };

describe('AirTouchController - basic enable/disable', () => {
  it('does nothing while disabled', () => {
    const input = new MockSystemInputProvider();
    const c = new AirTouchController(input);
    c.update(state({ gesture: 'pointer' }), CURSOR);
    expect(input.calls.length).toBe(0);
    expect(c.getState().status).toBe('disabled');
  });

  it('moves the cursor once enabled and tracking', () => {
    const input = new MockSystemInputProvider();
    const c = new AirTouchController(input);
    c.setEnabled(true);
    c.update(state({ gesture: 'pointer' }), CURSOR);

    expect(input.calls).toEqual([{ type: 'moveCursor', x: 500, y: 300 }]);
    expect(c.getState().status).toBe('tracking');
  });
});

describe('AirTouchController - clicks', () => {
  it('a pinch_start click event triggers exactly one click call', () => {
    const input = new MockSystemInputProvider();
    const c = new AirTouchController(input);
    c.setEnabled(true);
    c.update(state({ gesture: 'pinch_start', clickEvent: 'left' }), CURSOR);

    expect(input.clickCount('left')).toBe(1);
  });

  it('a right-click event triggers exactly one right click call', () => {
    const input = new MockSystemInputProvider();
    const c = new AirTouchController(input);
    c.setEnabled(true);
    c.update(state({ gesture: 'two_finger', clickEvent: 'right' }), CURSOR);

    expect(input.clickCount('right')).toBe(1);
  });

  it('no click call is made when clickEvent is null', () => {
    const input = new MockSystemInputProvider();
    const c = new AirTouchController(input);
    c.setEnabled(true);
    c.update(state({ gesture: 'pinch_held', clickEvent: null }), CURSOR);

    expect(input.clickCount('left')).toBe(0);
    expect(input.clickCount('right')).toBe(0);
  });
});

describe('AirTouchController - drag', () => {
  it('dragStart triggers exactly one mouseDown', () => {
    const input = new MockSystemInputProvider();
    const c = new AirTouchController(input);
    c.setEnabled(true);
    c.update(state({ gesture: 'pinch_start', clickEvent: 'left' }), CURSOR);
    c.update(state({ gesture: 'drag', dragStart: true }), { x: 600, y: 300 });

    expect(input.mouseDownCount('left')).toBe(1);
    expect(c.getState().isDragging).toBe(true);
  });

  it('continued dragging does not repeat mouseDown', () => {
    const input = new MockSystemInputProvider();
    const c = new AirTouchController(input);
    c.setEnabled(true);
    c.update(state({ gesture: 'pinch_start', clickEvent: 'left' }), CURSOR);
    c.update(state({ gesture: 'drag', dragStart: true }), { x: 600, y: 300 });
    c.update(state({ gesture: 'drag' }), { x: 650, y: 320 });
    c.update(state({ gesture: 'drag' }), { x: 700, y: 340 });

    expect(input.mouseDownCount('left')).toBe(1);
  });

  it('dragEnd triggers exactly one mouseUp and clears dragging state', () => {
    const input = new MockSystemInputProvider();
    const c = new AirTouchController(input);
    c.setEnabled(true);
    c.update(state({ gesture: 'pinch_start', clickEvent: 'left' }), CURSOR);
    c.update(state({ gesture: 'drag', dragStart: true }), { x: 600, y: 300 });
    c.update(state({ gesture: 'pointer', dragEnd: true }), { x: 650, y: 300 });

    expect(input.mouseUpCount('left')).toBe(1);
    expect(c.getState().isDragging).toBe(false);
  });
});

describe('AirTouchController - open palm (pause)', () => {
  it('open palm sets status to paused and stops cursor movement', () => {
    const input = new MockSystemInputProvider();
    const c = new AirTouchController(input);
    c.setEnabled(true);
    c.update(state({ gesture: 'pointer' }), CURSOR);
    input.reset();

    c.update(state({ gesture: 'open_palm' }), CURSOR);
    expect(c.getState().status).toBe('paused');
    expect(input.calls.filter((call) => call.type === 'moveCursor').length).toBe(0);
  });

  it('open palm during a drag releases the mouse button', () => {
    const input = new MockSystemInputProvider();
    const c = new AirTouchController(input);
    c.setEnabled(true);
    c.update(state({ gesture: 'pinch_start', clickEvent: 'left' }), CURSOR);
    c.update(state({ gesture: 'drag', dragStart: true }), { x: 600, y: 300 });
    expect(c.getState().isDragging).toBe(true);

    c.update(state({ gesture: 'open_palm' }), CURSOR);
    expect(input.heldButtons.has('left')).toBe(false);
    expect(c.getState().isDragging).toBe(false);
  });

  it('pause clears once the palm pose ends (does not latch)', () => {
    const input = new MockSystemInputProvider();
    const c = new AirTouchController(input);
    c.setEnabled(true);
    c.update(state({ gesture: 'open_palm' }), CURSOR);
    expect(c.getState().status).toBe('paused');

    c.update(state({ gesture: 'pointer' }), CURSOR);
    expect(c.getState().status).toBe('tracking');
  });
});

describe('AirTouchController - fist (emergency stop)', () => {
  it('fist sets status to stopped', () => {
    const input = new MockSystemInputProvider();
    const c = new AirTouchController(input);
    c.setEnabled(true);
    c.update(state({ gesture: 'fist' }), null);

    expect(c.getState().status).toBe('stopped');
  });

  it('fist during a drag releases the mouse button', () => {
    const input = new MockSystemInputProvider();
    const c = new AirTouchController(input);
    c.setEnabled(true);
    c.update(state({ gesture: 'pinch_start', clickEvent: 'left' }), CURSOR);
    c.update(state({ gesture: 'drag', dragStart: true }), { x: 600, y: 300 });

    c.update(state({ gesture: 'fist' }), null);
    expect(input.heldButtons.has('left')).toBe(false);
    expect(c.getState().isDragging).toBe(false);
  });

  it('emergency stop latches - a pointer gesture right after a fist does NOT resume tracking', () => {
    const input = new MockSystemInputProvider();
    const c = new AirTouchController(input);
    c.setEnabled(true);
    c.update(state({ gesture: 'fist' }), null);
    expect(c.getState().status).toBe('stopped');

    c.update(state({ gesture: 'pointer' }), CURSOR);
    expect(c.getState().status).toBe('stopped'); // still stopped - fist requires explicit re-enable
  });

  it('clearEmergencyStop resumes tracking', () => {
    const input = new MockSystemInputProvider();
    const c = new AirTouchController(input);
    c.setEnabled(true);
    c.update(state({ gesture: 'fist' }), null);
    c.clearEmergencyStop();

    c.update(state({ gesture: 'pointer' }), CURSOR);
    expect(c.getState().status).toBe('tracking');
  });

  it('disabling and re-enabling also clears an emergency stop', () => {
    const input = new MockSystemInputProvider();
    const c = new AirTouchController(input);
    c.setEnabled(true);
    c.update(state({ gesture: 'fist' }), null);

    c.setEnabled(false);
    c.setEnabled(true);
    c.update(state({ gesture: 'pointer' }), CURSOR);
    expect(c.getState().status).toBe('tracking');
  });
});

describe('AirTouchController - safety: mouse button can never remain stuck', () => {
  it('hand disappearing during a drag releases the button', () => {
    const input = new MockSystemInputProvider();
    const c = new AirTouchController(input);
    c.setEnabled(true);
    c.update(state({ gesture: 'pinch_start', clickEvent: 'left' }), CURSOR);
    c.update(state({ gesture: 'drag', dragStart: true }), { x: 600, y: 300 });

    // Hand lost mid-drag - HandGestureDetector.notifyHandLost sets dragEnd:true for
    // exactly this case; simulate that shape here.
    c.update(state({ gesture: 'none', pointer: null, dragEnd: true }), null);

    expect(input.mouseUpCount('left')).toBe(1);
    expect(c.getState().isDragging).toBe(false);
  });

  it('Air Touch disabled mid-drag releases the button', () => {
    const input = new MockSystemInputProvider();
    const c = new AirTouchController(input);
    c.setEnabled(true);
    c.update(state({ gesture: 'pinch_start', clickEvent: 'left' }), CURSOR);
    c.update(state({ gesture: 'drag', dragStart: true }), { x: 600, y: 300 });

    c.setEnabled(false);

    expect(input.heldButtons.has('left')).toBe(false);
    expect(c.getState().isDragging).toBe(false);
  });

  it('destroy() releases any held button', () => {
    const input = new MockSystemInputProvider();
    const c = new AirTouchController(input);
    c.setEnabled(true);
    c.update(state({ gesture: 'pinch_start', clickEvent: 'left' }), CURSOR);
    c.update(state({ gesture: 'drag', dragStart: true }), { x: 600, y: 300 });

    c.destroy();

    expect(input.heldButtons.has('left')).toBe(false);
    expect(c.getState().isDragging).toBe(false);
  });

  it('an exception during update() still releases a held button before rethrowing', () => {
    // A provider whose moveCursor throws, to simulate an unexpected runtime error
    // occurring mid-frame while a drag is active.
    const throwingInput = new MockSystemInputProvider();
    throwingInput.moveCursor = () => {
      throw new Error('simulated failure');
    };

    const c = new AirTouchController(throwingInput);
    c.setEnabled(true);
    // Establish a drag without triggering moveCursor - start it via a pinch+drag with
    // no cursor (null), only triggering the throwing path on the next frame.
    c.update(state({ gesture: 'pinch_start', clickEvent: 'left' }), null);
    c.update(state({ gesture: 'drag', dragStart: true }), null);
    expect(c.getState().isDragging).toBe(true);

    expect(() => c.update(state({ gesture: 'drag' }), CURSOR)).toThrow('simulated failure');
    expect(c.getState().isDragging).toBe(false);
    expect(throwingInput.calls.some((call) => call.type === 'releaseAll')).toBe(true);
  });

  it('setInputProvider mid-drag releases the button on the old provider first', () => {
    const inputA = new MockSystemInputProvider();
    const inputB = new MockSystemInputProvider();
    const c = new AirTouchController(inputA);
    c.setEnabled(true);
    c.update(state({ gesture: 'pinch_start', clickEvent: 'left' }), CURSOR);
    c.update(state({ gesture: 'drag', dragStart: true }), { x: 600, y: 300 });

    c.setInputProvider(inputB);

    expect(inputA.calls.some((call) => call.type === 'releaseAll')).toBe(true);
    expect(c.getState().isDragging).toBe(false);
  });
});

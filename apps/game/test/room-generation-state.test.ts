import { describe, expect, it } from 'vitest';
import { RoomGenerationState } from '../src/state/RoomGenerationState';

describe('RoomGenerationState', () => {
  it('starts idle and transitions through generating to ready', () => {
    const state = new RoomGenerationState();

    expect(state.snapshot).toEqual({ status: 'idle', error: undefined });
    expect(state.begin()).toBe(true);
    expect(state.status).toBe('generating');
    expect(state.begin()).toBe(false);

    state.ready();

    expect(state.snapshot).toEqual({ status: 'ready', error: undefined });
    expect(state.begin()).toBe(true);
  });

  it('captures generation errors and remains recoverable', () => {
    const state = new RoomGenerationState();
    state.begin();

    state.fail(new Error('map failed'));

    expect(state.snapshot).toEqual({ status: 'error', error: 'map failed' });
    expect(state.begin()).toBe(true);
    expect(state.status).toBe('generating');
    expect(state.error).toBeUndefined();
  });

  it('normalizes non-Error failures', () => {
    const state = new RoomGenerationState();
    state.fail('network unavailable');

    expect(state.error).toBe('network unavailable');
    state.reset();
    expect(state.snapshot).toEqual({ status: 'idle', error: undefined });
  });
});

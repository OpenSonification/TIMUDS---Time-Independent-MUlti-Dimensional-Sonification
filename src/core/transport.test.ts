import { describe, expect, it } from 'vitest';
import { timedProgress, transitionTransport } from './transport';
import type { TransportState } from './types';

describe('transport model', () => {
  it('transitions through play, hold, stop, seek and reset', () => {
    let state: TransportState = { status: 'ready', progress: 0 };
    state = transitionTransport(state, { type: 'PLAY' });
    expect(state.status).toBe('playing');
    state = transitionTransport(state, { type: 'SEEK', progress: 0.4 });
    expect(state.progress).toBe(0.4);
    state = transitionTransport(state, { type: 'HOLD' });
    expect(state.status).toBe('holding');
    state = transitionTransport(state, { type: 'STOP' });
    expect(state.status).toBe('stopped');
    expect(transitionTransport(state, { type: 'RESET' })).toEqual({
      status: 'ready',
      progress: 0,
    });
  });

  it('covers ready, playing, holding, stopped and resumed transitions', () => {
    let state: TransportState = { status: 'ready', progress: 0.4 };
    state = transitionTransport(state, { type: 'PLAY' });
    expect(state).toEqual({ status: 'playing', progress: 0.4 });
    state = transitionTransport(state, { type: 'HOLD' });
    expect(state.status).toBe('holding');
    state = transitionTransport(state, { type: 'PLAY' });
    expect(state.status).toBe('playing');
    state = transitionTransport(state, { type: 'STOP' });
    expect(state).toEqual({ status: 'stopped', progress: 0.4 });
    state = transitionTransport(state, { type: 'PLAY' });
    expect(state.status).toBe('playing');
  });

  it('derives progress from elapsed clock time and duration', () => {
    expect(timedProgress(0, 10, 20, 20, false)).toEqual({
      progress: 0.5,
      completed: false,
      elapsed: 10,
    });
    expect(timedProgress(0.75, 10, 20, 20, false)).toEqual({
      progress: 1,
      completed: true,
      elapsed: 10,
    });
  });

  it('wraps looped progress without completion', () => {
    expect(timedProgress(0.8, 0, 6, 10, true)).toEqual({
      progress: 0.3999999999999999,
      completed: false,
      elapsed: 6,
    });
  });
});

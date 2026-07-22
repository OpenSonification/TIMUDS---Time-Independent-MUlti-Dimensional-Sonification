import type { TransportState } from './types';

export type TransportEvent =
  | { type: 'PLAY' }
  | { type: 'HOLD' }
  | { type: 'STOP' }
  | { type: 'RESET' }
  | { type: 'SEEK'; progress: number }
  | { type: 'COMPLETE' }
  | { type: 'UNAVAILABLE' }
  | { type: 'ERROR' };

const clampProgress = (value: number) => Math.min(1, Math.max(0, value));

export function transitionTransport(
  state: TransportState,
  event: TransportEvent,
): TransportState {
  switch (event.type) {
    case 'PLAY':
      return { ...state, status: 'playing' };
    case 'HOLD':
      return { ...state, status: 'holding' };
    case 'STOP':
      return { ...state, status: 'stopped' };
    case 'RESET':
      return {
        status: state.status === 'silent' ? 'silent' : 'stopped',
        progress: 0,
      };
    case 'SEEK':
      return { ...state, progress: clampProgress(event.progress) };
    case 'COMPLETE':
      return { status: 'holding', progress: 1 };
    case 'UNAVAILABLE':
      return { ...state, status: 'unavailable' };
    case 'ERROR':
      return { ...state, status: 'error' };
  }
}

export interface TimedProgress {
  progress: number;
  completed: boolean;
  elapsed: number;
}

export function timedProgress(
  startProgress: number,
  startTime: number,
  currentTime: number,
  duration: number,
  loop: boolean,
): TimedProgress {
  const safeDuration = Math.max(0.001, duration);
  const elapsed = Math.max(0, currentTime - startTime);
  const raw = startProgress + elapsed / safeDuration;
  if (loop) return { progress: raw % 1, completed: false, elapsed };
  return { progress: Math.min(1, raw), completed: raw >= 1, elapsed };
}

import type { ProgressCueInterval } from './types';

const EPSILON = 1e-9;

export function progressCueInterval(value: ProgressCueInterval): number | null {
  if (value === 'off') return null;
  return Number(value) / 100;
}

function thresholds(interval: number): number[] {
  if (!Number.isFinite(interval) || interval <= 0 || interval > 1) return [];
  const count = Math.floor(1 / interval + EPSILON);
  return Array.from({ length: count }, (_, index) =>
    Number(Math.min(1, (index + 1) * interval).toFixed(12)),
  );
}

export interface MilestoneOptions {
  direction: 'forward' | 'backward';
  looped: boolean;
  directSeek?: boolean;
  maximumCues?: number;
}

export function getCrossedMilestones(
  previousProgress: number,
  nextProgress: number,
  interval: number,
  options: MilestoneOptions,
): number[] {
  if (
    options.directSeek ||
    !Number.isFinite(previousProgress) ||
    !Number.isFinite(nextProgress)
  )
    return [];
  const values = thresholds(interval);
  if (values.length === 0) return [];
  const previous = Math.min(1, Math.max(0, previousProgress));
  const next = Math.min(1, Math.max(0, nextProgress));
  let crossed: number[];

  if (options.direction === 'forward') {
    if (options.looped && next + EPSILON < previous) {
      crossed = [
        ...values.filter((value) => value > previous + EPSILON),
        ...values.filter((value) => value <= next + EPSILON),
      ];
    } else {
      crossed = values.filter(
        (value) => value > previous + EPSILON && value <= next + EPSILON,
      );
    }
  } else if (options.looped && next > previous + EPSILON) {
    crossed = [
      ...values
        .filter((value) => value < previous - EPSILON)
        .sort((left, right) => right - left),
      ...values
        .filter((value) => value >= next - EPSILON)
        .sort((left, right) => right - left),
    ];
  } else {
    crossed = values
      .filter((value) => value < previous - EPSILON && value >= next - EPSILON)
      .sort((left, right) => right - left);
  }

  const maximum = Math.max(0, options.maximumCues ?? 1);
  if (maximum === 0) return [];
  if (crossed.length <= maximum) return crossed;
  return crossed.slice(-maximum);
}

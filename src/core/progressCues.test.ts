import { describe, expect, it } from 'vitest';
import { getCrossedMilestones, progressCueInterval } from './progressCues';

describe('progress milestone detection', () => {
  it('converts the supported settings to normalised intervals', () => {
    expect(progressCueInterval('off')).toBeNull();
    expect(progressCueInterval('25')).toBe(0.25);
    expect(progressCueInterval('12.5')).toBe(0.125);
    expect(progressCueInterval('10')).toBe(0.1);
  });

  it.each([
    [0.1, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]],
    [0.125, [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]],
    [0.25, [0.25, 0.5, 0.75, 1]],
  ])(
    'enumerates %s thresholds without floating drift',
    (interval, expected) => {
      expect(
        getCrossedMilestones(0, 1, interval, {
          direction: 'forward',
          looped: false,
          maximumCues: 20,
        }),
      ).toEqual(expected);
    },
  );

  it('detects forward and backward crossings without duplicates', () => {
    expect(
      getCrossedMilestones(0.12, 0.13, 0.125, {
        direction: 'forward',
        looped: false,
      }),
    ).toEqual([0.125]);
    expect(
      getCrossedMilestones(0.13, 0.12, 0.125, {
        direction: 'backward',
        looped: false,
      }),
    ).toEqual([0.125]);
    expect(
      getCrossedMilestones(0.125, 0.13, 0.125, {
        direction: 'forward',
        looped: false,
      }),
    ).toEqual([]);
  });

  it('handles forward and backward loop wraps', () => {
    expect(
      getCrossedMilestones(0.9, 0.15, 0.125, {
        direction: 'forward',
        looped: true,
        maximumCues: 4,
      }),
    ).toEqual([1, 0.125]);
    expect(
      getCrossedMilestones(0.1, 0.8, 0.25, {
        direction: 'backward',
        looped: true,
        maximumCues: 4,
      }),
    ).toEqual([1]);
  });

  it('suppresses direct seeks and limits hidden-tab catch-up storms', () => {
    expect(
      getCrossedMilestones(0.1, 0.9, 0.1, {
        direction: 'forward',
        looped: false,
        directSeek: true,
      }),
    ).toEqual([]);
    expect(
      getCrossedMilestones(0.1, 0.9, 0.1, {
        direction: 'forward',
        looped: false,
      }),
    ).toEqual([0.9]);
  });

  it('includes the final completion milestone', () => {
    expect(
      getCrossedMilestones(0.99, 1, 0.125, {
        direction: 'forward',
        looped: false,
      }),
    ).toEqual([1]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  AUDITION_PATTERNS,
  AUDITION_PATTERN_OPTIONS,
  scaleAuditionPattern,
} from './auditionPatterns';

describe('instrument audition patterns', () => {
  it('provides distinct original note patterns with bounded events', () => {
    expect(AUDITION_PATTERN_OPTIONS).toHaveLength(5);
    expect(
      new Set(AUDITION_PATTERN_OPTIONS.map(({ label }) => label)).size,
    ).toBe(5);
    for (const pattern of AUDITION_PATTERN_OPTIONS) {
      expect(pattern.notes.length).toBeGreaterThan(0);
      for (const note of pattern.notes) {
        expect(note.startSeconds).toBeGreaterThanOrEqual(0);
        expect(note.durationSeconds).toBeGreaterThan(0);
        expect(note.midi).toBeGreaterThanOrEqual(0);
        expect(note.midi).toBeLessThanOrEqual(127);
        expect(note.startSeconds + note.durationSeconds).toBeLessThanOrEqual(
          pattern.sourceDurationSeconds,
        );
      }
    }
    expect(AUDITION_PATTERNS.bebop.notes).toHaveLength(9);
    expect(AUDITION_PATTERNS.clave.notes).toHaveLength(5);
  });

  it('scales a pattern into the selected test length and clamps unsafe values', () => {
    const short = scaleAuditionPattern(AUDITION_PATTERNS.boogie, 2);
    expect(short.durationSeconds).toBe(2);
    expect(short.notes.at(-1)).toEqual({
      startSeconds: 1.75,
      durationSeconds: 0.25,
      midi: 40,
    });
    expect(
      scaleAuditionPattern(AUDITION_PATTERNS.held, -1).durationSeconds,
    ).toBe(0.5);
    expect(
      scaleAuditionPattern(AUDITION_PATTERNS.held, 99).durationSeconds,
    ).toBe(5);
  });
});

import { describe, expect, it } from 'vitest';
import { INSTRUMENT_OPTIONS, INSTRUMENTS } from './instruments';

describe('instrument catalogue', () => {
  it('provides distinct, bounded definitions for every instrument', () => {
    expect(INSTRUMENT_OPTIONS).toHaveLength(10);
    expect(new Set(INSTRUMENT_OPTIONS.map(({ label }) => label)).size).toBe(10);
    expect(INSTRUMENTS.trumpet.label).toMatch(/Trumpet/);
    expect(INSTRUMENTS.drum.articulation).toBe('struck');

    for (const instrument of INSTRUMENT_OPTIONS) {
      expect(instrument.filterFrequency).toBeGreaterThan(0);
      expect(instrument.resonance).toBeGreaterThanOrEqual(0);
      expect(instrument.harmonics?.every((value) => value >= 0)).not.toBe(
        false,
      );
    }
  });
});

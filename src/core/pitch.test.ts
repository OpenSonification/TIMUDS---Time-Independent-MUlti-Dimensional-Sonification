import { describe, expect, it } from 'vitest';
import {
  mapValueToPitch,
  midiToFrequency,
  normaliseValue,
  sharedDomain,
} from './pitch';

describe('pitch mapping', () => {
  it('normalises and clamps signed values', () => {
    const domain = { minimum: -1, maximum: 1 };
    expect(normaliseValue(-1, domain)).toBe(0);
    expect(normaliseValue(0, domain)).toBe(0.5);
    expect(normaliseValue(2, domain)).toBe(1);
  });

  it('maps constant axes to the midpoint', () => {
    const pitch = mapValueToPitch(4, { minimum: 4, maximum: 4 }, 48, 72);
    expect(pitch.normalised).toBe(0.5);
    expect(pitch.midi).toBe(60);
    expect(pitch.noteName).toBe('C4');
    expect(pitch.constantDomain).toBe(true);
  });

  it('supports inverted continuous mapping', () => {
    expect(
      mapValueToPitch(-1, { minimum: -1, maximum: 1 }, 48, 72, true).midi,
    ).toBe(72);
    expect(mapValueToPitch(0.5, { minimum: 0, maximum: 1 }, 48, 72).midi).toBe(
      60,
    );
  });

  it('quantises a value to a bounded MIDI note map', () => {
    const notes = [48, 52, 55, 60, 64, 67, 72];
    expect(
      mapValueToPitch(-1, { minimum: -1, maximum: 1 }, 24, 96, false, notes)
        .midi,
    ).toBe(48);
    expect(
      mapValueToPitch(0, { minimum: -1, maximum: 1 }, 24, 96, false, notes)
        .midi,
    ).toBe(60);
    expect(
      mapValueToPitch(1, { minimum: -1, maximum: 1 }, 24, 96, true, notes).midi,
    ).toBe(48);
  });

  it('uses the middle imported note for a constant axis', () => {
    expect(
      mapValueToPitch(
        4,
        { minimum: 4, maximum: 4 },
        24,
        96,
        false,
        [48, 60, 72],
      ).midi,
    ).toBe(60);
  });

  it('converts MIDI notes to frequency', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 8);
    expect(midiToFrequency(60)).toBeCloseTo(261.6256, 3);
  });

  it('combines independent domains', () => {
    expect(
      sharedDomain({ minimum: -3, maximum: 2 }, { minimum: -1, maximum: 8 }),
    ).toEqual({
      minimum: -3,
      maximum: 8,
    });
  });
});

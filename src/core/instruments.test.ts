import { describe, expect, it } from 'vitest';
import {
  INSTRUMENT_OPTIONS,
  INSTRUMENTS,
  instrumentFilterFrequency,
} from './instruments';

describe('instrument catalogue', () => {
  it('provides distinct, bounded definitions for every instrument', () => {
    expect(INSTRUMENT_OPTIONS).toHaveLength(10);
    expect(new Set(INSTRUMENT_OPTIONS.map(({ label }) => label)).size).toBe(10);
    expect(INSTRUMENTS.trumpet.label).toMatch(/Trumpet/);
    expect(INSTRUMENTS.drum.articulation).toBe('struck');

    for (const instrument of INSTRUMENT_OPTIONS) {
      expect(instrument.filterBaseFrequency).toBeGreaterThan(0);
      expect(instrument.filterTracking).toBeGreaterThanOrEqual(0);
      expect(instrument.resonance).toBeGreaterThanOrEqual(0);
      expect(instrument.gainCompensation).toBeGreaterThanOrEqual(0.5);
      expect(instrument.gainCompensation).toBeLessThanOrEqual(1.1);
      expect(instrument.attackSeconds).toBeGreaterThan(0);
      expect(instrument.vibratoRate).toBeGreaterThanOrEqual(0);
      expect(instrument.vibratoDepthCents).toBeGreaterThanOrEqual(0);
      expect(
        instrument.harmonics?.every(
          (value) => Number.isFinite(value) && Math.abs(value) <= 1,
        ),
      ).not.toBe(false);
      if (instrument.secondaryVoice) {
        expect(instrument.secondaryVoice.frequencyRatio).toBeGreaterThan(0);
        expect(instrument.secondaryVoice.gain).toBeGreaterThan(0);
        expect(instrument.secondaryVoice.gain).toBeLessThanOrEqual(0.6);
      }
      if (instrument.noiseTexture) {
        expect(instrument.noiseTexture.filterFrequency).toBeGreaterThan(0);
        expect(instrument.noiseTexture.gain).toBeGreaterThan(0);
        expect(instrument.noiseTexture.gain).toBeLessThanOrEqual(0.2);
      }
      if (instrument.frequencyModulation) {
        expect(instrument.frequencyModulation.frequencyRatio).toBeGreaterThan(
          0,
        );
        expect(instrument.frequencyModulation.depthCents).toBeGreaterThan(0);
        expect(instrument.frequencyModulation.depthCents).toBeLessThanOrEqual(
          300,
        );
      }
    }

    const profiles = INSTRUMENT_OPTIONS.map((instrument) =>
      JSON.stringify({
        harmonics: instrument.harmonics,
        filterType: instrument.filterType,
        filterBaseFrequency: instrument.filterBaseFrequency,
        filterTracking: instrument.filterTracking,
        resonance: instrument.resonance,
        articulation: instrument.articulation,
        attackSeconds: instrument.attackSeconds,
        decaySeconds: instrument.decaySeconds,
        vibratoRate: instrument.vibratoRate,
        vibratoDepthCents: instrument.vibratoDepthCents,
        pitchDropCents: instrument.pitchDropCents,
        secondaryVoice: instrument.secondaryVoice,
        noiseTexture: instrument.noiseTexture,
        frequencyModulation: instrument.frequencyModulation,
      }),
    );
    expect(new Set(profiles).size).toBe(INSTRUMENT_OPTIONS.length);
  });

  it('separates the characteristic sound families', () => {
    expect(INSTRUMENTS.pure.harmonics).toBeNull();
    expect(INSTRUMENTS.reed.harmonics?.[2]).toBe(0);
    expect(INSTRUMENTS.bright.filterType).toBe('highpass');
    expect(INSTRUMENTS.flute.vibratoDepthCents).toBeGreaterThan(0);
    expect(INSTRUMENTS.strings.attackSeconds).toBeGreaterThan(
      INSTRUMENTS.trumpet.attackSeconds,
    );
    expect(INSTRUMENTS.mallet.decaySeconds).toBeGreaterThan(
      INSTRUMENTS.drum.decaySeconds,
    );
    expect(INSTRUMENTS.drum.pitchDropCents).toBeGreaterThan(0);
    expect(INSTRUMENTS.warm.secondaryVoice?.frequencyRatio).toBe(0.5);
    expect(INSTRUMENTS.strings.secondaryVoice?.detuneCents).toBeGreaterThan(0);
    expect(INSTRUMENTS.flute.noiseTexture?.filterType).toBe('highpass');
    expect(INSTRUMENTS.mallet.frequencyModulation?.frequencyRatio).not.toBe(
      Math.round(INSTRUMENTS.mallet.frequencyModulation?.frequencyRatio ?? 0),
    );
  });

  it('tracks filter frequency with pitch and keeps it in an audible range', () => {
    expect(instrumentFilterFrequency(INSTRUMENTS.reed, 440)).toBeGreaterThan(
      instrumentFilterFrequency(INSTRUMENTS.reed, 220),
    );
    expect(instrumentFilterFrequency(INSTRUMENTS.pure, -20)).toBe(9000);
    expect(instrumentFilterFrequency(INSTRUMENTS.trumpet, 100_000)).toBe(
      12_000,
    );
  });
});

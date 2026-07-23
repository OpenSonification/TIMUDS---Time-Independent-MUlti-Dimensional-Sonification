import type { TimbreName } from './types';

export interface SecondaryVoiceDefinition {
  waveform: 'sine' | 'same';
  frequencyRatio: number;
  detuneCents: number;
  gain: number;
}

export interface NoiseTextureDefinition {
  filterType: 'lowpass' | 'bandpass' | 'highpass';
  filterFrequency: number;
  resonance: number;
  gain: number;
}

export interface FrequencyModulationDefinition {
  frequencyRatio: number;
  depthCents: number;
}

export interface InstrumentDefinition {
  value: TimbreName;
  label: string;
  description: string;
  harmonics: readonly number[] | null;
  filterType: 'lowpass' | 'bandpass' | 'highpass';
  filterBaseFrequency: number;
  filterTracking: number;
  resonance: number;
  gainCompensation: number;
  articulation: 'sustained' | 'struck';
  attackSeconds: number;
  decaySeconds: number;
  vibratoRate: number;
  vibratoDepthCents: number;
  pitchDropCents: number;
  pitchDropSeconds: number;
  secondaryVoice: SecondaryVoiceDefinition | null;
  noiseTexture: NoiseTextureDefinition | null;
  frequencyModulation: FrequencyModulationDefinition | null;
}

export const INSTRUMENTS: Record<TimbreName, InstrumentDefinition> = {
  pure: {
    value: 'pure',
    label: 'Pure sine tone',
    description:
      'A plain sine wave with very few overtones. Useful as a neutral reference.',
    harmonics: null,
    filterType: 'lowpass',
    filterBaseFrequency: 9000,
    filterTracking: 0,
    resonance: 0.1,
    gainCompensation: 1,
    articulation: 'sustained',
    attackSeconds: 0.006,
    decaySeconds: 0,
    vibratoRate: 0,
    vibratoDepthCents: 0,
    pitchDropCents: 0,
    pitchDropSeconds: 0,
    secondaryVoice: null,
    noiseTexture: null,
    frequencyModulation: null,
  },
  warm: {
    value: 'warm',
    label: 'Warm organ',
    description: 'Round organ drawbars, a soft edge and a steady held note.',
    harmonics: [0, 1, 0.8, 0.15, 0.62, 0.1, 0.42, 0.08, 0.26],
    filterType: 'lowpass',
    filterBaseFrequency: 550,
    filterTracking: 2.4,
    resonance: 0.7,
    gainCompensation: 0.86,
    articulation: 'sustained',
    attackSeconds: 0.032,
    decaySeconds: 0,
    vibratoRate: 4.8,
    vibratoDepthCents: 2,
    pitchDropCents: 0,
    pitchDropSeconds: 0,
    secondaryVoice: {
      waveform: 'sine',
      frequencyRatio: 0.5,
      detuneCents: 0,
      gain: 0.42,
    },
    noiseTexture: null,
    frequencyModulation: null,
  },
  reed: {
    value: 'reed',
    label: 'Clarinet-like reed',
    description: 'A narrow, woody reed sound with strong odd harmonics.',
    harmonics: [0, 1, 0, 0.92, 0, 0.62, 0, 0.4, 0, 0.25],
    filterType: 'bandpass',
    filterBaseFrequency: 500,
    filterTracking: 1.4,
    resonance: 4.2,
    gainCompensation: 1.05,
    articulation: 'sustained',
    attackSeconds: 0.018,
    decaySeconds: 0,
    vibratoRate: 5.1,
    vibratoDepthCents: 10,
    pitchDropCents: 0,
    pitchDropSeconds: 0,
    secondaryVoice: null,
    noiseTexture: null,
    frequencyModulation: null,
  },
  bright: {
    value: 'bright',
    label: 'Bright synthesiser',
    description: 'A sharp electronic buzz with plenty of high harmonics.',
    harmonics: [0, 1, 0.9, 0.72, 0.58, 0.48, 0.4, 0.34, 0.29, 0.25, 0.22, 0.19],
    filterType: 'highpass',
    filterBaseFrequency: 250,
    filterTracking: 0.15,
    resonance: 0.8,
    gainCompensation: 0.72,
    articulation: 'sustained',
    attackSeconds: 0.004,
    decaySeconds: 0,
    vibratoRate: 0,
    vibratoDepthCents: 0,
    pitchDropCents: 0,
    pitchDropSeconds: 0,
    secondaryVoice: {
      waveform: 'same',
      frequencyRatio: 2,
      detuneCents: 0,
      gain: 0.22,
    },
    noiseTexture: null,
    frequencyModulation: null,
  },
  hollow: {
    value: 'hollow',
    label: 'Hollow',
    description: 'A dark, empty-sounding tone with a soft, triangular edge.',
    harmonics: [0, 1, 0, -0.6, 0, 0.32, 0, -0.18, 0, 0.1],
    filterType: 'lowpass',
    filterBaseFrequency: 450,
    filterTracking: 1.5,
    resonance: 1.2,
    gainCompensation: 1,
    articulation: 'sustained',
    attackSeconds: 0.045,
    decaySeconds: 0,
    vibratoRate: 3.5,
    vibratoDepthCents: 4,
    pitchDropCents: 0,
    pitchDropSeconds: 0,
    secondaryVoice: {
      waveform: 'sine',
      frequencyRatio: 0.5,
      detuneCents: 0,
      gain: 0.48,
    },
    noiseTexture: null,
    frequencyModulation: null,
  },
  flute: {
    value: 'flute',
    label: 'Flute-like',
    description:
      'A breathy-soft fundamental with a slow onset and light vibrato.',
    harmonics: [0, 1, 0.035, 0.018, 0.006, 0.003],
    filterType: 'lowpass',
    filterBaseFrequency: 1500,
    filterTracking: 4.5,
    resonance: 0.35,
    gainCompensation: 1,
    articulation: 'sustained',
    attackSeconds: 0.075,
    decaySeconds: 0,
    vibratoRate: 5.4,
    vibratoDepthCents: 16,
    pitchDropCents: 0,
    pitchDropSeconds: 0,
    secondaryVoice: null,
    noiseTexture: {
      filterType: 'highpass',
      filterFrequency: 2500,
      resonance: 0.35,
      gain: 0.045,
    },
    frequencyModulation: null,
  },
  trumpet: {
    value: 'trumpet',
    label: 'Trumpet-like brass',
    description: 'A bold brass buzz with a focused mid-range and quick attack.',
    harmonics: [0, 1, 0.95, 0.82, 0.7, 0.58, 0.48, 0.4, 0.32, 0.25, 0.18],
    filterType: 'bandpass',
    filterBaseFrequency: 700,
    filterTracking: 3.8,
    resonance: 1.7,
    gainCompensation: 0.76,
    articulation: 'sustained',
    attackSeconds: 0.012,
    decaySeconds: 0,
    vibratoRate: 5.8,
    vibratoDepthCents: 18,
    pitchDropCents: 0,
    pitchDropSeconds: 0,
    secondaryVoice: {
      waveform: 'same',
      frequencyRatio: 0.5,
      detuneCents: 0,
      gain: 0.12,
    },
    noiseTexture: {
      filterType: 'bandpass',
      filterFrequency: 1800,
      resonance: 0.8,
      gain: 0.018,
    },
    frequencyModulation: null,
  },
  strings: {
    value: 'strings',
    label: 'Bowed-string-like',
    description: 'A grainy bowed tone with a slower swell and wider vibrato.',
    harmonics: [0, 1, 0.65, 0.5, 0.4, 0.33, 0.28, 0.24, 0.2, 0.17, 0.14],
    filterType: 'lowpass',
    filterBaseFrequency: 700,
    filterTracking: 3.5,
    resonance: 0.9,
    gainCompensation: 0.8,
    articulation: 'sustained',
    attackSeconds: 0.11,
    decaySeconds: 0,
    vibratoRate: 5,
    vibratoDepthCents: 24,
    pitchDropCents: 0,
    pitchDropSeconds: 0,
    secondaryVoice: {
      waveform: 'same',
      frequencyRatio: 1,
      detuneCents: 13,
      gain: 0.55,
    },
    noiseTexture: {
      filterType: 'bandpass',
      filterFrequency: 1400,
      resonance: 0.7,
      gain: 0.025,
    },
    frequencyModulation: null,
  },
  mallet: {
    value: 'mallet',
    label: 'Mallet-like',
    description: 'A hard, bell-like strike with an uneven metallic spectrum.',
    harmonics: [0, 1, 0, 0.62, 0, 0.08, 0.4, 0, 0.2, 0, 0.12],
    filterType: 'bandpass',
    filterBaseFrequency: 1000,
    filterTracking: 6,
    resonance: 4.8,
    gainCompensation: 0.9,
    articulation: 'struck',
    attackSeconds: 0.002,
    decaySeconds: 0.42,
    vibratoRate: 0,
    vibratoDepthCents: 0,
    pitchDropCents: 0,
    pitchDropSeconds: 0,
    secondaryVoice: {
      waveform: 'sine',
      frequencyRatio: 2.71,
      detuneCents: 0,
      gain: 0.5,
    },
    noiseTexture: null,
    frequencyModulation: {
      frequencyRatio: 3.73,
      depthCents: 240,
    },
  },
  drum: {
    value: 'drum',
    label: 'Pitched drum',
    description: 'A short tom-like thump with a fast downward pitch bend.',
    harmonics: [0, 1, 0.7, 0.22, 0.08, 0.03],
    filterType: 'bandpass',
    filterBaseFrequency: 160,
    filterTracking: 1.7,
    resonance: 6.5,
    gainCompensation: 1.05,
    articulation: 'struck',
    attackSeconds: 0.002,
    decaySeconds: 0.12,
    vibratoRate: 0,
    vibratoDepthCents: 0,
    pitchDropCents: 750,
    pitchDropSeconds: 0.08,
    secondaryVoice: {
      waveform: 'sine',
      frequencyRatio: 0.5,
      detuneCents: 0,
      gain: 0.55,
    },
    noiseTexture: {
      filterType: 'bandpass',
      filterFrequency: 900,
      resonance: 1.2,
      gain: 0.16,
    },
    frequencyModulation: null,
  },
};

export const INSTRUMENT_OPTIONS = Object.values(INSTRUMENTS);

export function instrumentFilterFrequency(
  definition: InstrumentDefinition,
  fundamental: number,
): number {
  const trackedFrequency =
    definition.filterBaseFrequency +
    Math.max(0, fundamental) * definition.filterTracking;
  return Math.min(12_000, Math.max(80, trackedFrequency));
}

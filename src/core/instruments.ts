import type { TimbreName } from './types';

export interface InstrumentDefinition {
  value: TimbreName;
  label: string;
  description: string;
  harmonics: readonly number[] | null;
  filterType: 'lowpass' | 'bandpass';
  filterFrequency: number;
  resonance: number;
  articulation: 'sustained' | 'struck';
  decaySeconds: number;
}

export const INSTRUMENTS: Record<TimbreName, InstrumentDefinition> = {
  pure: {
    value: 'pure',
    label: 'Pure sine tone',
    description:
      'A plain sine wave with very few overtones. Useful as a neutral reference.',
    harmonics: null,
    filterType: 'lowpass',
    filterFrequency: 8000,
    resonance: 0.3,
    articulation: 'sustained',
    decaySeconds: 0,
  },
  warm: {
    value: 'warm',
    label: 'Warm organ',
    description:
      'A rounded, sustained organ-like voice with a compact harmonic series.',
    harmonics: [0, 1, 0.46, 0.24, 0.1, 0.06],
    filterType: 'lowpass',
    filterFrequency: 1500,
    resonance: 0.5,
    articulation: 'sustained',
    decaySeconds: 0,
  },
  reed: {
    value: 'reed',
    label: 'Clarinet-like reed',
    description:
      'A sustained reed-like voice with stronger odd harmonics and light resonance.',
    harmonics: [0, 1, 0.12, 0.68, 0.08, 0.34, 0.04, 0.18],
    filterType: 'bandpass',
    filterFrequency: 2600,
    resonance: 1.8,
    articulation: 'sustained',
    decaySeconds: 0,
  },
  bright: {
    value: 'bright',
    label: 'Bright synthesiser',
    description: 'A clear synthetic voice with alternating upper harmonics.',
    harmonics: [0, 1, 0.22, 0.42, 0.16, 0.28, 0.1, 0.18],
    filterType: 'lowpass',
    filterFrequency: 4200,
    resonance: 0.7,
    articulation: 'sustained',
    decaySeconds: 0,
  },
  hollow: {
    value: 'hollow',
    label: 'Hollow',
    description:
      'A rounded sustained voice with sparse upper harmonics for the negative-Y cue.',
    harmonics: [0, 1, 0.05, 0.42, 0.03, 0.18, 0.02, 0.08],
    filterType: 'bandpass',
    filterFrequency: 1800,
    resonance: 1.4,
    articulation: 'sustained',
    decaySeconds: 0,
  },
  flute: {
    value: 'flute',
    label: 'Flute-like',
    description:
      'A soft, sustained voice dominated by the fundamental with faint overtones.',
    harmonics: [0, 1, 0.08, 0.035, 0.015, 0.008],
    filterType: 'lowpass',
    filterFrequency: 5200,
    resonance: 0.35,
    articulation: 'sustained',
    decaySeconds: 0,
  },
  trumpet: {
    value: 'trumpet',
    label: 'Trumpet-like brass',
    description:
      'A bright, sustained brass-like voice with a dense harmonic series.',
    harmonics: [0, 1, 0.86, 0.64, 0.48, 0.35, 0.24, 0.16, 0.1],
    filterType: 'bandpass',
    filterFrequency: 3300,
    resonance: 1.1,
    articulation: 'sustained',
    decaySeconds: 0,
  },
  strings: {
    value: 'strings',
    label: 'Bowed-string-like',
    description:
      'A sustained synthetic string voice with gradually decreasing harmonics.',
    harmonics: [0, 1, 0.58, 0.36, 0.24, 0.17, 0.12, 0.08, 0.05],
    filterType: 'lowpass',
    filterFrequency: 2900,
    resonance: 0.65,
    articulation: 'sustained',
    decaySeconds: 0,
  },
  mallet: {
    value: 'mallet',
    label: 'Mallet-like',
    description:
      'A struck synthetic voice that decays after pitch changes, similar to a tuned mallet.',
    harmonics: [0, 1, 0, 0.34, 0, 0.14, 0, 0.06],
    filterType: 'lowpass',
    filterFrequency: 4600,
    resonance: 0.8,
    articulation: 'struck',
    decaySeconds: 0.22,
  },
  drum: {
    value: 'drum',
    label: 'Pitched drum',
    description:
      'A short, resonant tom-like synthetic pulse. It remains pitched so coordinates stay inspectable.',
    harmonics: [0, 1, 0.5, 0.2, 0.09, 0.04],
    filterType: 'bandpass',
    filterFrequency: 1200,
    resonance: 3.2,
    articulation: 'struck',
    decaySeconds: 0.16,
  },
};

export const INSTRUMENT_OPTIONS = Object.values(INSTRUMENTS);

import type { AxisConfig, NumericDomain } from './types';

export interface PitchResult {
  normalised: number;
  midi: number;
  frequency: number;
  noteName: string;
  constantDomain: boolean;
}

const NOTE_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
];

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normaliseValue(value: number, domain: NumericDomain): number {
  if (domain.minimum === domain.maximum) return 0.5;
  return clamp(
    (value - domain.minimum) / (domain.maximum - domain.minimum),
    0,
    1,
  );
}

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function midiToNoteName(midi: number): string {
  const rounded = Math.round(midi);
  const noteIndex = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export function mapValueToPitch(
  value: number,
  domain: NumericDomain,
  lowMidi: number,
  highMidi: number,
  inverted = false,
): PitchResult {
  const base = normaliseValue(value, domain);
  const normalised = inverted ? 1 - base : base;
  const midi = lowMidi + normalised * (highMidi - lowMidi);
  return {
    normalised,
    midi,
    frequency: midiToFrequency(midi),
    noteName: midiToNoteName(midi),
    constantDomain: domain.minimum === domain.maximum,
  };
}

export function effectiveDomain(
  config: AxisConfig,
  automatic: NumericDomain,
): NumericDomain {
  return config.automaticDomain ? automatic : config.manualDomain;
}

export function sharedDomain(
  x: NumericDomain,
  y: NumericDomain,
): NumericDomain {
  return {
    minimum: Math.min(x.minimum, y.minimum),
    maximum: Math.max(x.maximum, y.maximum),
  };
}

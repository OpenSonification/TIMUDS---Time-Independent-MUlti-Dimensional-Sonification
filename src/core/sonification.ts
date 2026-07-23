import { mapValueToPitch, normaliseValue } from './pitch';
import type {
  AxisConfig,
  NumericDomain,
  Point,
  SonificationMode,
} from './types';

export interface SignBlend {
  sign: 'negative' | 'zero' | 'positive';
  negativeGain: number;
  positiveGain: number;
  transitionWidth: number;
}

export interface SpatialPointMapping {
  mode: 'spatial';
  pan: number;
  frequency: number;
  midi: number;
  signBlend: SignBlend;
}

export interface AxisPointMapping {
  mode: 'axis-voices';
  frequencies: { x: number; y: number };
  pans: { x: number; y: number };
}

export function mapValueToPan(
  value: number,
  domain: NumericDomain,
  stereoWidth: number,
): number {
  const width = Math.min(1, Math.max(0, stereoWidth));
  if (domain.minimum === domain.maximum) return 0;
  return width * (2 * normaliseValue(value, domain) - 1);
}

export function pitchRangesOverlap(
  firstLow: number,
  firstHigh: number,
  secondLow: number,
  secondHigh: number,
): boolean {
  const firstMinimum = Math.min(firstLow, firstHigh);
  const firstMaximum = Math.max(firstLow, firstHigh);
  const secondMinimum = Math.min(secondLow, secondHigh);
  const secondMaximum = Math.max(secondLow, secondHigh);
  return (
    Math.max(firstMinimum, secondMinimum) <=
    Math.min(firstMaximum, secondMaximum)
  );
}

export function ySignBlend(
  value: number,
  domain: NumericDomain,
  transitionRatio = 0.05,
): SignBlend {
  const sign = value < 0 ? 'negative' : value > 0 ? 'positive' : 'zero';
  const maximumAbsolute = Math.max(
    Math.abs(domain.minimum),
    Math.abs(domain.maximum),
  );
  const transitionWidth = maximumAbsolute * Math.max(0, transitionRatio);

  if (!Number.isFinite(transitionWidth) || transitionWidth <= Number.EPSILON) {
    if (sign === 'negative')
      return { sign, negativeGain: 1, positiveGain: 0, transitionWidth: 0 };
    if (sign === 'positive')
      return { sign, negativeGain: 0, positiveGain: 1, transitionWidth: 0 };
    return {
      sign,
      negativeGain: Math.SQRT1_2,
      positiveGain: Math.SQRT1_2,
      transitionWidth: 0,
    };
  }

  const unit = Math.min(
    1,
    Math.max(0, (value + transitionWidth) / (2 * transitionWidth)),
  );
  if (unit === 0)
    return { sign, negativeGain: 1, positiveGain: 0, transitionWidth };
  if (unit === 1)
    return { sign, negativeGain: 0, positiveGain: 1, transitionWidth };
  return {
    sign,
    negativeGain: Math.cos((unit * Math.PI) / 2),
    positiveGain: Math.sin((unit * Math.PI) / 2),
    transitionWidth,
  };
}

function pitchForAxis(value: number, domain: NumericDomain, axis: AxisConfig) {
  return mapValueToPitch(
    value,
    domain,
    axis.lowMidi,
    axis.highMidi,
    axis.inverted,
    axis.midiNoteMap?.notes,
  );
}

export function mapPointForSonification(
  mode: SonificationMode,
  point: Point,
  domains: Record<'x' | 'y', NumericDomain>,
  axes: Record<'x' | 'y', AxisConfig>,
  stereoWidth: number,
): SpatialPointMapping | AxisPointMapping {
  if (mode === 'spatial') {
    const pitch = pitchForAxis(point.y, domains.y, axes.y);
    return {
      mode,
      pan: mapValueToPan(point.x, domains.x, stereoWidth),
      frequency: pitch.frequency,
      midi: pitch.midi,
      signBlend: ySignBlend(point.y, domains.y),
    };
  }
  return {
    mode,
    frequencies: {
      x: pitchForAxis(point.x, domains.x, axes.x).frequency,
      y: pitchForAxis(point.y, domains.y, axes.y).frequency,
    },
    pans: { x: axes.x.pan, y: axes.y.pan },
  };
}

import { mapValueToPitch, normaliseValue } from './pitch';
import type {
  AxisConfig,
  NumericDomain,
  Point,
  SonificationMode,
  ValueMapping,
} from './types';

export const MINIMUM_MAPPED_LEVEL = 0.1;
export const MINIMUM_BRIGHTNESS = 0.35;
export const MAXIMUM_BRIGHTNESS = 2.5;
export const MINIMUM_PULSE_RATE = 0.75;
export const MAXIMUM_PULSE_RATE = 8;

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
  level: number;
  brightness: number;
  pulseRate: number;
  signBlend: SignBlend;
}

export interface AxisPointMapping {
  mode: 'axis-voices';
  frequencies: { x: number; y: number };
  levels: { x: number; y: number };
  brightness: { x: number; y: number };
  pulseRates: { x: number; y: number };
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

export function mapValueToLevel(
  value: number,
  domain: NumericDomain,
  inverted = false,
): number {
  const normalised = normaliseValue(value, domain);
  const directed = inverted ? 1 - normalised : normalised;
  return MINIMUM_MAPPED_LEVEL + directed * (1 - MINIMUM_MAPPED_LEVEL);
}

function directedValue(
  value: number,
  domain: NumericDomain,
  inverted: boolean,
): number {
  const normalised = normaliseValue(value, domain);
  return inverted ? 1 - normalised : normalised;
}

export function mapValueToBrightness(
  value: number,
  domain: NumericDomain,
  inverted = false,
): number {
  return (
    MINIMUM_BRIGHTNESS +
    directedValue(value, domain, inverted) *
      (MAXIMUM_BRIGHTNESS - MINIMUM_BRIGHTNESS)
  );
}

export function mapValueToPulseRate(
  value: number,
  domain: NumericDomain,
  inverted = false,
): number {
  return (
    MINIMUM_PULSE_RATE +
    directedValue(value, domain, inverted) *
      (MAXIMUM_PULSE_RATE - MINIMUM_PULSE_RATE)
  );
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

function midpoint(domain: NumericDomain): number {
  return domain.minimum + (domain.maximum - domain.minimum) / 2;
}

export function mapPointForSonification(
  mode: SonificationMode,
  point: Point,
  domains: Record<'x' | 'y', NumericDomain>,
  axes: Record<'x' | 'y', AxisConfig>,
  stereoWidth: number,
  valueMapping: ValueMapping = 'pitch',
): SpatialPointMapping | AxisPointMapping {
  if (mode === 'spatial') {
    const pitch = pitchForAxis(
      valueMapping === 'pitch' ? point.y : midpoint(domains.y),
      domains.y,
      axes.y,
    );
    return {
      mode,
      pan: mapValueToPan(point.x, domains.x, stereoWidth),
      frequency: pitch.frequency,
      midi: pitch.midi,
      level:
        valueMapping === 'volume'
          ? mapValueToLevel(point.y, domains.y, axes.y.inverted)
          : 1,
      brightness:
        valueMapping === 'brightness'
          ? mapValueToBrightness(point.y, domains.y, axes.y.inverted)
          : 1,
      pulseRate:
        valueMapping === 'pulse'
          ? mapValueToPulseRate(point.y, domains.y, axes.y.inverted)
          : 0,
      signBlend: ySignBlend(point.y, domains.y),
    };
  }
  return {
    mode,
    frequencies: {
      x: pitchForAxis(
        valueMapping === 'pitch' ? point.x : midpoint(domains.x),
        domains.x,
        axes.x,
      ).frequency,
      y: pitchForAxis(
        valueMapping === 'pitch' ? point.y : midpoint(domains.y),
        domains.y,
        axes.y,
      ).frequency,
    },
    levels: {
      x:
        valueMapping === 'volume'
          ? mapValueToLevel(point.x, domains.x, axes.x.inverted)
          : 1,
      y:
        valueMapping === 'volume'
          ? mapValueToLevel(point.y, domains.y, axes.y.inverted)
          : 1,
    },
    brightness: {
      x:
        valueMapping === 'brightness'
          ? mapValueToBrightness(point.x, domains.x, axes.x.inverted)
          : 1,
      y:
        valueMapping === 'brightness'
          ? mapValueToBrightness(point.y, domains.y, axes.y.inverted)
          : 1,
    },
    pulseRates: {
      x:
        valueMapping === 'pulse'
          ? mapValueToPulseRate(point.x, domains.x, axes.x.inverted)
          : 0,
      y:
        valueMapping === 'pulse'
          ? mapValueToPulseRate(point.y, domains.y, axes.y.inverted)
          : 0,
    },
    pans: { x: axes.x.pan, y: axes.y.pan },
  };
}

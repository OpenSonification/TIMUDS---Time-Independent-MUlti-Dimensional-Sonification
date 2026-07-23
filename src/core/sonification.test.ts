import { describe, expect, it } from 'vitest';
import {
  MAXIMUM_BRIGHTNESS,
  MAXIMUM_PULSE_RATE,
  MINIMUM_BRIGHTNESS,
  MINIMUM_MAPPED_LEVEL,
  MINIMUM_PULSE_RATE,
  mapPointForSonification,
  mapValueToBrightness,
  mapValueToLevel,
  mapValueToPan,
  mapValueToPulseRate,
  pitchRangesOverlap,
  ySignBlend,
} from './sonification';
import type { AxisConfig } from './types';

const xAxis: AxisConfig = {
  key: 'x',
  label: 'X-axis',
  timbre: 'warm',
  automaticDomain: true,
  manualDomain: { minimum: -1, maximum: 1 },
  lowMidi: 48,
  highMidi: 60,
  midiNoteMap: null,
  inverted: false,
  gain: 0.72,
  muted: false,
  solo: false,
  pan: -0.65,
};

const yAxis: AxisConfig = {
  ...xAxis,
  key: 'y',
  label: 'Y-axis',
  timbre: 'reed',
  lowMidi: 67,
  highMidi: 79,
  pan: 0.65,
};

describe('spatial and axis sonification mapping', () => {
  it('maps the X domain continuously across a bounded stereo width', () => {
    const domain = { minimum: -2, maximum: 2 };
    expect(mapValueToPan(-2, domain, 0.75)).toBe(-0.75);
    expect(mapValueToPan(0, domain, 0.75)).toBe(0);
    expect(mapValueToPan(2, domain, 0.75)).toBe(0.75);
    expect(mapValueToPan(20, domain, 2)).toBe(1);
    expect(mapValueToPan(4, { minimum: 4, maximum: 4 }, 0.75)).toBe(0);
  });

  it('uses X for pan and Y for pitch in Spatial voice mode', () => {
    const mapping = mapPointForSonification(
      'spatial',
      { x: -1, y: 1 },
      {
        x: { minimum: -1, maximum: 1 },
        y: { minimum: -1, maximum: 1 },
      },
      { x: xAxis, y: yAxis },
      0.75,
    );
    expect(mapping.mode).toBe('spatial');
    if (mapping.mode !== 'spatial') return;
    expect(mapping.pan).toBe(-0.75);
    expect(mapping.midi).toBe(79);
    expect(mapping.signBlend.sign).toBe('positive');
  });

  it('retains fixed left and right cues in Axis voices mode', () => {
    const mapping = mapPointForSonification(
      'axis-voices',
      { x: 0, y: 0 },
      {
        x: { minimum: -1, maximum: 1 },
        y: { minimum: -1, maximum: 1 },
      },
      { x: xAxis, y: yAxis },
      0.75,
    );
    expect(mapping).toMatchObject({
      mode: 'axis-voices',
      levels: { x: 1, y: 1 },
      pans: { x: -0.65, y: 0.65 },
    });
  });

  it('maps each Axis voice volume while holding pitch at its midpoint', () => {
    const mapping = mapPointForSonification(
      'axis-voices',
      { x: -1, y: 1 },
      {
        x: { minimum: -1, maximum: 1 },
        y: { minimum: -1, maximum: 1 },
      },
      { x: xAxis, y: yAxis },
      0.75,
      'volume',
    );
    expect(mapping.mode).toBe('axis-voices');
    if (mapping.mode !== 'axis-voices') return;
    expect(mapping.levels.x).toBe(MINIMUM_MAPPED_LEVEL);
    expect(mapping.levels.y).toBe(1);
    expect(mapping.frequencies.x).toBeCloseTo(185, 0);
    expect(mapping.frequencies.y).toBeCloseTo(554, 0);
  });

  it('uses Y for volume at a fixed pitch in Spatial voice mode', () => {
    const mapping = mapPointForSonification(
      'spatial',
      { x: 1, y: -1 },
      {
        x: { minimum: -1, maximum: 1 },
        y: { minimum: -1, maximum: 1 },
      },
      { x: xAxis, y: yAxis },
      0.75,
      'volume',
    );
    expect(mapping.mode).toBe('spatial');
    if (mapping.mode !== 'spatial') return;
    expect(mapping.pan).toBe(0.75);
    expect(mapping.level).toBe(MINIMUM_MAPPED_LEVEL);
    expect(mapping.midi).toBe(73);
  });
});

describe('volume mapping', () => {
  it('stays bounded, supports inversion and centres constant domains', () => {
    const domain = { minimum: -1, maximum: 1 };
    expect(mapValueToLevel(-10, domain)).toBe(MINIMUM_MAPPED_LEVEL);
    expect(mapValueToLevel(10, domain)).toBe(1);
    expect(mapValueToLevel(-1, domain, true)).toBe(1);
    expect(mapValueToLevel(1, domain, true)).toBe(MINIMUM_MAPPED_LEVEL);
    expect(mapValueToLevel(4, { minimum: 4, maximum: 4 })).toBeCloseTo(0.55);
  });
});

describe('alternative sound mappings', () => {
  it('maps bounded brightness and pulse-rate ranges with inversion', () => {
    const domain = { minimum: 0, maximum: 10 };
    expect(mapValueToBrightness(0, domain)).toBe(MINIMUM_BRIGHTNESS);
    expect(mapValueToBrightness(10, domain)).toBe(MAXIMUM_BRIGHTNESS);
    expect(mapValueToBrightness(0, domain, true)).toBe(MAXIMUM_BRIGHTNESS);
    expect(mapValueToPulseRate(0, domain)).toBe(MINIMUM_PULSE_RATE);
    expect(mapValueToPulseRate(10, domain)).toBe(MAXIMUM_PULSE_RATE);
    expect(mapValueToPulseRate(10, domain, true)).toBe(MINIMUM_PULSE_RATE);
  });

  it('holds pitch and exposes separate Axis brightness and pulse values', () => {
    const domains = {
      x: { minimum: -1, maximum: 1 },
      y: { minimum: -1, maximum: 1 },
    };
    const brightness = mapPointForSonification(
      'axis-voices',
      { x: -1, y: 1 },
      domains,
      { x: xAxis, y: yAxis },
      0.75,
      'brightness',
    );
    const pulse = mapPointForSonification(
      'axis-voices',
      { x: -1, y: 1 },
      domains,
      { x: xAxis, y: yAxis },
      0.75,
      'pulse',
    );
    expect(brightness.mode).toBe('axis-voices');
    expect(pulse.mode).toBe('axis-voices');
    if (brightness.mode !== 'axis-voices' || pulse.mode !== 'axis-voices')
      return;
    expect(brightness.brightness).toEqual({
      x: MINIMUM_BRIGHTNESS,
      y: MAXIMUM_BRIGHTNESS,
    });
    expect(pulse.pulseRates).toEqual({
      x: MINIMUM_PULSE_RATE,
      y: MAXIMUM_PULSE_RATE,
    });
    expect(brightness.frequencies).toEqual(pulse.frequencies);
  });
});

describe('pitch range overlap', () => {
  it('distinguishes separated, touching and overlapping ranges', () => {
    expect(pitchRangesOverlap(48, 60, 67, 79)).toBe(false);
    expect(pitchRangesOverlap(48, 60, 60, 72)).toBe(true);
    expect(pitchRangesOverlap(48, 67, 60, 72)).toBe(true);
    expect(pitchRangesOverlap(60, 48, 79, 67)).toBe(false);
  });
});

describe('Y-sign timbre blend', () => {
  it('provides negative, balanced and positive equal-power blends', () => {
    const domain = { minimum: -1, maximum: 1 };
    expect(ySignBlend(-1, domain)).toMatchObject({
      sign: 'negative',
      negativeGain: 1,
      positiveGain: 0,
    });
    const zero = ySignBlend(0, domain);
    expect(zero.sign).toBe('zero');
    expect(zero.negativeGain).toBeCloseTo(Math.SQRT1_2);
    expect(zero.positiveGain).toBeCloseTo(Math.SQRT1_2);
    expect(ySignBlend(1, domain)).toMatchObject({
      sign: 'positive',
      negativeGain: 0,
      positiveGain: 1,
    });
  });

  it('crossfades continuously through the deadband', () => {
    const domain = { minimum: -2, maximum: 2 };
    const below = ySignBlend(-0.001, domain);
    const above = ySignBlend(0.001, domain);
    expect(Math.abs(below.negativeGain - above.negativeGain)).toBeLessThan(
      0.02,
    );
    expect(Math.abs(below.positiveGain - above.positiveGain)).toBeLessThan(
      0.02,
    );
  });

  it('handles one-sided, constant and extremely small domains safely', () => {
    expect(ySignBlend(2, { minimum: 1, maximum: 3 }).positiveGain).toBe(1);
    expect(ySignBlend(-2, { minimum: -3, maximum: -1 }).negativeGain).toBe(1);
    const constant = ySignBlend(0, { minimum: 0, maximum: 0 });
    expect(constant.negativeGain).toBeCloseTo(Math.SQRT1_2);
    expect(
      Number.isFinite(
        ySignBlend(1e-20, { minimum: -1e-20, maximum: 1e-20 }).positiveGain,
      ),
    ).toBe(true);
  });
});

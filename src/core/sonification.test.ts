import { describe, expect, it } from 'vitest';
import {
  mapPointForSonification,
  mapValueToPan,
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
      pans: { x: -0.65, y: 0.65 },
    });
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

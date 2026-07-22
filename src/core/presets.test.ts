import { describe, expect, it } from 'vitest';
import { generatePreset, PRESET_NAMES } from './presets';

describe('presets', () => {
  it('generates every preset deterministically with finite points', () => {
    for (const name of PRESET_NAMES) {
      const first = generatePreset(name);
      const second = generatePreset(name);
      expect(first).toEqual(second);
      expect(first.points.length).toBeGreaterThanOrEqual(3);
      expect(
        first.points.every(
          (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
        ),
      ).toBe(true);
    }
  });

  it('creates a smooth closed unit circle without duplicating the endpoint', () => {
    const circle = generatePreset('Circle');
    expect(circle.closed).toBe(true);
    expect(circle.points).toHaveLength(128);
    expect(circle.points[0]).toEqual({ x: 1, y: 0 });
    expect(circle.points.at(-1)).not.toEqual(circle.points[0]);
    for (const point of circle.points)
      expect(Math.hypot(point.x, point.y)).toBeCloseTo(1, 10);
  });

  it('marks open and closed presets correctly', () => {
    expect(generatePreset('Triangle').closed).toBe(true);
    expect(generatePreset('Lissajous curve').closed).toBe(true);
    expect(generatePreset('Diagonal line').closed).toBe(false);
    expect(generatePreset('Spiral').closed).toBe(false);
  });
});

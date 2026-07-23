import { describe, expect, it } from 'vitest';
import { generatePreset, PRESET_NAMES } from './presets';

describe('presets', () => {
  it('generates every preset deterministically with finite points', () => {
    for (const name of PRESET_NAMES) {
      const first = generatePreset(name);
      const second = generatePreset(name);
      expect(first).toEqual(second);
      expect(first.points.length).toBeGreaterThanOrEqual(2);
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
    expect(generatePreset('Square').closed).toBe(true);
    expect(generatePreset('Lissajous curve').closed).toBe(true);
    expect(generatePreset('Diagonal line').closed).toBe(false);
    expect(generatePreset('Spiral').closed).toBe(false);
  });

  it('includes deterministic comparison and edge-case curves', () => {
    const diagonal = generatePreset('Diagonal line');
    expect(diagonal.points.every((point) => point.y === point.x)).toBe(true);
    const antiDiagonal = generatePreset('Anti-diagonal line');
    expect(antiDiagonal.points.every((point) => point.y === -point.x)).toBe(
      true,
    );
    expect(generatePreset('Mirrored pair').points).toEqual([
      { x: 0.25, y: 0.75 },
      { x: 0.75, y: 0.25 },
    ]);
    expect(
      new Set(generatePreset('Constant X').points.map(({ x }) => x)).size,
    ).toBe(1);
    expect(
      new Set(generatePreset('Constant Y').points.map(({ y }) => y)).size,
    ).toBe(1);
    const signs = generatePreset('Y-zero crossings').points.map(({ y }) =>
      Math.sign(y),
    );
    expect(signs).toContain(-1);
    expect(signs).toContain(1);
  });
});

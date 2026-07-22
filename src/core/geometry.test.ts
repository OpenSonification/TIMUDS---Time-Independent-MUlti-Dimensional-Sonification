import { describe, expect, it } from 'vitest';
import {
  buildCurveGeometry,
  coordinateDomain,
  interpolateCurve,
  prepareDrawnPath,
} from './geometry';
import type { Point } from './types';

const rightAngle: Point[] = [
  { x: 0, y: 0 },
  { x: 3, y: 0 },
  { x: 3, y: 4 },
];

describe('curve geometry', () => {
  it('calculates domains containing negative values', () => {
    expect(
      coordinateDomain(
        [
          { x: -7, y: 2 },
          { x: 3, y: -4 },
        ],
        'x',
      ),
    ).toEqual({ minimum: -7, maximum: 3 });
    expect(
      coordinateDomain(
        [
          { x: -7, y: 2 },
          { x: 3, y: -4 },
        ],
        'y',
      ),
    ).toEqual({ minimum: -4, maximum: 2 });
  });

  it('calculates open and closed cumulative length', () => {
    expect(buildCurveGeometry(rightAngle, false).totalLength).toBeCloseTo(7);
    expect(buildCurveGeometry(rightAngle, true).totalLength).toBeCloseTo(12);
  });

  it('retains zero-length segments without dividing by zero', () => {
    const points = [
      { x: 1, y: 1 },
      { x: 1, y: 1 },
      { x: 3, y: 1 },
    ];
    const geometry = buildCurveGeometry(points, false);
    expect(geometry.segments).toHaveLength(2);
    expect(geometry.totalLength).toBe(2);
    expect(
      interpolateCurve(points, 0.5, false, 'arc-length', false, geometry),
    ).toEqual({ x: 2, y: 1 });
  });

  it('interpolates by arc length', () => {
    expect(interpolateCurve(rightAngle, 3 / 7, false, 'arc-length')).toEqual({
      x: 3,
      y: 0,
    });
    expect(interpolateCurve(rightAngle, 5 / 7, false, 'arc-length')).toEqual({
      x: 3,
      y: 2,
    });
  });

  it('gives each segment equal time in uniform mode', () => {
    expect(interpolateCurve(rightAngle, 0.25, false, 'uniform')).toEqual({
      x: 1.5,
      y: 0,
    });
    expect(interpolateCurve(rightAngle, 0.75, false, 'uniform')).toEqual({
      x: 3,
      y: 2,
    });
  });

  it('supports reverse progress and closed final-to-first interpolation', () => {
    expect(interpolateCurve(rightAngle, 0, false, 'uniform', true)).toEqual({
      x: 3,
      y: 4,
    });
    const triangle = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    expect(interpolateCurve(triangle, 1, true, 'uniform')).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('handles a wholly degenerate curve', () => {
    const points = [
      { x: 2, y: 2 },
      { x: 2, y: 2 },
    ];
    expect(interpolateCurve(points, 0.8, false, 'arc-length')).toEqual({
      x: 2,
      y: 2,
    });
  });

  it('deterministically deduplicates and bounds long drawn paths', () => {
    const points = Array.from({ length: 2_000 }, (_, index) => ({
      x: index / 1_999,
      y: index / 1_999,
    }));
    const prepared = prepareDrawnPath(points);
    expect(prepared.length).toBeLessThanOrEqual(300);
    expect(prepared[0]).toEqual({ x: 0, y: 0 });
    expect(prepared.at(-1)?.x).toBeCloseTo(1);
    expect(prepareDrawnPath(points)).toEqual(prepared);
  });
});

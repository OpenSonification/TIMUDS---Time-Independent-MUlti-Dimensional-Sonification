import { describe, expect, it } from 'vitest';
import { buildCurveGeometry } from './geometry';
import { crossedCurveBenchmarks, curveBenchmarks } from './curveBenchmarks';

describe('curve benchmarks', () => {
  const square = [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
  ];

  it('groups extrema reached at the same point', () => {
    const benchmarks = curveBenchmarks(
      square,
      true,
      'uniform',
      false,
      buildCurveGeometry(square, true),
    );
    expect(benchmarks).toEqual([
      {
        id: 'lowest-x+lowest-y',
        progress: 0,
        point: { x: -1, y: -1 },
        kinds: ['lowest-x', 'lowest-y'],
      },
      {
        id: 'highest-x',
        progress: 0.25,
        point: { x: 1, y: -1 },
        kinds: ['highest-x'],
      },
      {
        id: 'highest-y',
        progress: 0.5,
        point: { x: 1, y: 1 },
        kinds: ['highest-y'],
      },
    ]);
  });

  it('uses traversal order when reversed and reports constant dimensions once', () => {
    const points = [
      { x: 2, y: -1 },
      { x: 2, y: 3 },
      { x: 2, y: 0 },
    ];
    const benchmarks = curveBenchmarks(
      points,
      false,
      'uniform',
      true,
      buildCurveGeometry(points, false),
    );
    expect(
      benchmarks.map(({ progress, kinds }) => ({ progress, kinds })),
    ).toEqual([
      { progress: 0, kinds: ['constant-x'] },
      { progress: 0.5, kinds: ['highest-y'] },
      { progress: 1, kinds: ['lowest-y'] },
    ]);
  });

  it('finds ordinary and wrapped crossings without announcing direct repeats', () => {
    const benchmarks = curveBenchmarks(
      square,
      true,
      'uniform',
      false,
      buildCurveGeometry(square, true),
    );
    expect(crossedCurveBenchmarks(0.1, 0.3, benchmarks, false)).toHaveLength(1);
    expect(crossedCurveBenchmarks(0.3, 0.3, benchmarks, false)).toEqual([]);
    expect(
      crossedCurveBenchmarks(0.9, 0.1, benchmarks, true).map(
        ({ progress }) => progress,
      ),
    ).toEqual([0]);
    expect(crossedCurveBenchmarks(0.9, 0.1, benchmarks, false)).toEqual([]);

    const seamBenchmarks = [
      ...benchmarks,
      {
        id: 'near-seam',
        progress: 0.95,
        point: { x: -0.5, y: -1 },
        kinds: ['lowest-y' as const],
      },
    ].sort((left, right) => left.progress - right.progress);
    expect(
      crossedCurveBenchmarks(0.9, 0.3, seamBenchmarks, true).map(
        ({ progress }) => progress,
      ),
    ).toEqual([0.95, 0, 0.25]);
  });
});

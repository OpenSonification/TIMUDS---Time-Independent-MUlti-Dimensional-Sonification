import type { CurveGeometry } from './geometry';
import type { Parameterisation, Point } from './types';

export type CurveBenchmarkKind =
  | 'lowest-x'
  | 'highest-x'
  | 'lowest-y'
  | 'highest-y'
  | 'constant-x'
  | 'constant-y';

export interface CurveBenchmark {
  id: string;
  progress: number;
  point: Point;
  kinds: CurveBenchmarkKind[];
}

function forwardProgressAtPoint(
  pointIndex: number,
  pointCount: number,
  closed: boolean,
  parameterisation: Parameterisation,
  geometry: CurveGeometry,
): number {
  if (pointCount <= 1 || geometry.segments.length === 0) return 0;
  if (!closed && pointIndex === pointCount - 1) return 1;
  if (parameterisation === 'uniform') {
    return pointIndex / geometry.segments.length;
  }
  if (geometry.totalLength === 0) return 0;
  return (
    (geometry.segments[pointIndex]?.cumulativeStart ?? geometry.totalLength) /
    geometry.totalLength
  );
}

function traversalProgress(
  forwardProgress: number,
  closed: boolean,
  reverse: boolean,
): number {
  if (!reverse) return forwardProgress;
  if (closed && forwardProgress === 0) return 0;
  return 1 - forwardProgress;
}

function firstMatch(
  points: Point[],
  axis: 'x' | 'y',
  value: number,
  closed: boolean,
  parameterisation: Parameterisation,
  reverse: boolean,
  geometry: CurveGeometry,
): { progress: number; point: Point } {
  const matches = points
    .map((point, index) => ({
      point,
      progress: traversalProgress(
        forwardProgressAtPoint(
          index,
          points.length,
          closed,
          parameterisation,
          geometry,
        ),
        closed,
        reverse,
      ),
    }))
    .filter(({ point }) => point[axis] === value)
    .sort((left, right) => left.progress - right.progress);
  return matches[0] ?? { progress: 0, point: points[0] ?? { x: 0, y: 0 } };
}

export function curveBenchmarks(
  points: Point[],
  closed: boolean,
  parameterisation: Parameterisation,
  reverse: boolean,
  geometry: CurveGeometry,
): CurveBenchmark[] {
  if (points.length === 0) return [];
  const xValues = points.map(({ x }) => x);
  const yValues = points.map(({ y }) => y);
  const minimumX = Math.min(...xValues);
  const maximumX = Math.max(...xValues);
  const minimumY = Math.min(...yValues);
  const maximumY = Math.max(...yValues);
  const candidates: Array<{
    kind: CurveBenchmarkKind;
    axis: 'x' | 'y';
    value: number;
  }> = [
    {
      kind: minimumX === maximumX ? 'constant-x' : 'lowest-x',
      axis: 'x',
      value: minimumX,
    },
    ...(minimumX === maximumX
      ? []
      : [{ kind: 'highest-x' as const, axis: 'x' as const, value: maximumX }]),
    {
      kind: minimumY === maximumY ? 'constant-y' : 'lowest-y',
      axis: 'y',
      value: minimumY,
    },
    ...(minimumY === maximumY
      ? []
      : [{ kind: 'highest-y' as const, axis: 'y' as const, value: maximumY }]),
  ];

  const grouped = new Map<string, CurveBenchmark>();
  for (const candidate of candidates) {
    const match = firstMatch(
      points,
      candidate.axis,
      candidate.value,
      closed,
      parameterisation,
      reverse,
      geometry,
    );
    const key = match.progress.toFixed(12);
    const existing = grouped.get(key);
    if (existing) {
      existing.kinds.push(candidate.kind);
      existing.id = [...existing.kinds].sort().join('+');
    } else {
      grouped.set(key, {
        id: candidate.kind,
        progress: match.progress,
        point: match.point,
        kinds: [candidate.kind],
      });
    }
  }
  return [...grouped.values()].sort(
    (left, right) => left.progress - right.progress,
  );
}

export function crossedCurveBenchmarks(
  previousProgress: number,
  nextProgress: number,
  benchmarks: readonly CurveBenchmark[],
  looped: boolean,
): CurveBenchmark[] {
  if (nextProgress >= previousProgress) {
    return benchmarks.filter(
      ({ progress }) => progress > previousProgress && progress <= nextProgress,
    );
  }
  if (!looped) return [];
  return [
    ...benchmarks.filter(({ progress }) => progress > previousProgress),
    ...benchmarks.filter(({ progress }) => progress <= nextProgress),
  ];
}

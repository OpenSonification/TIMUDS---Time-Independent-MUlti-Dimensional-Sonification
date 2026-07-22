import type { NumericDomain, Parameterisation, Point } from './types';

export interface Segment {
  start: Point;
  end: Point;
  length: number;
  cumulativeStart: number;
  cumulativeEnd: number;
}

export interface CurveGeometry {
  segments: Segment[];
  totalLength: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function buildCurveGeometry(
  points: Point[],
  closed: boolean,
): CurveGeometry {
  const segments: Segment[] = [];
  let totalLength = 0;
  const count = closed ? points.length : Math.max(0, points.length - 1);
  for (let index = 0; index < count; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    if (!start || !end) continue;
    const length = distance(start, end);
    segments.push({
      start,
      end,
      length,
      cumulativeStart: totalLength,
      cumulativeEnd: totalLength + length,
    });
    totalLength += length;
  }
  return { segments, totalLength };
}

function interpolateSegment(segment: Segment, unit: number): Point {
  return {
    x: segment.start.x + (segment.end.x - segment.start.x) * unit,
    y: segment.start.y + (segment.end.y - segment.start.y) * unit,
  };
}

export function interpolateCurve(
  points: Point[],
  progress: number,
  closed: boolean,
  parameterisation: Parameterisation,
  reverse = false,
  geometry = buildCurveGeometry(points, closed),
): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1 || geometry.segments.length === 0)
    return points[0] ?? { x: 0, y: 0 };
  const unit = reverse ? 1 - clamp01(progress) : clamp01(progress);

  if (parameterisation === 'uniform') {
    const scaled = unit * geometry.segments.length;
    const index = Math.min(geometry.segments.length - 1, Math.floor(scaled));
    const segment = geometry.segments[index];
    if (!segment) return points[0] ?? { x: 0, y: 0 };
    return interpolateSegment(
      segment,
      index === geometry.segments.length - 1 && unit === 1 ? 1 : scaled - index,
    );
  }

  if (geometry.totalLength === 0) return points[0] ?? { x: 0, y: 0 };
  const target = unit * geometry.totalLength;
  let segment = geometry.segments[geometry.segments.length - 1];
  for (const candidate of geometry.segments) {
    if (candidate.length > 0 && target <= candidate.cumulativeEnd) {
      segment = candidate;
      break;
    }
  }
  if (!segment || segment.length === 0) return points[0] ?? { x: 0, y: 0 };
  return interpolateSegment(
    segment,
    clamp01((target - segment.cumulativeStart) / segment.length),
  );
}

export function coordinateDomain(
  points: Point[],
  axis: 'x' | 'y',
): NumericDomain {
  if (points.length === 0) return { minimum: 0, maximum: 0 };
  let minimum = points[0]?.[axis] ?? 0;
  let maximum = minimum;
  for (const point of points) {
    minimum = Math.min(minimum, point[axis]);
    maximum = Math.max(maximum, point[axis]);
  }
  return { minimum, maximum };
}

export function removeNearDuplicates(
  points: Point[],
  threshold: number,
): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    if (!previous || distance(previous, point) >= threshold) result.push(point);
  }
  return result;
}

export function resamplePath(points: Point[], targetCount: number): Point[] {
  if (points.length <= targetCount || targetCount < 2) return [...points];
  const geometry = buildCurveGeometry(points, false);
  if (geometry.totalLength === 0) return points.slice(0, 2);
  return Array.from({ length: targetCount }, (_, index) =>
    interpolateCurve(
      points,
      index / (targetCount - 1),
      false,
      'arc-length',
      false,
      geometry,
    ),
  );
}

export function prepareDrawnPath(points: Point[]): Point[] {
  return resamplePath(removeNearDuplicates(points, 0.006), 300);
}

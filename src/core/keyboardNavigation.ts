import type { AxisKey, NumericDomain, Point } from './types';

export type ExplorerStepName = 'fine' | 'standard' | 'coarse' | 'custom';

export interface ExplorerSteps {
  fine: number;
  standard: number;
  coarse: number;
}

export interface ExplorerMovement {
  point: Point;
  handled: boolean;
  boundary: null | `${AxisKey}-${'minimum' | 'maximum'}`;
}

export function explorationDomain(domain: NumericDomain): NumericDomain {
  if (domain.minimum !== domain.maximum) return domain;
  const padding = Math.max(1, Math.abs(domain.minimum) * 0.1);
  return {
    minimum: domain.minimum - padding,
    maximum: domain.maximum + padding,
  };
}

export function explorerSteps(domain: NumericDomain): ExplorerSteps {
  const span = Math.max(0, domain.maximum - domain.minimum);
  return {
    fine: span * 0.005,
    standard: span * 0.025,
    coarse: span * 0.1,
  };
}

export function stepForName(
  name: ExplorerStepName,
  domain: NumericDomain,
  custom: number,
): number {
  if (name === 'custom') return Math.max(0, custom);
  return explorerSteps(domain)[name];
}

export function moveExplorerPoint(
  point: Point,
  key: string,
  domains: Record<AxisKey, NumericDomain>,
  standardSteps: Record<AxisKey, number>,
  coarseSteps: Record<AxisKey, number>,
  useCoarse = false,
  wasdEnabled = false,
): ExplorerMovement {
  const normalisedKey = key.toLowerCase();
  const command =
    key === 'ArrowLeft' || (wasdEnabled && normalisedKey === 'a')
      ? { axis: 'x' as const, direction: -1 as const }
      : key === 'ArrowRight' || (wasdEnabled && normalisedKey === 'd')
        ? { axis: 'x' as const, direction: 1 as const }
        : key === 'ArrowUp' || (wasdEnabled && normalisedKey === 'w')
          ? { axis: 'y' as const, direction: 1 as const }
          : key === 'ArrowDown' || (wasdEnabled && normalisedKey === 's')
            ? { axis: 'y' as const, direction: -1 as const }
            : null;

  if (!command) return { point, handled: false, boundary: null };

  const { axis, direction } = command;
  const domain = domains[axis];
  const step = useCoarse ? coarseSteps[axis] : standardSteps[axis];
  const unclamped = point[axis] + direction * step;
  const nextValue = Math.min(
    domain.maximum,
    Math.max(domain.minimum, unclamped),
  );
  const boundary =
    nextValue === point[axis] &&
    (point[axis] === domain.minimum || point[axis] === domain.maximum)
      ? (`${axis}-${direction < 0 ? 'minimum' : 'maximum'}` as const)
      : null;

  return {
    point: { ...point, [axis]: nextValue },
    handled: true,
    boundary,
  };
}

export function nearestSourcePointIndex(
  points: Point[],
  target: Point,
): number {
  if (points.length === 0) return 0;
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  points.forEach((point, index) => {
    const distance = Math.hypot(point.x - target.x, point.y - target.y);
    if (distance < nearestDistance) {
      nearestIndex = index;
      nearestDistance = distance;
    }
  });
  return nearestIndex;
}

import { describe, expect, it } from 'vitest';
import {
  explorationDomain,
  explorerSteps,
  moveExplorerPoint,
  nearestSourcePointIndex,
  stepForName,
} from './keyboardNavigation';

const domains = {
  x: { minimum: -1, maximum: 1 },
  y: { minimum: -2, maximum: 2 },
};
const standard = { x: 0.1, y: 0.2 };
const coarse = { x: 0.5, y: 1 };

describe('two-dimensional keyboard navigation', () => {
  it('maps arrows to numeric axes with positive y upwards', () => {
    expect(
      moveExplorerPoint({ x: 0, y: 0 }, 'ArrowLeft', domains, standard, coarse)
        .point,
    ).toEqual({ x: -0.1, y: 0 });
    expect(
      moveExplorerPoint({ x: 0, y: 0 }, 'ArrowUp', domains, standard, coarse)
        .point,
    ).toEqual({ x: 0, y: 0.2 });
  });

  it('uses the coarse step and clamps at a boundary', () => {
    expect(
      moveExplorerPoint(
        { x: 0.8, y: 0 },
        'ArrowRight',
        domains,
        standard,
        coarse,
        true,
      ).point.x,
    ).toBe(1);
    expect(
      moveExplorerPoint({ x: 1, y: 0 }, 'ArrowRight', domains, standard, coarse)
        .boundary,
    ).toBe('x-maximum');
  });

  it('keeps WASD inert unless explicitly enabled', () => {
    expect(
      moveExplorerPoint({ x: 0, y: 0 }, 'w', domains, standard, coarse).handled,
    ).toBe(false);
    expect(
      moveExplorerPoint(
        { x: 0, y: 0 },
        'W',
        domains,
        standard,
        coarse,
        false,
        true,
      ).point.y,
    ).toBe(0.2);
  });

  it('derives stable steps and expands a constant exploration domain', () => {
    expect(explorerSteps(domains.x)).toEqual({
      fine: 0.01,
      standard: 0.05,
      coarse: 0.2,
    });
    expect(stepForName('custom', domains.x, -2)).toBe(0);
    expect(explorationDomain({ minimum: 4, maximum: 4 })).toEqual({
      minimum: 3,
      maximum: 5,
    });
  });

  it('finds the nearest source point without reordering the curve', () => {
    expect(
      nearestSourcePointIndex(
        [
          { x: -1, y: 0 },
          { x: 0, y: 2 },
          { x: 1, y: 0 },
        ],
        { x: 0.1, y: 1.8 },
      ),
    ).toBe(1);
  });
});

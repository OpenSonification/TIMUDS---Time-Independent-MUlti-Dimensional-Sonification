import type { CurveData, Point } from './types';

export type PresetName =
  'Circle' | 'Triangle' | 'Diagonal line' | 'Lissajous curve' | 'Spiral';

export const PRESET_NAMES: PresetName[] = [
  'Circle',
  'Triangle',
  'Diagonal line',
  'Lissajous curve',
  'Spiral',
];

function samples(count: number, create: (unit: number) => Point): Point[] {
  return Array.from({ length: count }, (_, index) => create(index / count));
}

export function generatePreset(name: PresetName): CurveData {
  switch (name) {
    case 'Circle':
      return {
        name,
        source: 'preset',
        closed: true,
        points: samples(128, (unit) => {
          const angle = unit * Math.PI * 2;
          return { x: Math.cos(angle), y: Math.sin(angle) };
        }),
      };
    case 'Triangle':
      return {
        name,
        source: 'preset',
        closed: true,
        points: [
          { x: 0, y: 1 },
          { x: -0.866_025_4, y: -0.5 },
          { x: 0.866_025_4, y: -0.5 },
        ],
      };
    case 'Diagonal line':
      return {
        name,
        source: 'preset',
        closed: false,
        points: Array.from({ length: 101 }, (_, index) => {
          const value = -1 + (index / 100) * 2;
          return { x: value, y: value };
        }),
      };
    case 'Lissajous curve':
      return {
        name,
        source: 'preset',
        closed: true,
        points: samples(240, (unit) => {
          const angle = unit * Math.PI * 2;
          return {
            x: Math.sin(3 * angle + Math.PI / 2),
            y: Math.sin(2 * angle),
          };
        }),
      };
    case 'Spiral':
      return {
        name,
        source: 'preset',
        closed: false,
        points: Array.from({ length: 241 }, (_, index) => {
          const unit = index / 240;
          const radius = 0.08 + unit * 0.92;
          const angle = unit * Math.PI * 6;
          return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
        }),
      };
  }
}

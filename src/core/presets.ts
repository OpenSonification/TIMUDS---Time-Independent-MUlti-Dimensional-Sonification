import type { CurveData, Point } from './types';

export type PresetName =
  | 'Circle'
  | 'Triangle'
  | 'Square'
  | 'Diagonal line'
  | 'Anti-diagonal line'
  | 'Lissajous curve'
  | 'Spiral'
  | 'Y-zero crossings'
  | 'Mirrored pair'
  | 'Constant X'
  | 'Constant Y';

export const PRESET_NAMES: PresetName[] = [
  'Circle',
  'Triangle',
  'Square',
  'Diagonal line',
  'Anti-diagonal line',
  'Lissajous curve',
  'Spiral',
  'Y-zero crossings',
  'Mirrored pair',
  'Constant X',
  'Constant Y',
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
    case 'Square':
      return {
        name,
        source: 'preset',
        closed: true,
        points: [
          { x: -1, y: -1 },
          { x: 1, y: -1 },
          { x: 1, y: 1 },
          { x: -1, y: 1 },
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
    case 'Anti-diagonal line':
      return {
        name,
        source: 'preset',
        closed: false,
        points: Array.from({ length: 101 }, (_, index) => {
          const value = -1 + (index / 100) * 2;
          return { x: value, y: -value };
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
    case 'Y-zero crossings':
      return {
        name,
        source: 'preset',
        closed: false,
        points: Array.from({ length: 161 }, (_, index) => {
          const unit = index / 160;
          return {
            x: -1 + unit * 2,
            y: Math.sin(unit * Math.PI * 8) * 0.8,
          };
        }),
      };
    case 'Mirrored pair':
      return {
        name,
        source: 'preset',
        closed: false,
        points: [
          { x: 0.25, y: 0.75 },
          { x: 0.75, y: 0.25 },
        ],
      };
    case 'Constant X':
      return {
        name,
        source: 'preset',
        closed: false,
        points: Array.from({ length: 101 }, (_, index) => ({
          x: 0.25,
          y: -1 + (index / 100) * 2,
        })),
      };
    case 'Constant Y':
      return {
        name,
        source: 'preset',
        closed: false,
        points: Array.from({ length: 101 }, (_, index) => ({
          x: -1 + (index / 100) * 2,
          y: -0.25,
        })),
      };
  }
}

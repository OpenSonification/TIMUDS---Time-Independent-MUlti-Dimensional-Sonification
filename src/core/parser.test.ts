import { describe, expect, it } from 'vitest';
import {
  MAX_FILE_BYTES,
  CoordinateParseError,
  parseCoordinates,
  parseCsv,
  parseJson,
  readCoordinateFile,
} from './parser';

describe('coordinate parsing', () => {
  it('parses CSV with a header', () => {
    expect(parseCsv('x,y\n-1,0\n0,1\n1,0')).toEqual([
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 0 },
    ]);
  });

  it('parses CSV without a header and preserves order', () => {
    expect(parseCsv('2,3\n-4,5')).toEqual([
      { x: 2, y: 3 },
      { x: -4, y: 5 },
    ]);
  });

  it('parses JSON pairs and objects', () => {
    expect(parseJson('[[0, 1], [2, 3]]')).toEqual([
      { x: 0, y: 1 },
      { x: 2, y: 3 },
    ]);
    expect(parseJson('[{"x":-1,"y":2},{"x":3,"y":4}]')).toEqual([
      { x: -1, y: 2 },
      { x: 3, y: 4 },
    ]);
  });

  it('detects JSON and CSV without silently recovering malformed input', () => {
    expect(parseCoordinates('[[0,0],[1,1]]', 'auto')).toHaveLength(2);
    expect(parseCoordinates('0,0\n1,1', 'auto')).toHaveLength(2);
    expect(() => parseCoordinates('[not-json]', 'auto')).toThrow(
      /could not be parsed/i,
    );
  });

  it.each([
    ['missing cell', '0,0\n1'],
    ['NaN', '0,0\nNaN,1'],
    ['infinity', '0,0\nInfinity,1'],
    ['too few points', '0,0'],
  ])('rejects %s with a useful location', (_case, input) => {
    expect(() => parseCsv(input)).toThrow(CoordinateParseError);
  });

  it('reports invalid JSON items', () => {
    expect(() => parseJson('[[0,0],[1]]')).toThrow(/Item 2/);
    expect(() => parseJson('[{"x":0,"y":0},{"x":1}]')).toThrow(/Item 2/);
    expect(() => parseJson('[[0,0],[1,1e400]]')).toThrow(/finite number/);
  });

  it('rejects empty cells and curves above the point limit', () => {
    expect(() => parseCsv('0,0\n,1')).toThrow(/Line 2, x/);
    const excessive = JSON.stringify(
      Array.from({ length: 20_001 }, () => [0, 0]),
    );
    expect(() => parseJson(excessive)).toThrow(/limit is 20,000/);
  });

  it('enforces the file size and extension limit', async () => {
    const large = new File([new Uint8Array(MAX_FILE_BYTES + 1)], 'large.csv', {
      type: 'text/csv',
    });
    await expect(readCoordinateFile(large)).rejects.toThrow(/too large/i);
    await expect(
      readCoordinateFile(new File(['0,0\n1,1'], 'curve.txt')),
    ).rejects.toThrow(/\.csv or \.json/);
  });
});

import type { Point } from './types';

export const MAX_FILE_BYTES = 1_000_000;
export const MAX_POINTS = 20_000;

export type CoordinateFormat = 'auto' | 'csv' | 'json';

export class CoordinateParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoordinateParseError';
  }
}

function validatePoints(points: Point[]): Point[] {
  if (points.length < 2) {
    throw new CoordinateParseError(
      'Provide at least two valid coordinate points.',
    );
  }
  if (points.length > MAX_POINTS) {
    throw new CoordinateParseError(
      `This curve has ${points.length.toLocaleString('en-GB')} points; the limit is ${MAX_POINTS.toLocaleString('en-GB')}.`,
    );
  }
  return points;
}

function parseFinite(value: unknown, location: string): number {
  if (typeof value === 'string' && value.trim() === '') {
    throw new CoordinateParseError(`${location} must be a finite number.`);
  }
  const number =
    typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(number)) {
    throw new CoordinateParseError(`${location} must be a finite number.`);
  }
  return number;
}

export function parseCsv(text: string): Point[] {
  const lines = text.split(/\r?\n/);
  const points: Point[] = [];
  let foundContent = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? '';
    if (!line) continue;
    const cells = line.split(',').map((cell) => cell.trim());
    if (
      !foundContent &&
      cells.length === 2 &&
      cells[0]?.toLowerCase() === 'x' &&
      cells[1]?.toLowerCase() === 'y'
    ) {
      foundContent = true;
      continue;
    }
    foundContent = true;
    if (cells.length !== 2) {
      throw new CoordinateParseError(
        `Line ${index + 1} must contain exactly two comma-separated values.`,
      );
    }
    points.push({
      x: parseFinite(cells[0], `Line ${index + 1}, x`),
      y: parseFinite(cells[1], `Line ${index + 1}, y`),
    });
  }
  return validatePoints(points);
}

export function parseJson(text: string): Point[] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : 'Unknown JSON error';
    throw new CoordinateParseError(`The JSON could not be parsed: ${detail}`);
  }
  if (!Array.isArray(value)) {
    throw new CoordinateParseError(
      'JSON must be an array of coordinate pairs or {x, y} objects.',
    );
  }
  const points = value.map((item: unknown, index: number): Point => {
    if (Array.isArray(item)) {
      if (item.length !== 2) {
        throw new CoordinateParseError(
          `Item ${index + 1} must be a pair containing exactly x and y.`,
        );
      }
      return {
        x: parseFinite(item[0], `Item ${index + 1}, x`),
        y: parseFinite(item[1], `Item ${index + 1}, y`),
      };
    }
    if (
      typeof item === 'object' &&
      item !== null &&
      'x' in item &&
      'y' in item
    ) {
      return {
        x: parseFinite(item.x, `Item ${index + 1}, x`),
        y: parseFinite(item.y, `Item ${index + 1}, y`),
      };
    }
    throw new CoordinateParseError(
      `Item ${index + 1} must be [x, y] or an object with x and y.`,
    );
  });
  return validatePoints(points);
}

export function parseCoordinates(
  text: string,
  format: CoordinateFormat,
): Point[] {
  if (text.trim().length === 0) {
    throw new CoordinateParseError(
      'Enter or choose coordinate data before importing.',
    );
  }
  const detected =
    format === 'auto'
      ? text.trimStart().startsWith('[')
        ? 'json'
        : 'csv'
      : format;
  return detected === 'json' ? parseJson(text) : parseCsv(text);
}

export async function readCoordinateFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new CoordinateParseError(
      `“${file.name}” is too large. Files must be no more than ${(MAX_FILE_BYTES / 1_000_000).toFixed(0)} MB.`,
    );
  }
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'csv' && extension !== 'json') {
    throw new CoordinateParseError('Choose a .csv or .json coordinate file.');
  }
  return file.text();
}

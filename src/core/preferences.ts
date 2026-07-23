import { INSTRUMENTS } from './instruments';
import type { AuditionPatternName } from './auditionPatterns';
import type {
  ProgressCueInterval,
  ShortcutScope,
  SonificationMode,
  TimbreName,
} from './types';

export const PREFERENCES_KEY = 'timuds.preferences';
export const PREFERENCES_VERSION = 1;

export interface AxisPreference {
  timbre: TimbreName;
  lowMidi: number;
  highMidi: number;
  pan: number;
}

export interface TimudsPreferences {
  version: typeof PREFERENCES_VERSION;
  sonificationMode: SonificationMode;
  progressCueInterval: ProgressCueInterval;
  shortcutScope: ShortcutScope;
  requireAltForLetters: boolean;
  stereoWidth: number;
  monoCompatible: boolean;
  ySignCue: boolean;
  spatialTimbre: TimbreName;
  progressCueVolume: number;
  testSoundDuration: number;
  auditionPattern: AuditionPatternName;
  announceBenchmarks: boolean;
  visibleStep: 0.01 | 0.1;
  axes: {
    x: AxisPreference;
    y: AxisPreference;
  };
}

export const DEFAULT_PREFERENCES: TimudsPreferences = {
  version: PREFERENCES_VERSION,
  sonificationMode: 'spatial',
  progressCueInterval: '12.5',
  shortcutScope: 'workspace',
  requireAltForLetters: false,
  stereoWidth: 0.75,
  monoCompatible: false,
  ySignCue: true,
  spatialTimbre: 'warm',
  progressCueVolume: 0.12,
  testSoundDuration: 2,
  auditionPattern: 'held',
  announceBenchmarks: false,
  visibleStep: 0.01,
  axes: {
    x: { timbre: 'warm', lowMidi: 48, highMidi: 60, pan: -0.65 },
    y: { timbre: 'reed', lowMidi: 67, highMidi: 79, pan: 0.65 },
  },
};

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function numberInRange(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : fallback;
}

function timbre(value: unknown, fallback: TimbreName): TimbreName {
  return typeof value === 'string' && value in INSTRUMENTS
    ? (value as TimbreName)
    : fallback;
}

function axisPreference(
  value: unknown,
  fallback: AxisPreference,
): AxisPreference {
  if (!isRecord(value)) return fallback;
  return {
    timbre: timbre(value.timbre, fallback.timbre),
    lowMidi: numberInRange(value.lowMidi, 0, 127, fallback.lowMidi),
    highMidi: numberInRange(value.highMidi, 0, 127, fallback.highMidi),
    pan: numberInRange(value.pan, -1, 1, fallback.pan),
  };
}

export function validatePreferences(value: unknown): TimudsPreferences {
  if (
    !isRecord(value) ||
    value.version !== PREFERENCES_VERSION ||
    !isRecord(value.axes)
  )
    return structuredClone(DEFAULT_PREFERENCES);

  const modes: SonificationMode[] = ['spatial', 'axis-voices'];
  const cueIntervals: ProgressCueInterval[] = ['off', '25', '12.5', '10'];
  const scopes: ShortcutScope[] = ['off', 'workspace', 'site-wide'];
  const auditionPatterns: AuditionPatternName[] = [
    'held',
    'bebop',
    'boogie',
    'clave',
    'hemiola',
  ];
  return {
    version: PREFERENCES_VERSION,
    sonificationMode: modes.includes(value.sonificationMode as SonificationMode)
      ? (value.sonificationMode as SonificationMode)
      : DEFAULT_PREFERENCES.sonificationMode,
    progressCueInterval: cueIntervals.includes(
      value.progressCueInterval as ProgressCueInterval,
    )
      ? (value.progressCueInterval as ProgressCueInterval)
      : DEFAULT_PREFERENCES.progressCueInterval,
    shortcutScope: scopes.includes(value.shortcutScope as ShortcutScope)
      ? (value.shortcutScope as ShortcutScope)
      : DEFAULT_PREFERENCES.shortcutScope,
    requireAltForLetters:
      typeof value.requireAltForLetters === 'boolean'
        ? value.requireAltForLetters
        : DEFAULT_PREFERENCES.requireAltForLetters,
    stereoWidth: numberInRange(
      value.stereoWidth,
      0,
      1,
      DEFAULT_PREFERENCES.stereoWidth,
    ),
    monoCompatible:
      typeof value.monoCompatible === 'boolean'
        ? value.monoCompatible
        : DEFAULT_PREFERENCES.monoCompatible,
    ySignCue:
      typeof value.ySignCue === 'boolean'
        ? value.ySignCue
        : DEFAULT_PREFERENCES.ySignCue,
    spatialTimbre: timbre(
      value.spatialTimbre,
      DEFAULT_PREFERENCES.spatialTimbre,
    ),
    progressCueVolume: numberInRange(
      value.progressCueVolume,
      0,
      0.3,
      DEFAULT_PREFERENCES.progressCueVolume,
    ),
    testSoundDuration: numberInRange(
      value.testSoundDuration,
      0.5,
      5,
      DEFAULT_PREFERENCES.testSoundDuration,
    ),
    auditionPattern: auditionPatterns.includes(
      value.auditionPattern as AuditionPatternName,
    )
      ? (value.auditionPattern as AuditionPatternName)
      : DEFAULT_PREFERENCES.auditionPattern,
    announceBenchmarks:
      typeof value.announceBenchmarks === 'boolean'
        ? value.announceBenchmarks
        : DEFAULT_PREFERENCES.announceBenchmarks,
    visibleStep:
      value.visibleStep === 0.1 ? 0.1 : DEFAULT_PREFERENCES.visibleStep,
    axes: {
      x: axisPreference(value.axes.x, DEFAULT_PREFERENCES.axes.x),
      y: axisPreference(value.axes.y, DEFAULT_PREFERENCES.axes.y),
    },
  };
}

export function loadPreferences(storage?: StorageLike): TimudsPreferences {
  if (!storage) return structuredClone(DEFAULT_PREFERENCES);
  try {
    const stored = storage.getItem(PREFERENCES_KEY);
    return stored
      ? validatePreferences(JSON.parse(stored) as unknown)
      : structuredClone(DEFAULT_PREFERENCES);
  } catch {
    return structuredClone(DEFAULT_PREFERENCES);
  }
}

export function savePreferences(
  storage: StorageLike | undefined,
  preferences: TimudsPreferences,
): void {
  if (!storage) return;
  try {
    storage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Storage can be blocked or full; preferences remain usable in memory.
  }
}

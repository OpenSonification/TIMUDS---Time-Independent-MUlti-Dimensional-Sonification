import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  loadPreferences,
  savePreferences,
  validatePreferences,
} from './preferences';

class MemoryStorage {
  value: string | null = null;
  getItem(key: string): string | null {
    return key === PREFERENCES_KEY ? this.value : null;
  }
  setItem(key: string, value: string): void {
    if (key === PREFERENCES_KEY) this.value = value;
  }
}

describe('versioned preferences', () => {
  it('restores validated settings without playback state', () => {
    const storage = new MemoryStorage();
    savePreferences(storage, {
      ...DEFAULT_PREFERENCES,
      sonificationMode: 'axis-voices',
      valueMapping: 'volume',
      shortcutScope: 'site-wide',
      stereoWidth: 0.5,
      testSoundDuration: 4,
      auditionPattern: 'bebop',
      announceBenchmarks: true,
      axes: {
        ...DEFAULT_PREFERENCES.axes,
        x: { ...DEFAULT_PREFERENCES.axes.x, lowMidi: 40 },
      },
    });
    expect(loadPreferences(storage)).toMatchObject({
      sonificationMode: 'axis-voices',
      valueMapping: 'volume',
      shortcutScope: 'site-wide',
      stereoWidth: 0.5,
      testSoundDuration: 4,
      auditionPattern: 'bebop',
      announceBenchmarks: true,
      axes: { x: { lowMidi: 40 } },
    });
    const stored = JSON.parse(storage.value ?? '{}') as Record<string, unknown>;
    expect(stored).not.toHaveProperty('transport');
    expect(stored).not.toHaveProperty('playing');
    expect(stored).not.toHaveProperty('sounding');
    expect(stored).not.toHaveProperty('playbackProgress');
  });

  it('discards incompatible versions and repairs invalid values', () => {
    expect(validatePreferences({ version: 0 })).toEqual(DEFAULT_PREFERENCES);
    expect(
      validatePreferences({
        ...DEFAULT_PREFERENCES,
        stereoWidth: 99,
        testSoundDuration: 99,
        auditionPattern: 'copyrighted-song',
        announceBenchmarks: 'yes',
        valueMapping: 'stereo-size',
        shortcutScope: 'everywhere',
        axes: {
          x: { timbre: 'sample', lowMidi: -1, highMidi: 500, pan: -5 },
          y: DEFAULT_PREFERENCES.axes.y,
        },
      }),
    ).toMatchObject({
      stereoWidth: 0.75,
      testSoundDuration: 2,
      auditionPattern: 'held',
      announceBenchmarks: false,
      valueMapping: 'pitch',
      shortcutScope: 'workspace',
      axes: { x: DEFAULT_PREFERENCES.axes.x },
    });
  });

  it('moves the original Axis defaults into the balanced audible register', () => {
    expect(
      validatePreferences({
        ...DEFAULT_PREFERENCES,
        version: 1,
        axes: {
          x: { timbre: 'warm', lowMidi: 48, highMidi: 60, pan: -0.65 },
          y: { timbre: 'reed', lowMidi: 67, highMidi: 79, pan: 0.65 },
        },
      }),
    ).toMatchObject({
      version: 4,
      axes: {
        x: { timbre: 'warm', lowMidi: 60, highMidi: 72, pan: 0 },
        y: { timbre: 'reed', lowMidi: 60, highMidi: 72, pan: 0 },
      },
    });

    expect(
      validatePreferences({
        ...DEFAULT_PREFERENCES,
        version: 1,
        axes: {
          x: { timbre: 'warm', lowMidi: 40, highMidi: 52, pan: -0.4 },
          y: { timbre: 'flute', lowMidi: 67, highMidi: 79, pan: 0.4 },
        },
      }),
    ).toMatchObject({
      version: 4,
      axes: {
        x: { timbre: 'warm', lowMidi: 40, highMidi: 52, pan: -0.4 },
        y: { timbre: 'flute', lowMidi: 67, highMidi: 79, pan: 0.4 },
      },
    });
  });

  it('defaults landmark voice over off while preserving a current opt-in', () => {
    expect(
      validatePreferences({
        ...DEFAULT_PREFERENCES,
        version: 3,
        announceBenchmarks: true,
      }),
    ).toMatchObject({
      version: 4,
      announceBenchmarks: false,
    });
    expect(
      validatePreferences({
        ...DEFAULT_PREFERENCES,
        announceBenchmarks: true,
      }),
    ).toMatchObject({
      version: 4,
      announceBenchmarks: true,
    });
  });

  it('survives malformed or unavailable storage', () => {
    const storage = new MemoryStorage();
    storage.value = '{broken';
    expect(loadPreferences(storage)).toEqual(DEFAULT_PREFERENCES);
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });
});

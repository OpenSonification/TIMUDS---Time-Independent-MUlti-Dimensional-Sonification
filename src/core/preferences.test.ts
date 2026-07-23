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
      shortcutScope: 'site-wide',
      stereoWidth: 0.5,
      axes: {
        ...DEFAULT_PREFERENCES.axes,
        x: { ...DEFAULT_PREFERENCES.axes.x, lowMidi: 40 },
      },
    });
    expect(loadPreferences(storage)).toMatchObject({
      sonificationMode: 'axis-voices',
      shortcutScope: 'site-wide',
      stereoWidth: 0.5,
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
        shortcutScope: 'everywhere',
        axes: {
          x: { timbre: 'sample', lowMidi: -1, highMidi: 500, pan: -5 },
          y: DEFAULT_PREFERENCES.axes.y,
        },
      }),
    ).toMatchObject({
      stereoWidth: 0.75,
      shortcutScope: 'workspace',
      axes: { x: DEFAULT_PREFERENCES.axes.x },
    });
  });

  it('survives malformed or unavailable storage', () => {
    const storage = new MemoryStorage();
    storage.value = '{broken';
    expect(loadPreferences(storage)).toEqual(DEFAULT_PREFERENCES);
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });
});

import { describe, expect, it } from 'vitest';
import {
  MAX_AUDIO_FILE_BYTES,
  readAudioSampleFile,
  safeAudioFileName,
} from './audioFile';

describe('local audio sample files', () => {
  it('accepts supported audio extensions without inspecting private content', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'voice.MP3', {
      type: 'audio/mpeg',
    });
    expect(new Uint8Array(await readAudioSampleFile(file))).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it.each([
    ['unsupported extension', new File([new Uint8Array([1])], 'voice.txt')],
    ['empty file', new File([], 'voice.wav')],
    [
      'oversized file',
      new File([new Uint8Array(MAX_AUDIO_FILE_BYTES + 1)], 'voice.ogg'),
    ],
  ])('rejects an %s', async (_label, file) => {
    await expect(readAudioSampleFile(file)).rejects.toThrow();
  });

  it('bounds and removes unsafe direction controls from display names', () => {
    expect(safeAudioFileName(`\u202epiano-${'a'.repeat(240)}.mp3`)).toBe(
      `piano-${'a'.repeat(194)}`,
    );
    expect(safeAudioFileName('\u0000\u200f')).toBe('Audio file');
  });
});

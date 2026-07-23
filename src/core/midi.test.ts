import { describe, expect, it } from 'vitest';
import {
  MAX_MIDI_FILE_BYTES,
  MidiParseError,
  parseStandardMidiFile,
  readMidiNoteMap,
} from './midi';

function standardMidi(track: number[]): ArrayBuffer {
  const length = track.length;
  return new Uint8Array([
    0x4d,
    0x54,
    0x68,
    0x64,
    0,
    0,
    0,
    6,
    0,
    0,
    0,
    1,
    0,
    96,
    0x4d,
    0x54,
    0x72,
    0x6b,
    (length >>> 24) & 0xff,
    (length >>> 16) & 0xff,
    (length >>> 8) & 0xff,
    length & 0xff,
    ...track,
  ]).buffer;
}

describe('Standard MIDI File note-map parsing', () => {
  it('extracts, deduplicates and sorts note-on events', () => {
    const result = parseStandardMidiFile(
      standardMidi([
        0, 0x90, 67, 100, 10, 60, 90, 0, 0x80, 60, 0, 0, 0x90, 67, 80, 0, 0xff,
        0x2f, 0,
      ]),
    );
    expect(result).toEqual({
      notes: [60, 67],
      noteOnEvents: 3,
      trackCount: 1,
    });
  });

  it('treats note-on velocity zero as note-off', () => {
    const result = parseStandardMidiFile(
      standardMidi([0, 0x90, 64, 0, 0, 0x90, 65, 1, 0, 0xff, 0x2f, 0]),
    );
    expect(result.notes).toEqual([65]);
    expect(result.noteOnEvents).toBe(1);
  });

  it.each([
    ['missing header', new Uint8Array([1, 2, 3, 4]).buffer],
    ['truncated track', standardMidi([0, 0x90, 60])],
    [
      'no notes',
      standardMidi([0, 0xff, 0x03, 3, 65, 66, 67, 0, 0xff, 0x2f, 0]),
    ],
  ])('rejects %s', (_case, buffer) => {
    expect(() => parseStandardMidiFile(buffer)).toThrow(MidiParseError);
  });

  it('enforces file size and extension limits before parsing', async () => {
    const large = new File(
      [new Uint8Array(MAX_MIDI_FILE_BYTES + 1)],
      'large.mid',
    );
    await expect(readMidiNoteMap(large)).rejects.toThrow(/too large/i);
    await expect(
      readMidiNoteMap(new File([standardMidi([0])], 'notes.wav')),
    ).rejects.toThrow(/\.mid or \.midi/i);
  });

  it('reads valid local files and strips control characters from display names', async () => {
    const file = new File(
      [standardMidi([0, 0x90, 60, 100, 0, 0xff, 0x2f, 0])],
      '\u202Escale.mid',
      { type: 'audio/midi' },
    );
    await expect(readMidiNoteMap(file)).resolves.toMatchObject({
      fileName: 'scale.mid',
      notes: [60],
      noteOnEvents: 1,
      trackCount: 1,
    });
  });
});

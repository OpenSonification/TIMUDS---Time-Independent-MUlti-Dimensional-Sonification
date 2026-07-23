import type { MidiNoteMap } from './types';

export const MAX_MIDI_FILE_BYTES = 2_000_000;
export const MAX_MIDI_TRACKS = 64;
export const MAX_MIDI_NOTE_EVENTS = 50_000;

export class MidiParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MidiParseError';
  }
}

interface ParsedMidi {
  notes: number[];
  noteOnEvents: number;
  trackCount: number;
}

class ByteReader {
  position = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get remaining(): number {
    return this.bytes.length - this.position;
  }

  readByte(context: string): number {
    if (this.position >= this.bytes.length) {
      throw new MidiParseError(`The MIDI file ended while reading ${context}.`);
    }
    return this.bytes[this.position++]!;
  }

  readUnsigned16(context: string): number {
    return this.readByte(context) * 0x100 + this.readByte(context);
  }

  readUnsigned32(context: string): number {
    const value =
      this.readByte(context) * 0x1000000 +
      this.readByte(context) * 0x10000 +
      this.readByte(context) * 0x100 +
      this.readByte(context);
    return value >>> 0;
  }

  readIdentifier(context: string): string {
    return String.fromCharCode(
      this.readByte(context),
      this.readByte(context),
      this.readByte(context),
      this.readByte(context),
    );
  }

  skip(length: number, context: string): void {
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > this.remaining
    ) {
      throw new MidiParseError(`The MIDI file has an invalid ${context} size.`);
    }
    this.position += length;
  }
}

function readVariableLength(
  reader: ByteReader,
  trackEnd: number,
  context: string,
): number {
  let value = 0;
  for (let index = 0; index < 4; index += 1) {
    if (reader.position >= trackEnd) {
      throw new MidiParseError(
        `The MIDI track ended while reading ${context}.`,
      );
    }
    const byte = reader.readByte(context);
    value = value * 0x80 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return value;
  }
  throw new MidiParseError(
    `The MIDI file has an invalid variable-length ${context}.`,
  );
}

function readDataByte(
  reader: ByteReader,
  trackEnd: number,
  context: string,
): number {
  if (reader.position >= trackEnd) {
    throw new MidiParseError(`The MIDI track ended while reading ${context}.`);
  }
  const value = reader.readByte(context);
  if (value >= 0x80) {
    throw new MidiParseError(
      `The MIDI file contains an invalid data byte in ${context}.`,
    );
  }
  return value;
}

function parseTrack(
  reader: ByteReader,
  trackEnd: number,
  noteEvents: number[],
): void {
  let runningStatus: number | null = null;

  while (reader.position < trackEnd) {
    readVariableLength(reader, trackEnd, 'event delta time');
    if (reader.position >= trackEnd) {
      throw new MidiParseError('The MIDI track ends before an event.');
    }

    let status = reader.readByte('event status');
    let firstData: number | null = null;
    if (status < 0x80) {
      if (runningStatus === null) {
        throw new MidiParseError(
          'The MIDI track uses running status before a channel event.',
        );
      }
      firstData = status;
      status = runningStatus;
    } else if (status < 0xf0) {
      runningStatus = status;
    }

    if (status === 0xff) {
      runningStatus = null;
      readDataByte(reader, trackEnd, 'meta-event type');
      const length = readVariableLength(reader, trackEnd, 'meta-event length');
      if (reader.position + length > trackEnd) {
        throw new MidiParseError('A MIDI meta event exceeds its track.');
      }
      reader.skip(length, 'meta event');
      continue;
    }

    if (status === 0xf0 || status === 0xf7) {
      runningStatus = null;
      const length = readVariableLength(
        reader,
        trackEnd,
        'system-event length',
      );
      if (reader.position + length > trackEnd) {
        throw new MidiParseError('A MIDI system event exceeds its track.');
      }
      reader.skip(length, 'system event');
      continue;
    }

    if (status < 0x80 || status > 0xef) {
      throw new MidiParseError(
        `Unsupported MIDI event status 0x${status.toString(16).toUpperCase()}.`,
      );
    }

    const message = status & 0xf0;
    const dataLength = message === 0xc0 || message === 0xd0 ? 1 : 2;
    const data1 =
      firstData ?? readDataByte(reader, trackEnd, 'channel-event data');
    const data2 =
      dataLength === 2
        ? readDataByte(reader, trackEnd, 'channel-event data')
        : null;

    if (message === 0x90 && data2 !== null && data2 > 0) {
      noteEvents.push(data1);
      if (noteEvents.length > MAX_MIDI_NOTE_EVENTS) {
        throw new MidiParseError(
          `The MIDI file contains more than ${MAX_MIDI_NOTE_EVENTS.toLocaleString('en-GB')} note-on events.`,
        );
      }
    }
  }

  if (reader.position !== trackEnd) {
    throw new MidiParseError('A MIDI event extends beyond its track.');
  }
}

export function parseStandardMidiFile(buffer: ArrayBuffer): ParsedMidi {
  if (buffer.byteLength === 0) {
    throw new MidiParseError('The MIDI file is empty.');
  }
  if (buffer.byteLength > MAX_MIDI_FILE_BYTES) {
    throw new MidiParseError(
      `MIDI files must be no more than ${MAX_MIDI_FILE_BYTES / 1_000_000} MB.`,
    );
  }

  const reader = new ByteReader(new Uint8Array(buffer));
  if (reader.readIdentifier('header') !== 'MThd') {
    throw new MidiParseError(
      'This is not a Standard MIDI File: the MThd header is missing.',
    );
  }
  const headerLength = reader.readUnsigned32('header length');
  if (headerLength < 6 || headerLength > reader.remaining) {
    throw new MidiParseError('The MIDI header has an invalid size.');
  }
  const format = reader.readUnsigned16('MIDI format');
  const trackCount = reader.readUnsigned16('track count');
  const division = reader.readUnsigned16('timing division');
  reader.skip(headerLength - 6, 'extended header');

  if (format > 2) {
    throw new MidiParseError(`MIDI format ${format} is not supported.`);
  }
  if (trackCount < 1 || trackCount > MAX_MIDI_TRACKS) {
    throw new MidiParseError(
      `The MIDI file must contain between 1 and ${MAX_MIDI_TRACKS} tracks.`,
    );
  }
  if (format === 0 && trackCount !== 1) {
    throw new MidiParseError('A format 0 MIDI file must contain one track.');
  }
  if (division === 0) {
    throw new MidiParseError('The MIDI timing division cannot be zero.');
  }

  const noteEvents: number[] = [];
  for (let track = 0; track < trackCount; track += 1) {
    if (reader.readIdentifier(`track ${track + 1} header`) !== 'MTrk') {
      throw new MidiParseError(`MIDI track ${track + 1} has no MTrk header.`);
    }
    const trackLength = reader.readUnsigned32(`track ${track + 1} length`);
    if (trackLength > reader.remaining) {
      throw new MidiParseError(`MIDI track ${track + 1} is truncated.`);
    }
    const trackEnd = reader.position + trackLength;
    parseTrack(reader, trackEnd, noteEvents);
  }

  if (noteEvents.length === 0) {
    throw new MidiParseError('The MIDI file contains no note-on events.');
  }

  return {
    notes: [...new Set(noteEvents)].sort((left, right) => left - right),
    noteOnEvents: noteEvents.length,
    trackCount,
  };
}

function safeFileName(name: string): string {
  const cleaned = [...name]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return !(
        codePoint <= 0x1f ||
        codePoint === 0x7f ||
        codePoint === 0x061c ||
        codePoint === 0x200e ||
        codePoint === 0x200f ||
        (codePoint >= 0x202a && codePoint <= 0x202e) ||
        (codePoint >= 0x2066 && codePoint <= 0x2069)
      );
    })
    .join('')
    .trim();
  return cleaned.slice(0, 200) || 'MIDI file';
}

export async function readMidiNoteMap(file: File): Promise<MidiNoteMap> {
  if (file.size > MAX_MIDI_FILE_BYTES) {
    throw new MidiParseError(
      `“${safeFileName(file.name)}” is too large. MIDI files must be no more than ${MAX_MIDI_FILE_BYTES / 1_000_000} MB.`,
    );
  }
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'mid' && extension !== 'midi') {
    throw new MidiParseError('Choose a .mid or .midi Standard MIDI File.');
  }
  const parsed = parseStandardMidiFile(await file.arrayBuffer());
  return { fileName: safeFileName(file.name), ...parsed };
}

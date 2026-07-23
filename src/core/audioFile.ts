export const MAX_AUDIO_FILE_BYTES = 10_000_000;

const AUDIO_FILE_EXTENSIONS = [
  '.mp3',
  '.wav',
  '.ogg',
  '.m4a',
  '.aac',
  '.webm',
] as const;

export const AUDIO_FILE_ACCEPT = [
  ...AUDIO_FILE_EXTENSIONS,
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'audio/aac',
  'audio/webm',
].join(',');

function hasSupportedExtension(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return AUDIO_FILE_EXTENSIONS.some((extension) =>
    lowerName.endsWith(extension),
  );
}

export function safeAudioFileName(name: string): string {
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
  return cleaned.slice(0, 200) || 'Audio file';
}

export function validateAudioSampleFile(file: File): void {
  if (!hasSupportedExtension(file.name)) {
    throw new Error('Choose an MP3, WAV, OGG, M4A, AAC or WebM audio file.');
  }
  if (file.size === 0) throw new Error('The audio file is empty.');
  if (file.size > MAX_AUDIO_FILE_BYTES) {
    throw new Error(
      `The audio file is too large. The maximum size is ${MAX_AUDIO_FILE_BYTES / 1_000_000} MB.`,
    );
  }
}

export async function readAudioSampleFile(file: File): Promise<ArrayBuffer> {
  validateAudioSampleFile(file);
  return file.arrayBuffer();
}

export type AuditionPatternName =
  'held' | 'bebop' | 'boogie' | 'clave' | 'hemiola';

export interface AuditionNote {
  startSeconds: number;
  durationSeconds: number;
  midi: number;
}

export interface AuditionPattern {
  value: AuditionPatternName;
  label: string;
  description: string;
  sourceDurationSeconds: number;
  notes: readonly AuditionNote[];
}

export interface ScaledAuditionPattern {
  durationSeconds: number;
  notes: AuditionNote[];
}

export const AUDITION_PATTERNS: Record<AuditionPatternName, AuditionPattern> = {
  held: {
    value: 'held',
    label: 'Held note',
    description: 'One steady note. Best for hearing the raw instrument colour.',
    sourceDurationSeconds: 1,
    notes: [{ startSeconds: 0, durationSeconds: 1, midi: 60 }],
  },
  bebop: {
    value: 'bebop',
    label: 'Bebop-style run',
    description: 'An original, angular nine-note run with quick changes.',
    sourceDurationSeconds: 1.8,
    notes: [
      { startSeconds: 0, durationSeconds: 0.16, midi: 60 },
      { startSeconds: 0.2, durationSeconds: 0.16, midi: 63 },
      { startSeconds: 0.4, durationSeconds: 0.16, midi: 65 },
      { startSeconds: 0.6, durationSeconds: 0.12, midi: 66 },
      { startSeconds: 0.76, durationSeconds: 0.18, midi: 67 },
      { startSeconds: 0.98, durationSeconds: 0.14, midi: 70 },
      { startSeconds: 1.16, durationSeconds: 0.18, midi: 72 },
      { startSeconds: 1.4, durationSeconds: 0.14, midi: 69 },
      { startSeconds: 1.6, durationSeconds: 0.2, midi: 72 },
    ],
  },
  boogie: {
    value: 'boogie',
    label: 'Boogie bass pattern',
    description:
      'An original low, walking pattern with an obvious octave shape.',
    sourceDurationSeconds: 4,
    notes: [
      { startSeconds: 0, durationSeconds: 0.38, midi: 36 },
      { startSeconds: 0.5, durationSeconds: 0.38, midi: 40 },
      { startSeconds: 1, durationSeconds: 0.38, midi: 43 },
      { startSeconds: 1.5, durationSeconds: 0.38, midi: 45 },
      { startSeconds: 2, durationSeconds: 0.38, midi: 46 },
      { startSeconds: 2.5, durationSeconds: 0.38, midi: 45 },
      { startSeconds: 3, durationSeconds: 0.38, midi: 43 },
      { startSeconds: 3.5, durationSeconds: 0.5, midi: 40 },
    ],
  },
  clave: {
    value: 'clave',
    label: 'Son-clave pulse',
    description:
      'Five original test strikes arranged as a 2–3 son-clave pulse.',
    sourceDurationSeconds: 4,
    notes: [
      { startSeconds: 0, durationSeconds: 0.16, midi: 72 },
      { startSeconds: 1, durationSeconds: 0.16, midi: 72 },
      { startSeconds: 2, durationSeconds: 0.16, midi: 79 },
      { startSeconds: 2.75, durationSeconds: 0.16, midi: 79 },
      { startSeconds: 3.5, durationSeconds: 0.3, midi: 79 },
    ],
  },
  hemiola: {
    value: 'hemiola',
    label: '3:2 hemiola',
    description:
      'Alternating high and low accents make the three-against-two feel obvious.',
    sourceDurationSeconds: 3,
    notes: [
      { startSeconds: 0, durationSeconds: 0.24, midi: 60 },
      { startSeconds: 0.5, durationSeconds: 0.24, midi: 67 },
      { startSeconds: 1, durationSeconds: 0.24, midi: 60 },
      { startSeconds: 1.5, durationSeconds: 0.24, midi: 67 },
      { startSeconds: 2, durationSeconds: 0.24, midi: 60 },
      { startSeconds: 2.5, durationSeconds: 0.5, midi: 67 },
    ],
  },
};

export const AUDITION_PATTERN_OPTIONS = Object.values(AUDITION_PATTERNS);

export function scaleAuditionPattern(
  pattern: AuditionPattern,
  requestedDurationSeconds: number,
): ScaledAuditionPattern {
  const durationSeconds = Math.min(5, Math.max(0.5, requestedDurationSeconds));
  const scale = durationSeconds / pattern.sourceDurationSeconds;
  return {
    durationSeconds,
    notes: pattern.notes.map((note) => ({
      midi: note.midi,
      startSeconds: note.startSeconds * scale,
      durationSeconds: Math.max(0.04, note.durationSeconds * scale),
    })),
  };
}

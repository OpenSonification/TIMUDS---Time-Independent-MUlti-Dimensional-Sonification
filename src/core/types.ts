export type AxisKey = 'x' | 'y';

export interface Point {
  x: number;
  y: number;
}

export interface CurveData {
  name: string;
  source: 'preset' | 'text' | 'file' | 'drawing' | 'editor';
  points: Point[];
  closed: boolean;
}

export type Parameterisation = 'arc-length' | 'uniform';
export type SonificationMode = 'spatial' | 'axis-voices';
export type ValueMapping = 'pitch' | 'volume' | 'brightness' | 'pulse';
export type ProgressCueInterval = 'off' | '25' | '12.5' | '10';
export type ShortcutScope = 'off' | 'workspace' | 'site-wide';

export type TimbreName =
  | 'pure'
  | 'warm'
  | 'reed'
  | 'bright'
  | 'hollow'
  | 'flute'
  | 'trumpet'
  | 'strings'
  | 'mallet'
  | 'drum'
  | 'sub-bass'
  | 'arcade'
  | 'air-jet'
  | 'siren'
  | 'robot'
  | 'pluck';

export interface MidiNoteMap {
  fileName: string;
  notes: number[];
  noteOnEvents: number;
  trackCount: number;
}

export interface NumericDomain {
  minimum: number;
  maximum: number;
}

export interface AxisConfig {
  key: AxisKey;
  label: string;
  timbre: TimbreName;
  automaticDomain: boolean;
  manualDomain: NumericDomain;
  lowMidi: number;
  highMidi: number;
  midiNoteMap: MidiNoteMap | null;
  inverted: boolean;
  gain: number;
  muted: boolean;
  solo: boolean;
  pan: number;
}

export type TransportStatus =
  'ready' | 'playing' | 'holding' | 'stopped' | 'unavailable' | 'error';

export interface TransportState {
  status: TransportStatus;
  progress: number;
}

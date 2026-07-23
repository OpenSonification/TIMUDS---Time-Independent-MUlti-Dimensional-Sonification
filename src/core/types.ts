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

export type TimbreName = 'pure' | 'warm' | 'reed' | 'bright';

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
  inverted: boolean;
  gain: number;
  muted: boolean;
  solo: boolean;
  pan: number;
}

export type TransportStatus =
  'silent' | 'playing' | 'holding' | 'stopped' | 'unavailable' | 'error';

export interface TransportState {
  status: TransportStatus;
  progress: number;
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INSTRUMENTS } from '../core/instruments';
import { DEFAULT_PREFERENCES } from '../core/preferences';
import type { AxisConfig } from '../core/types';
import {
  AudioEngine,
  PROGRESS_TICK_SECONDS,
  STOP_FADE_SECONDS,
} from './AudioEngine';

class Parameter {
  value = 0;
  setTargetAtTime = vi.fn();
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
}

class Node {
  connect<T>(node: T): T {
    return node;
  }
  disconnect = vi.fn();
}

class Oscillator extends Node {
  frequency = new Parameter();
  detune = new Parameter();
  type: OscillatorType = 'sine';
  start = vi.fn();
  stop = vi.fn();
  setPeriodicWave = vi.fn();
}

class Gain extends Node {
  gain = new Parameter();
}

class Filter extends Node {
  type: BiquadFilterType = 'lowpass';
  frequency = new Parameter();
  Q = new Parameter();
}

class Panner extends Node {
  pan = new Parameter();
}

class Compressor extends Node {
  threshold = new Parameter();
  knee = new Parameter();
  ratio = new Parameter();
  attack = new Parameter();
  release = new Parameter();
}

class BufferSource extends Node {
  buffer: AudioBuffer | null = null;
  loop = false;
  start = vi.fn();
  stop = vi.fn();
}

class Context {
  static latest: Context | null = null;
  state: AudioContextState = 'running';
  currentTime = 4;
  sampleRate = 48_000;
  destination = new Node();
  gains: Gain[] = [];
  oscillators: Oscillator[] = [];
  panners: Panner[] = [];
  filters: Filter[] = [];
  bufferSources: BufferSource[] = [];
  resume = vi.fn(() => Promise.resolve());
  close = vi.fn(() => Promise.resolve());

  constructor() {
    Context.latest = this;
  }

  createGain = () => {
    const node = new Gain();
    this.gains.push(node);
    return node;
  };
  createDynamicsCompressor = () => new Compressor();
  createOscillator = () => {
    const node = new Oscillator();
    this.oscillators.push(node);
    return node;
  };
  createBiquadFilter = () => {
    const node = new Filter();
    this.filters.push(node);
    return node;
  };
  createStereoPanner = () => {
    const node = new Panner();
    this.panners.push(node);
    return node;
  };
  createPeriodicWave = () => ({}) as PeriodicWave;
  createBuffer = (_channels: number, length: number) =>
    ({
      getChannelData: () => new Float32Array(length),
    }) as unknown as AudioBuffer;
  createBufferSource = () => {
    const node = new BufferSource();
    this.bufferSources.push(node);
    return node;
  };
}

const axes: AxisConfig[] = [
  {
    key: 'x',
    label: 'X-axis',
    timbre: DEFAULT_PREFERENCES.axes.x.timbre,
    automaticDomain: true,
    manualDomain: { minimum: -1, maximum: 1 },
    lowMidi: 48,
    highMidi: 60,
    midiNoteMap: null,
    inverted: false,
    gain: 0.7,
    muted: false,
    solo: false,
    pan: -0.65,
  },
  {
    key: 'y',
    label: 'Y-axis',
    timbre: DEFAULT_PREFERENCES.axes.y.timbre,
    automaticDomain: true,
    manualDomain: { minimum: -1, maximum: 1 },
    lowMidi: 67,
    highMidi: 79,
    midiNoteMap: null,
    inverted: false,
    gain: 0.7,
    muted: false,
    solo: false,
    pan: 0.65,
  },
];

beforeEach(() => {
  Context.latest = null;
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    value: Context,
  });
});

afterEach(() => {
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    value: undefined,
  });
});

describe('persistent audio engine', () => {
  it('creates one graph and smooths Spatial voice updates', async () => {
    const engine = new AudioEngine();
    await engine.enable();
    const context = Context.latest!;
    expect(context.oscillators).toHaveLength(8);
    expect(context.bufferSources).toHaveLength(2);

    engine.startSound({
      mode: 'spatial',
      frequency: 440,
      level: 1,
      brightness: 1,
      pulseRate: 0,
      pan: 0.5,
      timbre: 'warm',
      ySignCue: true,
      signBlend: {
        sign: 'positive',
        negativeGain: 0.25,
        positiveGain: 0.97,
        transitionWidth: 0.05,
      },
      masterVolume: 0.18,
      monoCompatible: false,
    });
    engine.applyFrame({
      mode: 'spatial',
      frequency: 445,
      level: 1,
      brightness: 1,
      pulseRate: 0,
      pan: 0.55,
      timbre: 'warm',
      ySignCue: true,
      signBlend: {
        sign: 'positive',
        negativeGain: 0.2,
        positiveGain: 0.98,
        transitionWidth: 0.05,
      },
      masterVolume: 0.18,
      monoCompatible: false,
    });

    expect(context.oscillators).toHaveLength(8);
    expect(
      context.oscillators[0]!.frequency.setTargetAtTime,
    ).toHaveBeenCalled();
    expect(context.panners[0]!.pan.setTargetAtTime).toHaveBeenLastCalledWith(
      0.55,
      4,
      expect.any(Number),
    );
  });

  it('centres both Axis voices for mono-compatible output', async () => {
    const engine = new AudioEngine();
    await engine.enable();
    const context = Context.latest!;
    engine.startSound({
      mode: 'axis-voices',
      axes,
      frequencies: { x: 220, y: 660 },
      levels: { x: 1, y: 1 },
      brightness: { x: 1, y: 1 },
      pulseRates: { x: 0, y: 0 },
      masterVolume: 0.18,
      monoCompatible: true,
    });
    expect(context.panners[0]!.pan.setTargetAtTime).toHaveBeenLastCalledWith(
      0,
      4,
      expect.any(Number),
    );
    expect(context.panners[1]!.pan.setTargetAtTime).toHaveBeenLastCalledWith(
      0,
      4,
      expect.any(Number),
    );
  });

  it('applies bounded mapped levels beneath each Axis listening gain', async () => {
    const engine = new AudioEngine();
    await engine.enable();
    const context = Context.latest!;
    engine.startSound({
      mode: 'axis-voices',
      axes,
      frequencies: { x: 220, y: 660 },
      levels: { x: 0.1, y: 4 },
      brightness: { x: 1, y: 1 },
      pulseRates: { x: 0, y: 0 },
      masterVolume: 0.18,
      monoCompatible: false,
    });

    expect(context.gains[3]!.gain.setTargetAtTime.mock.calls.at(-1)?.[0]).toBe(
      0.7 * 0.1 * 0.34 * INSTRUMENTS.warm.gainCompensation,
    );
    expect(context.gains[10]!.gain.setTargetAtTime.mock.calls.at(-1)?.[0]).toBe(
      0.7 * 0.34 * 1.05,
    );
  });

  it('applies mapped brightness and audio-clock pulse rates', async () => {
    const engine = new AudioEngine();
    await engine.enable();
    const context = Context.latest!;
    engine.startSound({
      mode: 'axis-voices',
      axes,
      frequencies: { x: 220, y: 660 },
      levels: { x: 1, y: 1 },
      brightness: { x: 0.35, y: 2.5 },
      pulseRates: { x: 0.75, y: 8 },
      masterVolume: 0.18,
      monoCompatible: false,
    });

    expect(
      context.filters[0]!.frequency.setTargetAtTime,
    ).toHaveBeenLastCalledWith((350 + 220 * 1.3) * 0.35, 4, expect.any(Number));
    expect(
      context.oscillators[3]!.frequency.setTargetAtTime,
    ).toHaveBeenLastCalledWith(0.75, 4, expect.any(Number));
    expect(context.gains[7]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0.7 * 0.34 * INSTRUMENTS.warm.gainCompensation * 0.4,
      4,
      expect.any(Number),
    );
  });

  it('applies clearly different filter, vibrato and envelope profiles', async () => {
    const engine = new AudioEngine();
    await engine.enable();
    const context = Context.latest!;
    const frame = {
      mode: 'spatial' as const,
      frequency: 440,
      level: 1,
      brightness: 1,
      pulseRate: 0,
      pan: 0,
      ySignCue: false,
      signBlend: {
        sign: 'positive' as const,
        negativeGain: 0,
        positiveGain: 1,
        transitionWidth: 0.05,
      },
      masterVolume: 0.18,
      monoCompatible: false,
    };

    engine.startSound({ ...frame, timbre: 'bright' });
    expect(context.filters[0]!.type).toBe('highpass');
    expect(context.oscillators[2]!.setPeriodicWave).toHaveBeenCalled();
    expect(context.gains[4]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0.35,
      4,
      expect.any(Number),
    );
    expect(
      context.oscillators[1]!.frequency.setTargetAtTime,
    ).toHaveBeenLastCalledWith(0, 4, expect.any(Number));
    expect(context.gains[1]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0,
      4,
      expect.any(Number),
    );

    engine.applyFrame({ ...frame, timbre: 'strings' });
    expect(context.filters[0]!.type).toBe('lowpass');
    expect(
      context.oscillators[1]!.frequency.setTargetAtTime,
    ).toHaveBeenLastCalledWith(5, 4, expect.any(Number));
    expect(context.gains[1]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      42,
      4,
      expect.any(Number),
    );
    expect(context.gains[2]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      1,
      4,
      0.18,
    );
    expect(
      context.oscillators[2]!.detune.setTargetAtTime,
    ).toHaveBeenLastCalledWith(24, 4, expect.any(Number));
    expect(context.gains[5]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0.06,
      4,
      expect.any(Number),
    );
  });

  it('uses inharmonic modulation for the mallet and breath noise for the flute', async () => {
    const engine = new AudioEngine();
    await engine.enable();
    const context = Context.latest!;
    const frame = {
      mode: 'spatial' as const,
      frequency: 440,
      level: 1,
      brightness: 1,
      pulseRate: 0,
      pan: 0,
      ySignCue: false,
      signBlend: {
        sign: 'positive' as const,
        negativeGain: 0,
        positiveGain: 1,
        transitionWidth: 0.05,
      },
      masterVolume: 0.18,
      monoCompatible: false,
    };

    engine.startSound({ ...frame, timbre: 'mallet' });
    expect(
      context.oscillators[1]!.frequency.setTargetAtTime,
    ).toHaveBeenLastCalledWith(440 * 3.73, 4, expect.any(Number));
    expect(context.gains[1]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      340,
      4,
      expect.any(Number),
    );
    expect(
      context.oscillators[2]!.frequency.setTargetAtTime,
    ).toHaveBeenLastCalledWith(440 * 2.71, 4, expect.any(Number));

    engine.applyFrame({ ...frame, timbre: 'flute' });
    expect(context.filters[1]!.type).toBe('highpass');
    expect(context.gains[5]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0.12,
      4,
      expect.any(Number),
    );
    expect(context.gains[6]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0.55,
      4,
      expect.any(Number),
    );

    engine.applyFrame({ ...frame, timbre: 'air-jet' });
    expect(context.gains[5]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0.3,
      4,
      expect.any(Number),
    );
    expect(context.gains[6]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0.14,
      4,
      expect.any(Number),
    );

    engine.applyFrame({ ...frame, timbre: 'robot' });
    expect(
      context.oscillators[1]!.frequency.setTargetAtTime,
    ).toHaveBeenLastCalledWith(440 * 1.414, 4, expect.any(Number));
    expect(context.gains[1]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      480,
      4,
      expect.any(Number),
    );
  });

  it('gives the pitched drum a short level envelope and downward pitch bend', async () => {
    const engine = new AudioEngine();
    await engine.enable();
    const context = Context.latest!;

    engine.startSound({
      mode: 'spatial',
      frequency: 440,
      level: 1,
      brightness: 1,
      pulseRate: 0,
      pan: 0,
      timbre: 'drum',
      ySignCue: false,
      signBlend: {
        sign: 'positive',
        negativeGain: 0,
        positiveGain: 1,
        transitionWidth: 0.05,
      },
      masterVolume: 0.18,
      monoCompatible: false,
    });

    expect(
      context.oscillators[0]!.frequency.setValueAtTime,
    ).toHaveBeenCalledWith(440 * 2 ** (1100 / 1200), 4);
    expect(
      context.oscillators[0]!.frequency.exponentialRampToValueAtTime,
    ).toHaveBeenCalledWith(440, 4.1);
    expect(
      context.oscillators[2]!.frequency.exponentialRampToValueAtTime,
    ).toHaveBeenCalledWith(220, 4.1);
    expect(
      context.gains[2]!.gain.exponentialRampToValueAtTime,
    ).toHaveBeenCalledWith(0.0001, 4.162);
  });

  it('keeps a struck sound audible across a requested calibration length', async () => {
    const engine = new AudioEngine();
    await engine.enable();
    const context = Context.latest!;

    engine.startSound(
      {
        mode: 'spatial',
        frequency: 440,
        level: 1,
        brightness: 1,
        pulseRate: 0,
        pan: 0,
        timbre: 'drum',
        ySignCue: false,
        signBlend: {
          sign: 'positive',
          negativeGain: 0,
          positiveGain: 1,
          transitionWidth: 0.05,
        },
        masterVolume: 0.18,
        monoCompatible: false,
      },
      { struckPreviewDurationSeconds: 2 },
    );

    expect(context.gains[2]!.gain.setTargetAtTime).toHaveBeenCalledWith(
      0.0001,
      4.002,
      2 / 2.6,
    );
    expect(
      context.gains[2]!.gain.exponentialRampToValueAtTime,
    ).not.toHaveBeenCalled();
  });

  it('uses the cue path and cancels every scheduled path on stop', async () => {
    const engine = new AudioEngine();
    await engine.enable();
    const context = Context.latest!;
    engine.startSound({
      mode: 'axis-voices',
      axes,
      frequencies: { x: 220, y: 660 },
      levels: { x: 1, y: 1 },
      brightness: { x: 1, y: 1 },
      pulseRates: { x: 0, y: 0 },
      masterVolume: 0.18,
      monoCompatible: false,
    });
    engine.triggerProgressCue(0.12);
    const cueGain = context.gains.at(-1)!.gain;
    expect(cueGain.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      0.0001,
      4 + PROGRESS_TICK_SECONDS,
    );

    engine.releaseTestSound();
    expect(context.gains[3]!.gain.setTargetAtTime).toHaveBeenCalledWith(
      0,
      4,
      0.012,
    );
    engine.stopAllSound();
    const master = context.gains[0]!.gain;
    expect(master.cancelScheduledValues).toHaveBeenCalledWith(4);
    expect(master.setValueAtTime).toHaveBeenCalledWith(0.18, 4);
    expect(master.linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      4 + STOP_FADE_SECONDS,
    );
    expect(cueGain.cancelScheduledValues).toHaveBeenCalledWith(4);
    for (const oscillator of context.oscillators)
      expect(oscillator.frequency.cancelScheduledValues).toHaveBeenCalledWith(
        4,
      );
  });
});

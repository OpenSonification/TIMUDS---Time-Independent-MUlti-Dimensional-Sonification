import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    expect(context.oscillators).toHaveLength(2);
    expect(context.bufferSources).toHaveLength(1);

    engine.startSound({
      mode: 'spatial',
      frequency: 440,
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

    expect(context.oscillators).toHaveLength(2);
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

  it('uses the cue path and cancels every scheduled path on stop', async () => {
    const engine = new AudioEngine();
    await engine.enable();
    const context = Context.latest!;
    engine.startSound({
      mode: 'axis-voices',
      axes,
      frequencies: { x: 220, y: 660 },
      masterVolume: 0.18,
      monoCompatible: false,
    });
    engine.triggerProgressCue(0.12);
    const cueGain = context.gains.at(-1)!.gain;
    expect(cueGain.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      0.0001,
      4 + PROGRESS_TICK_SECONDS,
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

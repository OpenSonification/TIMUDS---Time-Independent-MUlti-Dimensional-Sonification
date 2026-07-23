import { INSTRUMENTS, type InstrumentDefinition } from '../core/instruments';
import type { SignBlend } from '../core/sonification';
import type { AxisConfig, AxisKey, TimbreName } from '../core/types';

export const PITCH_SMOOTHING_SECONDS = 0.028;
export const PAN_SMOOTHING_SECONDS = 0.045;
export const TIMBRE_CROSSFADE_SECONDS = 0.075;
export const STOP_FADE_SECONDS = 0.12;
export const PROGRESS_TICK_SECONDS = 0.032;

interface Voice {
  oscillator: OscillatorNode;
  filter: BiquadFilterNode;
  articulation: GainNode;
  gain: GainNode;
  panner: StereoPannerNode;
  currentTimbre: TimbreName | null;
  currentFrequency: number;
  lastArticulationTime: number;
}

interface BaseAudioFrame {
  masterVolume: number;
  monoCompatible: boolean;
}

export interface AxisVoicesAudioFrame extends BaseAudioFrame {
  mode: 'axis-voices';
  frequencies: Record<AxisKey, number>;
  axes: AxisConfig[];
}

export interface SpatialAudioFrame extends BaseAudioFrame {
  mode: 'spatial';
  frequency: number;
  pan: number;
  timbre: TimbreName;
  ySignCue: boolean;
  signBlend: SignBlend;
}

export type AudioFrame = AxisVoicesAudioFrame | SpatialAudioFrame;

const AXES: AxisKey[] = ['x', 'y'];

function audioContextConstructor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  return (
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  );
}

export function webAudioSupported(): boolean {
  return audioContextConstructor() !== undefined;
}

function waveFor(
  context: AudioContext,
  definition: InstrumentDefinition,
): PeriodicWave {
  if (!definition.harmonics) {
    throw new Error('A pure sine tone does not need a periodic wave.');
  }
  return context.createPeriodicWave(
    new Float32Array(definition.harmonics.length),
    new Float32Array(definition.harmonics),
    {
      disableNormalization: false,
    },
  );
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = new Map<AxisKey, Voice>();
  private waves = new Map<Exclude<TimbreName, 'pure'>, PeriodicWave>();
  private progressSource: AudioBufferSourceNode | null = null;
  private progressGain: GainNode | null = null;
  private sounding = false;
  private currentMasterLevel = 0;

  get enabled(): boolean {
    return this.context !== null;
  }

  get currentTime(): number {
    return this.context?.currentTime ?? performance.now() / 1000;
  }

  async enable(): Promise<void> {
    if (!this.context) this.createGraph();
    if (!this.context)
      throw new Error('Web Audio is unavailable in this browser.');
    if (this.context.state === 'suspended') await this.context.resume();
  }

  private createGraph(): void {
    const Context = audioContextConstructor();
    if (!Context) return;
    const context = new Context();
    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    master.gain.value = 0;
    compressor.threshold.value = -14;
    compressor.knee.value = 18;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.2;
    master.connect(compressor).connect(context.destination);
    this.context = context;
    this.master = master;

    for (const axis of AXES) {
      const oscillator = context.createOscillator();
      const filter = context.createBiquadFilter();
      const articulation = context.createGain();
      const gain = context.createGain();
      const panner = context.createStereoPanner();
      oscillator.frequency.value = 220;
      filter.type = 'lowpass';
      filter.frequency.value = axis === 'x' ? 1500 : 2600;
      filter.Q.value = axis === 'x' ? 0.5 : 2.2;
      articulation.gain.value = 1;
      gain.gain.value = 0;
      oscillator
        .connect(filter)
        .connect(articulation)
        .connect(gain)
        .connect(panner)
        .connect(master);
      oscillator.start();
      this.voices.set(axis, {
        oscillator,
        filter,
        articulation,
        gain,
        panner,
        currentTimbre: null,
        currentFrequency: 0,
        lastArticulationTime: Number.NEGATIVE_INFINITY,
      });
    }

    const cueBuffer = context.createBuffer(
      1,
      Math.max(1, Math.round(context.sampleRate * 0.05)),
      context.sampleRate,
    );
    const samples = cueBuffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }
    const progressSource = context.createBufferSource();
    const progressFilter = context.createBiquadFilter();
    const progressGain = context.createGain();
    progressSource.buffer = cueBuffer;
    progressSource.loop = true;
    progressFilter.type = 'highpass';
    progressFilter.frequency.value = 3200;
    progressFilter.Q.value = 0.7;
    progressGain.gain.value = 0;
    progressSource
      .connect(progressFilter)
      .connect(progressGain)
      .connect(master);
    progressSource.start();
    this.progressSource = progressSource;
    this.progressGain = progressGain;
  }

  applyFrame(frame: AudioFrame, forceArticulation = false): void {
    const context = this.context;
    if (!context) return;
    if (frame.mode === 'axis-voices') {
      const anySolo = frame.axes.some((axis) => axis.solo);
      for (const config of frame.axes) {
        const audible = !config.muted && (!anySolo || config.solo);
        this.applyVoice(
          config.key,
          frame.frequencies[config.key],
          config.timbre,
          audible ? config.gain * 0.34 : 0,
          frame.monoCompatible ? 0 : config.pan,
          forceArticulation,
        );
      }
    } else {
      const pan = frame.monoCompatible ? 0 : frame.pan;
      if (frame.ySignCue) {
        this.applyVoice(
          'x',
          frame.frequency,
          'hollow',
          frame.signBlend.negativeGain * 0.31,
          pan,
          forceArticulation,
        );
        this.applyVoice(
          'y',
          frame.frequency,
          'bright',
          frame.signBlend.positiveGain * 0.31,
          pan,
          forceArticulation,
        );
      } else {
        this.applyVoice(
          'x',
          frame.frequency,
          frame.timbre,
          0.34,
          pan,
          forceArticulation,
        );
        this.applyVoice(
          'y',
          frame.frequency,
          frame.timbre,
          0,
          pan,
          forceArticulation,
        );
      }
    }
    if (this.sounding) {
      this.currentMasterLevel = frame.masterVolume;
      this.master?.gain.setTargetAtTime(
        frame.masterVolume,
        context.currentTime,
        PITCH_SMOOTHING_SECONDS,
      );
    }
  }

  private applyVoice(
    key: AxisKey,
    frequency: number,
    timbre: TimbreName,
    gain: number,
    pan: number,
    forceArticulation: boolean,
  ): void {
    if (!this.context) return;
    const voice = this.voices.get(key);
    if (!voice) return;
    const timbreChanged = this.setTimbre(voice, timbre);
    const pitchChanged =
      voice.currentFrequency <= 0 ||
      Math.abs(1200 * Math.log2(frequency / voice.currentFrequency)) >= 25;
    voice.oscillator.frequency.setTargetAtTime(
      frequency,
      this.context.currentTime,
      PITCH_SMOOTHING_SECONDS,
    );
    this.applyArticulation(
      voice,
      INSTRUMENTS[timbre],
      forceArticulation || timbreChanged || pitchChanged,
    );
    voice.currentFrequency = frequency;
    voice.gain.gain.setTargetAtTime(
      gain,
      this.context.currentTime,
      TIMBRE_CROSSFADE_SECONDS,
    );
    voice.panner.pan.setTargetAtTime(
      Math.min(1, Math.max(-1, pan)),
      this.context.currentTime,
      PAN_SMOOTHING_SECONDS,
    );
  }

  private setTimbre(voice: Voice, timbre: TimbreName): boolean {
    if (!this.context) return false;
    if (voice.currentTimbre === timbre) return false;
    voice.currentTimbre = timbre;
    const definition = INSTRUMENTS[timbre];
    if (!definition.harmonics) {
      voice.oscillator.type = 'sine';
    } else {
      let wave = this.waves.get(timbre as Exclude<TimbreName, 'pure'>);
      if (!wave) {
        wave = waveFor(this.context, definition);
        this.waves.set(timbre as Exclude<TimbreName, 'pure'>, wave);
      }
      voice.oscillator.setPeriodicWave(wave);
    }
    voice.filter.type = definition.filterType;
    voice.filter.frequency.setTargetAtTime(
      definition.filterFrequency,
      this.context.currentTime,
      TIMBRE_CROSSFADE_SECONDS,
    );
    voice.filter.Q.setTargetAtTime(
      definition.resonance,
      this.context.currentTime,
      TIMBRE_CROSSFADE_SECONDS,
    );
    return true;
  }

  private applyArticulation(
    voice: Voice,
    definition: InstrumentDefinition,
    trigger: boolean,
  ): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    const parameter = voice.articulation.gain;
    if (definition.articulation === 'sustained') {
      parameter.cancelScheduledValues(now);
      parameter.setTargetAtTime(1, now, 0.012);
      return;
    }
    if (!trigger || now - voice.lastArticulationTime < 0.09) return;
    voice.lastArticulationTime = now;
    parameter.cancelScheduledValues(now);
    parameter.setTargetAtTime(1, now, 0.003);
    parameter.setTargetAtTime(
      0.0001,
      now + Math.min(0.055, definition.decaySeconds / 3),
      definition.decaySeconds,
    );
  }

  startSound(frame: AudioFrame): void {
    this.sounding = true;
    this.applyFrame(frame, true);
  }

  triggerProgressCue(volume: number, completion = false): void {
    if (!this.context || !this.progressGain || !this.sounding) return;
    const now = this.context.currentTime;
    const duration = completion
      ? PROGRESS_TICK_SECONDS * 1.45
      : PROGRESS_TICK_SECONDS;
    const level = Math.min(0.18, Math.max(0, volume));
    const parameter = this.progressGain.gain;
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(0.0001, now);
    parameter.linearRampToValueAtTime(level, now + 0.004);
    parameter.exponentialRampToValueAtTime(0.0001, now + duration);
  }

  stopAllSound(fadeSeconds = STOP_FADE_SECONDS): void {
    this.sounding = false;
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    for (const voice of this.voices.values()) {
      voice.oscillator.frequency.cancelScheduledValues(now);
      voice.filter.frequency.cancelScheduledValues(now);
      voice.filter.Q.cancelScheduledValues(now);
      voice.articulation.gain.cancelScheduledValues(now);
      voice.gain.gain.cancelScheduledValues(now);
      voice.panner.pan.cancelScheduledValues(now);
    }
    if (this.progressGain) {
      this.progressGain.gain.cancelScheduledValues(now);
      this.progressGain.gain.setTargetAtTime(0, now, 0.008);
    }
    const fade = Math.min(1, Math.max(0.02, fadeSeconds));
    const parameter = this.master.gain;
    if (typeof parameter.cancelAndHoldAtTime === 'function') {
      parameter.cancelAndHoldAtTime(now);
    } else {
      parameter.cancelScheduledValues(now);
      parameter.setValueAtTime(this.currentMasterLevel, now);
    }
    parameter.linearRampToValueAtTime(0, now + fade);
    this.currentMasterLevel = 0;
  }

  fadeOut(): void {
    this.stopAllSound();
  }

  async close(): Promise<void> {
    this.stopAllSound();
    for (const voice of this.voices.values()) {
      try {
        voice.oscillator.stop();
        voice.oscillator.disconnect();
      } catch {
        // An already-stopped oscillator requires no further cleanup.
      }
    }
    if (this.progressSource) {
      try {
        this.progressSource.stop();
        this.progressSource.disconnect();
      } catch {
        // An already-stopped buffer source requires no further cleanup.
      }
    }
    this.voices.clear();
    this.waves.clear();
    if (this.context && this.context.state !== 'closed')
      await this.context.close();
    this.context = null;
    this.master = null;
    this.progressSource = null;
    this.progressGain = null;
    this.currentMasterLevel = 0;
  }
}

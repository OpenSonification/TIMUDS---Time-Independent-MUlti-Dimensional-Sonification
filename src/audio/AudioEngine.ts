import {
  INSTRUMENTS,
  instrumentFilterFrequency,
  type InstrumentDefinition,
} from '../core/instruments';
import type { SignBlend } from '../core/sonification';
import type { AxisConfig, AxisKey, TimbreName } from '../core/types';

export const PITCH_SMOOTHING_SECONDS = 0.028;
export const PAN_SMOOTHING_SECONDS = 0.045;
export const TIMBRE_CROSSFADE_SECONDS = 0.075;
export const STOP_FADE_SECONDS = 0.12;
export const PROGRESS_TICK_SECONDS = 0.032;
const STRUCK_PREVIEW_DECAY_DIVISOR = 2.6;

interface Voice {
  oscillator: OscillatorNode;
  carrierGain: GainNode;
  modulator: OscillatorNode;
  vibratoDepth: GainNode;
  secondaryOscillator: OscillatorNode;
  secondaryGain: GainNode;
  textureFilter: BiquadFilterNode;
  textureGain: GainNode;
  pulseOscillator: OscillatorNode;
  pulseDepth: GainNode;
  filter: BiquadFilterNode;
  articulation: GainNode;
  gain: GainNode;
  panner: StereoPannerNode;
  currentTimbre: TimbreName | null;
  currentFrequency: number;
  lastArticulationTime: number;
  pitchEnvelopeUntil: number;
}

interface BaseAudioFrame {
  masterVolume: number;
  monoCompatible: boolean;
}

export interface AxisVoicesAudioFrame extends BaseAudioFrame {
  mode: 'axis-voices';
  frequencies: Record<AxisKey, number>;
  levels: Record<AxisKey, number>;
  brightness: Record<AxisKey, number>;
  pulseRates: Record<AxisKey, number>;
  axes: AxisConfig[];
}

export interface SpatialAudioFrame extends BaseAudioFrame {
  mode: 'spatial';
  frequency: number;
  level: number;
  brightness: number;
  pulseRate: number;
  pan: number;
  timbre: TimbreName;
  ySignCue: boolean;
  signBlend: SignBlend;
}

export type AudioFrame = AxisVoicesAudioFrame | SpatialAudioFrame;

export interface StartSoundOptions {
  struckPreviewDurationSeconds?: number;
}

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
  private textureSource: AudioBufferSourceNode | null = null;
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

    const noiseBuffer = context.createBuffer(
      1,
      Math.max(1, Math.round(context.sampleRate * 0.35)),
      context.sampleRate,
    );
    const samples = noiseBuffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }
    const textureSource = context.createBufferSource();
    textureSource.buffer = noiseBuffer;
    textureSource.loop = true;

    for (const axis of AXES) {
      const oscillator = context.createOscillator();
      const modulator = context.createOscillator();
      const vibratoDepth = context.createGain();
      const filter = context.createBiquadFilter();
      const articulation = context.createGain();
      const gain = context.createGain();
      const panner = context.createStereoPanner();
      const secondaryOscillator = context.createOscillator();
      const secondaryGain = context.createGain();
      const textureFilter = context.createBiquadFilter();
      const textureGain = context.createGain();
      const carrierGain = context.createGain();
      const pulseOscillator = context.createOscillator();
      const pulseDepth = context.createGain();
      oscillator.frequency.value = 220;
      carrierGain.gain.value = 1;
      modulator.type = 'sine';
      modulator.frequency.value = 5;
      vibratoDepth.gain.value = 0;
      secondaryOscillator.type = 'sine';
      secondaryOscillator.frequency.value = 220;
      secondaryGain.gain.value = 0;
      filter.type = 'lowpass';
      filter.frequency.value = axis === 'x' ? 1500 : 2600;
      filter.Q.value = axis === 'x' ? 0.5 : 2.2;
      textureFilter.type = 'highpass';
      textureFilter.frequency.value = 2500;
      textureFilter.Q.value = 0.35;
      textureGain.gain.value = 0;
      pulseOscillator.type = 'sine';
      pulseOscillator.frequency.value = 1;
      pulseDepth.gain.value = 0;
      articulation.gain.value = 1;
      gain.gain.value = 0;
      oscillator
        .connect(carrierGain)
        .connect(filter)
        .connect(articulation)
        .connect(gain)
        .connect(panner)
        .connect(master);
      modulator.connect(vibratoDepth).connect(oscillator.detune);
      secondaryOscillator.connect(secondaryGain).connect(filter);
      textureSource
        .connect(textureFilter)
        .connect(textureGain)
        .connect(articulation);
      pulseOscillator.connect(pulseDepth).connect(gain.gain);
      oscillator.start();
      modulator.start();
      secondaryOscillator.start();
      pulseOscillator.start();
      this.voices.set(axis, {
        oscillator,
        carrierGain,
        modulator,
        vibratoDepth,
        secondaryOscillator,
        secondaryGain,
        textureFilter,
        textureGain,
        pulseOscillator,
        pulseDepth,
        filter,
        articulation,
        gain,
        panner,
        currentTimbre: null,
        currentFrequency: 0,
        lastArticulationTime: Number.NEGATIVE_INFINITY,
        pitchEnvelopeUntil: Number.NEGATIVE_INFINITY,
      });
    }
    textureSource.start();
    this.textureSource = textureSource;

    const progressSource = context.createBufferSource();
    const progressFilter = context.createBiquadFilter();
    const progressGain = context.createGain();
    progressSource.buffer = noiseBuffer;
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

  applyFrame(
    frame: AudioFrame,
    forceArticulation = false,
    struckPreviewDurationSeconds?: number,
  ): void {
    const context = this.context;
    if (!context) return;
    if (frame.mode === 'axis-voices') {
      const anySolo = frame.axes.some((axis) => axis.solo);
      for (const config of frame.axes) {
        const audible = !config.muted && (!anySolo || config.solo);
        const mappedLevel = Math.min(1, Math.max(0, frame.levels[config.key]));
        this.applyVoice(
          config.key,
          frame.frequencies[config.key],
          config.timbre,
          audible ? config.gain * mappedLevel * 0.34 : 0,
          frame.monoCompatible ? 0 : config.pan,
          frame.brightness[config.key],
          frame.pulseRates[config.key],
          forceArticulation,
          struckPreviewDurationSeconds,
        );
      }
    } else {
      const pan = frame.monoCompatible ? 0 : frame.pan;
      const mappedLevel = Math.min(1, Math.max(0, frame.level));
      if (frame.ySignCue) {
        this.applyVoice(
          'x',
          frame.frequency,
          'hollow',
          frame.signBlend.negativeGain * mappedLevel * 0.31,
          pan,
          frame.brightness,
          frame.pulseRate,
          forceArticulation,
          struckPreviewDurationSeconds,
        );
        this.applyVoice(
          'y',
          frame.frequency,
          'bright',
          frame.signBlend.positiveGain * mappedLevel * 0.31,
          pan,
          frame.brightness,
          frame.pulseRate,
          forceArticulation,
          struckPreviewDurationSeconds,
        );
      } else {
        this.applyVoice(
          'x',
          frame.frequency,
          frame.timbre,
          mappedLevel * 0.34,
          pan,
          frame.brightness,
          frame.pulseRate,
          forceArticulation,
          struckPreviewDurationSeconds,
        );
        this.applyVoice(
          'y',
          frame.frequency,
          frame.timbre,
          0,
          pan,
          frame.brightness,
          frame.pulseRate,
          forceArticulation,
          struckPreviewDurationSeconds,
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
    brightness: number,
    pulseRate: number,
    forceArticulation: boolean,
    struckPreviewDurationSeconds?: number,
  ): void {
    if (!this.context) return;
    const voice = this.voices.get(key);
    if (!voice) return;
    const definition = INSTRUMENTS[timbre];
    const timbreChanged = this.setTimbre(voice, timbre);
    const pitchChanged =
      voice.currentFrequency <= 0 ||
      Math.abs(1200 * Math.log2(frequency / voice.currentFrequency)) >= 25;
    this.applyArticulation(
      voice,
      definition,
      forceArticulation || timbreChanged,
      forceArticulation || timbreChanged || pitchChanged,
      frequency,
      struckPreviewDurationSeconds,
    );
    if (this.context.currentTime >= voice.pitchEnvelopeUntil) {
      voice.oscillator.frequency.setTargetAtTime(
        frequency,
        this.context.currentTime,
        PITCH_SMOOTHING_SECONDS,
      );
      voice.secondaryOscillator.frequency.setTargetAtTime(
        frequency * (definition.secondaryVoice?.frequencyRatio ?? 1),
        this.context.currentTime,
        PITCH_SMOOTHING_SECONDS,
      );
    }
    const frequencyModulation = definition.frequencyModulation;
    voice.modulator.frequency.setTargetAtTime(
      frequencyModulation
        ? frequency * frequencyModulation.frequencyRatio
        : definition.vibratoRate,
      this.context.currentTime,
      TIMBRE_CROSSFADE_SECONDS,
    );
    voice.vibratoDepth.gain.setTargetAtTime(
      frequencyModulation
        ? frequencyModulation.depthCents
        : definition.vibratoDepthCents,
      this.context.currentTime,
      TIMBRE_CROSSFADE_SECONDS,
    );
    const boundedBrightness = Math.min(2.5, Math.max(0.35, brightness));
    voice.filter.frequency.setTargetAtTime(
      Math.min(
        12_000,
        Math.max(
          80,
          instrumentFilterFrequency(definition, frequency) * boundedBrightness,
        ),
      ),
      this.context.currentTime,
      TIMBRE_CROSSFADE_SECONDS,
    );
    voice.carrierGain.gain.setTargetAtTime(
      definition.carrierGain,
      this.context.currentTime,
      TIMBRE_CROSSFADE_SECONDS,
    );
    voice.secondaryGain.gain.setTargetAtTime(
      definition.secondaryVoice?.gain ?? 0,
      this.context.currentTime,
      TIMBRE_CROSSFADE_SECONDS,
    );
    voice.textureGain.gain.setTargetAtTime(
      definition.noiseTexture?.gain ?? 0,
      this.context.currentTime,
      TIMBRE_CROSSFADE_SECONDS,
    );
    voice.currentFrequency = frequency;
    const compensatedGain = gain * definition.gainCompensation;
    const boundedPulseRate = Math.min(8, Math.max(0, pulseRate));
    const pulsing = boundedPulseRate > 0;
    voice.gain.gain.setTargetAtTime(
      compensatedGain * (pulsing ? 0.6 : 1),
      this.context.currentTime,
      TIMBRE_CROSSFADE_SECONDS,
    );
    voice.pulseOscillator.frequency.setTargetAtTime(
      pulsing ? Math.max(0.75, boundedPulseRate) : 0.75,
      this.context.currentTime,
      TIMBRE_CROSSFADE_SECONDS,
    );
    voice.pulseDepth.gain.setTargetAtTime(
      pulsing ? compensatedGain * 0.4 : 0,
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
    let wave: PeriodicWave | null = null;
    if (!definition.harmonics) {
      voice.oscillator.type = 'sine';
    } else {
      wave = this.waves.get(timbre as Exclude<TimbreName, 'pure'>) ?? null;
      if (!wave) {
        wave = waveFor(this.context, definition);
        this.waves.set(timbre as Exclude<TimbreName, 'pure'>, wave);
      }
      voice.oscillator.setPeriodicWave(wave);
    }
    if (definition.secondaryVoice?.waveform === 'same' && wave) {
      voice.secondaryOscillator.setPeriodicWave(wave);
    } else {
      voice.secondaryOscillator.type = 'sine';
    }
    voice.secondaryOscillator.detune.setTargetAtTime(
      definition.secondaryVoice?.detuneCents ?? 0,
      this.context.currentTime,
      TIMBRE_CROSSFADE_SECONDS,
    );
    voice.filter.type = definition.filterType;
    voice.filter.Q.setTargetAtTime(
      definition.resonance,
      this.context.currentTime,
      TIMBRE_CROSSFADE_SECONDS,
    );
    const texture = definition.noiseTexture;
    voice.textureFilter.type = texture?.filterType ?? 'highpass';
    voice.textureFilter.frequency.setTargetAtTime(
      texture?.filterFrequency ?? 2500,
      this.context.currentTime,
      TIMBRE_CROSSFADE_SECONDS,
    );
    voice.textureFilter.Q.setTargetAtTime(
      texture?.resonance ?? 0.35,
      this.context.currentTime,
      TIMBRE_CROSSFADE_SECONDS,
    );
    return true;
  }

  private applyArticulation(
    voice: Voice,
    definition: InstrumentDefinition,
    onset: boolean,
    strike: boolean,
    frequency: number,
    struckPreviewDurationSeconds?: number,
  ): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    const parameter = voice.articulation.gain;
    if (definition.articulation === 'sustained') {
      voice.pitchEnvelopeUntil = Number.NEGATIVE_INFINITY;
      if (!onset) return;
      parameter.cancelScheduledValues(now);
      parameter.setValueAtTime(0.0001, now);
      parameter.setTargetAtTime(1, now, definition.attackSeconds);
      return;
    }
    if (!strike || now - voice.lastArticulationTime < 0.09) return;
    voice.lastArticulationTime = now;
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(0.0001, now);
    parameter.linearRampToValueAtTime(1, now + definition.attackSeconds);
    if (struckPreviewDurationSeconds === undefined) {
      parameter.exponentialRampToValueAtTime(
        0.0001,
        now + definition.attackSeconds + definition.decaySeconds,
      );
    } else {
      const previewDuration = Math.min(
        5,
        Math.max(0.5, struckPreviewDurationSeconds),
      );
      parameter.setTargetAtTime(
        0.0001,
        now + definition.attackSeconds,
        Math.max(
          definition.decaySeconds,
          previewDuration / STRUCK_PREVIEW_DECAY_DIVISOR,
        ),
      );
    }
    if (definition.pitchDropCents <= 0) return;
    voice.oscillator.frequency.cancelScheduledValues(now);
    voice.oscillator.frequency.setValueAtTime(
      frequency * 2 ** (definition.pitchDropCents / 1200),
      now,
    );
    voice.oscillator.frequency.exponentialRampToValueAtTime(
      frequency,
      now + definition.pitchDropSeconds,
    );
    const secondaryRatio = definition.secondaryVoice?.frequencyRatio ?? 1;
    voice.secondaryOscillator.frequency.cancelScheduledValues(now);
    voice.secondaryOscillator.frequency.setValueAtTime(
      frequency * secondaryRatio * 2 ** (definition.pitchDropCents / 1200),
      now,
    );
    voice.secondaryOscillator.frequency.exponentialRampToValueAtTime(
      frequency * secondaryRatio,
      now + definition.pitchDropSeconds,
    );
    voice.pitchEnvelopeUntil = now + definition.pitchDropSeconds;
  }

  startSound(frame: AudioFrame, options: StartSoundOptions = {}): void {
    this.sounding = true;
    this.applyFrame(frame, true, options.struckPreviewDurationSeconds);
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

  releaseTestSound(): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const voice of this.voices.values()) {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0, now, 0.012);
      voice.pulseDepth.gain.cancelScheduledValues(now);
      voice.pulseDepth.gain.setTargetAtTime(0, now, 0.012);
    }
  }

  stopAllSound(fadeSeconds = STOP_FADE_SECONDS): void {
    this.sounding = false;
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    for (const voice of this.voices.values()) {
      voice.oscillator.frequency.cancelScheduledValues(now);
      voice.carrierGain.gain.cancelScheduledValues(now);
      voice.modulator.frequency.cancelScheduledValues(now);
      voice.vibratoDepth.gain.cancelScheduledValues(now);
      voice.secondaryOscillator.frequency.cancelScheduledValues(now);
      voice.secondaryOscillator.detune.cancelScheduledValues(now);
      voice.secondaryGain.gain.cancelScheduledValues(now);
      voice.textureFilter.frequency.cancelScheduledValues(now);
      voice.textureFilter.Q.cancelScheduledValues(now);
      voice.textureGain.gain.cancelScheduledValues(now);
      voice.pulseOscillator.frequency.cancelScheduledValues(now);
      voice.pulseDepth.gain.cancelScheduledValues(now);
      voice.filter.frequency.cancelScheduledValues(now);
      voice.filter.Q.cancelScheduledValues(now);
      voice.articulation.gain.cancelScheduledValues(now);
      voice.gain.gain.cancelScheduledValues(now);
      voice.panner.pan.cancelScheduledValues(now);
      voice.lastArticulationTime = Number.NEGATIVE_INFINITY;
      voice.pitchEnvelopeUntil = Number.NEGATIVE_INFINITY;
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
        voice.modulator.stop();
        voice.modulator.disconnect();
        voice.secondaryOscillator.stop();
        voice.secondaryOscillator.disconnect();
        voice.pulseOscillator.stop();
        voice.pulseOscillator.disconnect();
      } catch {
        // An already-stopped oscillator requires no further cleanup.
      }
    }
    if (this.textureSource) {
      try {
        this.textureSource.stop();
        this.textureSource.disconnect();
      } catch {
        // An already-stopped buffer source requires no further cleanup.
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
    this.textureSource = null;
    this.progressSource = null;
    this.progressGain = null;
    this.currentMasterLevel = 0;
  }
}

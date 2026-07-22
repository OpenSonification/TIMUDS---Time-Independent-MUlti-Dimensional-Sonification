import type { AxisConfig, AxisKey, TimbreName } from '../core/types';

interface Voice {
  oscillator: OscillatorNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  panner: StereoPannerNode;
  currentTimbre: TimbreName | null;
}

export interface AudioFrame {
  frequencies: Record<AxisKey, number>;
  axes: AxisConfig[];
  masterVolume: number;
  centreVoices: boolean;
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
  timbre: Exclude<TimbreName, 'pure'>,
): PeriodicWave {
  const harmonics: Record<Exclude<TimbreName, 'pure'>, number[]> = {
    warm: [0, 1, 0.46, 0.24, 0.1, 0.06],
    reed: [0, 1, 0.72, 0.38, 0.25, 0.14, 0.08],
    bright: [0, 1, 0.22, 0.42, 0.16, 0.28, 0.1, 0.18],
  };
  return context.createPeriodicWave(
    new Float32Array(harmonics[timbre].length),
    new Float32Array(harmonics[timbre]),
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
  private sounding = false;

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
      const gain = context.createGain();
      const panner = context.createStereoPanner();
      oscillator.frequency.value = 220;
      filter.type = 'lowpass';
      filter.frequency.value = axis === 'x' ? 1500 : 2600;
      filter.Q.value = axis === 'x' ? 0.5 : 2.2;
      gain.gain.value = 0;
      oscillator.connect(filter).connect(gain).connect(panner).connect(master);
      oscillator.start();
      this.voices.set(axis, {
        oscillator,
        filter,
        gain,
        panner,
        currentTimbre: null,
      });
    }
  }

  applyFrame(frame: AudioFrame): void {
    const context = this.context;
    if (!context) return;
    const anySolo = frame.axes.some((axis) => axis.solo);
    for (const config of frame.axes) {
      const voice = this.voices.get(config.key);
      if (!voice) continue;
      this.setTimbre(voice, config.timbre);
      voice.oscillator.frequency.setTargetAtTime(
        frame.frequencies[config.key],
        context.currentTime,
        0.018,
      );
      const audible = !config.muted && (!anySolo || config.solo);
      voice.gain.gain.setTargetAtTime(
        audible ? config.gain * 0.34 : 0,
        context.currentTime,
        0.02,
      );
      voice.panner.pan.setTargetAtTime(
        frame.centreVoices ? 0 : config.pan,
        context.currentTime,
        0.025,
      );
    }
    if (this.sounding) {
      this.master?.gain.setTargetAtTime(
        frame.masterVolume,
        context.currentTime,
        0.025,
      );
    }
  }

  private setTimbre(voice: Voice, timbre: TimbreName): void {
    if (!this.context) return;
    if (voice.currentTimbre === timbre) return;
    voice.currentTimbre = timbre;
    if (timbre === 'pure') {
      voice.oscillator.type = 'sine';
      voice.filter.frequency.setTargetAtTime(
        8000,
        this.context.currentTime,
        0.02,
      );
      voice.filter.Q.setTargetAtTime(0.3, this.context.currentTime, 0.02);
      return;
    }
    let wave = this.waves.get(timbre);
    if (!wave) {
      wave = waveFor(this.context, timbre);
      this.waves.set(timbre, wave);
    }
    voice.oscillator.setPeriodicWave(wave);
    const frequency =
      timbre === 'warm' ? 1500 : timbre === 'reed' ? 2600 : 4200;
    const resonance = timbre === 'reed' ? 2.2 : 0.7;
    voice.filter.frequency.setTargetAtTime(
      frequency,
      this.context.currentTime,
      0.02,
    );
    voice.filter.Q.setTargetAtTime(resonance, this.context.currentTime, 0.02);
  }

  startSound(frame: AudioFrame): void {
    this.sounding = true;
    this.applyFrame(frame);
  }

  fadeOut(): void {
    this.sounding = false;
    if (!this.context || !this.master) return;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.018);
  }

  async close(): Promise<void> {
    this.fadeOut();
    for (const voice of this.voices.values()) {
      try {
        voice.oscillator.stop();
        voice.oscillator.disconnect();
      } catch {
        // An already-stopped oscillator requires no further cleanup.
      }
    }
    this.voices.clear();
    this.waves.clear();
    if (this.context && this.context.state !== 'closed')
      await this.context.close();
    this.context = null;
    this.master = null;
  }
}

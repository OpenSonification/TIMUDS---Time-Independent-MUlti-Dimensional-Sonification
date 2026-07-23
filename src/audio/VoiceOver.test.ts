import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceOver, voiceOverSupported } from './VoiceOver';

class Utterance {
  lang = '';
  pitch = 0;
  rate = 0;
  text: string;
  voice: SpeechSynthesisVoice | null = null;
  volume = 0;

  constructor(text: string) {
    this.text = text;
  }
}

const englishVoice = {
  default: true,
  lang: 'en-GB',
  localService: true,
  name: 'Test English',
  voiceURI: 'test-english',
} as SpeechSynthesisVoice;

afterEach(() => {
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: undefined,
  });
});

describe('browser voice over', () => {
  it('speaks with an installed English voice and can cancel queued speech', () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel,
        getVoices: () => [englishVoice],
        speak,
      },
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: Utterance,
    });

    const voiceOver = new VoiceOver();
    expect(voiceOverSupported()).toBe(true);
    expect(voiceOver.speak(' Highest Y coordinate. ')).toBe(true);
    expect(speak).toHaveBeenCalledOnce();
    expect(speak.mock.calls[0]?.[0]).toMatchObject({
      text: 'Highest Y coordinate.',
      lang: 'en-GB',
      voice: englishVoice,
      rate: 0.95,
      volume: 0.9,
    });

    voiceOver.cancel();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('stays silent when browser speech is unavailable', () => {
    expect(voiceOverSupported()).toBe(false);
    expect(new VoiceOver().speak('Highest Y coordinate.')).toBe(false);
  });
});

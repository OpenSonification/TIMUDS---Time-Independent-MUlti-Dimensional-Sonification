function browserSpeech():
  | {
      synthesis: SpeechSynthesis;
      Utterance: typeof SpeechSynthesisUtterance;
    }
  | undefined {
  if (
    typeof window === 'undefined' ||
    !window.speechSynthesis ||
    typeof window.SpeechSynthesisUtterance !== 'function'
  )
    return undefined;
  return {
    synthesis: window.speechSynthesis,
    Utterance: window.SpeechSynthesisUtterance,
  };
}

function preferredEnglishVoice(
  voices: readonly SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  return (
    voices.find(({ lang }) => lang.toLowerCase() === 'en-gb') ??
    voices.find(({ lang }) => lang.toLowerCase().startsWith('en-')) ??
    voices.find(({ lang }) => lang.toLowerCase().startsWith('en')) ??
    null
  );
}

export function voiceOverSupported(): boolean {
  return browserSpeech() !== undefined;
}

export class VoiceOver {
  private activeUtterances = new Set<SpeechSynthesisUtterance>();

  speak(message: string): boolean {
    const speech = browserSpeech();
    const text = message.trim();
    if (!speech || !text) return false;

    let utterance: SpeechSynthesisUtterance | undefined;
    try {
      const currentUtterance = new speech.Utterance(text);
      utterance = currentUtterance;
      const voice = preferredEnglishVoice(speech.synthesis.getVoices());
      currentUtterance.lang = voice?.lang ?? 'en-GB';
      currentUtterance.voice = voice;
      currentUtterance.rate = 0.95;
      currentUtterance.pitch = 1;
      currentUtterance.volume = 0.9;
      const release = () => this.activeUtterances.delete(currentUtterance);
      currentUtterance.onend = release;
      currentUtterance.onerror = release;
      this.activeUtterances.add(currentUtterance);
      speech.synthesis.speak(currentUtterance);
      return true;
    } catch {
      if (utterance) this.activeUtterances.delete(utterance);
      return false;
    }
  }

  cancel(): void {
    try {
      browserSpeech()?.synthesis.cancel();
    } catch {
      // Browser speech may disappear during page teardown.
    } finally {
      this.activeUtterances.clear();
    }
  }
}

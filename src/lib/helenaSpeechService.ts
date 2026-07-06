export interface HelenaSpeechOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: SpeechSynthesisErrorEvent) => void;
}

const DEFAULT_OPTIONS: Required<Pick<HelenaSpeechOptions, "lang" | "rate" | "pitch" | "volume">> = {
  lang: "pt-BR",
  rate: 1,
  pitch: 1,
  volume: 1,
};

export class HelenaSpeechService {
  isSupported() {
    return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  }

  speak(text: string, options: HelenaSpeechOptions = {}) {
    if (!this.isSupported()) {
      throw new Error("Text-to-Speech não é suportado neste navegador.");
    }

    const content = this.prepareTextForSpeech(text);
    if (!content) return;

    this.stop();

    const utterance = new SpeechSynthesisUtterance(content);
    const merged = { ...DEFAULT_OPTIONS, ...options };
    utterance.lang = merged.lang;
    utterance.rate = merged.rate;
    utterance.pitch = merged.pitch;
    utterance.volume = merged.volume;

    const voice = this.pickVoice(merged.lang);
    if (voice) utterance.voice = voice;

    utterance.onstart = () => options.onStart?.();
    utterance.onend = () => options.onEnd?.();
    utterance.onerror = (event) => options.onError?.(event);

    window.speechSynthesis.speak(utterance);
  }

  stop() {
    if (!this.isSupported()) return;
    window.speechSynthesis.cancel();
  }

  pause() {
    if (!this.isSupported()) return;
    window.speechSynthesis.pause();
  }

  resume() {
    if (!this.isSupported()) return;
    window.speechSynthesis.resume();
  }

  prepareTextForSpeech(text: string) {
    return text
      .replace(/```action[\s\S]*?```/g, "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[#>*_`~|-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private pickVoice(lang: string) {
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((voice) => voice.lang === lang) ||
      voices.find((voice) => voice.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase())) ||
      null
    );
  }
}

export const helenaSpeechService = new HelenaSpeechService();

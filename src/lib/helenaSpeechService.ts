import { getFunctionAuthHeaders } from "@/lib/functionAuth";

export interface HelenaSpeechOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

const DEFAULT_OPTIONS: Required<Pick<HelenaSpeechOptions, "lang" | "rate" | "pitch" | "volume">> = {
  lang: "pt-BR",
  rate: 1,
  pitch: 1,
  volume: 1,
};

export class HelenaSpeechService {
  private currentAudio: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;

  isSupported() {
    return this.isRemoteAudioSupported() || this.isBrowserSpeechSupported();
  }

  async speak(text: string, options: HelenaSpeechOptions = {}) {
    if (!this.isSupported()) {
      throw new Error("Text-to-Speech não é suportado neste navegador.");
    }

    const content = this.prepareTextForSpeech(text);
    if (!content) return;

    this.stop();

    try {
      await this.speakWithElevenLabs(content, options);
      return;
    } catch {
      this.stopRemoteAudio();
      if (!this.isBrowserSpeechSupported()) {
        throw new Error("Text-to-Speech não é suportado neste navegador.");
      }
    }

    this.speakWithBrowser(content, options);
  }

  stop() {
    this.stopRemoteAudio();
    if (this.isBrowserSpeechSupported()) {
      window.speechSynthesis.cancel();
    }
  }

  pause() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      return;
    }
    if (this.isBrowserSpeechSupported()) {
      window.speechSynthesis.pause();
    }
  }

  resume() {
    if (this.currentAudio) {
      void this.currentAudio.play();
      return;
    }
    if (this.isBrowserSpeechSupported()) {
      window.speechSynthesis.resume();
    }
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

  private async speakWithElevenLabs(content: string, options: HelenaSpeechOptions) {
    if (!this.isRemoteAudioSupported()) {
      throw new Error("Reprodução de áudio remoto não é suportada neste navegador.");
    }

    const headers = await getFunctionAuthHeaders();
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/helena-tts`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text: content }),
    });

    if (!response.ok) {
      const error = await this.readFunctionError(response);
      throw new Error(error || "ElevenLabs não conseguiu gerar o áudio.");
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.volume = options.volume ?? DEFAULT_OPTIONS.volume;

    this.currentAudio = audio;
    this.currentAudioUrl = audioUrl;

    audio.onplay = () => options.onStart?.();
    audio.onended = () => {
      this.releaseRemoteAudio(audio);
      options.onEnd?.();
    };
    audio.onerror = () => {
      this.releaseRemoteAudio(audio);
      options.onError?.("Erro ao reproduzir áudio da Helena.");
    };

    try {
      await audio.play();
    } catch (error) {
      this.releaseRemoteAudio(audio);
      throw error;
    }
  }

  private speakWithBrowser(content: string, options: HelenaSpeechOptions) {
    if (!this.isBrowserSpeechSupported()) {
      throw new Error("Text-to-Speech não é suportado neste navegador.");
    }

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
    utterance.onerror = (event) => options.onError?.(event.error || "Erro ao reproduzir resposta em voz.");

    window.speechSynthesis.speak(utterance);
  }

  private isBrowserSpeechSupported() {
    return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  }

  private isRemoteAudioSupported() {
    return typeof window !== "undefined" && typeof Audio !== "undefined" && typeof URL !== "undefined";
  }

  private stopRemoteAudio() {
    if (!this.currentAudio) return;

    this.currentAudio.pause();
    this.currentAudio.currentTime = 0;
    this.releaseRemoteAudio(this.currentAudio);
  }

  private releaseRemoteAudio(audio: HTMLAudioElement) {
    if (this.currentAudio === audio) {
      this.currentAudio = null;
    }
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
  }

  private async readFunctionError(response: Response) {
    try {
      const data = await response.json();
      return typeof data?.error === "string" ? data.error : "";
    } catch {
      return "";
    }
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

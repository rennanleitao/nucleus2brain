import { useCallback, useEffect, useMemo, useState } from "react";
import { helenaSpeechService } from "@/lib/helenaSpeechService";

const AUTO_SPEAK_KEY = "nucleus.helena.autoSpeak";

export function useHelenaSpeech() {
  const service = useMemo(() => helenaSpeechService, []);
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [autoSpeak, setAutoSpeakState] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(AUTO_SPEAK_KEY) === "true";
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsSupported(service.isSupported());
  }, [service]);

  const setAutoSpeak = useCallback((enabled: boolean) => {
    setAutoSpeakState(enabled);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTO_SPEAK_KEY, String(enabled));
    }
  }, []);

  const stop = useCallback(() => {
    service.stop();
    setIsSpeaking(false);
    setIsPaused(false);
  }, [service]);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    setError(null);
    try {
      service.speak(text, {
        onStart: () => {
          setIsSpeaking(true);
          setIsPaused(false);
        },
        onEnd: () => {
          setIsSpeaking(false);
          setIsPaused(false);
          onEnd?.();
        },
        onError: (event) => {
          setIsSpeaking(false);
          setIsPaused(false);
          setError(event.error || "Erro ao reproduzir resposta em voz.");
          onEnd?.();
        },
      });
    } catch (err) {
      setIsSpeaking(false);
      setIsPaused(false);
      setError(err instanceof Error ? err.message : "Text-to-Speech não está disponível.");
      onEnd?.();
    }
  }, [service]);

  const pause = useCallback(() => {
    service.pause();
    setIsPaused(true);
  }, [service]);

  const resume = useCallback(() => {
    service.resume();
    setIsPaused(false);
  }, [service]);

  useEffect(() => {
    return () => service.stop();
  }, [service]);

  return {
    isSupported,
    isSpeaking,
    isPaused,
    autoSpeak,
    error,
    speak,
    stop,
    pause,
    resume,
    setAutoSpeak,
  };
}

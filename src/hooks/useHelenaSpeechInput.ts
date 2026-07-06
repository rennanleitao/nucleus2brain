import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionConstructor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function useHelenaSpeechInput() {
  const recognitionRef = useRef<InstanceType<SpeechRecognitionConstructor> | null>(null);
  const finalTranscriptRef = useRef("");
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsSupported(Boolean(getSpeechRecognition()));
  }, []);

  const resetTranscript = useCallback(() => {
    finalTranscriptRef.current = "";
    setTranscript("");
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    return transcript.trim();
  }, [transcript]);

  const abort = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setError("Este navegador não suporta entrada de voz.");
      return false;
    }

    abort();
    resetTranscript();
    setError(null);

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript || "";
        if (result.isFinal) finalTranscriptRef.current += `${text} `;
        else interim += text;
      }
      setTranscript(`${finalTranscriptRef.current}${interim}`.trim());
    };

    recognition.onerror = (event: any) => {
      if (event.error === "aborted") return;
      setError(`Erro na entrada de voz: ${event.error || "desconhecido"}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    return true;
  }, [abort, resetTranscript]);

  useEffect(() => {
    return () => abort();
  }, [abort]);

  return {
    isSupported,
    isListening,
    transcript,
    error,
    start,
    stop,
    abort,
    resetTranscript,
  };
}

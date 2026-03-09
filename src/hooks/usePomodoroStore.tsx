import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react";

// Generate alpha wave binaural beats using Web Audio API
function createAlphaWavesNode(audioCtx: AudioContext): { start: () => void; stop: () => void } {
  const baseFreq = 200;
  const alphaFreq = 10; // 10Hz alpha wave
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = 0.15;
  gainNode.connect(audioCtx.destination);

  const oscLeft = audioCtx.createOscillator();
  const oscRight = audioCtx.createOscillator();
  oscLeft.type = "sine";
  oscRight.type = "sine";
  oscLeft.frequency.value = baseFreq;
  oscRight.frequency.value = baseFreq + alphaFreq;

  const panLeft = audioCtx.createStereoPanner();
  const panRight = audioCtx.createStereoPanner();
  panLeft.pan.value = -1;
  panRight.pan.value = 1;

  oscLeft.connect(panLeft).connect(gainNode);
  oscRight.connect(panRight).connect(gainNode);

  // Add pink noise for ambience
  const bufferSize = audioCtx.sampleRate * 2;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  const noiseNode = audioCtx.createBufferSource();
  noiseNode.buffer = noiseBuffer;
  noiseNode.loop = true;
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.value = 0.08;
  noiseNode.connect(noiseGain).connect(audioCtx.destination);

  return {
    start: () => { oscLeft.start(); oscRight.start(); noiseNode.start(); },
    stop: () => { oscLeft.stop(); oscRight.stop(); noiseNode.stop(); },
  };
}

type PomodoroPhase = "focus" | "break" | "idle";

interface PomodoroState {
  phase: PomodoroPhase;
  secondsLeft: number;
  totalSeconds: number;
  isRunning: boolean;
  taskId: string | null;
  taskTitle: string | null;
  focusMinutes: number;
  breakMinutes: number;
  sessionsCompleted: number;
  alphaWaves: boolean;
  startFocus: (taskId?: string, taskTitle?: string) => void;
  startBreak: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setFocusMinutes: (m: number) => void;
  setBreakMinutes: (m: number) => void;
  toggleAlphaWaves: () => void;
}

const PomodoroContext = createContext<PomodoroState | null>(null);

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<PomodoroPhase>("idle");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState<string | null>(null);
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [alphaWaves, setAlphaWaves] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const alphaNodeRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    setSecondsLeft(prev => {
      if (prev <= 1) {
        clearTimer();
        setIsRunning(false);
        // Play notification sound
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(phase === "focus" ? "⏰ Foco finalizado!" : "☕ Pausa finalizada!", {
            body: phase === "focus" ? "Hora de descansar!" : "Volte ao foco!",
            icon: "/pwa-192x192.png",
          });
        }
        if (phase === "focus") {
          setSessionsCompleted(s => s + 1);
        }
        setPhase("idle");
        return 0;
      }
      return prev - 1;
    });
  }, [clearTimer, phase]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(tick, 1000);
    }
    return clearTimer;
  }, [isRunning, tick, clearTimer]);

  // Alpha waves audio
  useEffect(() => {
    if (alphaWaves && isRunning && phase === "focus") {
      if (!audioRef.current) {
        audioRef.current = new Audio("https://cdn.pixabay.com/audio/2024/11/26/audio_d60e55d74c.mp3");
        audioRef.current.loop = true;
        audioRef.current.volume = 0.3;
      }
      audioRef.current.play().catch(() => {});
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
    return () => {
      if (audioRef.current && (!isRunning || phase !== "focus" || !alphaWaves)) {
        audioRef.current.pause();
      }
    };
  }, [alphaWaves, isRunning, phase]);

  const startFocus = useCallback((tId?: string, tTitle?: string) => {
    clearTimer();
    const secs = focusMinutes * 60;
    setPhase("focus");
    setSecondsLeft(secs);
    setTotalSeconds(secs);
    setIsRunning(true);
    setTaskId(tId || null);
    setTaskTitle(tTitle || null);
  }, [focusMinutes, clearTimer]);

  const startBreak = useCallback(() => {
    clearTimer();
    const secs = breakMinutes * 60;
    setPhase("break");
    setSecondsLeft(secs);
    setTotalSeconds(secs);
    setIsRunning(true);
    setTaskId(null);
    setTaskTitle(null);
  }, [breakMinutes, clearTimer]);

  const pause = useCallback(() => setIsRunning(false), []);
  const resume = useCallback(() => setIsRunning(true), []);
  const reset = useCallback(() => {
    clearTimer();
    setPhase("idle");
    setSecondsLeft(0);
    setTotalSeconds(0);
    setIsRunning(false);
    setTaskId(null);
    setTaskTitle(null);
    if (audioRef.current) audioRef.current.pause();
  }, [clearTimer]);

  const toggleAlphaWaves = useCallback(() => setAlphaWaves(a => !a), []);

  return (
    <PomodoroContext.Provider value={{
      phase, secondsLeft, totalSeconds, isRunning, taskId, taskTitle,
      focusMinutes, breakMinutes, sessionsCompleted, alphaWaves,
      startFocus, startBreak, pause, resume, reset,
      setFocusMinutes, setBreakMinutes, toggleAlphaWaves,
    }}>
      {children}
    </PomodoroContext.Provider>
  );
}

export function usePomodoro() {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error("usePomodoro must be used within PomodoroProvider");
  return ctx;
}

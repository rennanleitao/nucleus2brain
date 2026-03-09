import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react";

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
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

import { useState, useEffect, useRef } from "react";
import { Play, Square, Timer, Clock, Zap } from "lucide-react";
import { startTimeEntry, stopTimeEntry, fetchRunningTimeEntries, fetchTimeEntries } from "@/lib/api";
import { usePomodoro } from "@/hooks/usePomodoroStore";
import { toast } from "sonner";

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

export function formatTotalTime(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface TaskTimerProps {
  taskId: string;
  taskTitle?: string;
  compact?: boolean;
}

export function TaskTimer({ taskId, taskTitle, compact = true }: TaskTimerProps) {
  const [running, setRunning] = useState<{ id: string; started_at: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [totalLogged, setTotalLogged] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pomodoro = usePomodoro();

  useEffect(() => {
    const load = async () => {
      try {
        const [entries, runningEntries] = await Promise.all([
          fetchTimeEntries(taskId),
          fetchRunningTimeEntries(),
        ]);
        const active = runningEntries.find((e: any) => e.task_id === taskId);
        if (active) setRunning(active);
        const total = (entries || [])
          .filter((e: any) => e.duration_seconds)
          .reduce((sum: number, e: any) => sum + e.duration_seconds, 0);
        setTotalLogged(total);
      } catch {}
    };
    load();
  }, [taskId]);

  useEffect(() => {
    if (running) {
      const update = () => {
        const diff = Math.round((Date.now() - new Date(running.started_at).getTime()) / 1000);
        setElapsed(diff);
      };
      update();
      intervalRef.current = setInterval(update, 1000);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    } else {
      setElapsed(0);
    }
  }, [running]);

  // Close menu on click outside
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const handleStartTimer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    try {
      const entry = await startTimeEntry(taskId);
      setRunning(entry);
      toast.success("Timer iniciado");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleStartPomodoro = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    try {
      const entry = await startTimeEntry(taskId);
      setRunning(entry);
      pomodoro.startFocus(taskId, taskTitle || "Task");
      toast.success("Pomodoro iniciado");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleStop = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!running) return;
    try {
      const entry = await stopTimeEntry(running.id);
      setTotalLogged(prev => prev + (entry.duration_seconds || 0));
      setRunning(null);
      // If pomodoro is running for this task, also reset it
      if (pomodoro.taskId === taskId && pomodoro.isRunning) {
        pomodoro.reset();
      }
      toast.success("Timer parado");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(prev => !prev);
  };

  if (compact) {
    return (
      <div className="relative flex items-center gap-1" onClick={e => e.stopPropagation()} ref={menuRef}>
        {totalLogged > 0 && !running && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Timer className="h-2.5 w-2.5" />
            {formatTotalTime(totalLogged)}
          </span>
        )}
        {running ? (
          <button onClick={handleStop} className="flex items-center gap-1 text-destructive hover:text-destructive/80 transition-colors" title="Parar timer">
            <Square className="h-3 w-3 fill-current" />
            <span className="text-[10px] font-mono tabular-nums">{formatDuration(elapsed)}</span>
          </button>
        ) : (
          <>
            <button onClick={handlePlayClick} className="text-muted-foreground hover:text-primary transition-colors" title="Iniciar">
              <Play className="h-3 w-3" />
            </button>
            {showMenu && (
              <div className="absolute bottom-full right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg z-30 min-w-[160px] py-1 animate-fade-in">
                <button
                  onClick={handleStartTimer}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors text-left"
                >
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Contabilizar tempo</span>
                </button>
                <button
                  onClick={handleStartPomodoro}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors text-left"
                >
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <span>Iniciar Pomodoro</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return null;
}

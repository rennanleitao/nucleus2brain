import { useState, useEffect, useRef } from "react";
import { Play, Square, Timer } from "lucide-react";
import { startTimeEntry, stopTimeEntry, fetchRunningTimeEntries, fetchTimeEntries } from "@/lib/api";
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
  compact?: boolean;
}

export function TaskTimer({ taskId, compact = true }: TaskTimerProps) {
  const [running, setRunning] = useState<{ id: string; started_at: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [totalLogged, setTotalLogged] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [entries, runningEntries] = await Promise.all([
          fetchTimeEntries(taskId),
          fetchRunningTimeEntries(),
        ]);
        const active = runningEntries.find((e: any) => e.task_id === taskId);
        if (active) {
          setRunning(active);
        }
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

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const entry = await startTimeEntry(taskId);
      setRunning(entry);
      toast.success("Timer iniciado");
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
      toast.success("Timer parado");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
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
          <button onClick={handleStart} className="text-muted-foreground hover:text-primary transition-colors" title="Iniciar timer">
            <Play className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  return null;
}

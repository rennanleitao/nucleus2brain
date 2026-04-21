import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Calendar as CalIcon, ListChecks, Bell, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createTask, fetchSpaces } from "@/lib/api";

interface Props {
  date: Date;
  defaultTime?: string;
  trigger: React.ReactNode;
  onCreated?: () => void;
  /** Called to create a Google Calendar event */
  onCreateEvent: (payload: { summary: string; date: string; startTime: string; endTime: string; description?: string; location?: string }) => Promise<void>;
}

export function QuickCreatePopover({ date, defaultTime, trigger, onCreated, onCreateEvent }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"event" | "task" | "reminder">("event");
  const [loading, setLoading] = useState(false);
  const dateStr = format(date, "yyyy-MM-dd");
  const initialTime = defaultTime || "09:00";

  // Event state
  const [evTitle, setEvTitle] = useState("");
  const [evStart, setEvStart] = useState(initialTime);
  const [evEnd, setEvEnd] = useState("10:00");
  const [evLocation, setEvLocation] = useState("");

  // Task state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [taskSpaceId, setTaskSpaceId] = useState<string>("");
  const [spaces, setSpaces] = useState<{ id: string; name: string }[]>([]);

  // Reminder state
  const [remTitle, setRemTitle] = useState("");
  const [remTime, setRemTime] = useState(initialTime);
  const [remTaskId, setRemTaskId] = useState<string>("");
  const [openTasks, setOpenTasks] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    fetchSpaces().then((s) => setSpaces(s as any)).catch(() => {});
    supabase
      .from("tasks")
      .select("id, title")
      .neq("status", "completed")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setOpenTasks((data as any) || []));
  }, [open]);

  useEffect(() => {
    if (defaultTime) {
      setEvStart(defaultTime);
      setRemTime(defaultTime);
      // auto end = start + 1h
      const [h, m] = defaultTime.split(":").map(Number);
      const endH = (h + 1) % 24;
      setEvEnd(`${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }, [defaultTime]);

  const reset = () => {
    setEvTitle(""); setEvLocation("");
    setTaskTitle(""); setTaskPriority("medium"); setTaskSpaceId("");
    setRemTitle(""); setRemTaskId("");
  };

  const handleCreateEvent = async () => {
    if (!evTitle.trim()) { toast.error("Adicione um título"); return; }
    setLoading(true);
    try {
      await onCreateEvent({
        summary: evTitle.trim(),
        date: dateStr,
        startTime: evStart,
        endTime: evEnd,
        location: evLocation.trim() || undefined,
      });
      reset();
      setOpen(false);
      onCreated?.();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar evento");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) { toast.error("Adicione um título"); return; }
    setLoading(true);
    try {
      await createTask({
        title: taskTitle.trim(),
        priority: taskPriority,
        status: "in_progress" as any,
        due_date: dateStr,
        space_id: taskSpaceId || null,
      } as any);
      toast.success("Task criada!");
      reset();
      setOpen(false);
      onCreated?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReminder = async () => {
    if (!remTaskId) { toast.error("Selecione uma task"); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const reminderTime = new Date(`${dateStr}T${remTime}:00`).toISOString();
      const { error } = await supabase
        .from("reminders")
        .insert({ user_id: user.id, task_id: remTaskId, reminder_time: reminderTime });
      if (error) throw error;
      toast.success("Lembrete criado!");
      reset();
      setOpen(false);
      onCreated?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="px-3 py-2 border-b border-border">
          <p className="text-xs text-muted-foreground">{format(date, "EEEE, d MMM yyyy")}</p>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3 rounded-none border-b border-border bg-transparent h-9">
            <TabsTrigger value="event" className="text-xs gap-1"><CalIcon className="h-3 w-3" />Evento</TabsTrigger>
            <TabsTrigger value="task" className="text-xs gap-1"><ListChecks className="h-3 w-3" />Task</TabsTrigger>
            <TabsTrigger value="reminder" className="text-xs gap-1"><Bell className="h-3 w-3" />Lembrete</TabsTrigger>
          </TabsList>

          <TabsContent value="event" className="p-3 space-y-2 mt-0">
            <Input placeholder="Título do evento" value={evTitle} onChange={(e) => setEvTitle(e.target.value)} className="h-9" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Início</Label>
                <Input type="time" value={evStart} onChange={(e) => setEvStart(e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Fim</Label>
                <Input type="time" value={evEnd} onChange={(e) => setEvEnd(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <Input placeholder="Local (opcional)" value={evLocation} onChange={(e) => setEvLocation(e.target.value)} className="h-8 text-xs" />
            <Button onClick={handleCreateEvent} disabled={loading} size="sm" className="w-full gradient-primary text-primary-foreground">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Plus className="h-3 w-3 mr-1" />Criar evento</>}
            </Button>
          </TabsContent>

          <TabsContent value="task" className="p-3 space-y-2 mt-0">
            <Input placeholder="Título da task" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="h-9" />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as any)}
                className="h-8 text-xs bg-background border border-input rounded-md px-2"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
              <select
                value={taskSpaceId}
                onChange={(e) => setTaskSpaceId(e.target.value)}
                className="h-8 text-xs bg-background border border-input rounded-md px-2"
              >
                <option value="">Sem space</option>
                {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <Button onClick={handleCreateTask} disabled={loading} size="sm" className="w-full gradient-primary text-primary-foreground">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Plus className="h-3 w-3 mr-1" />Criar task</>}
            </Button>
          </TabsContent>

          <TabsContent value="reminder" className="p-3 space-y-2 mt-0">
            <select
              value={remTaskId}
              onChange={(e) => setRemTaskId(e.target.value)}
              className="w-full h-9 text-sm bg-background border border-input rounded-md px-2"
            >
              <option value="">Selecione uma task...</option>
              {openTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <div>
              <Label className="text-[10px] text-muted-foreground">Horário</Label>
              <Input type="time" value={remTime} onChange={(e) => setRemTime(e.target.value)} className="h-8 text-xs" />
            </div>
            <Button onClick={handleCreateReminder} disabled={loading || !remTaskId} size="sm" className="w-full gradient-primary text-primary-foreground">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Plus className="h-3 w-3 mr-1" />Criar lembrete</>}
            </Button>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

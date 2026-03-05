import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { updateTask } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell } from "lucide-react";

interface EditTaskDialogProps {
  task: {
    id: string;
    title: string;
    description?: string | null;
    priority: "low" | "medium" | "high";
    status: "todo" | "in_progress" | "waiting" | "completed" | "cancelled";
    due_date?: string | null;
    space_id?: string | null;
  };
  spaces: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function EditTaskDialog({ task, spaces, open, onOpenChange, onUpdated }: EditTaskDialogProps) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState(task.priority);
  const [status, setStatus] = useState(task.status);
  const [dueDate, setDueDate] = useState(task.due_date || "");
  const [spaceId, setSpaceId] = useState(task.space_id || "");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [existingReminder, setExistingReminder] = useState<any>(null);

  useEffect(() => {
    // Load existing reminder for this task
    const loadReminder = async () => {
      const { data } = await supabase
        .from("reminders")
        .select("*")
        .eq("task_id", task.id)
        .eq("sent", false)
        .maybeSingle();
      if (data) {
        setExistingReminder(data);
        const dt = new Date(data.reminder_time);
        setReminderDate(dt.toISOString().split("T")[0]);
        setReminderTime(dt.toTimeString().slice(0, 5));
      }
    };
    loadReminder();
  }, [task.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await updateTask(task.id, {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status,
        due_date: dueDate || null,
        space_id: spaceId || null,
        completed_at: status === "completed" ? new Date().toISOString() : null,
      });

      // Handle reminder
      if (reminderDate && reminderTime) {
        const reminderDatetime = new Date(`${reminderDate}T${reminderTime}`).toISOString();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          if (existingReminder) {
            await supabase.from("reminders").update({ reminder_time: reminderDatetime }).eq("id", existingReminder.id);
          } else {
            await supabase.from("reminders").insert({
              user_id: user.id,
              task_id: task.id,
              reminder_time: reminderDatetime,
            });
          }
        }
      } else if (existingReminder && !reminderDate) {
        // Remove reminder if cleared
        await supabase.from("reminders").delete().eq("id", existingReminder.id);
      }

      toast.success("Task atualizada!");
      onOpenChange(false);
      onUpdated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Editar Task</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" placeholder="Título da task" value={title} onChange={e => setTitle(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" required />
          <textarea placeholder="Descrição" value={description} onChange={e => setDescription(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary h-20 resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Prioridade</label>
              <select value={priority} onChange={e => setPriority(e.target.value as any)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as any)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="todo">A Fazer</option><option value="in_progress">Em Progresso</option>
                <option value="waiting">Aguardando</option><option value="completed">Concluída</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Space</label>
              <select value={spaceId} onChange={e => setSpaceId(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="">Sem space</option>
                {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data limite</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>
          </div>

          {/* Reminder */}
          <div className="border border-border rounded-lg p-3 space-y-2">
            <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <Bell className="h-3 w-3" /> Lembrete
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-primary" />
              <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-primary" />
            </div>
            {existingReminder && (
              <button type="button" onClick={() => { setReminderDate(""); setReminderTime(""); }}
                className="text-[10px] text-destructive hover:underline">
                Remover lembrete
              </button>
            )}
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

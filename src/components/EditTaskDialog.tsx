import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { updateTask, fetchAllTags, fetchSubtasks, createSubtask, updateSubtask, deleteSubtask } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, Tag, X, Search, ChevronDown, Plus, CheckCircle2, Circle, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function getBrtToday() {
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return brt.toISOString().split("T")[0];
}

function getBrtTomorrow() {
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  brt.setDate(brt.getDate() + 1);
  return brt.toISOString().split("T")[0];
}

function SpaceLetterAvatar({ name }: { name: string }) {
  return (
    <span className="flex items-center justify-center h-5 w-5 rounded bg-muted text-[10px] font-semibold text-foreground shrink-0 uppercase">
      {name.charAt(0)}
    </span>
  );
}

function SpaceComboboxEdit({ spaces, spaceId, onSelect }: { spaces: { id: string; name: string }[]; spaceId: string; onSelect: (id: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const sorted = useMemo(() => [...spaces].sort((a, b) => a.name.localeCompare(b.name)), [spaces]);
  const filtered = sorted.filter(s => !query || s.name.toLowerCase().includes(query.toLowerCase()));
  const selected = spaces.find(s => s.id === spaceId);

  return (
    <div className="relative">
      <button type="button" onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none hover:border-foreground/30 transition-colors text-left">
        {selected ? (<><SpaceLetterAvatar name={selected.name} /><span className="truncate">{selected.name}</span></>) : (
          <span className="text-muted-foreground">Sem space</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
      </button>
      {isOpen && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-2.5 py-2 border-b border-border">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input type="text" placeholder="Buscar space..." value={query} onChange={e => setQuery(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" autoFocus />
          </div>
          <div className="max-h-40 overflow-y-auto">
            <button type="button" onClick={() => { onSelect(""); setIsOpen(false); setQuery(""); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors text-left ${!spaceId ? "bg-accent" : ""}`}>
              <span className="text-muted-foreground">Sem space</span>
            </button>
            {filtered.map(s => (
              <button key={s.id} type="button" onClick={() => { onSelect(s.id); setIsOpen(false); setQuery(""); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors text-left ${spaceId === s.id ? "bg-accent" : ""}`}>
                <SpaceLetterAvatar name={s.name} />
                <span className="truncate">{s.name}</span>
              </button>
            ))}
            {filtered.length === 0 && query && <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum space encontrado</p>}
          </div>
        </div>
      )}
    </div>
  );
}

interface EditTaskDialogProps {
  task: {
    id: string;
    title: string;
    description?: string | null;
    priority: "low" | "medium" | "high";
    status: "todo" | "in_progress" | "waiting" | "completed" | "cancelled";
    due_date?: string | null;
    space_id?: string | null;
    tag?: string | null;
    estimated_minutes?: number | null;
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
  const [tag, setTag] = useState(task.tag || "");
  const [tagInput, setTagInput] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [existingReminder, setExistingReminder] = useState<any>(null);

  // Subtasks state
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskDate, setNewSubtaskDate] = useState("");

  useEffect(() => {
    if (open) {
      fetchAllTags().then(setAllTags).catch(() => {});
      fetchSubtasks(task.id).then(setSubtasks).catch(() => {});
    }
  }, [open, task.id]);

  useEffect(() => {
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

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    if (newSubtaskDate && dueDate && newSubtaskDate > dueDate) {
      toast.error("Data da subtask não pode ser posterior à data da task");
      return;
    }
    try {
      await createSubtask({ task_id: task.id, title: newSubtaskTitle.trim(), due_date: newSubtaskDate || null });
      const updated = await fetchSubtasks(task.id);
      setSubtasks(updated);
      setNewSubtaskTitle("");
      setNewSubtaskDate("");
      toast.success("Subtask adicionada");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleSubtask = async (subId: string) => {
    const sub = subtasks.find(s => s.id === subId);
    if (!sub) return;
    const newStatus = sub.status === "completed" ? "todo" : "completed";
    try {
      await updateSubtask(subId, { status: newStatus, completed_at: newStatus === "completed" ? new Date().toISOString() : null });
      const updated = await fetchSubtasks(task.id);
      setSubtasks(updated);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteSubtask = async (subId: string) => {
    try {
      await deleteSubtask(subId);
      setSubtasks(prev => prev.filter(s => s.id !== subId));
      toast.success("Subtask removida");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

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
        tag: tag || null,
      } as any);

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

  const todayStr = getBrtToday();
  const tomorrowStr = getBrtTomorrow();
  const filteredTags = allTags.filter(t => !tagInput || t.toLowerCase().includes(tagInput.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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
              <SpaceComboboxEdit spaces={spaces} spaceId={spaceId} onSelect={setSpaceId} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data limite</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
              <div className="flex gap-1 mt-1">
                <button type="button" onClick={() => setDueDate(todayStr)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${dueDate === todayStr ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"}`}>
                  Hoje
                </button>
                <button type="button" onClick={() => setDueDate(tomorrowStr)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${dueDate === tomorrowStr ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"}`}>
                  Amanhã
                </button>
              </div>
            </div>
          </div>

          {/* Tag selector */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Tag className="h-3 w-3" /> Tag (opcional)
            </label>
            {tag ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">#{tag}</Badge>
                <button type="button" onClick={() => setTag("")} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar ou criar tag..."
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onFocus={() => setShowTagPicker(true)}
                  onBlur={() => setTimeout(() => setShowTagPicker(false), 150)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && tagInput.trim()) {
                      e.preventDefault();
                      setTag(tagInput.trim().replace(/^#/, ""));
                      setTagInput("");
                      setShowTagPicker(false);
                    }
                  }}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                />
                {showTagPicker && filteredTags.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-32 overflow-y-auto">
                    {filteredTags.map(t => (
                      <button key={t} type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { setTag(t); setTagInput(""); setShowTagPicker(false); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors">
                        #{t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Subtasks */}
          <div className="border border-border rounded-lg p-3 space-y-2">
            <label className="text-xs text-muted-foreground font-medium">Subtasks</label>
            {subtasks.length > 0 && (
              <div className="space-y-1 ml-1 border-l border-border pl-2">
                {subtasks.map(sub => (
                  <div key={sub.id} className="flex items-center gap-2 py-0.5">
                    <button type="button" onClick={() => handleToggleSubtask(sub.id)}
                      className={`flex-shrink-0 transition-colors ${sub.status === "completed" ? "text-muted-foreground" : "text-muted-foreground hover:text-primary"}`}>
                      {sub.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    </button>
                    <span className={`text-xs flex-1 truncate ${sub.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                      {sub.title}
                    </span>
                    {sub.due_date && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <CalendarDays className="h-2.5 w-2.5" />
                        {sub.due_date}
                      </span>
                    )}
                    <button type="button" onClick={() => handleDeleteSubtask(sub.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Nova subtask..."
                value={newSubtaskTitle}
                onChange={e => setNewSubtaskTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddSubtask(); } }}
                className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary"
              />
              <input
                type="date"
                value={newSubtaskDate}
                onChange={e => setNewSubtaskDate(e.target.value)}
                className="bg-background border border-border rounded px-1 py-1.5 text-[10px] outline-none focus:border-primary w-[110px]"
              />
              <Button type="button" variant="ghost" size="sm" onClick={handleAddSubtask} disabled={!newSubtaskTitle.trim()} className="h-7 px-2">
                <Plus className="h-3 w-3" />
              </Button>
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
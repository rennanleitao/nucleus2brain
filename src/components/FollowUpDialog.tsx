import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createTask } from "@/lib/api";
import { toast } from "sonner";
import { ArrowRight, Plus, Bell, X } from "lucide-react";

interface FollowUpDialogProps {
  completedTask: {
    id: string;
    title: string;
    space_id?: string | null;
    priority: "low" | "medium" | "high";
  };
  spaces: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function FollowUpDialog({ completedTask, spaces, open, onOpenChange, onCreated }: FollowUpDialogProps) {
  const [mode, setMode] = useState<"ask" | "task" | "reminder">("ask");
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState(completedTask.priority);

  const reset = () => {
    setMode("ask");
    setTitle("");
    setDueDate("");
    setPriority(completedTask.priority);
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const handleCreateFollowUp = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await createTask({
        title: title.trim(),
        priority,
        space_id: completedTask.space_id || null,
        due_date: dueDate || null,
        description: `Follow-up de: ${completedTask.title}`,
        status: "todo",
      });
      toast.success("Follow-up criado!");
      handleClose(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReminder = async () => {
    if (!title.trim() || !dueDate) return;
    setLoading(true);
    try {
      await createTask({
        title: `⏰ ${title.trim()}`,
        priority: "medium",
        space_id: completedTask.space_id || null,
        due_date: dueDate,
        description: `Lembrete de: ${completedTask.title}`,
        status: "waiting",
      });
      toast.success("Lembrete criado!");
      handleClose(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const spaceName = spaces.find(s => s.id === completedTask.space_id)?.name;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            Tarefa concluída!
          </DialogTitle>
          <DialogDescription className="text-left">
            <span className="font-medium text-foreground">{completedTask.title}</span>
            {spaceName && <span className="text-muted-foreground"> · {spaceName}</span>}
          </DialogDescription>
        </DialogHeader>

        {mode === "ask" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Precisa de alguma ação de follow-up?</p>
            <div className="grid grid-cols-1 gap-2">
              <Button variant="outline" className="justify-start gap-2" onClick={() => setMode("task")}>
                <Plus className="h-4 w-4" /> Criar tarefa de follow-up
              </Button>
              <Button variant="outline" className="justify-start gap-2" onClick={() => setMode("reminder")}>
                <Bell className="h-4 w-4" /> Criar lembrete
              </Button>
              <Button variant="ghost" className="justify-start gap-2 text-muted-foreground" onClick={() => handleClose(false)}>
                <X className="h-4 w-4" /> Não precisa, concluído de vez
              </Button>
            </div>
          </div>
        )}

        {mode === "task" && (
          <div className="space-y-3">
            <input type="text" placeholder="Título do follow-up" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" autoFocus />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Prioridade</label>
                <select value={priority} onChange={e => setPriority(e.target.value as any)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary">
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Prazo</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode("ask")} className="flex-1">Voltar</Button>
              <Button onClick={handleCreateFollowUp} disabled={loading || !title.trim()} className="flex-1 gradient-primary text-primary-foreground border-0">
                {loading ? "Criando..." : "Criar Follow-up"}
              </Button>
            </div>
          </div>
        )}

        {mode === "reminder" && (
          <div className="space-y-3">
            <input type="text" placeholder="Sobre o que lembrar?" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" autoFocus />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Quando lembrar?</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" required />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode("ask")} className="flex-1">Voltar</Button>
              <Button onClick={handleCreateReminder} disabled={loading || !title.trim() || !dueDate} className="flex-1 gradient-primary text-primary-foreground border-0">
                {loading ? "Criando..." : "Criar Lembrete"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

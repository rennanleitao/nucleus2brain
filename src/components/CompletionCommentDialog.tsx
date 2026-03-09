import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateTask, createNote, updateNote, fetchNotesBySpace, fetchNotes } from "@/lib/api";
import { toast } from "sonner";
import { MessageSquare, FilePlus, FileText } from "lucide-react";

interface CompletionCommentDialogProps {
  task: {
    id: string;
    title: string;
    space_id?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

export function CompletionCommentDialog({ task, open, onOpenChange, onDone }: CompletionCommentDialogProps) {
  const [comment, setComment] = useState("");
  const [destination, setDestination] = useState<"task" | "new_note" | "existing_note">("task");
  const [noteTitle, setNoteTitle] = useState("");
  const [notes, setNotes] = useState<any[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setComment("");
      setDestination("task");
      setNoteTitle(`Conclusão: ${task.title}`);
      setSelectedNoteId("");
      // Load notes for the space (or all notes if no space)
      const loadNotes = async () => {
        try {
          const n = task.space_id ? await fetchNotesBySpace(task.space_id) : await fetchNotes();
          setNotes(n);
        } catch { /* ignore */ }
      };
      loadNotes();
    }
  }, [open, task.space_id]);

  const handleSkip = () => {
    onOpenChange(false);
    onDone();
  };

  const handleSubmit = async () => {
    if (!comment.trim()) {
      handleSkip();
      return;
    }
    setLoading(true);
    try {
      if (destination === "task") {
        await updateTask(task.id, { completion_note: comment.trim() } as any);
        toast.success("Comentário salvo na atividade");
      } else if (destination === "new_note") {
        const noteContent = `<p><strong>Conclusão de: ${task.title}</strong></p><p>${comment.trim().replace(/\n/g, "<br/>")}</p>`;
        await createNote({
          title: `Conclusão: ${task.title}`,
          content: noteContent,
          tags: ["conclusão"],
          space_id: task.space_id || null,
        });
        // Also save on the task
        await updateTask(task.id, { completion_note: comment.trim() } as any);
        toast.success("Nota criada e comentário salvo");
      } else if (destination === "existing_note" && selectedNoteId) {
        const note = notes.find(n => n.id === selectedNoteId);
        if (note) {
          const appendContent = `${note.content || ""}<hr/><p><strong>Conclusão de: ${task.title}</strong></p><p>${comment.trim().replace(/\n/g, "<br/>")}</p>`;
          await updateNote(selectedNoteId, { content: appendContent });
        }
        await updateTask(task.id, { completion_note: comment.trim() } as any);
        toast.success("Comentário adicionado à nota existente");
      }
      onOpenChange(false);
      onDone();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            Comentário de conclusão
          </DialogTitle>
        </DialogHeader>
        <p className="text-micro text-muted-foreground">
          Adicione um comentário sobre a conclusão de "<span className="font-medium text-foreground">{task.title}</span>"
        </p>

        <Textarea
          placeholder="O que foi feito, observações, resultados..."
          value={comment}
          onChange={e => setComment(e.target.value)}
          className="min-h-[100px] resize-none"
          autoFocus
        />

        {comment.trim() && (
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">Onde guardar este comentário?</Label>
            <RadioGroup value={destination} onValueChange={(v) => setDestination(v as any)} className="space-y-2">
              <div className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="task" id="dest-task" />
                <Label htmlFor="dest-task" className="flex items-center gap-2 cursor-pointer flex-1 text-sm">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Apenas na atividade
                </Label>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="new_note" id="dest-new" />
                <Label htmlFor="dest-new" className="flex items-center gap-2 cursor-pointer flex-1 text-sm">
                  <FilePlus className="h-4 w-4 text-muted-foreground" />
                  Criar nova nota {task.space_id ? "no Space" : ""}
                </Label>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="existing_note" id="dest-existing" />
                <Label htmlFor="dest-existing" className="flex items-center gap-2 cursor-pointer flex-1 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Adicionar a nota existente
                </Label>
              </div>
            </RadioGroup>

            {destination === "existing_note" && (
              <Select value={selectedNoteId} onValueChange={setSelectedNoteId}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Selecionar nota..." />
                </SelectTrigger>
                <SelectContent>
                  {notes.map(n => (
                    <SelectItem key={n.id} value={n.id}>{n.title}</SelectItem>
                  ))}
                  {notes.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma nota encontrada</div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={handleSkip}>Pular</Button>
          <Button
            size="sm"
            className="gradient-primary text-primary-foreground border-0"
            onClick={handleSubmit}
            disabled={loading || (destination === "existing_note" && !selectedNoteId && !!comment.trim())}
          >
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

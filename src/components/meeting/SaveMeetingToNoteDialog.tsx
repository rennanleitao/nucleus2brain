import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchNotes, fetchSpaces, createNote, updateNote } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTitle: string;
  markdownContent: string;
  onSaved?: (noteId: string) => void;
}

export function SaveMeetingToNoteDialog({ open, onOpenChange, defaultTitle, markdownContent, onSaved }: Props) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [title, setTitle] = useState(defaultTitle);
  const [spaceId, setSpaceId] = useState<string>("none");
  const [noteQuery, setNoteQuery] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: spaces = [] } = useQuery({ queryKey: ["spaces"], queryFn: fetchSpaces, enabled: open });
  const { data: notes = [] } = useQuery({ queryKey: ["notes"], queryFn: fetchNotes, enabled: open });

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setMode("new");
      setSelectedNoteId(null);
      setNoteQuery("");
    }
  }, [open, defaultTitle]);

  const filteredNotes = useMemo(() => {
    const q = noteQuery.trim().toLowerCase();
    const list = (notes as any[]).slice(0, 200);
    if (!q) return list.slice(0, 30);
    return list.filter((n) => (n.title ?? "").toLowerCase().includes(q)).slice(0, 30);
  }, [notes, noteQuery]);

  const htmlContent = markdownToHtml(markdownContent);

  const handleSave = async () => {
    if (!markdownContent.trim()) {
      toast.error("Nada para salvar ainda.");
      return;
    }
    setSaving(true);
    try {
      if (mode === "new") {
        const finalTitle = title.trim() || "Reunião";
        const note = await createNote({
          title: finalTitle,
          content: htmlContent,
          tags: ["reuniao"],
          space_id: spaceId === "none" ? null : spaceId,
        } as any);
        toast.success("Nota criada");
        onSaved?.((note as any).id);
      } else {
        if (!selectedNoteId) {
          toast.error("Selecione uma nota");
          setSaving(false);
          return;
        }
        const existing = (notes as any[]).find((n) => n.id === selectedNoteId);
        const prev = existing?.content ?? "";
        const separator = prev ? "<hr /><p><br /></p>" : "";
        await updateNote(selectedNoteId, { content: `${prev}${separator}${htmlContent}` } as any);
        toast.success("Conteúdo anexado à nota");
        onSaved?.(selectedNoteId);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Salvar em nota</DialogTitle>
          <DialogDescription>Envie a reunião organizada para uma nota nova ou anexe a uma existente.</DialogDescription>
        </DialogHeader>

        <RadioGroup value={mode} onValueChange={(v) => setMode(v as "new" | "existing")} className="grid grid-cols-2 gap-2">
          <label className={cn("cursor-pointer rounded-md border p-3 text-sm", mode === "new" && "border-primary bg-primary/5")}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="new" />
              <span className="font-medium">Nova nota</span>
            </div>
          </label>
          <label className={cn("cursor-pointer rounded-md border p-3 text-sm", mode === "existing" && "border-primary bg-primary/5")}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="existing" />
              <span className="font-medium">Nota existente</span>
            </div>
          </label>
        </RadioGroup>

        {mode === "new" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="note-title">Título</Label>
              <Input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Space</Label>
              <Select value={spaceId} onValueChange={setSpaceId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem space</SelectItem>
                  {(spaces as any[]).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Input placeholder="Buscar nota..." value={noteQuery} onChange={(e) => setNoteQuery(e.target.value)} />
            <ScrollArea className="h-56 rounded-md border">
              <div className="p-1">
                {filteredNotes.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Nenhuma nota encontrada.</p>
                ) : filteredNotes.map((n: any) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setSelectedNoteId(n.id)}
                    className={cn(
                      "block w-full rounded px-3 py-2 text-left text-sm hover:bg-accent",
                      selectedNoteId === n.id && "bg-accent",
                    )}
                  >
                    <p className="font-medium">{n.title || "Sem título"}</p>
                    {n.spaces?.name && <p className="text-xs text-muted-foreground">{n.spaces.name}</p>}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function markdownToHtml(md: string): string {
  // Minimal markdown → HTML conversion tailored for TipTap-compatible output.
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  let listType: "ul" | "ol" | null = null;

  const closeList = () => {
    if (inList && listType) {
      out.push(`</${listType}>`);
      inList = false;
      listType = null;
    }
  };

  const inline = (s: string) =>
    s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { closeList(); continue; }

    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      closeList();
      const level = h[1].length + 1; // # -> h2 for consistency
      out.push(`<h${Math.min(level, 4)}>${inline(h[2])}</h${Math.min(level, 4)}>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      if (!inList || listType !== "ul") { closeList(); out.push("<ul>"); inList = true; listType = "ul"; }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      if (!inList || listType !== "ol") { closeList(); out.push("<ol>"); inList = true; listType = "ol"; }
      out.push(`<li>${inline(line.replace(/^\d+\.\s+/, ""))}</li>`);
      continue;
    }

    if (/^---+$/.test(line)) { closeList(); out.push("<hr />"); continue; }

    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  return out.join("");
}

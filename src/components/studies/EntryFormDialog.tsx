import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateEntry, useUpdateEntry, type StudyEntry, type StudyEntryKind } from "@/hooks/useStudies";
import { FileText, Link2, Loader2, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  topicId: string;
  entry?: StudyEntry | null;
  defaultKind?: StudyEntryKind;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function EntryFormDialog({ open, onOpenChange, topicId, entry, defaultKind = "event" }: Props) {
  const [kind, setKind] = useState<StudyEntryKind>(defaultKind);
  const [entryDate, setEntryDate] = useState(todayISO());
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [highlight, setHighlight] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [sourceMode, setSourceMode] = useState<"link" | "text">("link");
  const [uploading, setUploading] = useState(false);
  const create = useCreateEntry();
  const update = useUpdateEntry();

  useEffect(() => {
    if (!open) return;
    setKind(entry?.kind ?? defaultKind);
    setEntryDate(entry?.entry_date ?? todayISO());
    setTitle(entry?.title ?? "");
    setSummary(entry?.summary ?? "");
    setCategory(entry?.category ?? "");
    setContent(entry?.content ?? "");
    setSourceUrl(entry?.source_url ?? "");
    setHighlight(entry?.highlight ?? "");
    setNotes(entry?.notes ?? "");
    setTags((entry?.tags ?? []).join(", "));
    setSourceMode(entry?.source_url ? "link" : "text");
  }, [open, entry, defaultKind]);

  const isEvent = kind === "event";
  const canSave = title.trim() && summary.trim() && (!isEvent || !!entryDate) && !uploading;

  const uploadDocument = async (file: File) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Faça login para enviar arquivos");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/studies/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage.from("attachments").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("attachments").getPublicUrl(path);
      setSourceUrl(data.publicUrl);
      setSourceMode("link");
      toast.success("Documento anexado");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar documento");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!canSave) return;
    const tagArr = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const payload: Partial<StudyEntry> & { topic_id: string; title: string; summary: string } = {
      topic_id: topicId,
      kind,
      title: title.trim(),
      summary: summary.trim(),
      source_url: sourceUrl.trim() || null,
      notes: notes.trim() || null,
      tags: tagArr,
      entry_date: isEvent ? entryDate : null,
      highlight: isEvent ? (highlight.trim() || null) : null,
      category: !isEvent ? (category.trim() || null) : null,
      content: !isEvent ? (content.trim() || null) : null,
    };
    try {
      if (entry) {
        await update.mutateAsync({ id: entry.id, ...payload });
        toast.success("Registro atualizado");
      } else {
        await create.mutateAsync(payload);
        toast.success(isEvent ? "Evento adicionado" : "Item adicionado à biblioteca");
      }
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {entry ? "Editar registro" : isEvent ? "Novo evento" : "Novo item da biblioteca"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isEvent ? (
            <div className="grid grid-cols-[140px_1fr] gap-3">
              <div className="space-y-1.5">
                <Label>Data *</Label>
                <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Título *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resumo curto" autoFocus />
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Título *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Building Agents with LLMs" autoFocus />
              </div>
              <div className="space-y-2">
                <Label>Fonte <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={sourceMode === "link" ? "secondary" : "outline"} onClick={() => setSourceMode("link")}>
                    <Link2 className="mr-1.5 h-3.5 w-3.5" /> Link ou documento
                  </Button>
                  <Button type="button" variant={sourceMode === "text" ? "secondary" : "outline"} onClick={() => setSourceMode("text")}>
                    <FileText className="mr-1.5 h-3.5 w-3.5" /> Texto livre
                  </Button>
                </div>
                {sourceMode === "link" ? (
                  <div className="space-y-2">
                    <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://artigo, PDF ou apresentação..." />
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                      {uploading ? "Enviando documento..." : "Ou enviar PDF, Word ou apresentação"}
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,application/pdf"
                        className="sr-only"
                        disabled={uploading}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadDocument(file);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="Cole um trecho, referência ou texto que deseja guardar..." />
                )}
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>{isEvent ? "Resumo *" : "Minha leitura / relevância *"}</Label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} placeholder={isEvent ? "Sobre o que é este registro" : "Com suas palavras: por que este conteúdo importa e como ele pode ser útil?"} />
          </div>

          {isEvent && (
            <div className="space-y-1.5">
              <Label>Highlight</Label>
              <Textarea value={highlight} onChange={(e) => setHighlight(e.target.value)} rows={2} placeholder="Trecho ou dado mais importante" />
            </div>
          )}

          {isEvent ? (
            <>
              <div className="space-y-1.5">
                <Label>Link da fonte</Label>
                <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Sua interpretação" />
              </div>
              <div className="space-y-1.5">
                <Label>Tags (separadas por vírgula)</Label>
                <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="rpa, ia" />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label>Tags <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ia, agentes, arquitetura" />
              <p className="text-[11px] text-muted-foreground">Separe as tags por vírgula.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!canSave}>
            {entry ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/RichTextEditor";
import { useCreateEntry, useUpdateEntry, type StudyEntry, type StudyEntryKind } from "@/hooks/useStudies";
import { FileText, Link2, Loader2, Paperclip, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  cleanRepositorySources,
  createEmptyRepositorySource,
  ensureHtml,
  formatFileSize,
  getPrimarySourceUrl,
  htmlToPlainText,
  isImageSource,
  isPdfSource,
  parseRepositorySources,
  serializeRepositorySources,
  type RepositorySource,
} from "@/lib/studyRepository";
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
  const [sources, setSources] = useState<RepositorySource[]>([createEmptyRepositorySource()]);
  const [sourceUrl, setSourceUrl] = useState("");
  const [highlight, setHighlight] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingSourceId, setUploadingSourceId] = useState<string | null>(null);
  const create = useCreateEntry();
  const update = useUpdateEntry();

  useEffect(() => {
    if (!open) return;
    setKind(entry?.kind ?? defaultKind);
    setEntryDate(entry?.entry_date ?? todayISO());
    setTitle(entry?.title ?? "");
    setSummary(!entry || (entry.kind ?? defaultKind) === "event" ? (entry?.summary ?? "") : ensureHtml(entry.summary ?? ""));
    setCategory(entry?.category ?? "");
    setSources(parseRepositorySources(entry));
    setSourceUrl(entry?.source_url ?? "");
    setHighlight(entry?.highlight ?? "");
    setNotes(entry?.notes ?? "");
    setTags((entry?.tags ?? []).join(", "));
  }, [open, entry, defaultKind]);

  const isEvent = kind === "event";
  const hasSummary = isEvent ? summary.trim().length > 0 : htmlToPlainText(summary).length > 0;
  const hasRepositorySource = !isEvent && cleanRepositorySources(sources).length > 0;
  const canSave = title.trim() && (isEvent ? hasSummary && !!entryDate : hasSummary || hasRepositorySource) && !uploading;

  const updateSource = (id: string, patch: Partial<RepositorySource>) => {
    setSources((current) => current.map((source) => source.id === id ? { ...source, ...patch } : source));
  };

  const addSource = () => {
    setSources((current) => [...current, createEmptyRepositorySource()]);
  };

  const removeSource = (id: string) => {
    setSources((current) => {
      const next = current.filter((source) => source.id !== id);
      return next.length ? next : [createEmptyRepositorySource()];
    });
  };

  const uploadDocument = async (file: File, sourceId?: string) => {
    setUploading(true);
    setUploadingSourceId(sourceId ?? null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Faça login para enviar arquivos");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/studies/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage.from("attachments").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("attachments").getPublicUrl(path);
      if (sourceId) {
        updateSource(sourceId, {
          kind: "link",
          url: data.publicUrl,
          title: file.name,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          storagePath: path,
        });
      } else {
        setSourceUrl(data.publicUrl);
      }
      toast.success("Documento anexado");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar documento");
    } finally {
      setUploading(false);
      setUploadingSourceId(null);
    }
  };

  const submit = async () => {
    if (!canSave) return;
    const tagArr = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const cleanedSources = cleanRepositorySources(sources);
    const repositoryContent = serializeRepositorySources(cleanedSources);
    const payload: Partial<StudyEntry> & { topic_id: string; title: string; summary: string } = {
      topic_id: topicId,
      kind,
      title: title.trim(),
      summary: isEvent ? summary.trim() : (summary.trim() || "<p></p>"),
      source_url: isEvent ? (sourceUrl.trim() || null) : getPrimarySourceUrl(cleanedSources),
      notes: notes.trim() || null,
      tags: tagArr,
      entry_date: isEvent ? entryDate : null,
      highlight: isEvent ? (highlight.trim() || null) : null,
      category: !isEvent ? (category.trim() || null) : null,
      content: !isEvent ? repositoryContent : null,
    };
    try {
      if (entry) {
        await update.mutateAsync({ id: entry.id, ...payload });
        toast.success("Registro atualizado");
      } else {
        await create.mutateAsync(payload);
        toast.success(isEvent ? "Evento adicionado" : "Item adicionado ao repositório");
      }
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {entry ? "Editar registro" : isEvent ? "Novo evento" : "Novo item do repositório"}
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
                <div className="flex items-center justify-between gap-3">
                  <Label>Fontes e anexos <span className="font-normal text-muted-foreground">(links, imagens, PDFs, arquivos ou texto livre)</span></Label>
                  <Button type="button" variant="outline" size="sm" onClick={addSource}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar fonte
                  </Button>
                </div>
                <div className="space-y-3">
                  {sources.map((source, index) => (
                    <div key={source.id} className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground">Fonte {index + 1}</p>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeSource(source.id)} className="h-7 px-2 text-xs">
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Remover
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button type="button" variant={source.kind === "link" ? "secondary" : "outline"} onClick={() => updateSource(source.id, { kind: "link" })}>
                          <Link2 className="mr-1.5 h-3.5 w-3.5" /> Link/documento
                        </Button>
                        <Button type="button" variant={source.kind === "text" ? "secondary" : "outline"} onClick={() => updateSource(source.id, { kind: "text" })}>
                          <FileText className="mr-1.5 h-3.5 w-3.5" /> Texto livre
                        </Button>
                      </div>
                      <Input value={source.title} onChange={(e) => updateSource(source.id, { title: e.target.value })} placeholder="Nome da fonte. Ex.: Relatório McKinsey 2026" />
                      {source.kind === "link" ? (
                        <div className="space-y-2">
                          <Input value={source.url} onChange={(e) => updateSource(source.id, { url: e.target.value })} placeholder="https://artigo, imagem, PDF ou arquivo..." />
                          {source.url && isImageSource(source) && (
                            <div className="overflow-hidden rounded-lg border border-border bg-background">
                              <img src={source.url} alt={source.title || source.fileName || "Imagem anexada"} className="max-h-48 w-full object-contain" />
                            </div>
                          )}
                          {source.fileName && (
                            <p className="text-[11px] text-muted-foreground">
                              {isPdfSource(source) ? "PDF" : source.mimeType?.startsWith("image/") ? "Imagem" : "Arquivo"} anexado: {source.fileName}
                              {formatFileSize(source.fileSize) && ` · ${formatFileSize(source.fileSize)}`}
                            </p>
                          )}
                          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                            {uploading && uploadingSourceId === source.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                            {uploading && uploadingSourceId === source.id ? "Enviando arquivo..." : "Ou anexar imagem, PDF ou arquivo"}
                            <input
                              type="file"
                              accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,application/pdf"
                              className="sr-only"
                              disabled={uploading}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) void uploadDocument(file, source.id);
                                event.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      ) : (
                        <Textarea value={source.text} onChange={(e) => updateSource(source.id, { text: e.target.value })} rows={4} placeholder="Cole um trecho, referência, transcrição ou texto que deseja guardar..." />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>{isEvent ? "Resumo *" : "Resumo e principais takeaways"}</Label>
            {isEvent ? (
              <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} placeholder="Sobre o que é este registro" />
            ) : (
              <RichTextEditor
                content={summary}
                onChange={setSummary}
                placeholder="Opcional quando você só quer anexar um arquivo ou link. Use para registrar takeaways, citações e utilidade."
                className="[&_.ProseMirror]:min-h-[180px]"
              />
            )}
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

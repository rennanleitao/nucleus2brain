import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCreateEntry, useUpdateEntry, type StudyEntry, type StudyEntryKind } from "@/hooks/useStudies";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
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

const KNOWLEDGE_CATEGORIES = [
  "Framework", "Conceito", "Metodologia", "Livro", "Artigo",
  "Playbook", "Prompt", "Benchmark", "Modelo Mental", "Síntese", "Template", "Checklist",
];

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
  const [advancedOpen, setAdvancedOpen] = useState(false);
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
    setAdvancedOpen(Boolean(entry?.category || entry?.content || entry?.notes || entry?.tags?.length));
  }, [open, entry, defaultKind]);

  const isEvent = kind === "event";
  const canSave = title.trim() && summary.trim() && (!isEvent || !!entryDate);

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
              <div className="space-y-1.5">
                <Label>Link <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://artigo, PDF ou apresentação..." />
                <p className="text-[11px] text-muted-foreground">Cole um link para artigo, PDF, apresentação ou outra fonte.</p>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Resumo *</Label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder={isEvent ? "Sobre o que é este registro" : "Em uma frase: o que é e por que importa"} />
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
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="rounded-lg border border-border">
              <CollapsibleTrigger asChild>
                <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/40">
                  <span className="flex items-center gap-2"><SlidersHorizontal className="h-3.5 w-3.5" /> Mais detalhes</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-4 border-t border-border p-3">
                  <div className="space-y-1.5">
                    <Label>Categoria</Label>
                    <Input list="kb-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Livro, Artigo, Framework..." />
                    <datalist id="kb-categories">
                      {KNOWLEDGE_CATEGORIES.map((c) => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Conteúdo complementar</Label>
                    <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="Trechos, passos, estrutura ou exemplos..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Observações</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Sua interpretação" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tags (separadas por vírgula)</Label>
                    <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ia, agentes, arquitetura" />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
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

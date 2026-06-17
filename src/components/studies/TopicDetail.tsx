import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Pencil, Trash2, ExternalLink, NotebookPen, MoreHorizontal, Maximize2, Minimize2 } from "lucide-react";
import {
  useStudyEntries, useDeleteEntry, useStudyAreas, useUpdateTopic, useDeleteTopic,
  type StudyTopic, type StudyEntry,
} from "@/hooks/useStudies";
import { EntryFormDialog } from "./EntryFormDialog";
import { TopicFormDialog } from "./TopicFormDialog";
import { formatDateBR, formatRelative } from "@/lib/studyDate";


interface Props { topic: StudyTopic; focusMode?: boolean; onToggleFocus?: () => void }

export function TopicDetail({ topic, focusMode = false, onToggleFocus }: Props) {
  const { data: areas = [] } = useStudyAreas();
  const { data: entries = [] } = useStudyEntries(topic.id);
  const area = areas.find((a) => a.id === topic.area_id);

  const deleteEntry = useDeleteEntry();
  const deleteTopic = useDeleteTopic();
  const updateTopic = useUpdateTopic();
  const [, setParams] = useSearchParams();
  const [editTopic, setEditTopic] = useState(false);
  const [entryDialog, setEntryDialog] = useState<{ open: boolean; edit?: StudyEntry }>({ open: false });

  // Inline free-form annotations — autosaved with debounce
  const [notesDraft, setNotesDraft] = useState(topic.notes ?? "");
  const [notesSaving, setNotesSaving] = useState(false);
  const lastSavedRef = useRef(topic.notes ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNotesDraft(topic.notes ?? "");
    lastSavedRef.current = topic.notes ?? "";
  }, [topic.id]);

  useEffect(() => {
    if (notesDraft === lastSavedRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setNotesSaving(true);
      try {
        await updateTopic.mutateAsync({ id: topic.id, notes: notesDraft.trim() ? notesDraft : null });
        lastSavedRef.current = notesDraft;
      } finally {
        setNotesSaving(false);
      }
    }, 700);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [notesDraft, topic.id, updateTopic]);

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-8">

        <header className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{area?.name ?? "—"}</span>
                <span>·</span>
                <span>Última atualização {formatRelative(topic.last_updated_at ?? topic.updated_at)}</span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">{topic.title}</h1>
              {topic.description && <p className="text-sm text-muted-foreground">{topic.description}</p>}
              {topic.tags && topic.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {topic.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px] font-normal">#{t}</Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setEditTopic(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
              </Button>
              <Button size="sm" onClick={() => setEntryDialog({ open: true })}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar registro
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => {
                      if (confirm(`Remover tema "${topic.title}" e todos os registros?`)) {
                        deleteTopic.mutate(topic.id, {
                          onSuccess: () => {
                            const p = new URLSearchParams(window.location.search);
                            p.delete("topic");
                            setParams(p, { replace: true });
                          },
                        });
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover tema
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <Separator />

        {/* Anotações livres do tema */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <NotebookPen className="h-4 w-4" /> Anotações
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {notesSaving ? "Salvando..." : notesDraft && notesDraft === lastSavedRef.current ? "Salvo" : ""}
            </span>
          </div>
          <Textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Espaço livre para suas reflexões, ideias soltas, perguntas, conexões..."
            rows={5}
            className="resize-y bg-muted/30 border-border/50 focus-visible:bg-background"
          />
        </section>



        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Timeline</h2>
            <span className="text-xs text-muted-foreground">{entries.length} registros</span>
          </div>
          {entries.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Nenhum registro ainda.{" "}
                <button className="text-foreground underline" onClick={() => setEntryDialog({ open: true })}>
                  Adicionar o primeiro
                </button>.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {entries.map((e) => (
                <Card key={e.id} className="hover:border-foreground/20 transition-colors group">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="font-mono">{formatDateBR(e.entry_date)}</span>
                        </div>
                        <h3 className="text-sm font-medium leading-snug">{e.title}</h3>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEntryDialog({ open: true, edit: e })}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm("Remover registro?")) deleteEntry.mutate(e.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{e.summary}</p>
                    {e.highlight && (
                      <div className="text-sm text-foreground/90 border-l-2 border-foreground/30 pl-3 italic">
                        {e.highlight}
                      </div>
                    )}
                    {e.notes && (
                      <div className="text-xs text-muted-foreground border-l-2 border-border pl-3 whitespace-pre-wrap">
                        <span className="font-medium text-foreground/70">Observações: </span>{e.notes}
                      </div>
                    )}
                    {(e.source_url || (e.tags && e.tags.length > 0)) && (
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        {e.source_url && (
                          <a href={e.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                            <ExternalLink className="h-3 w-3" /> Fonte
                          </a>
                        )}
                        {e.tags?.map((t) => <Badge key={t} variant="secondary" className="text-[10px] font-normal">#{t}</Badge>)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      <EntryFormDialog
        open={entryDialog.open}
        onOpenChange={(o) => setEntryDialog({ open: o, edit: o ? entryDialog.edit : undefined })}
        topicId={topic.id}
        entry={entryDialog.edit}
      />
      <TopicFormDialog open={editTopic} onOpenChange={setEditTopic} topic={topic} />
    </div>
  );
}

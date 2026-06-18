import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Plus, Pencil, Trash2, ExternalLink, NotebookPen, MoreHorizontal, Maximize2, Minimize2, ChevronDown, ChevronRight, ArrowRightLeft, Copy, Calendar, BookOpen } from "lucide-react";
import {
  useStudyEntries, useDeleteEntry, useStudyAreas, useUpdateTopic, useDeleteTopic,
  useMoveEntry, useDuplicateEntry,
  type StudyTopic, type StudyEntry, type StudyEntryKind,
} from "@/hooks/useStudies";
import { EntryFormDialog } from "./EntryFormDialog";
import { TopicFormDialog } from "./TopicFormDialog";
import { EntryAIAssist } from "./EntryAIAssist";
import { PickTopicDialog } from "./PickTopicDialog";
import { formatDateBR, formatRelative } from "@/lib/studyDate";
import { toast } from "sonner";


interface Props { topic: StudyTopic; focusMode?: boolean; onToggleFocus?: () => void }

export function TopicDetail({ topic, focusMode = false, onToggleFocus }: Props) {
  const { data: areas = [] } = useStudyAreas();
  const { data: entries = [] } = useStudyEntries(topic.id);
  const area = areas.find((a) => a.id === topic.area_id);

  const deleteEntry = useDeleteEntry();
  const deleteTopic = useDeleteTopic();
  const updateTopic = useUpdateTopic();
  const moveEntry = useMoveEntry();
  const duplicateEntry = useDuplicateEntry();
  const [, setParams] = useSearchParams();
  const [editTopic, setEditTopic] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [entryDialog, setEntryDialog] = useState<{ open: boolean; edit?: StudyEntry; kind?: StudyEntryKind }>({ open: false });
  const [pickDialog, setPickDialog] = useState<{ open: boolean; mode: "move" | "duplicate"; entry?: StudyEntry }>({ open: false, mode: "move" });

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

  useEffect(() => {
    if (!focusMode || !onToggleFocus) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onToggleFocus(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode, onToggleFocus]);

  return (
    <div className={focusMode
      ? "fixed inset-0 z-50 overflow-y-auto bg-background animate-fade-in"
      : "flex-1 overflow-y-auto bg-background"}>
      <div className={focusMode
        ? "max-w-6xl mx-auto px-8 md:px-16 lg:px-24 py-10 md:py-16 space-y-10"
        : "max-w-4xl mx-auto p-6 md:p-8 space-y-8"}>

        <header className="space-y-5 text-center">
          <div className="flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span>{area?.name ?? "—"}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="normal-case tracking-normal">Atualizado {formatRelative(topic.last_updated_at ?? topic.updated_at)}</span>
          </div>

          <h1 className={focusMode
            ? "text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1] max-w-3xl mx-auto"
            : "text-3xl md:text-4xl font-semibold tracking-tight leading-[1.15] max-w-2xl mx-auto"}>
            {topic.title}
          </h1>

          {topic.description && (
            <div className="max-w-2xl mx-auto">
              <button
                onClick={() => setDescOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {descOpen ? "Ocultar descrição" : "Mostrar descrição"}
                <ChevronDown className={`h-3 w-3 transition-transform ${descOpen ? "rotate-180" : ""}`} />
              </button>
              {descOpen && (
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed animate-fade-in">
                  {topic.description}
                </p>
              )}
            </div>
          )}

          {topic.tags && topic.tags.length > 0 && (
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {topic.tags.map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px] font-normal">#{t}</Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-center gap-2 pt-2">
            {onToggleFocus && (
              <Button variant="ghost" size="sm" onClick={onToggleFocus} title={focusMode ? "Sair do modo leitura (Esc)" : "Modo leitura"}>
                {focusMode ? <Minimize2 className="h-3.5 w-3.5 mr-1.5" /> : <Maximize2 className="h-3.5 w-3.5 mr-1.5" />}
                {focusMode ? "Sair" : "Leitura"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setEditTopic(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar
                  <ChevronDown className="h-3 w-3 ml-1.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEntryDialog({ open: true, kind: "event" })}>
                  <Calendar className="h-3.5 w-3.5 mr-2" /> Evento relevante
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEntryDialog({ open: true, kind: "knowledge" })}>
                  <BookOpen className="h-3.5 w-3.5 mr-2" /> Knowledge Base
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
        <EntriesTabs
          topic={topic}
          entries={entries}
          focusMode={focusMode}
          onEdit={(e) => setEntryDialog({ open: true, edit: e })}
          onMove={(e) => setPickDialog({ open: true, mode: "move", entry: e })}
          onDuplicate={(e) => setPickDialog({ open: true, mode: "duplicate", entry: e })}
          onDelete={(id) => { if (confirm("Remover registro?")) deleteEntry.mutate(id); }}
          onAdd={(kind) => setEntryDialog({ open: true, kind })}
        />
      </div>

      <EntryFormDialog
        open={entryDialog.open}
        onOpenChange={(o) => setEntryDialog({ open: o, edit: o ? entryDialog.edit : undefined, kind: o ? entryDialog.kind : undefined })}
        topicId={topic.id}
        entry={entryDialog.edit}
        defaultKind={entryDialog.kind ?? entryDialog.edit?.kind ?? "event"}
      />
      <TopicFormDialog open={editTopic} onOpenChange={setEditTopic} topic={topic} />
      <PickTopicDialog
        open={pickDialog.open}
        mode={pickDialog.mode}
        currentTopicId={topic.id}
        onOpenChange={(o) => setPickDialog((p) => ({ ...p, open: o }))}
        onConfirm={async (topicId) => {
          if (!pickDialog.entry) return;
          if (pickDialog.mode === "move") {
            await moveEntry.mutateAsync({ id: pickDialog.entry.id, topic_id: topicId });
            toast.success("Registro movido");
          } else {
            await duplicateEntry.mutateAsync({ entry: pickDialog.entry, topic_id: topicId });
            toast.success("Registro duplicado");
          }
        }}
      />
    </div>
  );
}

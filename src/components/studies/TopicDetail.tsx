import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowRightLeft,
  BookOpen,
  Calendar,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Plus,
  Quote,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  type StudyEntry,
  type StudyEntryKind,
  type StudyTopic,
  useDeleteEntry,
  useDeleteTopic,
  useDuplicateEntry,
  useMoveEntry,
  useStudyAreas,
  useStudyEntries,
} from "@/hooks/useStudies";
import { formatRelative } from "@/lib/studyDate";
import { ensureHtml, getSourceHost, htmlToPlainText, parseRepositorySources } from "@/lib/studyRepository";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EntryAIAssist } from "./EntryAIAssist";
import { EntryFormDialog } from "./EntryFormDialog";
import { PickTopicDialog } from "./PickTopicDialog";
import { StudyNoteDialog } from "./StudyNoteDialog";
import { TopicFormDialog } from "./TopicFormDialog";

interface Props {
  topic: StudyTopic;
  focusMode?: boolean;
  onToggleFocus?: () => void;
}

type WorkspaceTab = "library" | "notes" | "timeline";

export function TopicDetail({ topic, focusMode = false, onToggleFocus }: Props) {
  const { data: areas = [] } = useStudyAreas();
  const { data: entries = [] } = useStudyEntries(topic.id);
  const area = areas.find((item) => item.id === topic.area_id);
  const deleteEntry = useDeleteEntry();
  const deleteTopic = useDeleteTopic();
  const moveEntry = useMoveEntry();
  const duplicateEntry = useDuplicateEntry();
  const [, setParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("library");
  const [editTopic, setEditTopic] = useState(false);
  const [noteDialog, setNoteDialog] = useState<{ open: boolean; note?: StudyEntry }>({ open: false });
  const [entryDialog, setEntryDialog] = useState<{
    open: boolean;
    edit?: StudyEntry;
    kind?: StudyEntryKind;
  }>({ open: false });
  const [pickDialog, setPickDialog] = useState<{
    open: boolean;
    mode: "move" | "duplicate";
    entry?: StudyEntry;
  }>({ open: false, mode: "move" });

  const knowledge = useMemo(
    () => entries.filter((entry) => entry.kind === "knowledge"),
    [entries]
  );
  const events = useMemo(
    () => entries.filter((entry) => (entry.kind ?? "event") === "event"),
    [entries]
  );
  const notes = useMemo(
    () => entries.filter((entry) => entry.kind === "note"),
    [entries]
  );

  const takeaways = useMemo(() => {
    return entries
      .filter((entry) => entry.highlight && entry.highlight.trim().length > 0)
      .map((entry) => ({
        id: entry.id,
        text: entry.highlight!.trim(),
        source: entry.title,
        date: entry.entry_date,
      }));
  }, [entries]);

  const hasFreeText = !!topic.notes && topic.notes.trim().length > 0;
  const hasDescription = !!topic.description && topic.description.trim().length > 0;
  const hasOverview = hasFreeText || takeaways.length > 0;

  useEffect(() => {
    setActiveTab("library");
  }, [topic.id]);

  useEffect(() => {
    if (!focusMode || !onToggleFocus) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onToggleFocus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode, onToggleFocus]);

  const openEntry = (kind: StudyEntryKind) => setEntryDialog({ open: true, kind });
  const editEntry = (entry: StudyEntry) => setEntryDialog({ open: true, edit: entry });
  const moveEntryToTopic = (entry: StudyEntry) =>
    setPickDialog({ open: true, mode: "move", entry });
  const duplicateEntryToTopic = (entry: StudyEntry) =>
    setPickDialog({ open: true, mode: "duplicate", entry });
  const removeEntry = (id: string) => {
    if (confirm("Remover registro?")) deleteEntry.mutate(id);
  };

  const entryActions = {
    onEdit: editEntry,
    onMove: moveEntryToTopic,
    onDuplicate: duplicateEntryToTopic,
    onDelete: removeEntry,
  };

  const removeTopic = () => {
    if (!confirm(`Remover tema "${topic.title}" e todos os registros?`)) return;
    deleteTopic.mutate(topic.id, {
      onSuccess: () => {
        const nextParams = new URLSearchParams(window.location.search);
        nextParams.delete("topic");
        setParams(nextParams, { replace: true });
      },
    });
  };

  return (
    <div
      className={cn(
        "bg-background",
        focusMode
          ? "fixed inset-0 z-50 overflow-y-auto animate-fade-in"
          : "flex-1 overflow-y-auto"
      )}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 md:px-8 md:py-7">
        <header className="space-y-4 border-b border-border pb-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Conhecimento</span>
            <span>/</span>
            <span>{area?.name ?? "Área"}</span>
            <span>/</span>
            <span className="truncate text-foreground/70">{topic.title}</span>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 max-w-3xl space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  {topic.title}
                </h1>
                <Badge variant="secondary" className="font-normal">
                  {area?.name ?? "Sem área"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Atualizado {formatRelative(topic.last_updated_at ?? topic.updated_at)}
              </p>
              {hasDescription && (
                <p className="text-[15px] leading-relaxed text-foreground/70">
                  {topic.description}
                </p>
              )}
              {!!topic.tags?.length && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {topic.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px] font-normal">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Button size="sm" onClick={() => openEntry("knowledge")}>
                <BookOpen className="mr-1.5 h-3.5 w-3.5" /> Adicionar ao repositório
              </Button>
              <Button variant="outline" size="sm" onClick={() => setNoteDialog({ open: true })}>
                <NotebookPen className="mr-1.5 h-3.5 w-3.5" /> Nova anotação
              </Button>
              <Button variant="outline" size="sm" onClick={() => openEntry("event")}>
                <Calendar className="mr-1.5 h-3.5 w-3.5" /> Adicionar evento
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditTopic(true)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar tema
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Mais ações">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onToggleFocus && (
                    <DropdownMenuItem onClick={onToggleFocus}>
                      {focusMode ? (
                        <Minimize2 className="mr-2 h-3.5 w-3.5" />
                      ) : (
                        <Maximize2 className="mr-2 h-3.5 w-3.5" />
                      )}
                      {focusMode ? "Sair do modo leitura" : "Modo leitura"}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={removeTopic}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Remover tema
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>




        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as WorkspaceTab)}
          className="mt-4"
        >
          <div className="overflow-x-auto border-b border-border">
            <TabsList className="h-11 min-w-[390px] justify-start gap-1 rounded-none bg-transparent p-0">
              <WorkspaceTabTrigger value="library" icon={BookOpen} label="Repositório" count={knowledge.length} />
              <WorkspaceTabTrigger value="notes" icon={NotebookPen} label="Anotações" count={notes.length} />
              {events.length > 0 && <WorkspaceTabTrigger value="timeline" icon={Calendar} label="Timeline" count={events.length} />}
            </TabsList>
          </div>

          <TabsContent value="library" className="mt-6">
            <LibraryTab
              topic={topic}
              entries={knowledge}
              onAdd={() => openEntry("knowledge")}
              {...entryActions}
            />
          </TabsContent>

          <TabsContent value="timeline" className="mt-6">
            <TimelineTab
              topic={topic}
              entries={events}
              focusMode={focusMode}
              onAdd={() => openEntry("event")}
              {...entryActions}
            />
          </TabsContent>

          <TabsContent value="notes" className="mt-6">
            <NotesTab
              entries={notes}
              onAdd={() => setNoteDialog({ open: true })}
              onEdit={(note) => setNoteDialog({ open: true, note })}
              onMove={moveEntryToTopic}
              onDuplicate={duplicateEntryToTopic}
              onDelete={removeEntry}
            />
          </TabsContent>
        </Tabs>
      </div>

      <EntryFormDialog
        open={entryDialog.open}
        onOpenChange={(open) =>
          setEntryDialog({
            open,
            edit: open ? entryDialog.edit : undefined,
            kind: open ? entryDialog.kind : undefined,
          })
        }
        topicId={topic.id}
        entry={entryDialog.edit}
        defaultKind={entryDialog.kind ?? entryDialog.edit?.kind ?? "event"}
      />
      <StudyNoteDialog
        open={noteDialog.open}
        onOpenChange={(open) => setNoteDialog({ open, note: open ? noteDialog.note : undefined })}
        topicId={topic.id}
        note={noteDialog.note}
      />
      <TopicFormDialog open={editTopic} onOpenChange={setEditTopic} topic={topic} />
      <PickTopicDialog
        open={pickDialog.open}
        mode={pickDialog.mode}
        currentTopicId={topic.id}
        onOpenChange={(open) => setPickDialog((current) => ({ ...current, open }))}
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

function WorkspaceTabTrigger({
  value,
  icon: Icon,
  label,
  count,
}: {
  value: WorkspaceTab;
  icon: typeof BookOpen;
  label: string;
  count?: number;
}) {
  return (
    <TabsTrigger
      value={value}
      className="h-11 gap-2 rounded-none border-b-2 border-transparent px-4 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {count !== undefined && (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] leading-none">{count}</span>
      )}
    </TabsTrigger>
  );
}

interface EntryTabProps {
  topic: StudyTopic;
  entries: StudyEntry[];
  onAdd: () => void;
  onEdit: (entry: StudyEntry) => void;
  onMove: (entry: StudyEntry) => void;
  onDuplicate: (entry: StudyEntry) => void;
  onDelete: (id: string) => void;
}

function LibraryTab({ topic, entries, onAdd, onEdit, onMove, onDuplicate, onDelete }: EntryTabProps) {
  const [query, setQuery] = useState("");
  const filteredEntries = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return entries;
    return entries.filter((entry) => {
      const sources = parseRepositorySources(entry);
      return [entry.title, htmlToPlainText(ensureHtml(entry.summary)), entry.content, entry.source_url, ...(entry.tags ?? []), ...sources.flatMap((source) => [source.title, source.url, source.text])]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(normalized));
    });
  }, [entries, query]);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Repositório</h2>
          <p className="text-sm text-muted-foreground">{entries.length} {entries.length === 1 ? "item" : "itens"}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no repositório..." className="pl-9" />
          </div>
          <Button onClick={onAdd}>
            <Plus className="mr-1.5 h-4 w-4" /> Adicionar conteúdo
          </Button>
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <EmptyState
          label={query ? "Nenhum conteúdo corresponde à busca." : "Repositório vazio."}
          cta={query ? undefined : "Adicionar ao repositório"}
          onClick={query ? undefined : onAdd}
        />
      ) : (
        <div className="mx-auto max-w-7xl overflow-hidden rounded-xl border border-border bg-card">
          <div className="hidden grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)_88px] border-b border-border bg-muted/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Fontes</span>
            <span>Resumo e principais takeaways</span>
            <span className="text-right">Ações</span>
          </div>
          {filteredEntries.map((entry) => (
            <KnowledgeCard
              key={entry.id}
              topic={topic}
              entry={entry}
              onEdit={() => onEdit(entry)}
              onMove={() => onMove(entry)}
              onDuplicate={() => onDuplicate(entry)}
              onDelete={() => onDelete(entry.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TimelineTab({ topic, entries, focusMode, onAdd, onEdit, onMove, onDuplicate, onDelete }: EntryTabProps & { focusMode: boolean }) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Timeline</h2>
          <p className="text-sm text-muted-foreground">{entries.length} {entries.length === 1 ? "evento" : "eventos"}</p>
        </div>
        <Button onClick={onAdd}>
          <Plus className="mr-1.5 h-4 w-4" /> Adicionar evento
        </Button>
      </div>

      {entries.length === 0 ? (
        <EmptyState label="Nenhum evento ainda." cta="Adicionar evento" onClick={onAdd} />
      ) : (
        <div className="relative space-y-4 md:space-y-5">
          <div className="absolute bottom-6 left-[67px] top-6 hidden w-px bg-border md:block" />
          {entries.map((entry) => (
            <div key={entry.id} className="relative grid gap-2 md:grid-cols-[120px_minmax(0,1fr)] md:gap-5">
              <TimelineDate date={entry.entry_date} />
              <span className="absolute left-[63px] top-7 hidden h-2.5 w-2.5 rounded-full border-2 border-background bg-primary md:block" />
              <EventCard
                topic={topic}
                entry={entry}
                focusMode={focusMode}
                onEdit={() => onEdit(entry)}
                onMove={() => onMove(entry)}
                onDuplicate={() => onDuplicate(entry)}
                onDelete={() => onDelete(entry.id)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function NotesTab({ entries, onAdd, onEdit, onMove, onDuplicate, onDelete }: {
  entries: StudyEntry[];
  onAdd: () => void;
  onEdit: (entry: StudyEntry) => void;
  onMove: (entry: StudyEntry) => void;
  onDuplicate: (entry: StudyEntry) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Anotações</h2>
          <p className="text-sm text-muted-foreground">{entries.length} {entries.length === 1 ? "nota" : "notas"} com ideias, conclusões e conexões.</p>
        </div>
        <Button onClick={onAdd}><Plus className="mr-1.5 h-4 w-4" /> Nova anotação</Button>
      </div>
      {entries.length === 0 ? (
        <EmptyState label="Nenhuma anotação ainda." cta="Criar primeira anotação" onClick={onAdd} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {entries.map((entry) => (
            <Card key={entry.id} className="group transition-colors hover:border-foreground/20">
              <CardContent className="flex min-h-48 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><NotebookPen className="h-3.5 w-3.5" /> Anotação</div>
                    <h3 className="font-medium leading-snug">{entry.title}</h3>
                  </div>
                  <EntryActions onEdit={() => onEdit(entry)} onMove={() => onMove(entry)} onDuplicate={() => onDuplicate(entry)} onDelete={() => onDelete(entry.id)} />
                </div>
                <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">{entry.summary}</p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex flex-wrap gap-1.5">
                    {entry.tags?.map((tag) => <Badge key={tag} variant="secondary" className="text-[10px] font-normal">#{tag}</Badge>)}
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onEdit(entry)}>Abrir anotação</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyState({ label, cta, onClick }: { label: string; cta?: string; onClick?: () => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <BookOpen className="h-7 w-7 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{label}</p>
        {cta && onClick && <Button variant="outline" size="sm" onClick={onClick}>{cta}</Button>}
      </CardContent>
    </Card>
  );
}

function EntryActions({ onEdit, onMove, onDuplicate, onDelete }: {
  onEdit: () => void;
  onMove: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 gap-1 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label="Editar registro">
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Mais ações do registro">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onMove}>
            <ArrowRightLeft className="mr-2 h-3.5 w-3.5" /> Mover para outro tema
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy className="mr-2 h-3.5 w-3.5" /> Duplicar em outro tema
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={onDelete}>
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Remover
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TimelineDate({ date }: { date: string | null }) {
  if (!date) return <div className="text-xs text-muted-foreground md:pt-5">Sem data</div>;
  const parsed = parseLocalDate(date);
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(parsed).replace(".", "").toUpperCase();
  return (
    <div className="flex items-baseline gap-2 md:block md:pr-8 md:pt-3 md:text-right">
      <span className="text-2xl font-semibold tracking-tight text-primary md:block">{String(parsed.getDate()).padStart(2, "0")}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:block">{month} {parsed.getFullYear()}</span>
    </div>
  );
}

function EventCard({ topic, entry, focusMode, onEdit, onMove, onDuplicate, onDelete }: {
  topic: StudyTopic;
  entry: StudyEntry;
  focusMode: boolean;
  onEdit: () => void;
  onMove: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="group transition-colors hover:border-foreground/20">
      <CardContent className="space-y-3 p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className={cn("font-medium leading-snug", focusMode ? "text-lg" : "text-base")}>{entry.title}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/75">{entry.summary}</p>
          </div>
          <EntryActions onEdit={onEdit} onMove={onMove} onDuplicate={onDuplicate} onDelete={onDelete} />
        </div>
        {entry.highlight && (
          <blockquote className="border-l-2 border-primary/40 bg-muted/30 py-2 pl-4 pr-3 text-sm italic leading-relaxed text-foreground/85">
            {entry.highlight}
          </blockquote>
        )}
        {entry.notes && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground/70">Observações: </span>{entry.notes}
          </p>
        )}
        <EntryFooter entry={entry} />
        <EntryAIAssist topic={topic} entry={entry} />
      </CardContent>
    </Card>
  );
}

function KnowledgeCard({ topic, entry, onEdit, onMove, onDuplicate, onDelete }: {
  topic: StudyTopic;
  entry: StudyEntry;
  onEdit: () => void;
  onMove: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const sources = parseRepositorySources(entry);
  const hasSources = sources.some((source) => source.title || source.url || source.text);
  const summaryHtml = ensureHtml(entry.summary);
  return (
    <div className="group border-b border-border last:border-b-0 transition-colors hover:bg-muted/20">
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)_88px] md:p-5">
        <div className="min-w-0 space-y-3">
          <div>
            <h3 className="text-base font-medium leading-snug">{entry.title}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              {entry.category && <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">{entry.category}</Badge>}
              <span>Atualizado {formatRelative(entry.updated_at)}</span>
            </div>
          </div>

          <div className="space-y-2">
            {hasSources ? sources.map((source) => (
              <div key={source.id} className="rounded-lg border border-border bg-background/70 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium">
                  {source.kind === "link" ? <Link2 className="h-3.5 w-3.5 text-primary" /> : <FileText className="h-3.5 w-3.5 text-primary" />}
                  <span className="min-w-0 truncate">{source.title || (source.url ? getSourceHost(source.url) : "Texto livre")}</span>
                </div>
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer" className="flex items-start gap-1.5 break-all text-xs text-primary hover:underline">
                    <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" /> {source.url}
                  </a>
                ) : source.text ? (
                  <p className="line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{source.text}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Fonte sem conteúdo preenchido.</p>
                )}
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                Sem fonte adicionada.
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div
            className="prose prose-sm max-w-none text-foreground dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1"
            dangerouslySetInnerHTML={{ __html: summaryHtml }}
          />
          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border pt-3">
            <div className="flex flex-wrap gap-1.5">
              {entry.tags?.map((tag) => <Badge key={tag} variant="secondary" className="text-[10px] font-normal">#{tag}</Badge>)}
            </div>
            <EntryAIAssist topic={topic} entry={entry} mode="enrich" />
          </div>
        </div>

        <div className="flex justify-end md:pt-1">
          <EntryActions onEdit={onEdit} onMove={onMove} onDuplicate={onDuplicate} onDelete={onDelete} />
        </div>
      </div>
    </div>
  );
}

function EntryFooter({ entry }: { entry: StudyEntry }) {
  if (!entry.source_url && !entry.tags?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {entry.source_url && (
        <a href={entry.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <ExternalLink className="h-3 w-3" /> Fonte
        </a>
      )}
      {entry.tags?.map((tag) => <Badge key={tag} variant="secondary" className="text-[10px] font-normal">#{tag}</Badge>)}
    </div>
  );
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatEntryDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(parseLocalDate(value));
}

interface Takeaway {
  id: string;
  text: string;
  source: string;
  date: string | null;
}

function TopicOverview({
  notes,
  takeaways,
  focusMode,
}: {
  notes: string | null;
  takeaways: Takeaway[];
  focusMode: boolean;
}) {
  const hasNotes = !!notes && notes.trim().length > 0;
  const paragraphs = hasNotes ? splitParagraphs(notes!) : [];
  const hasTakeaways = takeaways.length > 0;

  return (
    <section
      className={cn(
        "mt-8 grid gap-8",
        hasNotes && hasTakeaways ? "lg:grid-cols-[minmax(0,1fr)_320px]" : "grid-cols-1"
      )}
    >
      {hasNotes && (
        <article className="min-w-0">
          <SectionEyebrow icon={FileText} label="Visão geral" />
          <div
            className={cn(
              "mt-4 space-y-5 font-serif text-foreground/90",
              focusMode ? "text-[19px] leading-[1.85]" : "text-[17px] leading-[1.8]"
            )}
          >
            {paragraphs.map((paragraph, index) => (
              <p
                key={index}
                className={cn(
                  "whitespace-pre-wrap",
                  index === 0 && "first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:text-5xl first-letter:font-semibold first-letter:leading-[0.9] first-letter:text-foreground"
                )}
              >
                {paragraph}
              </p>
            ))}
          </div>
        </article>
      )}

      {hasTakeaways && (
        <aside
          className={cn(
            "min-w-0",
            hasNotes ? "lg:sticky lg:top-6 lg:self-start" : ""
          )}
        >
          <SectionEyebrow icon={Sparkles} label="Principais takeaways" count={takeaways.length} />
          <ol className="mt-4 space-y-3">
            {takeaways.map((takeaway, index) => (
              <li
                key={takeaway.id}
                className="group relative rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-foreground/25"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-background text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 space-y-2">
                    <p className="text-[13px] leading-relaxed text-foreground/90">
                      <Quote className="mr-1 inline h-3 w-3 -translate-y-0.5 text-primary/60" aria-hidden />
                      {takeaway.text}
                    </p>
                    <p className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                      {takeaway.source}
                      {takeaway.date && (
                        <>
                          <span className="mx-1.5 text-border">•</span>
                          {formatEntryDate(takeaway.date)}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      )}
    </section>
  );
}

function SectionEyebrow({
  icon: Icon,
  label,
  count,
}: {
  icon: typeof FileText;
  label: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border/60 pb-2">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {count !== undefined && (
        <span className="ml-auto text-[11px] font-medium tabular-nums text-muted-foreground/70">
          {count.toString().padStart(2, "0")}
        </span>
      )}
    </div>
  );
}

function splitParagraphs(value: string): string[] {
  return value
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}


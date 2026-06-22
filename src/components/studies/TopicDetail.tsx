import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  ArrowRightLeft,
  BookOpen,
  Calendar,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Plus,
  Search,
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
  useUpdateTopic,
} from "@/hooks/useStudies";
import { formatRelative } from "@/lib/studyDate";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EntryAIAssist } from "./EntryAIAssist";
import { EntryFormDialog } from "./EntryFormDialog";
import { PickTopicDialog } from "./PickTopicDialog";
import { TopicFormDialog } from "./TopicFormDialog";

interface Props {
  topic: StudyTopic;
  focusMode?: boolean;
  onToggleFocus?: () => void;
}

type WorkspaceTab = "overview" | "library" | "timeline" | "notes";

export function TopicDetail({ topic, focusMode = false, onToggleFocus }: Props) {
  const { data: areas = [] } = useStudyAreas();
  const { data: entries = [] } = useStudyEntries(topic.id);
  const area = areas.find((item) => item.id === topic.area_id);
  const deleteEntry = useDeleteEntry();
  const deleteTopic = useDeleteTopic();
  const updateTopic = useUpdateTopic();
  const moveEntry = useMoveEntry();
  const duplicateEntry = useDuplicateEntry();
  const [, setParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [editTopic, setEditTopic] = useState(false);
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

  const [notesDraft, setNotesDraft] = useState(topic.notes ?? "");
  const [notesSaving, setNotesSaving] = useState(false);
  const lastSavedRef = useRef(topic.notes ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setActiveTab("overview");
    setNotesDraft(topic.notes ?? "");
    lastSavedRef.current = topic.notes ?? "";
  }, [topic.id, topic.notes]);

  useEffect(() => {
    if (notesDraft === lastSavedRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setNotesSaving(true);
      try {
        await updateTopic.mutateAsync({
          id: topic.id,
          notes: notesDraft.trim() ? notesDraft : null,
        });
        lastSavedRef.current = notesDraft;
      } finally {
        setNotesSaving(false);
      }
    }, 700);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [notesDraft, topic.id, updateTopic]);

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
              {topic.description && (
                <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
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
              <Button variant="outline" size="sm" onClick={() => openEntry("event")}>
                <Calendar className="mr-1.5 h-3.5 w-3.5" /> Adicionar evento
              </Button>
              <Button size="sm" onClick={() => openEntry("knowledge")}>
                <BookOpen className="mr-1.5 h-3.5 w-3.5" /> Item na biblioteca
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
            <TabsList className="h-11 min-w-[520px] justify-start gap-1 rounded-none bg-transparent p-0">
              <WorkspaceTabTrigger value="overview" icon={LayoutDashboard} label="Visão geral" />
              <WorkspaceTabTrigger value="library" icon={BookOpen} label="Biblioteca" count={knowledge.length} />
              <WorkspaceTabTrigger value="timeline" icon={Calendar} label="Timeline" count={events.length} />
              <WorkspaceTabTrigger value="notes" icon={NotebookPen} label="Anotações" />
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-6">
            <OverviewTab
              topic={topic}
              knowledge={knowledge}
              events={events}
              hasNotes={Boolean(notesDraft.trim())}
              onChangeTab={setActiveTab}
            />
          </TabsContent>

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
              value={notesDraft}
              onChange={setNotesDraft}
              saving={notesSaving}
              saved={notesDraft === lastSavedRef.current}
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

function OverviewTab({
  topic,
  knowledge,
  events,
  hasNotes,
  onChangeTab,
}: {
  topic: StudyTopic;
  knowledge: StudyEntry[];
  events: StudyEntry[];
  hasNotes: boolean;
  onChangeTab: (tab: WorkspaceTab) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={BookOpen} label="Biblioteca" value={knowledge.length} hint="itens cadastrados" />
        <SummaryCard icon={Calendar} label="Timeline" value={events.length} hint="eventos registrados" />
        <SummaryCard icon={NotebookPen} label="Anotações" value={hasNotes ? "Ativas" : "Vazias"} hint="com salvamento automático" />
        <SummaryCard icon={Clock3} label="Última atualização" value={formatRelative(topic.last_updated_at ?? topic.updated_at)} hint="atividade do tema" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_0.8fr]">
        <RecentBlock
          title="Últimos itens da biblioteca"
          empty="Nenhum item na biblioteca."
          entries={knowledge.slice(0, 3)}
          onViewAll={() => onChangeTab("library")}
        />
        <RecentBlock
          title="Últimos eventos"
          empty="Nenhum evento na timeline."
          entries={events.slice(0, 3)}
          onViewAll={() => onChangeTab("timeline")}
          showDate
        />
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Sobre este tema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p className="leading-relaxed">
              {topic.description || "Adicione uma descrição para contextualizar este tema."}
            </p>
            <Button variant="ghost" size="sm" className="h-auto px-0 text-foreground" onClick={() => onChangeTab("notes")}>
              Abrir anotações <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, hint }: {
  icon: typeof BookOpen;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4 md:p-5">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-semibold tracking-tight">{value}</p>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentBlock({ title, empty, entries, onViewAll, showDate = false }: {
  title: string;
  empty: string;
  entries: StudyEntry[];
  onViewAll: () => void;
  showDate?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="divide-y divide-border">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 py-3 first:pt-1">
                <div className="rounded-md bg-muted p-1.5 text-muted-foreground">
                  {showDate ? <Calendar className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{entry.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {showDate && entry.entry_date ? formatEntryDate(entry.entry_date) : entry.category || formatRelative(entry.updated_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        <Button variant="ghost" size="sm" className="mt-2 h-auto px-0 text-xs" onClick={onViewAll}>
          Ver tudo <ArrowRight className="ml-1.5 h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
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
    return entries.filter((entry) =>
      [entry.title, entry.summary, entry.category, ...(entry.tags ?? [])]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(normalized))
    );
  }, [entries, query]);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Biblioteca</h2>
          <p className="text-sm text-muted-foreground">{entries.length} {entries.length === 1 ? "item" : "itens"}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar na biblioteca..." className="pl-9" />
          </div>
          <Button onClick={onAdd}>
            <Plus className="mr-1.5 h-4 w-4" /> Adicionar item
          </Button>
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <EmptyState
          label={query ? "Nenhum item corresponde à busca." : "Biblioteca vazia."}
          cta={query ? undefined : "Adicionar item à biblioteca"}
          onClick={query ? undefined : onAdd}
        />
      ) : (
        <div className="mx-auto max-w-5xl space-y-3">
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

function NotesTab({ value, onChange, saving, saved }: {
  value: string;
  onChange: (value: string) => void;
  saving: boolean;
  saved: boolean;
}) {
  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Anotações do tema</h2>
          <p className="text-sm text-muted-foreground">Reflexões, perguntas e conexões livres.</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {saving ? "Salvando..." : saved ? "Salvo automaticamente" : ""}
        </span>
      </div>
      <Card>
        <CardContent className="p-3 md:p-5">
          <Textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Escreva suas reflexões, ideias soltas, perguntas e conexões..."
            className="min-h-[360px] resize-y border-0 bg-transparent text-sm leading-7 shadow-none focus-visible:ring-0 md:text-base"
          />
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">As alterações são salvas automaticamente.</p>
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
  const [contentOpen, setContentOpen] = useState(false);
  const hasContent = Boolean(entry.content?.trim());
  return (
    <>
      <Card className="group transition-colors hover:border-foreground/20">
        <CardContent className="space-y-3 p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              {entry.category && <Badge variant="outline" className="text-[10px] font-normal uppercase tracking-wider">{entry.category}</Badge>}
              <h3 className="text-base font-medium leading-snug">{entry.title}</h3>
            </div>
            <EntryActions onEdit={onEdit} onMove={onMove} onDuplicate={onDuplicate} onDelete={onDelete} />
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/75">{entry.summary}</p>
          {hasContent && (
            <Button variant="ghost" size="sm" className="h-auto w-fit px-0 text-xs" onClick={() => setContentOpen(true)}>
              Ver conteúdo <ArrowRight className="ml-1.5 h-3 w-3" />
            </Button>
          )}
          <div className="space-y-3 pt-2">
            <EntryFooter entry={entry} />
            <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <span>Atualizado {formatRelative(entry.updated_at)}</span>
              <EntryAIAssist topic={topic} entry={entry} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={contentOpen} onOpenChange={setContentOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{entry.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <p className="text-sm leading-relaxed text-muted-foreground">{entry.summary}</p>
            <div className="whitespace-pre-wrap text-sm leading-7 text-foreground/90 md:text-base">{entry.content}</div>
            {entry.notes && (
              <div className="rounded-lg bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Observações: </span>{entry.notes}
              </div>
            )}
            <EntryFooter entry={entry} />
          </div>
        </DialogContent>
      </Dialog>
    </>
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

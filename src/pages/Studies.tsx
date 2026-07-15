import { useMemo, useState } from "react";
import { confirmDialog } from "@/components/ui/dialog-service";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, FolderOpen, ArrowLeft, MoreHorizontal, Trash2, Pencil, GraduationCap, ChevronRight, BookOpen, Calendar } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  useStudyAreas, useStudyTopics, useAllRecentEntries, useDeleteArea, useDeleteTopic,
  type StudyArea, type StudyTopic,
} from "@/hooks/useStudies";
import { AreaFormDialog } from "@/components/studies/AreaFormDialog";
import { TopicFormDialog } from "@/components/studies/TopicFormDialog";
import { TopicDetail } from "@/components/studies/TopicDetail";
import { formatRelative, formatDateBR } from "@/lib/studyDate";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export default function Studies() {
  const [params, setParams] = useSearchParams();
  const isMobile = useIsMobile();
  const areaId = params.get("area");
  const topicId = params.get("topic");
  const focusMode = params.get("focus") === "1";

  const toggleFocus = () => {
    const p = new URLSearchParams(params);
    if (focusMode) p.delete("focus");
    else p.set("focus", "1");
    setParams(p, { replace: true });
  };

  const { data: areas = [], isLoading: areasLoading } = useStudyAreas();
  const { data: topics = [] } = useStudyTopics(areaId);
  const { data: allTopics = [] } = useStudyTopics(null);
  const { data: recentEntries = [] } = useAllRecentEntries(8);

  const [areaDialog, setAreaDialog] = useState<{ open: boolean; edit?: StudyArea }>({ open: false });
  const [topicDialog, setTopicDialog] = useState<{ open: boolean; edit?: StudyTopic }>({ open: false });
  const deleteArea = useDeleteArea();
  const deleteTopic = useDeleteTopic();

  const selectedTopic = useMemo(
    () => allTopics.find((t) => t.id === topicId) ?? null,
    [allTopics, topicId]
  );

  const setSelection = (next: { area?: string | null; topic?: string | null }) => {
    const p = new URLSearchParams(params);
    if (next.area !== undefined) {
      if (next.area) p.set("area", next.area);
      else p.delete("area");
    }
    if (next.topic !== undefined) {
      if (next.topic) p.set("topic", next.topic);
      else p.delete("topic");
    }
    setParams(p, { replace: true });
  };

  const topicsByArea = useMemo(() => {
    const map = new Map<string, number>();
    allTopics.forEach((t) => map.set(t.area_id, (map.get(t.area_id) ?? 0) + 1));
    return map;
  }, [allTopics]);


  // ---------------- Empty home view ----------------
  if (!areaId && !topicId) {
    return (
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-8">
          <header className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold tracking-tight">Conhecimento</h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                Organize áreas, temas, leituras e eventos importantes em um só lugar.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAreaDialog({ open: true })}>
                <Plus className="h-4 w-4 mr-1.5" /> Nova área
              </Button>
              <Button onClick={() => setTopicDialog({ open: true })} disabled={areas.length === 0}>
                <Plus className="h-4 w-4 mr-1.5" /> Novo tema
              </Button>
            </div>
          </header>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Áreas de conhecimento</h2>
                <span className="text-xs text-muted-foreground">{areas.length} {areas.length === 1 ? "área" : "áreas"}</span>
              </div>
              {areasLoading ? (
                <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando...</CardContent></Card>
              ) : areas.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-10 text-center space-y-3">
                    <GraduationCap className="h-8 w-8 mx-auto text-muted-foreground" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Comece criando uma área</p>
                      <p className="text-xs text-muted-foreground">Ex.: Brasil, IA, ServiceNow, Geopolítica.</p>
                    </div>
                    <Button onClick={() => setAreaDialog({ open: true })}><Plus className="h-4 w-4 mr-1.5" />Criar primeira área</Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="divide-y divide-border p-0">
                    {areas.map((a) => (
                      <div key={a.id} className="group flex items-center gap-1 p-2">
                        <button
                          onClick={() => setSelection({ area: a.id })}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted/60"
                        >
                          <span className="rounded-lg bg-primary/10 p-2 text-primary"><FolderOpen className="h-4 w-4" /></span>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-medium">{a.name}</h3>
                            <p className="truncate text-xs text-muted-foreground">{a.description || `${topicsByArea.get(a.id) ?? 0} temas`}</p>
                          </div>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{topicsByArea.get(a.id) ?? 0} temas</span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setAreaDialog({ open: true, edit: a })}><Pencil className="h-3.5 w-3.5 mr-2" /> Editar</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={async () => { if (await confirmDialog({ title: "Remover área", description: `Remover área "${a.name}" e todos os temas?`, destructive: true, confirmLabel: "Remover" })) deleteArea.mutate(a.id); }}>
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Atividade recente</h2>
                <span className="text-xs text-muted-foreground">Últimos registros</span>
              </div>
              <Card className="h-[calc(100%-1.75rem)] min-h-56">
                <CardContent className="divide-y divide-border p-0">
                  {recentEntries.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma atividade recente.</p>
                  ) : recentEntries.slice(0, 6).map((entry) => {
                    const topic = allTopics.find((item) => item.id === entry.topic_id);
                    return (
                      <button key={entry.id} className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-muted/50" onClick={() => topic && setSelection({ area: topic.area_id, topic: topic.id })}>
                        <span className="rounded-md bg-muted p-2 text-muted-foreground">
                          {entry.kind === "knowledge" ? <BookOpen className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{entry.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{topic?.title ?? "Tema"}</p>
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{entry.entry_date ? formatDateBR(entry.entry_date) : formatRelative(entry.updated_at)}</span>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            </section>
          </div>

          {allTopics.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Temas recentes</h2>
                <span className="text-xs text-muted-foreground">Atualizados recentemente</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {allTopics.slice(0, 4).map((topic) => {
                  const topicArea = areas.find((item) => item.id === topic.area_id);
                  return (
                    <Card key={topic.id} className="cursor-pointer transition-colors hover:border-foreground/25" onClick={() => setSelection({ area: topic.area_id, topic: topic.id })}>
                      <CardContent className="space-y-4 p-4">
                        <div className="flex items-start gap-3">
                          <span className="rounded-lg bg-primary/10 p-2 text-primary"><BookOpen className="h-4 w-4" /></span>
                          <div className="min-w-0">
                            <h3 className="line-clamp-2 text-sm font-medium">{topic.title}</h3>
                            <p className="truncate text-xs text-muted-foreground">{topicArea?.name ?? "Sem área"}</p>
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground">Atualizado {formatRelative(topic.last_updated_at ?? topic.updated_at)}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <AreaFormDialog open={areaDialog.open} onOpenChange={(o) => setAreaDialog({ open: o })} area={areaDialog.edit} />
        <TopicFormDialog open={topicDialog.open} onOpenChange={(o) => setTopicDialog({ open: o })} topic={topicDialog.edit} />
      </div>
    );
  }

  // ---------------- Workspace ----------------
  // Layout strategy:
  //  - area selected, no topic: [areas rail] [topics grid]  → grid uses all remaining space
  //  - topic open: [topics list 240px] [topic detail flex] → no areas column, max space for detail
  const inTopic = !!selectedTopic;
  const currentArea = areas.find((a) => a.id === areaId);

  return (
    <div className="flex-1 flex min-h-0 bg-background">
      {/* Areas rail — only visible when browsing an area (no topic open) */}
      {!inTopic && (
        <aside className={cn("w-full md:w-56 border-r border-border flex flex-col shrink-0", isMobile && areaId ? "hidden" : "")}>
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold">Áreas</h2>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAreaDialog({ open: true })}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              <button
                onClick={() => setSelection({ area: null, topic: null })}
                className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors text-muted-foreground"
              >
                ← Voltar
              </button>
              {areas.map((a) => (
                <div key={a.id} className="group flex items-center">
                  <button
                    onClick={() => setSelection({ area: a.id, topic: null })}
                    className={cn(
                      "flex-1 text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors flex items-center justify-between",
                      areaId === a.id && "bg-muted font-medium"
                    )}
                  >
                    <span className="truncate">{a.name}</span>
                    <span className="text-[11px] text-muted-foreground">{topicsByArea.get(a.id) ?? 0}</span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setAreaDialog({ open: true, edit: a })}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={async () => { if (await confirmDialog({ title: "Remover área", description: `Remover área "${a.name}" e todos os temas?`, destructive: true, confirmLabel: "Remover" })) { deleteArea.mutate(a.id); if (areaId === a.id) setSelection({ area: null, topic: null }); } }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </ScrollArea>
        </aside>
      )}

      {/* Area selected, no topic → topics as full-width card grid */}
      {!inTopic && areaId && (
        <main className={cn("flex-1 overflow-y-auto", isMobile && !areaId ? "hidden" : "")}>
          <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-6">
            <header className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1 min-w-0">
                {isMobile && (
                  <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setSelection({ area: null })}>
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Áreas
                  </Button>
                )}
                <h1 className="text-2xl font-semibold tracking-tight truncate">{currentArea?.name}</h1>
                <p className="text-xs text-muted-foreground">{topics.length} {topics.length === 1 ? "tema" : "temas"}</p>
              </div>
              <Button onClick={() => setTopicDialog({ open: true })}>
                <Plus className="h-4 w-4 mr-1.5" /> Novo tema
              </Button>
            </header>

            {topics.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-10 text-center text-sm text-muted-foreground space-y-3">
                  <p>Nenhum tema nesta área.</p>
                  <Button onClick={() => setTopicDialog({ open: true })}><Plus className="h-4 w-4 mr-1.5" />Criar primeiro tema</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {topics.map((t) => (
                  <Card
                    key={t.id}
                    onClick={() => setSelection({ topic: t.id })}
                    className="cursor-pointer hover:border-foreground/30 transition-colors group relative"
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-medium leading-snug flex-1 min-w-0">{t.title}</h3>
                        <div onClick={(e) => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-1">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setTopicDialog({ open: true, edit: t })}>
                                <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={async () => { if (await confirmDialog({ title: "Remover tema", description: `Remover tema "${t.title}" e todos os registros?`, destructive: true, confirmLabel: "Remover" })) deleteTopic.mutate(t.id); }}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      {t.description && <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                      <p className="text-[10px] text-muted-foreground">{formatRelative(t.last_updated_at ?? t.updated_at)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* Empty state for desktop when no area picked */}
      {!inTopic && !areaId && !isMobile && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Selecione uma área
        </div>
      )}

      {/* Topic open: full-width knowledge workspace */}
      {inTopic && selectedTopic && (
        <div className="flex min-w-0 flex-1 flex-col">
          {!focusMode && (
            <div className="border-b border-border px-2 py-1.5 sm:px-4">
              <Button variant="ghost" size="sm" onClick={() => setSelection({ topic: null })}>
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> {currentArea?.name ?? "Temas"}
              </Button>
            </div>
          )}
          <TopicDetail topic={selectedTopic} focusMode={focusMode} onToggleFocus={toggleFocus} />
        </div>
      )}


      <AreaFormDialog open={areaDialog.open} onOpenChange={(o) => setAreaDialog({ open: o })} area={areaDialog.edit} />
      <TopicFormDialog
        open={topicDialog.open}
        onOpenChange={(o) => setTopicDialog({ open: o })}
        topic={topicDialog.edit}
        defaultAreaId={areaId}
      />
    </div>
  );
}

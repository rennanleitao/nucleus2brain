import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, FolderOpen, ArrowLeft, MoreHorizontal, Trash2, Pencil, GraduationCap } from "lucide-react";
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
      next.area ? p.set("area", next.area) : p.delete("area");
    }
    if (next.topic !== undefined) {
      next.topic ? p.set("topic", next.topic) : p.delete("topic");
    }
    setParams(p, { replace: true });
  };

  const topicsByArea = useMemo(() => {
    const map = new Map<string, number>();
    allTopics.forEach((t) => map.set(t.area_id, (map.get(t.area_id) ?? 0) + 1));
    return map;
  }, [allTopics]);

  const stats = useMemo(() => {
    const total = allTopics.length;
    const oneWeekAgo = Date.now() - 7 * 86400000;
    const twoWeeksAgo = Date.now() - 14 * 86400000;
    const entriesThisWeek = recentEntries.filter((u) => new Date(u.entry_date).getTime() >= oneWeekAgo).length;
    const stale = allTopics.filter((t) => !t.last_updated_at || new Date(t.last_updated_at).getTime() < twoWeeksAgo).length;
    return { total, entriesThisWeek, stale };
  }, [allTopics, recentEntries]);

  // ---------------- Empty home view ----------------
  if (!areaId && !topicId) {
    return (
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-8">
          <header className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold tracking-tight">Conhecimentos Gerais</h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                Acompanhe temas de interesse com uma cronologia simples de registros.
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

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard label="Temas acompanhados" value={stats.total} />
            <StatCard label="Registros esta semana" value={stats.entriesThisWeek} />
            <StatCard label="Sem atualização" value={stats.stale} hint="14+ dias" />
          </div>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Áreas</h2>
            {areasLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {areas.map((a) => (
                  <Card
                    key={a.id}
                    onClick={() => setSelection({ area: a.id })}
                    className="cursor-pointer hover:border-foreground/30 transition-colors group relative"
                  >
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setAreaDialog({ open: true, edit: a })}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => { if (confirm(`Remover área "${a.name}" e todos os temas?`)) deleteArea.mutate(a.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardContent className="p-5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <FolderOpen className="h-5 w-5 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground pr-7">{topicsByArea.get(a.id) ?? 0} temas</span>
                      </div>
                      <h3 className="text-base font-medium leading-tight">{a.name}</h3>
                      {a.description && <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {recentEntries.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Últimos registros</h2>
              <Card>
                <CardContent className="p-0 divide-y divide-border">
                  {recentEntries.map((u) => {
                    const topic = allTopics.find((t) => t.id === u.topic_id);
                    return (
                      <button
                        key={u.id}
                        className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-start gap-3"
                        onClick={() => topic && setSelection({ area: topic.area_id, topic: topic.id })}
                      >
                        <span className="text-[11px] font-mono text-muted-foreground shrink-0 w-20 pt-0.5">{formatDateBR(u.entry_date)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{u.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{topic?.title ?? "—"}</p>
                        </div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
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
                        onClick={() => { if (confirm(`Remover área "${a.name}" e todos os temas?`)) { deleteArea.mutate(a.id); if (areaId === a.id) setSelection({ area: null, topic: null }); } }}
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
                                onClick={() => { if (confirm(`Remover tema "${t.title}" e todos os registros?`)) deleteTopic.mutate(t.id); }}
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

      {/* Topic open: narrow topics list + spacious detail */}
      {inTopic && selectedTopic && (
        <>
          <aside className={cn("md:w-60 border-r border-border flex flex-col shrink-0", isMobile ? "hidden" : "flex")}>
            <div className="p-3 border-b border-border space-y-2">
              <button
                onClick={() => setSelection({ topic: null })}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> {currentArea?.name ?? "Áreas"}
              </button>
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Temas</p>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setTopicDialog({ open: true })}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-0.5">
                {topics.map((t) => (
                  <div key={t.id} className="group flex items-center">
                    <button
                      onClick={() => setSelection({ topic: t.id })}
                      className={cn(
                        "flex-1 text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors truncate min-w-0",
                        topicId === t.id && "bg-muted font-medium"
                      )}
                    >
                      {t.title}
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setTopicDialog({ open: true, edit: t })}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            if (confirm(`Remover tema "${t.title}" e todos os registros?`)) {
                              deleteTopic.mutate(t.id);
                              if (topicId === t.id) setSelection({ topic: null });
                            }
                          }}
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

          <div className="flex-1 flex flex-col min-w-0">
            {isMobile && (
              <div className="p-2 border-b border-border flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelection({ topic: null })}>
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" /> {currentArea?.name ?? "Voltar"}
                </Button>
              </div>
            )}
            <TopicDetail topic={selectedTopic} />
          </div>
        </>
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

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Pencil, Trash2, ExternalLink, BookOpen, Link2, ListChecks, Save, X,
} from "lucide-react";
import {
  useStudyUpdates, useStudySources, useBookSummaries, useUpdateTopic, useDeleteUpdate,
  useDeleteSource, useDeleteBookSummary, useStudyAreas, UPDATE_TYPE_LABELS,
  SOURCE_TYPE_LABELS, type StudyTopic,
} from "@/hooks/useStudies";
import { StatusBadge } from "./StatusBadge";
import { UpdateFormDialog } from "./UpdateFormDialog";
import { SourceFormDialog } from "./SourceFormDialog";
import { BookSummaryFormDialog } from "./BookSummaryFormDialog";
import { TopicFormDialog } from "./TopicFormDialog";
import { formatDateBR, formatRelative } from "@/lib/studyDate";
import { toast } from "sonner";

interface Props {
  topic: StudyTopic;
}

interface TrackingPoint { id: string; text: string; done: boolean }

export function TopicDetail({ topic }: Props) {
  const { data: areas = [] } = useStudyAreas();
  const { data: updates = [] } = useStudyUpdates(topic.id);
  const { data: sources = [] } = useStudySources(topic.id);
  const { data: books = [] } = useBookSummaries(topic.id);
  const area = areas.find((a) => a.id === topic.area_id);

  const updateTopic = useUpdateTopic();
  const deleteUpdate = useDeleteUpdate();
  const deleteSource = useDeleteSource();
  const deleteBook = useDeleteBookSummary();

  const [editTopic, setEditTopic] = useState(false);
  const [updateDialog, setUpdateDialog] = useState<{ open: boolean; edit?: any }>({ open: false });
  const [sourceDialog, setSourceDialog] = useState(false);
  const [bookDialog, setBookDialog] = useState(false);

  // Inline editing of leitura atual
  const [editingReading, setEditingReading] = useState(false);
  const [readingDraft, setReadingDraft] = useState(topic.current_reading ?? "");

  // Tracking points
  const points: TrackingPoint[] = Array.isArray(topic.tracking_points)
    ? (topic.tracking_points as any[]).map((p) => ({ id: String(p.id ?? crypto.randomUUID()), text: String(p.text ?? ""), done: !!p.done }))
    : [];
  const [newPoint, setNewPoint] = useState("");

  const savePoints = async (next: TrackingPoint[]) => {
    await updateTopic.mutateAsync({ id: topic.id, tracking_points: next as any });
  };

  const togglePoint = (id: string) => {
    savePoints(points.map((p) => (p.id === id ? { ...p, done: !p.done } : p)));
  };
  const removePoint = (id: string) => savePoints(points.filter((p) => p.id !== id));
  const addPoint = () => {
    if (!newPoint.trim()) return;
    savePoints([...points, { id: crypto.randomUUID(), text: newPoint.trim(), done: false }]);
    setNewPoint("");
  };

  const saveReading = async () => {
    await updateTopic.mutateAsync({ id: topic.id, current_reading: readingDraft.trim() || null });
    setEditingReading(false);
    toast.success("Leitura atual atualizada");
  };

  const whatChangedItems = updates.filter((u) => u.what_changed?.trim()).slice(0, 5);

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-8">
        {/* Header */}
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
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={topic.status} />
                {topic.tags?.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[10px] font-normal">#{t}</Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setEditTopic(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
              </Button>
              <Button size="sm" onClick={() => setUpdateDialog({ open: true })}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Atualização
              </Button>
            </div>
          </div>
        </header>

        <Separator />

        {/* Leitura atual */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Leitura atual</h2>
            {!editingReading && (
              <Button variant="ghost" size="sm" onClick={() => { setReadingDraft(topic.current_reading ?? ""); setEditingReading(true); }}>
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
          {editingReading ? (
            <div className="space-y-2">
              <Textarea value={readingDraft} onChange={(e) => setReadingDraft(e.target.value)} rows={5} autoFocus />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setEditingReading(false)}><X className="h-3.5 w-3.5 mr-1" />Cancelar</Button>
                <Button size="sm" onClick={saveReading}><Save className="h-3.5 w-3.5 mr-1" />Salvar</Button>
              </div>
            </div>
          ) : topic.current_reading ? (
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{topic.current_reading}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Sem leitura registrada. Clique no lápis para escrever sua interpretação atual.</p>
          )}
        </section>

        {/* Atualizações */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Atualizações recentes</h2>
            <span className="text-xs text-muted-foreground">{updates.length} no total</span>
          </div>
          {updates.length === 0 ? (
            <Card className="border-dashed"><CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma atualização ainda. <button className="text-foreground underline" onClick={() => setUpdateDialog({ open: true })}>Adicionar a primeira</button>.
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {updates.map((u) => (
                <Card key={u.id} className="hover:border-foreground/20 transition-colors group">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="font-mono">{formatDateBR(u.date)}</span>
                          <Badge variant="outline" className="font-normal text-[10px] uppercase tracking-wider">{UPDATE_TYPE_LABELS[u.type]}</Badge>
                          {u.source_name && <span className="truncate">{u.source_name}</span>}
                        </div>
                        <h3 className="text-sm font-medium leading-snug">{u.title}</h3>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setUpdateDialog({ open: true, edit: u })}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm("Remover atualização?")) deleteUpdate.mutate(u.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">{u.summary}</p>
                    {u.why_it_matters && (
                      <div className="text-xs text-muted-foreground border-l-2 border-border pl-3">
                        <span className="font-medium text-foreground/70">Por que importa: </span>{u.why_it_matters}
                      </div>
                    )}
                    {(u.source_url || (u.tags && u.tags.length > 0)) && (
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        {u.source_url && (
                          <a href={u.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                            <ExternalLink className="h-3 w-3" /> Fonte
                          </a>
                        )}
                        {u.tags?.map((t) => <Badge key={t} variant="secondary" className="text-[10px] font-normal">#{t}</Badge>)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* O que mudou */}
        {whatChangedItems.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">O que mudou</h2>
            <ul className="space-y-2 text-sm">
              {whatChangedItems.map((u) => (
                <li key={u.id} className="flex gap-3 text-foreground/80">
                  <span className="text-muted-foreground font-mono text-xs mt-0.5 shrink-0">{formatDateBR(u.date)}</span>
                  <span>{u.what_changed}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Pontos para acompanhar */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <ListChecks className="h-4 w-4" /> Pontos para acompanhar
          </h2>
          <div className="space-y-1.5">
            {points.map((p) => (
              <div key={p.id} className="group flex items-center gap-3 py-1">
                <Checkbox checked={p.done} onCheckedChange={() => togglePoint(p.id)} />
                <span className={`text-sm flex-1 ${p.done ? "line-through text-muted-foreground" : ""}`}>{p.text}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removePoint(p.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <form
              onSubmit={(e) => { e.preventDefault(); addPoint(); }}
              className="flex items-center gap-2 pt-1"
            >
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={newPoint}
                onChange={(e) => setNewPoint(e.target.value)}
                placeholder="Adicionar ponto..."
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 h-7 text-sm"
              />
            </form>
          </div>
        </section>

        {/* Fontes */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Fontes principais
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setSourceDialog(true)}><Plus className="h-3.5 w-3.5 mr-1" />Fonte</Button>
          </div>
          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nenhuma fonte registrada.</p>
          ) : (
            <div className="space-y-1">
              {sources.map((s) => (
                <div key={s.id} className="group flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline truncate">{s.name}</a>
                      ) : (
                        <span className="text-sm font-medium truncate">{s.name}</span>
                      )}
                      <Badge variant="outline" className="text-[10px] font-normal uppercase tracking-wider">{SOURCE_TYPE_LABELS[s.source_type]}</Badge>
                    </div>
                    {s.notes && <p className="text-xs text-muted-foreground mt-0.5">{s.notes}</p>}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono shrink-0">{formatDateBR(s.captured_at)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => { if (confirm("Remover fonte?")) deleteSource.mutate(s.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Livros */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Resumos de livros
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setBookDialog(true)}><Plus className="h-3.5 w-3.5 mr-1" />Livro</Button>
          </div>
          {books.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nenhum resumo de livro.</p>
          ) : (
            <div className="space-y-2">
              {books.map((b) => (
                <Card key={b.id} className="group">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium">{b.title}</h3>
                        <p className="text-xs text-muted-foreground">{[b.author, b.year].filter(Boolean).join(" · ")}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                        {b.notebooklm_url && (
                          <a href={b.notebooklm_url} target="_blank" rel="noreferrer">
                            <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="h-3 w-3" /></Button>
                          </a>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm("Remover resumo?")) deleteBook.mutate(b.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {b.executive_summary && <p className="text-sm text-foreground/80 leading-relaxed">{b.executive_summary}</p>}
                    {b.main_ideas && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer hover:text-foreground">Ver mais</summary>
                        <div className="mt-2 space-y-2 text-foreground/80 text-sm">
                          {b.main_ideas && <div><div className="font-medium text-foreground/70 text-xs uppercase tracking-wider mb-1">Principais ideias</div><p className="whitespace-pre-wrap">{b.main_ideas}</p></div>}
                          {b.key_concepts && <div><div className="font-medium text-foreground/70 text-xs uppercase tracking-wider mb-1">Conceitos</div><p className="whitespace-pre-wrap">{b.key_concepts}</p></div>}
                          {b.relevant_quotes && <div><div className="font-medium text-foreground/70 text-xs uppercase tracking-wider mb-1">Citações</div><p className="whitespace-pre-wrap">{b.relevant_quotes}</p></div>}
                          {b.practical_applications && <div><div className="font-medium text-foreground/70 text-xs uppercase tracking-wider mb-1">Aplicações práticas</div><p className="whitespace-pre-wrap">{b.practical_applications}</p></div>}
                          {b.review_questions && <div><div className="font-medium text-foreground/70 text-xs uppercase tracking-wider mb-1">Perguntas para revisão</div><p className="whitespace-pre-wrap">{b.review_questions}</p></div>}
                        </div>
                      </details>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      <UpdateFormDialog
        open={updateDialog.open}
        onOpenChange={(o) => setUpdateDialog({ open: o, edit: o ? updateDialog.edit : undefined })}
        topicId={topic.id}
        update={updateDialog.edit}
      />
      <SourceFormDialog open={sourceDialog} onOpenChange={setSourceDialog} topicId={topic.id} />
      <BookSummaryFormDialog open={bookDialog} onOpenChange={setBookDialog} topicId={topic.id} />
      <TopicFormDialog open={editTopic} onOpenChange={setEditTopic} topic={topic} />
    </div>
  );
}

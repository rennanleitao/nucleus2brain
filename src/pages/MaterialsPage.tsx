import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, Link as LinkIcon, Trash2, FolderOpen, CheckSquare, Plus, Tag as TagIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createTaskMaterial, fetchSpaces, fetchTasks, fetchAllTags } from "@/lib/api";
import { toast } from "sonner";

interface MaterialRow {
  id: string;
  title: string;
  url: string;
  description: string | null;
  task_id: string | null;
  created_at: string;
  task_title: string | null;
  space_id: string | null;
  space_name: string | null;
  tag: string | null;
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  const loadMaterials = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("task_materials")
      .select("*, tasks(title, space_id, spaces(name)), spaces(name)")
      .order("created_at", { ascending: false });

    if (!error && data) {
      const mapped: MaterialRow[] = data.map((m: any) => ({
        id: m.id,
        title: m.title,
        url: m.url,
        description: m.description,
        task_id: m.task_id,
        created_at: m.created_at,
        task_title: m.tasks?.title || null,
        // Prefer direct space link; fallback to task's space
        space_id: m.space_id || m.tasks?.space_id || null,
        space_name: m.spaces?.name || m.tasks?.spaces?.name || null,
        tag: m.tag || null,
      }));
      setMaterials(mapped);
    }
    setLoading(false);
  };

  useEffect(() => { loadMaterials(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return materials;
    const q = search.toLowerCase();
    return materials.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.url.toLowerCase().includes(q) ||
        (m.description || "").toLowerCase().includes(q) ||
        (m.task_title || "").toLowerCase().includes(q) ||
        (m.space_name || "").toLowerCase().includes(q) ||
        (m.tag || "").toLowerCase().includes(q)
    );
  }, [materials, search]);

  const handleDelete = async (id: string) => {
    await (supabase as any).from("task_materials").delete().eq("id", id);
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Materiais</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Todos os materiais de referência, vinculados ou não a tarefas.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Novo material
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título, URL, task, space ou tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground animate-pulse">Carregando materiais...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <LinkIcon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">
            {search ? "Nenhum material encontrado para essa busca." : "Nenhum material adicionado ainda."}
          </p>
          {!search && (
            <Button onClick={() => setCreateOpen(true)} variant="outline" size="sm" className="mt-4">
              <Plus className="h-4 w-4 mr-1" /> Adicionar primeiro material
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((mat) => (
            <div
              key={mat.id}
              className="group border border-border rounded-lg p-3 sm:p-4 bg-card hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={mat.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline flex items-center gap-1 truncate"
                    >
                      <LinkIcon className="h-3.5 w-3.5 shrink-0" />
                      {mat.title}
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                    </a>
                  </div>

                  {mat.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{mat.description}</p>
                  )}

                  

                  {(mat.task_title || mat.space_name || mat.tag) && (
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {mat.task_title && (
                        <Badge
                          variant="outline"
                          className="text-[10px] cursor-pointer hover:bg-accent"
                          onClick={() => navigate("/tasks")}
                        >
                          <CheckSquare className="h-3 w-3 mr-1" />
                          {mat.task_title}
                        </Badge>
                      )}
                      {mat.space_name && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] cursor-pointer hover:bg-accent"
                          onClick={() => mat.space_id && navigate(`/spaces/${mat.space_id}`)}
                        >
                          <FolderOpen className="h-3 w-3 mr-1" />
                          {mat.space_name}
                        </Badge>
                      )}
                      {mat.tag && (
                        <Badge
                          variant="outline"
                          className="text-[10px] cursor-pointer hover:bg-accent"
                          onClick={() => navigate(`/tags?tag=${encodeURIComponent(mat.tag!)}`)}
                        >
                          <TagIcon className="h-3 w-3 mr-1" />
                          #{mat.tag}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleDelete(mat.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  title="Remover material"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        {filtered.length} {filtered.length === 1 ? "material" : "materiais"} encontrado{filtered.length === 1 ? "" : "s"}
      </p>

      <CreateMaterialDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={loadMaterials}
      />
    </div>
  );
}

// ----- Create Material Dialog -----
function CreateMaterialDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [taskId, setTaskId] = useState<string>("");
  const [spaceId, setSpaceId] = useState<string>("");
  const [tag, setTag] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const [spaces, setSpaces] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    fetchSpaces().then(setSpaces).catch(() => {});
    fetchTasks().then(setTasks).catch(() => {});
    fetchAllTags().then(setAllTags).catch(() => {});
  }, [open]);

  const reset = () => {
    setTitle(""); setUrl(""); setDescription("");
    setTaskId(""); setSpaceId(""); setTag("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    setSaving(true);
    try {
      await createTaskMaterial({
        title: title.trim(),
        url: url.trim(),
        description: description.trim() || null,
        task_id: taskId || null,
        space_id: spaceId || null,
        tag: tag.trim().replace(/^#/, "") || null,
      });
      toast.success("Material adicionado");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar material");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto bg-background p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="text-base font-semibold tracking-tight">Novo material</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="field-label">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Documentação da API"
              className="field-input"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="field-label">URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="field-input"
              required
            />
          </div>

          <div>
            <label className="field-label">Descrição (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Resumo curto do conteúdo"
              className="field-input h-20 resize-none"
            />
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Vínculos (opcionais)
            </p>

            <div>
              <label className="field-label flex items-center gap-1.5">
                <CheckSquare className="h-3 w-3" /> Task
              </label>
              <select
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className="field-input"
              >
                <option value="">Nenhuma</option>
                {tasks.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label flex items-center gap-1.5">
                <FolderOpen className="h-3 w-3" /> Space
              </label>
              <select
                value={spaceId}
                onChange={(e) => setSpaceId(e.target.value)}
                className="field-input"
              >
                <option value="">Nenhum</option>
                {spaces.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label flex items-center gap-1.5">
                <TagIcon className="h-3 w-3" /> Tag
              </label>
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="ex.: pesquisa"
                list="materials-tag-suggestions"
                className="field-input"
              />
              <datalist id="materials-tag-suggestions">
                {allTags.map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !title.trim() || !url.trim()}>
              {saving ? "Salvando..." : "Adicionar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

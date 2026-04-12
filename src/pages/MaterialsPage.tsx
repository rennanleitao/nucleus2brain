import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, ExternalLink, Link as LinkIcon, Trash2, FolderOpen, CheckSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface MaterialRow {
  id: string;
  title: string;
  url: string;
  description: string | null;
  task_id: string;
  created_at: string;
  task_title: string;
  space_id: string | null;
  space_name: string | null;
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const loadMaterials = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("task_materials")
      .select("*, tasks(title, space_id, spaces(name))")
      .order("created_at", { ascending: false });

    if (!error && data) {
      const mapped: MaterialRow[] = data.map((m: any) => ({
        id: m.id,
        title: m.title,
        url: m.url,
        description: m.description,
        task_id: m.task_id,
        created_at: m.created_at,
        task_title: m.tasks?.title || "Tarefa removida",
        space_id: m.tasks?.space_id || null,
        space_name: m.tasks?.spaces?.name || null,
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
        m.task_title.toLowerCase().includes(q) ||
        (m.space_name || "").toLowerCase().includes(q)
    );
  }, [materials, search]);

  const handleDelete = async (id: string) => {
    await (supabase as any).from("task_materials").delete().eq("id", id);
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Materiais</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Todos os materiais de referência vinculados às suas tarefas.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título, URL, task ou space..."
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

                  <p className="text-[11px] text-muted-foreground/70 truncate">{mat.url}</p>

                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <Badge
                      variant="outline"
                      className="text-[10px] cursor-pointer hover:bg-accent"
                      onClick={() => navigate("/tasks")}
                    >
                      <CheckSquare className="h-3 w-3 mr-1" />
                      {mat.task_title}
                    </Badge>
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
                  </div>
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
    </div>
  );
}

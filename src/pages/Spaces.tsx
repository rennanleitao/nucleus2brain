import { useEffect, useState, useMemo } from "react";
import { fetchSpaces, updateSpaceCategory, deleteSpaceCategory } from "@/lib/api";
import { SpaceCard } from "@/components/SpaceCard";
import { CreateSpaceDialog } from "@/components/CreateSpaceDialog";
import { EditSpaceDialog } from "@/components/EditSpaceDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { FolderOpen, Search, ChevronDown, MoreVertical, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

const NO_CATEGORY_KEY = "__none__";

export default function Spaces() {
  const [spaces, setSpaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSpace, setEditingSpace] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("spaces.collapsedCategories");
      if (raw) return new Set(JSON.parse(raw));
    } catch {}
    return new Set();
  });

  const startRename = (id: string, name: string) => {
    setRenaming({ id, name });
  };

  const cancelRename = () => setRenaming(null);

  const confirmRename = async () => {
    if (!renaming) return;
    try {
      await updateSpaceCategory(renaming.id, renaming.name);
      toast.success("Categoria atualizada");
      setRenaming(null);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteSpaceCategory(deletingId);
      toast.success("Categoria excluída");
      setDeletingId(null);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleCategoryCollapsed = (key: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem("spaces.collapsedCategories", JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const load = async () => {
    try {
      setSpaces(await fetchSpaces());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredSpaces = useMemo(() => {
    return spaces
      .filter(s =>
        !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.description || "").toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [spaces, search]);

  const groupedSpaces = useMemo(() => {
    const byCategory = new Map<string, any[]>();
    for (const s of filteredSpaces) {
      const key = s.category_id || NO_CATEGORY_KEY;
      const list = byCategory.get(key) ?? [];
      list.push(s);
      byCategory.set(key, list);
    }

    const groups: { key: string; label: string; spaces: any[] }[] = [];
    const seenCategoryIds = new Set<string>();

    // Preserve category creation order from spaces list, then alphabetical fallback
    for (const s of spaces) {
      if (s.category_id && s.space_categories?.name && !seenCategoryIds.has(s.category_id)) {
        const list = byCategory.get(s.category_id);
        if (list?.length) {
          groups.push({ key: s.category_id, label: s.space_categories.name, spaces: list });
          seenCategoryIds.add(s.category_id);
        }
      }
    }
    groups.sort((a, b) => a.label.localeCompare(b.label));

    const orphan = byCategory.get(NO_CATEGORY_KEY);
    if (orphan?.length) {
      groups.push({ key: NO_CATEGORY_KEY, label: "Sem categoria", spaces: orphan });
    }

    return groups;
  }, [filteredSpaces, spaces]);

  if (loading) {
    return <div className="p-6 flex items-center justify-center"><p className="text-small text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-end justify-between gap-3 pb-4 border-b border-border/60">
        <div className="min-w-0">
          <p className="eyebrow mb-2">Workspace</p>
          <h1 className="text-title">Spaces</h1>
          <p className="text-small text-muted-foreground mt-1">Organize your work into knowledge hubs.</p>
        </div>
        <CreateSpaceDialog onCreated={load} />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar spaces..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-muted/50 border border-transparent rounded-lg pl-9 pr-3 py-2 text-[13px] outline-none focus:border-border focus:bg-background transition-colors"
        />
      </div>

      {groupedSpaces.length > 0 ? (
        <div className="space-y-4">
          {groupedSpaces.map((group, groupIdx) => {
            const isCollapsed = collapsedCategories.has(group.key);
            return (
              <section key={group.key} className={`rounded-xl border border-border/60 bg-card overflow-hidden ${groupIdx > 0 ? "mt-4" : ""}`}>
                <button
                  type="button"
                  onClick={() => toggleCategoryCollapsed(group.key)}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-muted border-b border-border/60 group/hdr transition-colors"
                >
                  <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground group-hover/hdr:text-foreground transition-colors truncate">
                    {group.label}
                  </h3>
                  <span className="text-[10.5px] tabular-nums text-muted-foreground/60 font-medium">
                    {group.spaces.length}
                  </span>
                  <span className="flex-1" />
                  <ChevronDown className={`h-3 w-3 text-muted-foreground/50 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                </button>

                {!isCollapsed && (
                  <div className="divide-y divide-border/60">
                    {group.spaces.map(s => (
                      <div key={s.id} onDoubleClick={() => setEditingSpace(s)} title="Duplo clique para editar">
                        <SpaceCard space={s} variant="list" onCategoryChanged={load} />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <FolderOpen className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-small text-muted-foreground">
            {search ? "Nenhum space encontrado" : "No spaces yet. Create your first one."}
          </p>
        </div>
      )}

      {editingSpace && (
        <EditSpaceDialog
          space={editingSpace}
          open={!!editingSpace}
          onOpenChange={(open) => { if (!open) setEditingSpace(null); }}
          onUpdated={() => { setEditingSpace(null); load(); }}
          onDeleted={() => { setEditingSpace(null); load(); }}
        />
      )}
    </div>
  );
}

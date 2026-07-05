import { useEffect, useState } from "react";
import { fetchSpaces } from "@/lib/api";
import { SpaceCard } from "@/components/SpaceCard";
import { CreateSpaceDialog } from "@/components/CreateSpaceDialog";
import { EditSpaceDialog } from "@/components/EditSpaceDialog";
import { FolderOpen, Search } from "lucide-react";
import { toast } from "sonner";

export default function Spaces() {
  const [spaces, setSpaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSpace, setEditingSpace] = useState<any>(null);
  const [search, setSearch] = useState("");

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

  const filtered = spaces
    .filter(s =>
      !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.description || "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  if (loading) {
    return <div className="p-6 flex items-center justify-center"><p className="text-small text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-end justify-between gap-3 pb-4 border-b border-border/60">
        <div className="min-w-0">
          <p className="eyebrow mb-2">Workspace</p>
          <h1 className="text-title">Spaces</h1>
          <p className="text-small text-muted-foreground mt-1 italic font-serif">Organize your work into knowledge hubs.</p>
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

      {filtered.length > 0 ? (
        <div className="rounded-xl border border-border/60 overflow-hidden bg-card">
          {filtered.map(s => (
            <div key={s.id} onDoubleClick={() => setEditingSpace(s)} title="Duplo clique para editar">
              <SpaceCard space={s} variant="list" />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <FolderOpen className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-small text-muted-foreground italic font-serif">
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

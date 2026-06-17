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
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-title flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-muted-foreground" /> Spaces
          </h1>
          <p className="text-small text-muted-foreground mt-1">Organize your work into knowledge hubs</p>
        </div>
        <CreateSpaceDialog onCreated={load} />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar spaces..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-small outline-none focus:border-foreground transition-colors"
        />
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map(s => (
            <div key={s.id} onDoubleClick={() => setEditingSpace(s)} title="Duplo clique para editar">
              <SpaceCard space={s} variant="list" />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-small text-muted-foreground">
            {search ? "Nenhum space encontrado" : "No spaces yet. Create your first one!"}
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

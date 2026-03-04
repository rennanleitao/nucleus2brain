import { useEffect, useState } from "react";
import { fetchSpaces } from "@/lib/api";
import { SpaceCard } from "@/components/SpaceCard";
import { CreateSpaceDialog } from "@/components/CreateSpaceDialog";
import { FolderOpen } from "lucide-react";
import { toast } from "sonner";

export default function Spaces() {
  const [spaces, setSpaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div className="p-6 flex items-center justify-center"><p className="text-sm text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-muted-foreground" /> Spaces
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Organize your work into knowledge hubs</p>
        </div>
        <CreateSpaceDialog onCreated={load} />
      </div>

      {spaces.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {spaces.map(s => <SpaceCard key={s.id} space={s} />)}
        </div>
      ) : (
        <div className="text-center py-12">
          <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No spaces yet. Create your first one!</p>
        </div>
      )}
    </div>
  );
}

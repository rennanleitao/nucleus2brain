import { mockSpaces } from "@/data/mockData";
import { SpaceCard } from "@/components/SpaceCard";
import { FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Spaces() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-muted-foreground" /> Spaces
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Organize your work into knowledge hubs</p>
        </div>
        <Button size="sm" className="gradient-primary text-primary-foreground border-0">
          <Plus className="h-4 w-4 mr-1" /> New Space
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockSpaces.map(s => <SpaceCard key={s.id} space={s} />)}
      </div>
    </div>
  );
}

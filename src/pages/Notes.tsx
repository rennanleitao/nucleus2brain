import { mockNotes } from "@/data/mockData";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Notes() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" /> Notes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Your second brain</p>
        </div>
        <Button size="sm" className="gradient-primary text-primary-foreground border-0">
          <Plus className="h-4 w-4 mr-1" /> New Note
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {mockNotes.map(note => (
          <div key={note.id} className="p-4 rounded-xl border border-border bg-card hover:shadow-elevated transition-all cursor-pointer animate-fade-in">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-sm font-semibold">{note.title}</h3>
              {note.spaceName && (
                <span className="text-[11px] text-muted-foreground">{note.spaceName}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{note.content}</p>
            <div className="flex gap-1.5 flex-wrap">
              {note.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

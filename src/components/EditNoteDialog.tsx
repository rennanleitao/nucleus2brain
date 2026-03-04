import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { updateNote } from "@/lib/api";
import { toast } from "sonner";

interface EditNoteDialogProps {
  note: {
    id: string;
    title: string;
    content: string;
    tags: string[];
    space_id?: string | null;
  };
  spaces: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function EditNoteDialog({ note, spaces, open, onOpenChange, onUpdated }: EditNoteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tagsStr, setTagsStr] = useState(note.tags.join(", "));
  const [spaceId, setSpaceId] = useState(note.space_id || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await updateNote(note.id, {
        title: title.trim(),
        content,
        tags: tagsStr.split(",").map(t => t.trim()).filter(Boolean),
        space_id: spaceId || null,
      });
      toast.success("Note updated!");
      onOpenChange(false);
      onUpdated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Edit Note</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" placeholder="Note title" value={title} onChange={e => setTitle(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" required />
          <textarea placeholder="Write your note..." value={content} onChange={e => setContent(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary h-48 resize-none font-mono text-xs" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Space</label>
              <select value={spaceId} onChange={e => setSpaceId(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="">No space</option>
                {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tags</label>
              <input type="text" placeholder="tag1, tag2" value={tagsStr} onChange={e => setTagsStr(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full gradient-primary text-primary-foreground border-0">
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

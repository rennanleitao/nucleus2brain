import { useState, useEffect } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { Tag, Plus, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createTaggedSnippet, fetchTaggedSnippets } from "@/lib/api";
import { toast } from "sonner";

interface TagBubbleMenuProps {
  editor: Editor;
  noteId: string | null;
  existingTags: string[];
}

export function TagBubbleMenu({ editor, noteId, existingTags }: TagBubbleMenuProps) {
  const [open, setOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);

  const handleTag = async (tag: string) => {
    if (!noteId) {
      toast.error("Salve a nota antes de tagear trechos");
      return;
    }
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText.trim()) return;

    setSaving(true);
    try {
      await createTaggedSnippet(noteId, tag, selectedText.trim());
      toast.success(`Trecho tageado com #${tag}`);
      setOpen(false);
      setNewTag("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAndTag = async () => {
    const tag = newTag.trim().replace(/^#/, "");
    if (!tag) return;
    await handleTag(tag);
  };

  return (
    <BubbleMenu
      editor={editor}
      options={{ duration: 150, placement: "top" } as any}
      className="flex items-center gap-1 bg-popover border border-border rounded-lg shadow-lg px-1.5 py-1"
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
            <Tag className="h-3.5 w-3.5" />
            Tagear trecho
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <p className="text-xs font-medium mb-2 text-muted-foreground">Selecione ou crie uma tag</p>
          
          {existingTags.length > 0 && (
            <ScrollArea className="max-h-32 mb-2">
              <div className="flex flex-wrap gap-1">
                {existingTags.map(tag => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-[11px] cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => handleTag(tag)}
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          )}

          <div className="flex gap-1.5">
            <Input
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              placeholder="Nova tag..."
              className="h-7 text-xs"
              onKeyDown={e => e.key === "Enter" && handleCreateAndTag()}
            />
            <Button
              size="sm"
              className="h-7 px-2"
              disabled={!newTag.trim() || saving}
              onClick={handleCreateAndTag}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </BubbleMenu>
  );
}

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { Tag, Plus, Sparkles, Loader2, ChevronDown, Check, X, Wand2, FileText, BookOpen, BriefcaseBusiness, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createTaggedSnippet, fetchAllTags } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TagBubbleMenuProps {
  editor: Editor;
  noteId: string | null;
  existingTags: string[];
}

const AI_MODES = [
  { key: "improve", label: "Melhorar texto", Icon: Wand2 },
  { key: "simplify", label: "Simplificar", Icon: FileText },
  { key: "expand", label: "Expandir", Icon: BookOpen },
  { key: "formal", label: "Tom formal", Icon: BriefcaseBusiness },
  { key: "meeting", label: "Organizar Meeting Notes", Icon: ClipboardList },
] as const;

export function TagBubbleMenu({ editor, noteId, existingTags }: TagBubbleMenuProps) {
  const [tagOpen, setTagOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);

  // Fetch all user tags when tag popover opens
  useEffect(() => {
    if (tagOpen) {
      fetchAllTags().then(tags => {
        const merged = [...new Set([...existingTags, ...tags])].sort();
        setAllTags(merged);
      }).catch(() => setAllTags(existingTags));
    }
  }, [tagOpen, existingTags]);

  // AI preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewOriginal, setPreviewOriginal] = useState("");
  const [previewImproved, setPreviewImproved] = useState("");
  const [previewRange, setPreviewRange] = useState<{ from: number; to: number } | null>(null);
  const [previewMode, setPreviewMode] = useState("");

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
      setTagOpen(false);
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

  const handleAiImprove = async (mode: string) => {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText.trim()) return;

    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("improve-text", {
        body: { text: selectedText.trim(), mode },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const improved = data.improved;
      if (improved && improved !== selectedText.trim()) {
        setPreviewOriginal(selectedText.trim());
        setPreviewImproved(improved);
        setPreviewRange({ from, to });
        setPreviewOpen(true);
      } else {
        toast.info("Nenhuma alteração sugerida");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao melhorar texto");
    } finally {
      setAiLoading(false);
    }
  };

  const handleAcceptPreview = () => {
    if (previewRange && previewImproved) {
      editor.chain().focus().deleteRange(previewRange).insertContentAt(previewRange.from, previewImproved).run();
      toast.success("Texto atualizado");
    }
    setPreviewOpen(false);
  };

  const handleRejectPreview = () => {
    setPreviewOpen(false);
    toast.info("Alteração descartada");
  };

  return (
    <>
      <BubbleMenu
        editor={editor}
        options={{ duration: 150, placement: "top" } as any}
        className="flex items-center gap-0.5 bg-popover border border-border rounded-lg shadow-elevated px-1 py-0.5"
      >
        {/* Tag button */}
        <Popover open={tagOpen} onOpenChange={setTagOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs px-2 hover:bg-accent">
              <Tag className="h-3 w-3" />
              Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2.5" align="start">
            <p className="text-[11px] font-medium mb-2 text-muted-foreground">Selecione ou crie uma tag</p>
            
            {allTags.length > 0 && (
              <ScrollArea className="max-h-28 mb-2">
                <div className="flex flex-wrap gap-1">
                  {allTags.filter(tag => !newTag.trim() || tag.toLowerCase().includes(newTag.trim().toLowerCase())).map(tag => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-[10px] cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => handleTag(tag)}
                    >
                      #{tag}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            )}

            <div className="flex gap-1">
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
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Divider */}
        <div className="w-px h-4 bg-border mx-0.5" />

        {/* AI Improve dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs px-2 hover:bg-accent"
              disabled={aiLoading}
            >
              {aiLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              IA
              <ChevronDown className="h-2.5 w-2.5 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {AI_MODES.map(mode => (
              <DropdownMenuItem
                key={mode.key}
                onClick={() => handleAiImprove(mode.key)}
                className="text-xs gap-2 cursor-pointer"
              >
                <mode.Icon className="h-3 w-3" />
                {mode.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </BubbleMenu>

      {/* AI Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4" />
              Confirmar alteração
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground mb-1">Original</p>
              <div className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {previewOriginal}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground mb-1">Sugestão da IA</p>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                {previewImproved}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={handleRejectPreview} className="gap-1.5">
              <X className="h-3.5 w-3.5" />
              Descartar
            </Button>
            <Button size="sm" onClick={handleAcceptPreview} className="gap-1.5">
              <Check className="h-3.5 w-3.5" />
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

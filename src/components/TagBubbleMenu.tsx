import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { marked } from "marked";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { Tag, Plus, Loader2, ChevronDown, Check, X, Wand2, FileText, BookOpen, BriefcaseBusiness, ClipboardList, RefreshCw, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createTaggedSnippet, fetchAllTags } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";

interface TagBubbleMenuProps {
  editor: Editor;
  noteId: string | null;
  existingTags: string[];
  spaceId?: string | null;
  onTaskCreated?: () => void;
}

const AI_MODES = [
  { key: "improve", label: "Melhorar texto", Icon: Wand2 },
  { key: "simplify", label: "Simplificar", Icon: FileText },
  { key: "expand", label: "Expandir", Icon: BookOpen },
  { key: "formal", label: "Tom formal", Icon: BriefcaseBusiness },
  { key: "meeting", label: "Organizar Meeting Notes", Icon: ClipboardList },
] as const;

export function TagBubbleMenu({ editor, noteId, existingTags, spaceId, onTaskCreated }: TagBubbleMenuProps) {
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
  const [refinementInput, setRefinementInput] = useState("");
  const [refining, setRefining] = useState(false);

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
        setPreviewMode(mode);
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
    setRefinementInput("");
    toast.info("Alteração descartada");
  };

  const handleRefine = async () => {
    if (!refinementInput.trim() || !previewOriginal) return;
    setRefining(true);
    try {
      const { data, error } = await supabase.functions.invoke("improve-text", {
        body: { text: previewOriginal, mode: "meeting", extraInstructions: refinementInput.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data.improved) {
        setPreviewImproved(data.improved);
        setRefinementInput("");
        toast.success("Notas reorganizadas com ajustes");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao refinar");
    } finally {
      setRefining(false);
    }
  };

  // Task creation dialog state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDefaultTitle, setTaskDefaultTitle] = useState("");
  const [taskDefaultDesc, setTaskDefaultDesc] = useState("");
  const [spaces, setSpaces] = useState<{ id: string; name: string }[]>([]);

  const handleOpenTaskDialog = async () => {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ").trim();
    if (!selectedText) return;

    setTaskDefaultTitle(selectedText.length > 80 ? selectedText.slice(0, 80) + "…" : selectedText);
    setTaskDefaultDesc(`Trecho da nota: "${selectedText}"`);

    // Fetch spaces for the dialog
    const { data } = await supabase.from("spaces").select("id, name").order("name");
    setSpaces(data || []);
    setTaskDialogOpen(true);
  };

  return (
    <>
      <BubbleMenu
        editor={editor}
        options={{ placement: "top" }}
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
                <Wand2 className="h-3 w-3" />
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

        {/* Divider */}
        <div className="w-px h-4 bg-border mx-0.5" />

        {/* Create Task button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs px-2 hover:bg-accent"
          onClick={handleOpenTaskDialog}
        >
          <ListTodo className="h-3 w-3" />
          Task
        </Button>
      </BubbleMenu>

      {/* AI Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className={`${previewMode === "meeting" ? "sm:max-w-2xl" : "sm:max-w-lg"} max-h-[85vh] flex flex-col gap-0 p-0`}>
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              {previewMode === "meeting" ? (
                <ClipboardList className="h-4 w-4" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {previewMode === "meeting" ? "Meeting Notes Organizadas" : "Confirmar alteração"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto px-6 flex-1 min-h-0">
            {previewMode !== "meeting" && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-1">Original</p>
                <div className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {previewOriginal}
                </div>
              </div>
            )}
            <div>
              {previewMode !== "meeting" && (
                <p className="text-[11px] font-medium text-muted-foreground mb-1">Sugestão da IA</p>
              )}
              <div className={`rounded-md border p-3 text-sm leading-relaxed ${previewMode === "meeting" ? "border-border bg-card" : "border-primary/30 bg-primary/5 whitespace-pre-wrap"}`}>
                {previewMode === "meeting" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert [&>hr]:my-4 [&>h2]:mt-5 [&>h2]:mb-2 [&>ul]:my-2 [&>p]:my-2 [&>ul>li]:my-1">
                    <ReactMarkdown>{previewImproved}</ReactMarkdown>
                  </div>
                ) : (
                  previewImproved
                )}
              </div>
            </div>
            {previewMode === "meeting" && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-1">Ajustes (opcional)</p>
                <div className="flex gap-2">
                  <Textarea
                    value={refinementInput}
                    onChange={e => setRefinementInput(e.target.value)}
                    placeholder="Ex: Separar os itens de Compras e Contabilidade..."
                    className="min-h-[60px] text-xs resize-none"
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto px-3 gap-1.5 self-end"
                    disabled={!refinementInput.trim() || refining}
                    onClick={handleRefine}
                  >
                    {refining ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Reprocessar
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0 px-6 py-4 border-t bg-background shrink-0">
            <Button variant="outline" size="sm" onClick={handleRejectPreview} className="gap-1.5">
              <X className="h-3.5 w-3.5" />
              Descartar
            </Button>
            <Button size="sm" onClick={handleAcceptPreview} className="gap-1.5">
              <Check className="h-3.5 w-3.5" />
              {previewMode === "meeting" ? "Substituir texto" : "Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Create Task Dialog */}
      <CreateTaskDialog
        spaces={spaces}
        onCreated={() => {
          setTaskDialogOpen(false);
          onTaskCreated?.();
        }}
        defaultSpaceId={spaceId || undefined}
        externalOpen={taskDialogOpen}
        onExternalOpenChange={setTaskDialogOpen}
        trigger={null}
        defaultTitle={taskDefaultTitle}
        defaultDescription={taskDefaultDesc}
        defaultNoteId={noteId}
      />
    </>
  );
}

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import Mention from "@tiptap/extension-mention";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Details, DetailsSummary, DetailsContent } from "@tiptap/extension-details";
import { useEffect, useImperativeHandle, forwardRef, useCallback, useRef, useState } from "react";
import { TagBubbleMenu } from "@/components/TagBubbleMenu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Minus, Highlighter, Quote, Undo, Redo, ImageIcon, Code, FilePlus,
  Table as TableIcon, Link2, ChevronRight, Paperclip,
} from "lucide-react";
import { TableFiltersPanel } from "@/components/editor/TableFiltersPanel";
import { Iframe } from "@/components/editor/IframeExtension";
import { getGoogleEmbedUrl } from "@/components/editor/googleDocsEmbed";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { createNoteMentionSuggestion } from "@/components/editor/NoteMention";
import { DateHeading } from "@/components/editor/DateHeadingExtension";
import { buildDateEntryHtml, entryIdForDate } from "@/lib/noteEntries";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  onTagsDetected?: (tags: string[]) => void;
  noteId?: string | null;
  existingTags?: string[];
  onTaskItemClick?: (taskTitle: string) => void;
  spaceId?: string | null;
  onTaskCreated?: () => void;
  allNotes?: { id: string; title: string }[];
  onNoteLinkClick?: (noteId: string) => void;
  onCreateSubNote?: (title: string) => void;
  onLinkNote?: () => void;
  onSelectionChange?: (hasSelection: boolean) => void;
  toolbarExtra?: React.ReactNode;
}

export interface RichTextEditorHandle {
  processTaskPatterns: () => string[];
  insertNoteMention: (note: { id: string; title: string }) => void;
  isEmpty: () => boolean;
  getSelectionText: () => string;
  getDocText: () => string;
  insertHtml: (html: string) => void;
  replaceSelectionWithHtml: (html: string) => void;
  setHtml: (html: string) => void;
  insertDateEntry: (date: string) => void;
  scrollToEntry: (date: string) => void;
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor({
  content, onChange, placeholder = "Comece a escrever...", editable = true, className = "", onTagsDetected, noteId = null, existingTags = [], onTaskItemClick, spaceId = null, onTaskCreated,
  allNotes = [], onNoteLinkClick, onCreateSubNote, onLinkNote, onSelectionChange, toolbarExtra,
}, ref) {
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [embedPrompt, setEmbedPrompt] = useState<{ embedUrl: string; type: string; originalUrl: string } | null>(null);

  // Keep refs for the latest values so the suggestion closure always sees fresh data
  const allNotesRef = useRef(allNotes);
  const onCreateSubNoteRef = useRef(onCreateSubNote);
  allNotesRef.current = allNotes;
  onCreateSubNoteRef.current = onCreateSubNote;

  const handleImageUpload = useCallback(async (file: File) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Faça login para enviar imagens"); return; }
      const path = `${user.id}/notes/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("attachments").upload(path, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("attachments").getPublicUrl(path);
      editorRef.current?.chain().focus().setImage({ src: data.publicUrl, alt: file.name }).run();
    } catch (err: any) {
      toast.error("Erro ao enviar imagem: " + err.message);
    }
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      if (file.type.startsWith("image/")) {
        return handleImageUpload(file);
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Faça login para enviar arquivos"); return; }
      const toastId = toast.loading(`Enviando ${file.name}...`);
      const path = `${user.id}/notes/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("attachments").upload(path, file, {
        contentType: file.type || "application/octet-stream",
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("attachments").getPublicUrl(path);
      const safeName = file.name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const html = `<p><a href="${data.publicUrl}" target="_blank" rel="noopener noreferrer" download="${safeName}" data-attachment="true" class="note-attachment">📎 ${safeName} <span class="text-xs text-muted-foreground">(${formatBytes(file.size)})</span></a></p>`;
      editorRef.current?.chain().focus().insertContent(html).run();
      toast.success("Arquivo anexado", { id: toastId });
    } catch (err: any) {
      toast.error("Erro ao enviar arquivo: " + err.message);
    }
  }, [handleImageUpload]);

  // Stable suggestion config – created once
  const suggestionRef = useRef(
    createNoteMentionSuggestion(async () => {
      return (allNotesRef.current || [])
        .filter((n) => n.id !== noteId)
        .map((n) => ({ id: n.id, title: n.title }));
    })
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      DateHeading.configure({ levels: [1, 2, 3] }),
      Placeholder.configure({ placeholder }),
      Highlight.configure({ multicolor: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false, allowBase64: true }),
      Iframe,
      Table.configure({ resizable: false, HTMLAttributes: { class: "note-table" } }),
      TableRow,
      TableHeader,
      TableCell,
      Details.configure({
        persist: true,
        HTMLAttributes: { class: "note-toggle" },
      }),
      DetailsSummary,
      DetailsContent,
      Mention.configure({
        HTMLAttributes: {
          class: "mention-note",
        },
        suggestion: suggestionRef.current,
        renderText: ({ node }) => `@${node.attrs.label}`,
        renderHTML: ({ node }) => [
          "span",
          {
            class: "mention-note",
            "data-note-id": node.attrs.id,
            "data-mention": "",
          },
          `📄 ${node.attrs.label}`,
        ],
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);

      const text = editor.getText();

      if (onTagsDetected) {
        const tagMatches = text.match(/#(\w[\w-]*)(?=[\s,.;:!?\n])/g);
        const tags = tagMatches ? [...new Set(tagMatches.map(t => t.slice(1)))] : [];
        onTagsDetected(tags);
      }
    },
    onSelectionUpdate: ({ editor }) => {
      if (onSelectionChange) {
        const { from, to } = editor.state.selection;
        onSelectionChange(from !== to);
      }
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] px-4 py-3",
      },
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData("text/plain")?.trim();
        if (text) {
          const embed = getGoogleEmbedUrl(text);
          if (embed) {
            event.preventDefault();
            setEmbedPrompt({ ...embed, originalUrl: text });
            return true;
          }
        }
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) handleImageUpload(file);
            return true;
          }
        }
        const files = event.clipboardData?.files;
        if (files && files.length > 0) {
          event.preventDefault();
          for (const file of Array.from(files)) handleFileUpload(file);
          return true;
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        event.preventDefault();
        for (const file of Array.from(files)) handleFileUpload(file);
        return true;
      },
      handleClick: (_view, _pos, event) => {
        // Handle note mention clicks
        const target = event.target as HTMLElement;
        const mention = target.closest("[data-mention]") || (target.hasAttribute("data-mention") ? target : null);
        if (mention) {
          const mentionNoteId = mention.getAttribute("data-note-id");
          if (mentionNoteId) {
            if (mentionNoteId === "__create__") {
              const label = mention.textContent?.replace("📄 ", "").replace('Criar nota "', "").replace('"', "").trim();
              if (label && onCreateSubNoteRef.current) onCreateSubNoteRef.current(label);
            } else if (onNoteLinkClick) {
              onNoteLinkClick(mentionNoteId);
            }
            return true;
          }
        }

        // Check if user clicked on a task item text
        if (onTaskItemClick) {
          const taskItem = target.closest('[data-type="taskItem"]') || target.closest('li[data-checked]');
          if (taskItem) {
            const checkbox = taskItem.querySelector('label') || taskItem.querySelector('input');
            if (checkbox && checkbox.contains(target)) return false;
            const textContent = taskItem.textContent?.trim();
            if (textContent) {
              onTaskItemClick(textContent);
              return true;
            }
          }
        }
        return false;
      },
    },
  });

  useImperativeHandle(ref, () => ({
    processTaskPatterns: () => {
      if (!editor) return [];
      const text = editor.getText();
      const taskMatches = text.match(/\(\)\s*([^\n]{2,})/g);
      if (!taskMatches) return [];

      const titles: string[] = [];
      let htmlContent = editor.getHTML();

      for (const match of taskMatches) {
        const taskTitle = match.replace(/^\(\)\s*/, "").trim();
        if (!taskTitle || taskTitle.startsWith("#")) continue;
        titles.push(taskTitle);

        htmlContent = htmlContent
          .replace(`() ${taskTitle}`, "")
          .replace(`()${taskTitle}`, "");
      }

      htmlContent = htmlContent.replace(/<p>\s*<\/p>/g, "");
      if (!htmlContent.trim()) htmlContent = "<p></p>";

      editor.commands.setContent(htmlContent);

      for (const title of titles) {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "taskList",
            content: [
              {
                type: "taskItem",
                attrs: { checked: false },
                content: [{ type: "paragraph", content: [{ type: "text", text: title }] }],
              },
            ],
          })
          .run();
      }

      onChange(editor.getHTML());
      return titles;
    },
    insertNoteMention: (note: { id: string; title: string }) => {
      if (!editor) return;
      editor
        .chain()
        .focus()
        .insertContent([
          { type: "mention", attrs: { id: note.id, label: note.title } },
          { type: "text", text: " " },
        ])
        .run();
      onChange(editor.getHTML());
    },
    isEmpty: () => {
      if (!editor) return true;
      return editor.isEmpty || !editor.getText().trim();
    },
    getSelectionText: () => {
      if (!editor) return "";
      const { from, to } = editor.state.selection;
      if (from === to) return "";
      return editor.state.doc.textBetween(from, to, "\n").trim();
    },
    getDocText: () => {
      if (!editor) return "";
      return editor.getText().trim();
    },
    insertHtml: (html: string) => {
      if (!editor) return;
      editor.chain().focus("end").insertContent(html).run();
      onChange(editor.getHTML());
    },
    replaceSelectionWithHtml: (html: string) => {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      if (from === to) {
        editor.commands.setContent(html);
      } else {
        editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, html).run();
      }
      onChange(editor.getHTML());
    },
    setHtml: (html: string) => {
      if (!editor) return;
      editor.commands.setContent(html);
      onChange(editor.getHTML());
    },
    insertDateEntry: (date: string) => {
      if (!editor) return;
      editor.chain().focus("end").insertContent(buildDateEntryHtml(date)).run();
      onChange(editor.getHTML());
      // Scroll the freshly-inserted heading into view
      requestAnimationFrame(() => {
        const el = editorContainerRef.current?.querySelector<HTMLElement>(`#${CSS.escape(entryIdForDate(date))}`);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    scrollToEntry: (date: string) => {
      const el = editorContainerRef.current?.querySelector<HTMLElement>(`#${CSS.escape(entryIdForDate(date))}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  }), [editor, onChange]);

  useEffect(() => {
    if (editor) editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content]);

  if (!editor) return null;

  const ToolbarButton = ({ onClick, active, children, title }: {
    onClick: () => void; active?: boolean; children: React.ReactNode; title: string;
  }) => (
    <Button
      type="button" variant="ghost" size="icon"
      className={`h-7 w-7 ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
      onClick={onClick} title={title}
    >
      {children}
    </Button>
  );

  const handleInsertSubNote = () => {
    if (onCreateSubNote) {
      const title = prompt("Título da nova nota:");
      if (title?.trim()) {
        onCreateSubNote(title.trim());
      }
    }
  };

  return (
    <div className={`border border-border rounded-lg bg-card overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-px px-3 py-1.5 border-b border-border/50 bg-background flex-wrap">
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Desfazer">
          <Undo className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Refazer">
          <Redo className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-4 mx-1.5 bg-border/40" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })} title="Título 1">
          <Heading1 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })} title="Título 2">
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })} title="Título 3">
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-4 mx-1.5 bg-border/40" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")} title="Negrito">
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")} title="Itálico">
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")} title="Riscado">
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()}
          active={editor.isActive("highlight")} title="Destaque">
          <Highlighter className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-4 mx-1.5 bg-border/40" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")} title="Lista">
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")} title="Lista numerada">
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive("taskList")} title="Checklist">
          <CheckSquare className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setDetails().run()}
          active={editor.isActive("details")} title="Toggle (lista colapsável)">
          <ChevronRight className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-4 mx-1.5 bg-border/40" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")} title="Citação">
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divisória">
          <Minus className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*";
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) handleImageUpload(file);
          };
          input.click();
        }} title="Inserir imagem">
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.multiple = true;
          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) Array.from(files).forEach((f) => handleFileUpload(f));
          };
          input.click();
        }} title="Anexar arquivo">
          <Paperclip className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          title="Inserir tabela"
        >
          <TableIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        {onLinkNote && (
          <ToolbarButton onClick={onLinkNote} title="Vincular nota">
            <Link2 className="h-3.5 w-3.5" />
          </ToolbarButton>
        )}
        {onCreateSubNote && (
          <ToolbarButton onClick={handleInsertSubNote} title="Criar sub-nota">
            <FilePlus className="h-3.5 w-3.5" />
          </ToolbarButton>
        )}
        {toolbarExtra && (
          <>
            <Separator orientation="vertical" className="h-4 mx-1.5 bg-border/40" />
            {toolbarExtra}
          </>
        )}
      </div>


      {/* Bubble Menu for tagging selections */}
      {editable && (
        <TagBubbleMenu editor={editor} noteId={noteId} existingTags={existingTags} spaceId={spaceId} onTaskCreated={onTaskCreated} />
      )}

      {/* Editor */}
      <div ref={editorContainerRef} className="relative">
        <EditorContent editor={editor} />
        {/* Filtros sobrepostos a cada tabela da nota */}
        <TableFiltersPanel editor={editor} containerRef={editorContainerRef} />
      </div>

      {/* Google Docs Embed Prompt */}
      <AlertDialog open={!!embedPrompt} onOpenChange={(open) => !open && setEmbedPrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Embedar {embedPrompt?.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja incorporar este documento diretamente na nota ou inserir como link?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              if (embedPrompt && editor) {
                editor.chain().focus().insertContent(`<p><a href="${embedPrompt.originalUrl}" target="_blank">${embedPrompt.originalUrl}</a></p>`).run();
                onChange(editor.getHTML());
              }
              setEmbedPrompt(null);
            }}>
              Inserir como link
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (embedPrompt && editor) {
                editor.chain().focus().insertContent({ type: "iframe", attrs: { src: embedPrompt.embedUrl, title: embedPrompt.type } }).run();
                onChange(editor.getHTML());
              }
              setEmbedPrompt(null);
            }}>
              Embedar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

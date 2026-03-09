import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import { useEffect, useImperativeHandle, forwardRef, useCallback, useRef, useState } from "react";
import { TagBubbleMenu } from "@/components/TagBubbleMenu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Minus, Highlighter, Quote, Undo, Redo, ImageIcon, Code,
} from "lucide-react";
import { Iframe } from "@/components/editor/IframeExtension";
import { getGoogleEmbedUrl } from "@/components/editor/googleDocsEmbed";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

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
}

export interface RichTextEditorHandle {
  /** Scans for ()taskName patterns, replaces them with checklist items, and returns detected task titles */
  processTaskPatterns: () => string[];
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor({
  content, onChange, placeholder = "Comece a escrever...", editable = true, className = "", onTagsDetected, noteId = null, existingTags = [], onTaskItemClick,
}, ref) {
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const [embedPrompt, setEmbedPrompt] = useState<{ embedUrl: string; type: string; originalUrl: string } | null>(null);

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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Placeholder.configure({ placeholder }),
      Highlight.configure({ multicolor: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false, allowBase64: true }),
      Iframe,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);

      const text = editor.getText();

      // Detect #tags in text
      if (onTagsDetected) {
        const tagMatches = text.match(/#(\w[\w-]*)(?=[\s,.;:!?\n])/g);
        const tags = tagMatches ? [...new Set(tagMatches.map(t => t.slice(1)))] : [];
        onTagsDetected(tags);
      }
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] px-4 py-3",
      },
      handlePaste: (_view, event) => {
        // Check for Google Docs URL in plain text
        const text = event.clipboardData?.getData("text/plain")?.trim();
        if (text) {
          const embed = getGoogleEmbedUrl(text);
          if (embed) {
            event.preventDefault();
            setEmbedPrompt({ ...embed, originalUrl: text });
            return true;
          }
        }
        // Check for image paste
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
        return false;
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        for (const file of Array.from(files)) {
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            handleImageUpload(file);
            return true;
          }
        }
        return false;
      },
      handleClick: (_view, _pos, event) => {
        // Check if user clicked on a task item text
        if (onTaskItemClick) {
          const target = event.target as HTMLElement;
          const taskItem = target.closest('[data-type="taskItem"]') || target.closest('li[data-checked]');
          if (taskItem) {
            // Don't intercept checkbox clicks
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

  // Expose processTaskPatterns to parent via ref
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

        // Remove the raw pattern from HTML
        htmlContent = htmlContent
          .replace(`() ${taskTitle}`, "")
          .replace(`()${taskTitle}`, "");
      }

      // Clean up empty paragraphs
      htmlContent = htmlContent.replace(/<p>\s*<\/p>/g, "");
      if (!htmlContent.trim()) htmlContent = "<p></p>";

      editor.commands.setContent(htmlContent);

      // Insert checklist items for each task
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

  return (
    <div className={`border border-border rounded-lg bg-card overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30 flex-wrap">
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Desfazer">
          <Undo className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Refazer">
          <Redo className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-5 mx-1" />

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

        <Separator orientation="vertical" className="h-5 mx-1" />

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

        <Separator orientation="vertical" className="h-5 mx-1" />

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

        <Separator orientation="vertical" className="h-5 mx-1" />

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
      </div>


      {/* Bubble Menu for tagging selections */}
      {editable && (
        <TagBubbleMenu editor={editor} noteId={noteId} existingTags={existingTags} />
      )}

      {/* Editor */}
      <EditorContent editor={editor} />

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

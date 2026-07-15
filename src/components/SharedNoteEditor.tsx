import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useEffect, useCallback, useRef } from "react";
import {
  Bold, Italic, Strikethrough, Heading2,
  List, ListOrdered, CheckSquare, Minus, Quote, Undo, Redo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface SharedNoteEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
}

export function SharedNoteEditor({ content, onChange, editable = false }: SharedNoteEditorProps) {
  const isUpdatingRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: "notes-editor focus:outline-none min-h-[40vh] px-6 py-8 md:px-10 md:py-10",
      },
    },
    onUpdate: ({ editor }) => {
      if (!isUpdatingRef.current) {
        onChange(editor.getHTML());
      }
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      isUpdatingRef.current = true;
      editor.commands.setContent(content, { emitUpdate: false });
      isUpdatingRef.current = false;
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  if (!editor) return null;

  const ToolbarButton = ({ onClick, active, children, title }: { onClick: () => void; active?: boolean; children: React.ReactNode; title: string }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`h-7 w-7 p-0 ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );

  return (
    <div>
      {editable && (
        <div className="flex items-center gap-0.5 flex-wrap border-b border-border pb-2 mb-3">
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Negrito">
            <Bold className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Itálico">
            <Italic className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Tachado">
            <Strikethrough className="h-3.5 w-3.5" />
          </ToolbarButton>

          <Separator orientation="vertical" className="h-4 mx-1" />

          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Título">
            <Heading2 className="h-3.5 w-3.5" />
          </ToolbarButton>

          <Separator orientation="vertical" className="h-4 mx-1" />

          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Lista">
            <List className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Lista numerada">
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} title="Checklist">
            <CheckSquare className="h-3.5 w-3.5" />
          </ToolbarButton>

          <Separator orientation="vertical" className="h-4 mx-1" />

          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Citação">
            <Quote className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Separador">
            <Minus className="h-3.5 w-3.5" />
          </ToolbarButton>

          <Separator orientation="vertical" className="h-4 mx-1" />

          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Desfazer">
            <Undo className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Refazer">
            <Redo className="h-3.5 w-3.5" />
          </ToolbarButton>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}

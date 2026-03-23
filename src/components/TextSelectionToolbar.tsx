import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createTask } from "@/lib/api";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { toast } from "sonner";

interface TextSelectionToolbarProps {
  selectedText: string;
  selectionRect: DOMRect | null;
  isVisible: boolean;
  onClose: () => void;
  noteId: string;
  spaceId?: string | null;
  onTaskCreated?: () => void;
}

export function TextSelectionToolbar({
  selectedText,
  selectionRect,
  isVisible,
  onClose,
  noteId,
  spaceId,
  onTaskCreated,
}: TextSelectionToolbarProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        // Don't close if the create dialog is open
        if (!showCreateDialog) onClose();
      }
    };
    if (isVisible) {
      document.addEventListener("mousedown", handleClickOutside, { capture: true });
    }
    return () => document.removeEventListener("mousedown", handleClickOutside, { capture: true });
  }, [isVisible, onClose, showCreateDialog]);

  if (!isVisible || !selectionRect || !selectedText) return null;

  const top = selectionRect.top - 40 + window.scrollY;
  const left = selectionRect.left + selectionRect.width / 2;

  return (
    <>
      {createPortal(
        <div
          ref={toolbarRef}
          className="fixed z-[9999] animate-in fade-in-0 zoom-in-95 duration-150"
          style={{
            top: `${selectionRect.top - 40}px`,
            left: `${Math.max(80, Math.min(selectionRect.left + selectionRect.width / 2, window.innerWidth - 80))}px`,
            transform: "translateX(-50%)",
          }}
        >
          <Button
            size="sm"
            variant="secondary"
            className="h-7 gap-1.5 text-xs shadow-lg border border-border rounded-full px-3"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowCreateDialog(true);
            }}
          >
            <Plus className="h-3 w-3" />
            Criar task
          </Button>
        </div>,
        document.body
      )}

      {showCreateDialog && (
        <CreateTaskDialog
          open={showCreateDialog}
          onOpenChange={(open) => {
            setShowCreateDialog(open);
            if (!open) onClose();
          }}
          defaultTitle={selectedText.slice(0, 100)}
          defaultDescription={`Origem: trecho da nota\n\n"${selectedText}"`}
          defaultNoteId={noteId}
          defaultSpaceId={spaceId || undefined}
        />
      )}
    </>
  );
}

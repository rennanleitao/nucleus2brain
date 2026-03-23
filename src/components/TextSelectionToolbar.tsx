import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { fetchSpaces } from "@/lib/api";

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
  const [spaces, setSpaces] = useState<{ id: string; name: string }[]>([]);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showCreateDialog && spaces.length === 0) {
      fetchSpaces().then(setSpaces).catch(() => {});
    }
  }, [showCreateDialog, spaces.length]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        if (!showCreateDialog) onClose();
      }
    };
    if (isVisible) {
      document.addEventListener("mousedown", handleClickOutside, { capture: true });
    }
    return () => document.removeEventListener("mousedown", handleClickOutside, { capture: true });
  }, [isVisible, onClose, showCreateDialog]);

  if (!isVisible || !selectionRect || !selectedText) return null;

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

      <CreateTaskDialog
        spaces={spaces}
        onCreated={() => {
          onTaskCreated?.();
          onClose();
        }}
        externalOpen={showCreateDialog}
        onExternalOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) onClose();
        }}
        defaultTitle={selectedText.slice(0, 100)}
        defaultDescription={`Origem: trecho da nota\n\n"${selectedText}"`}
        defaultNoteId={noteId}
        defaultSpaceId={spaceId || undefined}
      />
    </>
  );
}

import { useState, useEffect, useCallback, useRef } from "react";

interface TextSelectionState {
  selectedText: string;
  selectionRect: DOMRect | null;
  isVisible: boolean;
  clearSelection: () => void;
}

export function useTextSelection(containerRef: React.RefObject<HTMLElement | null>): TextSelectionState {
  const [selectedText, setSelectedText] = useState("");
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSelection = useCallback(() => {
    setSelectedText("");
    setSelectionRect(null);
    setIsVisible(false);
  }, []);

  const handleSelectionChange = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        clearSelection();
        return;
      }

      const container = containerRef.current;
      if (!container) { clearSelection(); return; }

      const anchorNode = selection.anchorNode;
      if (!anchorNode || !container.contains(anchorNode)) {
        clearSelection();
        return;
      }

      const text = selection.toString().trim();
      if (text.length < 3) { clearSelection(); return; }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectedText(text);
      setSelectionRect(rect);
      setIsVisible(true);
    }, 200);
  }, [containerRef, clearSelection]);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [handleSelectionChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [clearSelection]);

  return { selectedText, selectionRect, isVisible, clearSelection };
}

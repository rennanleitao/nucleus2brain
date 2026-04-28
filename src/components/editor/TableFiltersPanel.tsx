import { useEffect, useState } from "react";
import { Editor } from "@tiptap/react";
import { Trash2, Columns3, Rows3, BetweenHorizontalStart, BetweenVerticalStart } from "lucide-react";

interface TableMeta {
  id: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TableFiltersPanelProps {
  editor: Editor | null;
  containerRef: React.RefObject<HTMLDivElement>;
}

/**
 * Floating overlay layer for each <table.note-table>:
 *  - "+" handle on the right edge to add a column
 *  - "+" handle on the bottom edge to add a row
 *  - Top-right menu with add/remove column/row and delete table
 */
export function TableFiltersPanel({ editor, containerRef }: TableFiltersPanelProps) {
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const getCellPosition = (cell: HTMLElement) => {
    if (!editor) return null;
    const view = (editor as any).view;
    let found: number | null = null;

    const isCellStart = (pos: number | null | undefined) => {
      if (typeof pos !== "number" || pos < 0) return false;
      try {
        const nodeAfter = editor.state.doc.resolve(pos).nodeAfter;
        return nodeAfter?.type.name === "tableCell" || nodeAfter?.type.name === "tableHeader";
      } catch {
        return false;
      }
    };

    editor.state.doc.descendants((node, pos) => {
      if (found !== null) return false;
      if (node.type.name !== "tableCell" && node.type.name !== "tableHeader") return true;

      const dom = view.nodeDOM(pos);
      if (dom === cell || (dom instanceof HTMLElement && dom.contains(cell))) {
        found = pos;
        return false;
      }

      return true;
    });

    if (isCellStart(found)) return found;

    try {
      const row = cell.parentElement;
      const index = row ? Array.from(row.children).indexOf(cell) : -1;
      const candidates = [
        row && index >= 0 ? view.posAtDOM(row, index) : null,
        view.posAtDOM(cell, 0),
      ];

      for (const candidate of candidates) {
        if (isCellStart(candidate)) return candidate;
        if (isCellStart(candidate - 1)) return candidate - 1;
      }
    } catch {
      return null;
    }

    return found;
  };

  const getTableElement = (tableId: string) => {
    return containerRef.current?.querySelector<HTMLTableElement>(`table[data-table-id="${tableId}"]`) ?? null;
  };

  const getSelectionTableId = () => {
    if (!editor) return null;
    const view = (editor as any).view;
    const domAtSelection = view.domAtPos(editor.state.selection.from).node;
    const el = domAtSelection instanceof HTMLElement ? domAtSelection : domAtSelection?.parentElement;
    return ((el?.closest("table.note-table") as HTMLTableElement | null)?.dataset.tableId) ?? null;
  };

  const getTargetCellPosition = (tableId: string, targetCell: "first" | "last" | "current") => {
    if (!editor) return null;

    if (targetCell === "current" && getSelectionTableId() === tableId) {
      return "current";
    }

    const tbl = getTableElement(tableId);
    const cells = tbl?.querySelectorAll<HTMLElement>("td, th");
    const target = targetCell === "last" ? cells?.[(cells?.length ?? 0) - 1] : cells?.[0];
    if (!target) return null;

    const pos = getCellPosition(target);
    return typeof pos === "number" && pos >= 0 ? pos : null;
  };

  // Select a reliable table cell, then run the TipTap table command in a fresh editor state.
  const runTableCommand = (
    tableId: string,
    command: "addColumnAfter" | "addRowAfter" | "deleteColumn" | "deleteRow" | "deleteTable",
    targetCell: "first" | "last" | "current" = "current"
  ) => {
    if (!editor) return false;

    const targetPos = getTargetCellPosition(tableId, targetCell);
    if (targetPos === null) return false;

    const commandFn = (editor.commands as any)[command];
    if (typeof commandFn !== "function") return false;

    try {
      if (typeof targetPos === "number") {
        const selected = Boolean((editor.commands as any).setCellSelection({ anchorCell: targetPos, headCell: targetPos }));
        if (!selected) return false;
      }

      editor.view.focus();
      const ok = Boolean(commandFn());
      requestAnimationFrame(() => editor.view.focus());
      return ok;
    } catch (error) {
      console.error("Erro ao executar comando da tabela", error);
      return false;
    }
  };

  // Scan tables, assign stable ids, capture geometry
  useEffect(() => {
    if (!editor) return;
    const root = containerRef.current;
    if (!root) return;

    const scan = () => {
      const tableEls = Array.from(root.querySelectorAll<HTMLTableElement>("table.note-table"));
      const rootRect = root.getBoundingClientRect();
      const next: TableMeta[] = tableEls.map((tbl, idx) => {
        if (!tbl.dataset.tableId) tbl.dataset.tableId = `tbl-${idx}-${Math.random().toString(36).slice(2, 7)}`;
        const id = tbl.dataset.tableId!;
        const rect = tbl.getBoundingClientRect();
        return {
          id,
          top: rect.top - rootRect.top + root.scrollTop,
          left: rect.left - rootRect.left + root.scrollLeft,
          width: rect.width,
          height: rect.height,
        };
      });
      setTables((prev) => {
        if (
          prev.length === next.length &&
          prev.every(
            (p, i) =>
              p.id === next[i].id &&
              p.width === next[i].width &&
              p.height === next[i].height &&
              p.top === next[i].top &&
              p.left === next[i].left
          )
        ) {
          return prev;
        }
        return next;
      });
      setActiveId((id) => (id && next.some((table) => table.id === id) ? id : null));
    };

    scan();
    const ro = new ResizeObserver(() => scan());
    ro.observe(root);

    const onUpdate = () => requestAnimationFrame(scan);
    editor.on("update", onUpdate);
    editor.on("selectionUpdate", onUpdate);
    window.addEventListener("resize", scan);

    return () => {
      ro.disconnect();
      editor.off("update", onUpdate);
      editor.off("selectionUpdate", onUpdate);
      window.removeEventListener("resize", scan);
    };
  }, [editor, containerRef]);

  // Show controls when the table is clicked or when the selection is inside a table.
  useEffect(() => {
    const root = containerRef.current;
    if (!root || !editor) return;

    const setActiveFromTarget = (eventTarget: EventTarget | null) => {
      const element = eventTarget instanceof HTMLElement ? eventTarget : null;
      const tbl = element?.closest?.("table.note-table") as HTMLTableElement | null;
      if (tbl?.dataset.tableId) {
        setActiveId(tbl.dataset.tableId);
      } else if (!element?.closest?.("[data-table-controls]")) {
        setActiveId(null);
      }
    };

    const onPointerDown = (event: MouseEvent) => setActiveFromTarget(event.target);
    const onSelectionUpdate = () => setActiveId(getSelectionTableId());

    root.addEventListener("mousedown", onPointerDown);
    editor.on("selectionUpdate", onSelectionUpdate);
    return () => {
      root.removeEventListener("mousedown", onPointerDown);
      editor.off("selectionUpdate", onSelectionUpdate);
    };
  }, [editor, containerRef]);

  if (!tables.length || !editor) return null;

  const actions: Array<{
    key: string;
    label: string;
    icon: typeof Trash2;
    command: "addColumnAfter" | "addRowAfter" | "deleteColumn" | "deleteRow" | "deleteTable";
    target: "first" | "last" | "current";
    destructive?: boolean;
  }> = [
    { key: "add-col", label: "Coluna", icon: BetweenVerticalStart, command: "addColumnAfter", target: "current" },
    { key: "add-row", label: "Linha", icon: BetweenHorizontalStart, command: "addRowAfter", target: "current" },
    { key: "del-col", label: "Coluna", icon: Columns3, command: "deleteColumn", target: "current", destructive: true },
    { key: "del-row", label: "Linha", icon: Rows3, command: "deleteRow", target: "current", destructive: true },
    { key: "del-tbl", label: "Tabela", icon: Trash2, command: "deleteTable", target: "first", destructive: true },
  ];

  return (
    <div data-table-controls className="pointer-events-none absolute inset-0 z-10">
      {tables.map((meta) => {
        const isActive = activeId === meta.id;
        if (!isActive) return null;

        return (
          <div
            key={meta.id}
            data-table-controls
            className="pointer-events-none absolute"
            style={{
              top: meta.top,
              left: meta.left,
              width: meta.width,
              height: meta.height,
            }}
          >
            <div
              className="pointer-events-auto absolute left-1/2 -translate-x-1/2 -top-12 flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1.5 shadow-lg"
              onMouseDown={(event) => event.preventDefault()}
            >
              {actions.map((action, idx) => {
                const Icon = action.icon;
                const showSeparatorBefore = idx === 2;
                return (
                  <div key={action.key} className="flex items-center">
                    {showSeparatorBefore && <div className="mx-1 h-5 w-px bg-border" />}
                    <button
                      type="button"
                      title={
                        action.command === "addColumnAfter"
                          ? "Adicionar coluna"
                          : action.command === "addRowAfter"
                          ? "Adicionar linha"
                          : action.command === "deleteColumn"
                          ? "Remover coluna"
                          : action.command === "deleteRow"
                          ? "Remover linha"
                          : "Excluir tabela"
                      }
                      onClick={() => runTableCommand(meta.id, action.command, action.target)}
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        action.destructive
                          ? "text-destructive hover:bg-destructive/10"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{action.label}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

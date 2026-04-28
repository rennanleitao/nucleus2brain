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

  return (
    <div data-table-controls className="pointer-events-none absolute inset-0 z-10">
      {tables.map((meta) => {
        const isActive = activeId === meta.id;
        if (!isActive) return null;

        return (
          <div
            key={meta.id}
            className="pointer-events-none absolute"
            style={{
              top: meta.top,
              left: meta.left,
              width: meta.width,
              height: meta.height,
            }}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="pointer-events-auto absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground"
                  title="Opções da tabela"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    runTableCommand(meta.id, "addColumnAfter", "last");
                  }}
                >
                  <Columns3 className="h-4 w-4 mr-2" /> Adicionar coluna
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    runTableCommand(meta.id, "addRowAfter", "last");
                  }}
                >
                  <Rows3 className="h-4 w-4 mr-2" /> Adicionar linha
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    runTableCommand(meta.id, "deleteColumn", "current");
                  }}
                >
                  <X className="h-4 w-4 mr-2" /> Remover coluna atual
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    runTableCommand(meta.id, "deleteRow", "current");
                  }}
                >
                  <X className="h-4 w-4 mr-2" /> Remover linha atual
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={(event) => {
                    event.preventDefault();
                    runTableCommand(meta.id, "deleteTable", "first");
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir tabela
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* "+" on right edge to add column */}
            <button
              type="button"
              title="Adicionar coluna"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                runTableCommand(meta.id, "addColumnAfter", "last");
              }}
              className="pointer-events-auto absolute flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110"
              style={{
                top: meta.height / 2 - 11,
                left: meta.width - 11,
                width: 22,
                height: 22,
              }}
            >
              <Plus className="h-3 w-3" />
            </button>

            {/* "+" on bottom edge to add row */}
            <button
              type="button"
              title="Adicionar linha"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                runTableCommand(meta.id, "addRowAfter", "last");
              }}
              className="pointer-events-auto absolute flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110"
              style={{
                top: meta.height - 11,
                left: meta.width / 2 - 11,
                width: 22,
                height: 22,
              }}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

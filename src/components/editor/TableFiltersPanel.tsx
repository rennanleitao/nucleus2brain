import { useEffect, useRef, useState } from "react";
import { Editor } from "@tiptap/react";
import { Search, X, Plus, Trash2, MoreHorizontal, Columns3, Rows3 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TableMeta {
  id: string;
  colWidths: number[];
  rowHeights: number[];
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
 *  - Filter bar above the table (one input per column)
 *  - "+" handle on the right edge to add a column
 *  - "+" handle on the bottom edge to add a row
 *  - Top-right menu with delete column / delete row / delete table
 */
export function TableFiltersPanel({ editor, containerRef }: TableFiltersPanelProps) {
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [queries, setQueries] = useState<Record<string, string[]>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const getCellPosition = (cell: HTMLElement) => {
    if (!editor) return null;
    const view = (editor as any).view;
    let found: number | null = null;

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

    return found;
  };

  const getSelectionTableId = () => {
    if (!editor) return null;
    const view = (editor as any).view;
    const domAtSelection = view.domAtPos(editor.state.selection.from).node;
    const el = domAtSelection instanceof HTMLElement ? domAtSelection : domAtSelection?.parentElement;
    return ((el?.closest("table.note-table") as HTMLTableElement | null)?.dataset.tableId) ?? null;
  };

  // Select a reliable table cell, then run the TipTap table command.
  const runTableCommand = (
    tableId: string,
    command: "addColumnAfter" | "addRowAfter" | "deleteColumn" | "deleteRow" | "deleteTable",
    targetCell: "first" | "last" | "current" = "current"
  ) => {
    const root = containerRef.current;
    if (!root || !editor) return false;

    let chain = editor.chain().focus() as any;
    const currentSelectionIsInTable = targetCell === "current" && getSelectionTableId() === tableId;

    if (!currentSelectionIsInTable) {
      const tbl = root.querySelector<HTMLTableElement>(`table[data-table-id="${tableId}"]`);
      const cells = tbl?.querySelectorAll<HTMLElement>("td, th");
      const target = targetCell === "last" ? cells?.[(cells?.length ?? 0) - 1] : cells?.[0];
      if (!target) return false;

      const pos = getCellPosition(target);
      if (typeof pos !== "number" || pos < 0) return false;
      chain = chain.setCellSelection({ anchorCell: pos, headCell: pos });
    }

    const commandFn = chain[command];
    if (typeof commandFn !== "function") return false;

    try {
      return Boolean(commandFn.call(chain).run());
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
        const rows = Array.from(tbl.querySelectorAll<HTMLTableRowElement>("tr"));
        const firstRow = rows[0];
        const cells = firstRow ? (Array.from(firstRow.children) as HTMLElement[]) : [];
        const colWidths = cells.map((c) => c.getBoundingClientRect().width);
        const rowHeights = rows.map((r) => r.getBoundingClientRect().height);
        return {
          id,
          colWidths,
          rowHeights,
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
              p.left === next[i].left &&
              p.colWidths.length === next[i].colWidths.length &&
              p.colWidths.every((w, j) => w === next[i].colWidths[j])
          )
        ) {
          return prev;
        }
        return next;
      });
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

  // Apply filters by hiding/showing rows in each table
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    tables.forEach((meta) => {
      const tbl = root.querySelector<HTMLTableElement>(`table[data-table-id="${meta.id}"]`);
      if (!tbl) return;
      const colQueries = (queries[meta.id] ?? []).map((q) => (q ?? "").trim().toLowerCase());
      const hasAny = colQueries.some((q) => q.length > 0);
      const rows = Array.from(tbl.querySelectorAll<HTMLTableRowElement>("tr"));
      rows.forEach((row) => {
        if (row.querySelector("th")) {
          row.style.display = "";
          return;
        }
        if (!hasAny) {
          row.style.display = "";
          return;
        }
        const cells = Array.from(row.children) as HTMLElement[];
        const ok = colQueries.every((q, idx) => {
          if (!q) return true;
          const text = (cells[idx]?.textContent ?? "").toLowerCase();
          return text.includes(q);
        });
        row.style.display = ok ? "" : "none";
      });
    });
  }, [queries, tables, containerRef]);

  // Hover detection: since wrapper is pointer-events:none, listen on container directly
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const onMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const tbl = target?.closest?.("table.note-table") as HTMLTableElement | null;
      if (tbl?.dataset.tableId) {
        setHoveredId(tbl.dataset.tableId);
      }
    };
    const onLeave = () => setHoveredId(null);
    root.addEventListener("mousemove", onMove);
    root.addEventListener("mouseleave", onLeave);
    return () => {
      root.removeEventListener("mousemove", onMove);
      root.removeEventListener("mouseleave", onLeave);
    };
  }, [containerRef]);

  if (!tables.length || !editor) return null;

  return (
    <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-10">
      {tables.map((meta) => {
        const totalWidth = meta.colWidths.reduce((a, b) => a + b, 0) || meta.width;
        const isHover = hoveredId === meta.id;

        return (
          <div
            key={meta.id}
            className="pointer-events-none absolute"
            style={{
              top: meta.top - 32,
              left: meta.left,
              width: totalWidth + 28,
              height: meta.height + 32 + 16,
            }}
          >
            {/* Filter bar */}
            <div
              className="pointer-events-auto absolute left-0 top-0 flex items-stretch bg-muted/70 backdrop-blur-sm border border-border rounded-md overflow-hidden shadow-sm"
              style={{ width: totalWidth, height: 26 }}
            >
              <div className="flex items-center px-1.5 text-muted-foreground border-r border-border bg-background/50">
                <Search className="h-3 w-3" />
              </div>
              {meta.colWidths.map((w, idx) => {
                const value = queries[meta.id]?.[idx] ?? "";
                return (
                  <div
                    key={idx}
                    className="flex items-center border-r border-border last:border-r-0 px-1"
                    style={{ width: w }}
                  >
                    <input
                      type="text"
                      value={value}
                      placeholder="Filtrar…"
                      onChange={(e) => {
                        const v = e.target.value;
                        setQueries((q) => {
                          const arr = [...(q[meta.id] ?? [])];
                          arr[idx] = v;
                          return { ...q, [meta.id]: arr };
                        });
                      }}
                      className="w-full bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/50 text-foreground"
                    />
                    {value && (
                      <button
                        type="button"
                        onClick={() =>
                          setQueries((q) => {
                            const arr = [...(q[meta.id] ?? [])];
                            arr[idx] = "";
                            return { ...q, [meta.id]: arr };
                          })
                        }
                        className="text-muted-foreground hover:text-foreground"
                        title="Limpar"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Menu: more actions */}
              <div className="ml-auto flex items-center border-l border-border bg-background/50">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="px-1.5 h-full text-muted-foreground hover:text-foreground"
                      title="Opções da tabela"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem
                      onClick={() => {
                        runTableCommand(meta.id, "addColumnAfter", "last");
                      }}
                    >
                      <Columns3 className="h-4 w-4 mr-2" /> Adicionar coluna
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        runTableCommand(meta.id, "addRowAfter", "last");
                      }}
                    >
                      <Rows3 className="h-4 w-4 mr-2" /> Adicionar linha
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        runTableCommand(meta.id, "deleteColumn");
                      }}
                    >
                      <X className="h-4 w-4 mr-2" /> Remover coluna atual
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        runTableCommand(meta.id, "deleteRow");
                      }}
                    >
                      <X className="h-4 w-4 mr-2" /> Remover linha atual
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => {
                        runTableCommand(meta.id, "deleteTable", "first");
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Excluir tabela
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* "+" on right edge to add column */}
            <button
              type="button"
              title="Adicionar coluna"
              onClick={() => {
                if (focusLastCellOf(meta.id)) editor.chain().focus().addColumnAfter().run();
              }}
              className={`pointer-events-auto absolute flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-opacity hover:scale-110 ${
                isHover ? "opacity-100" : "opacity-0"
              }`}
              style={{
                top: 32 + meta.height / 2 - 10,
                left: totalWidth + 4,
                width: 20,
                height: 20,
              }}
            >
              <Plus className="h-3 w-3" />
            </button>

            {/* "+" on bottom edge to add row */}
            <button
              type="button"
              title="Adicionar linha"
              onClick={() => {
                if (focusLastCellOf(meta.id)) editor.chain().focus().addRowAfter().run();
              }}
              className={`pointer-events-auto absolute flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-opacity hover:scale-110 ${
                isHover ? "opacity-100" : "opacity-0"
              }`}
              style={{
                top: 32 + meta.height + 4,
                left: totalWidth / 2 - 10,
                width: 20,
                height: 20,
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

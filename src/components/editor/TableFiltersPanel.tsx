import { useEffect, useRef, useState } from "react";
import { Editor } from "@tiptap/react";
import { Search, X } from "lucide-react";

interface TableMeta {
  id: string;
  colWidths: number[];
  top: number;
  left: number;
  width: number;
}

interface TableFiltersPanelProps {
  editor: Editor | null;
  containerRef: React.RefObject<HTMLDivElement>;
}

/**
 * Renders one filter bar per <table.note-table> in the editor.
 * The bars live OUTSIDE the editor DOM (so ProseMirror can't strip them)
 * and are absolutely positioned above each table, with one input per column.
 */
export function TableFiltersPanel({ editor, containerRef }: TableFiltersPanelProps) {
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [queries, setQueries] = useState<Record<string, string[]>>({});
  const overlayRef = useRef<HTMLDivElement>(null);

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
        const firstRow = tbl.querySelector("tr");
        const cells = firstRow ? Array.from(firstRow.children) as HTMLElement[] : [];
        const colWidths = cells.map((c) => c.getBoundingClientRect().width);
        return {
          id,
          colWidths,
          top: rect.top - rootRect.top + root.scrollTop,
          left: rect.left - rootRect.left + root.scrollLeft,
          width: rect.width,
        };
      });
      setTables((prev) => {
        // shallow compare to avoid useless re-renders
        if (prev.length === next.length && prev.every((p, i) => p.id === next[i].id && p.width === next[i].width && p.top === next[i].top && p.colWidths.length === next[i].colWidths.length && p.colWidths.every((w, j) => w === next[i].colWidths[j]))) {
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

  if (!tables.length) return null;

  return (
    <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-10">
      {tables.map((meta) => {
        const totalWidth = meta.colWidths.reduce((a, b) => a + b, 0) || meta.width;
        return (
          <div
            key={meta.id}
            className="pointer-events-auto absolute flex items-stretch bg-muted/60 backdrop-blur-sm border border-border rounded-md overflow-hidden shadow-sm"
            style={{
              top: Math.max(0, meta.top - 30),
              left: meta.left,
              width: totalWidth,
              height: 26,
            }}
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
          </div>
        );
      })}
    </div>
  );
}

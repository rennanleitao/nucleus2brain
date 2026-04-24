import { useEffect, useState } from "react";
import { Editor } from "@tiptap/react";
import { Search, X } from "lucide-react";

interface TableInfo {
  id: string;
  preview: string;
}

interface TableFiltersPanelProps {
  editor: Editor | null;
  containerRef: React.RefObject<HTMLDivElement>;
}

/**
 * Scans the editor DOM for <table> elements, gives each a stable id,
 * and renders a filter input per table. Filtering hides rows whose
 * text doesn't match the query (header row stays visible).
 */
export function TableFiltersPanel({ editor, containerRef }: TableFiltersPanelProps) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [queries, setQueries] = useState<Record<string, string>>({});

  // Re-scan tables on every editor update
  useEffect(() => {
    if (!editor) return;
    const scan = () => {
      const root = containerRef.current;
      if (!root) return;
      const tableEls = Array.from(root.querySelectorAll("table")) as HTMLTableElement[];
      const infos: TableInfo[] = tableEls.map((tbl, idx) => {
        if (!tbl.dataset.tableId) tbl.dataset.tableId = `tbl-${Date.now()}-${idx}`;
        const firstCell = tbl.querySelector("th, td")?.textContent?.trim() ?? "";
        return {
          id: tbl.dataset.tableId,
          preview: firstCell.slice(0, 24) || `Tabela ${idx + 1}`,
        };
      });
      setTables(infos);
    };
    scan();
    editor.on("update", scan);
    editor.on("selectionUpdate", scan);
    return () => {
      editor.off("update", scan);
      editor.off("selectionUpdate", scan);
    };
  }, [editor, containerRef]);

  // Apply filters whenever queries change or tables change
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const tableEls = Array.from(root.querySelectorAll("table")) as HTMLTableElement[];
    tableEls.forEach((tbl) => {
      const id = tbl.dataset.tableId;
      const q = (id && queries[id]?.trim().toLowerCase()) || "";
      const rows = Array.from(tbl.querySelectorAll("tr")) as HTMLElement[];
      rows.forEach((row, idx) => {
        const isHeader = idx === 0 && row.querySelector("th");
        if (!q || isHeader) {
          row.style.display = "";
          return;
        }
        const text = row.textContent?.toLowerCase() ?? "";
        row.style.display = text.includes(q) ? "" : "none";
      });
    });
  }, [queries, tables, containerRef]);

  const activeFilters = tables.filter((t) => queries[t.id]?.trim());

  if (tables.length === 0) return null;

  return (
    <div className="border-t border-border/40 bg-muted/20 px-3 py-2 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground/70 font-medium">
        <Search className="h-2.5 w-2.5" />
        Filtros de tabela ({tables.length})
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tables.map((t, i) => (
          <div key={t.id} className="flex items-center gap-1 bg-background border border-border rounded px-1.5 py-0.5">
            <span className="text-[10px] text-muted-foreground">#{i + 1}</span>
            <input
              type="text"
              value={queries[t.id] ?? ""}
              onChange={(e) => setQueries((q) => ({ ...q, [t.id]: e.target.value }))}
              placeholder={`Filtrar "${t.preview}"...`}
              className="bg-transparent text-xs outline-none w-32 placeholder:text-muted-foreground/50"
            />
            {queries[t.id] && (
              <button
                type="button"
                onClick={() => setQueries((q) => ({ ...q, [t.id]: "" }))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        ))}
        {activeFilters.length > 0 && (
          <button
            type="button"
            onClick={() => setQueries({})}
            className="text-[10px] text-muted-foreground hover:text-foreground underline"
          >
            limpar todos
          </button>
        )}
      </div>
    </div>
  );
}

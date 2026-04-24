import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

export function FilterableTableNodeView() {
  const [query, setQuery] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Apply filter by hiding rows whose text doesn't match
  useEffect(() => {
    const tbl = wrapperRef.current?.querySelector("table");
    if (!tbl) return;
    const rows = Array.from(tbl.querySelectorAll("tbody > tr, tr")) as HTMLElement[];
    const q = query.trim().toLowerCase();
    rows.forEach((row, idx) => {
      // Keep header row (first row with TH) always visible
      const isHeader = row.querySelector("th") && idx === 0;
      if (!q || isHeader) {
        row.style.display = "";
        return;
      }
      const text = row.textContent?.toLowerCase() ?? "";
      row.style.display = text.includes(q) ? "" : "none";
    });
  }, [query]);

  return (
    <NodeViewWrapper className="filterable-table-wrapper my-3">
      <div
        ref={wrapperRef}
        className="rounded-lg border border-border/60 bg-card overflow-hidden"
      >
        <div
          contentEditable={false}
          className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-border/40 bg-muted/30"
        >
          <button
            type="button"
            onClick={() => {
              setShowFilter((v) => !v);
              if (showFilter) setQuery("");
            }}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            title="Filtrar tabela"
          >
            <Search className="h-3 w-3" />
            {showFilter ? "Ocultar filtro" : "Filtrar"}
          </button>
          {showFilter && (
            <div className="flex items-center gap-1 flex-1 max-w-xs">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar nesta tabela..."
                className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-muted-foreground hover:text-foreground"
                  title="Limpar"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <NodeViewContent as="table" className="filterable-table w-full text-sm" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}

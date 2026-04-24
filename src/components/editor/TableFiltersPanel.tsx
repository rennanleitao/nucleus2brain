import { useEffect } from "react";
import { Editor } from "@tiptap/react";

interface TableFiltersPanelProps {
  editor: Editor | null;
  containerRef: React.RefObject<HTMLDivElement>;
}

/**
 * Injects a filter row directly inside each <table.note-table> rendered by
 * the TipTap editor. The filter row lives in the DOM only (it is NOT part of
 * the editor document), so it doesn't pollute the saved HTML and doesn't
 * trigger ProseMirror transactions.
 *
 * Each column gets a small input; typing hides body rows whose corresponding
 * cell does not contain the query (case-insensitive). Multiple column
 * filters combine with AND.
 */
export function TableFiltersPanel({ editor, containerRef }: TableFiltersPanelProps) {
  useEffect(() => {
    if (!editor) return;
    const root = containerRef.current;
    if (!root) return;

    const FILTER_ROW_CLASS = "note-table-filter-row";

    const applyFilters = (tbl: HTMLTableElement) => {
      const filterRow = tbl.querySelector<HTMLTableRowElement>(`tr.${FILTER_ROW_CLASS}`);
      if (!filterRow) return;
      const inputs = Array.from(
        filterRow.querySelectorAll<HTMLInputElement>("input.note-table-filter-input")
      );
      const queries = inputs.map((i) => i.value.trim().toLowerCase());
      const hasAny = queries.some((q) => q.length > 0);

      const allRows = Array.from(tbl.querySelectorAll<HTMLTableRowElement>("tr"));
      allRows.forEach((row) => {
        if (row.classList.contains(FILTER_ROW_CLASS)) return;
        // Skip header rows (any row containing <th>)
        if (row.querySelector("th")) {
          row.style.display = "";
          return;
        }
        if (!hasAny) {
          row.style.display = "";
          return;
        }
        const cells = Array.from(row.children) as HTMLElement[];
        const match = queries.every((q, idx) => {
          if (!q) return true;
          const cell = cells[idx];
          const text = (cell?.textContent ?? "").toLowerCase();
          return text.includes(q);
        });
        row.style.display = match ? "" : "none";
      });
    };

    const ensureFilterRow = (tbl: HTMLTableElement) => {
      // Determine column count from first row
      const firstRow = tbl.querySelector<HTMLTableRowElement>("tr");
      if (!firstRow) return;
      const colCount = firstRow.children.length;
      if (colCount === 0) return;

      let filterRow = tbl.querySelector<HTMLTableRowElement>(`tr.${FILTER_ROW_CLASS}`);
      const needsRebuild = filterRow && filterRow.children.length !== colCount;
      if (needsRebuild && filterRow) {
        filterRow.remove();
        filterRow = null;
      }

      if (!filterRow) {
        filterRow = document.createElement("tr");
        filterRow.className = FILTER_ROW_CLASS;
        // Mark as non-editable so ProseMirror ignores it
        filterRow.setAttribute("contenteditable", "false");
        (filterRow as any).__isFilterRow = true;
        for (let i = 0; i < colCount; i++) {
          const td = document.createElement("td");
          td.setAttribute("contenteditable", "false");
          const input = document.createElement("input");
          input.type = "text";
          input.placeholder = "Filtrar…";
          input.className = "note-table-filter-input";
          input.addEventListener("input", () => applyFilters(tbl));
          input.addEventListener("mousedown", (e) => e.stopPropagation());
          input.addEventListener("click", (e) => e.stopPropagation());
          input.addEventListener("keydown", (e) => e.stopPropagation());
          td.appendChild(input);
          filterRow.appendChild(td);
        }

        // Insert right after the first row (header) if it has <th>, otherwise at top
        const tbody = tbl.querySelector("tbody") ?? tbl;
        const headerRow = tbody.querySelector("tr");
        if (headerRow && headerRow.querySelector("th") && headerRow.nextSibling) {
          tbody.insertBefore(filterRow, headerRow.nextSibling);
        } else if (headerRow && headerRow.querySelector("th")) {
          tbody.appendChild(filterRow);
        } else {
          tbody.insertBefore(filterRow, tbody.firstChild);
        }
      }

      applyFilters(tbl);
    };

    const scan = () => {
      const tables = Array.from(root.querySelectorAll<HTMLTableElement>("table.note-table"));
      tables.forEach(ensureFilterRow);
    };

    // Initial pass + observe DOM mutations from ProseMirror re-renders.
    scan();
    const mo = new MutationObserver(() => {
      // Defer to avoid re-entering during prosemirror's own DOM updates
      requestAnimationFrame(scan);
    });
    mo.observe(root, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
    };
  }, [editor, containerRef]);

  return null;
}

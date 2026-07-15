// Helpers for date-entry sections inside notes.
// A date entry is represented as: <h2 data-entry-date="YYYY-MM-DD" id="entry-YYYY-MM-DD">…label…</h2>

export interface NoteEntry {
  date: string; // YYYY-MM-DD
  headingId: string;
  snippet: string;
}

export interface NoteTopic {
  id: string;
  text: string;
}

export interface NoteAttachment {
  href: string;
  label: string;
  kind: "image" | "file" | "link";
}

// Parse attachments: images (<img>) and links (<a href>) inside a note.
// Storage/attachment URLs are marked as "file", other links as "link".
export function parseNoteAttachments(html: string): NoteAttachment[] {
  if (!html || typeof window === "undefined") return [];
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const out: NoteAttachment[] = [];
  const seen = new Set<string>();
  const push = (att: NoteAttachment) => {
    if (!att.href || seen.has(att.href)) return;
    seen.add(att.href);
    out.push(att);
  };
  doc.querySelectorAll("img[src]").forEach((img) => {
    const src = img.getAttribute("src") || "";
    const alt = (img.getAttribute("alt") || "").trim();
    if (!src || src.startsWith("data:")) return;
    push({ href: src, label: alt || filenameFromUrl(src) || "Imagem", kind: "image" });
  });
  doc.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;
    const text = (a.textContent || "").replace(/\s+/g, " ").trim();
    const looksLikeFile = /\/attachments\//i.test(href)
      || /\.(pdf|docx?|xlsx?|pptx?|txt|csv|zip|rar|mp3|mp4|mov|wav|m4a|png|jpe?g|gif|webp|svg)(\?|$)/i.test(href);
    push({
      href,
      label: text || filenameFromUrl(href) || href,
      kind: looksLikeFile ? "file" : "link",
    });
  });
  return out;
}

function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url, "http://x");
    const name = decodeURIComponent(u.pathname.split("/").pop() || "");
    return name;
  } catch {
    return "";
  }
}

// Parse topics: <mark data-topic="topic-...">…</mark> injected via the
// "Criar tópico" bubble action.
export function parseNoteTopics(html: string): NoteTopic[] {
  if (!html || typeof window === "undefined") return [];
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const marks = Array.from(doc.querySelectorAll("mark[data-topic]"));
  const seen = new Set<string>();
  const topics: NoteTopic[] = [];
  marks.forEach((m) => {
    const id = m.getAttribute("data-topic") || "";
    const text = (m.textContent || "").replace(/\s+/g, " ").trim();
    if (!id || !text || seen.has(id)) return;
    seen.add(id);
    topics.push({ id, text: text.slice(0, 120) });
  });
  return topics;
}

export function newTopicId(): string {
  return `topic-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const DATE_ATTR = "data-entry-date";

export function entryIdForDate(date: string): string {
  return `entry-${date}`;
}

export function isValidEntryDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

// Parse a note's HTML and return all date-entry sections found (in document order).
export function parseNoteEntries(html: string): NoteEntry[] {
  if (!html || typeof window === "undefined") return [];
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const headings = Array.from(doc.querySelectorAll(`[${DATE_ATTR}]`));
  const entries: NoteEntry[] = [];
  headings.forEach((h) => {
    const date = h.getAttribute(DATE_ATTR) || "";
    if (!isValidEntryDate(date)) return;
    // Snippet: siblings until next entry heading
    let snippet = "";
    let node = h.nextSibling as ChildNode | null;
    while (node && snippet.length < 140) {
      if (node.nodeType === 1) {
        const el = node as Element;
        if (el.hasAttribute?.(DATE_ATTR)) break;
        snippet += " " + (el.textContent || "");
      } else if (node.nodeType === 3) {
        snippet += " " + (node.textContent || "");
      }
      node = node.nextSibling;
    }
    entries.push({
      date,
      headingId: h.id || entryIdForDate(date),
      snippet: snippet.replace(/\s+/g, " ").trim().slice(0, 140),
    });
  });
  return entries;
}

// Returns the max (most recent) date present in the note, or null.
export function getLastEntryDate(html: string): string | null {
  const entries = parseNoteEntries(html);
  if (entries.length === 0) return null;
  return entries.map((e) => e.date).sort().slice(-1)[0];
}

const WEEKDAYS_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_LONG_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Parse YYYY-MM-DD as a local date (avoiding UTC drift).
function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split("-").map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

// Full label used inside the heading: "06 Jul 2026 · Segunda"
export function formatEntryLabel(date: string): string {
  if (!isValidEntryDate(date)) return date;
  const d = parseLocalDate(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = MONTHS_PT[d.getMonth()];
  const year = d.getFullYear();
  const weekday = WEEKDAYS_PT[d.getDay()];
  return `${day} ${month} ${year} · ${weekday}`;
}

// Short label for sidebars: "06 Jul"
export function formatEntryShort(date: string): string {
  if (!isValidEntryDate(date)) return date;
  const d = parseLocalDate(date);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_PT[d.getMonth()]}`;
}

export function formatMonthLabel(date: string): string {
  const d = parseLocalDate(date);
  return `${MONTHS_LONG_PT[d.getMonth()]} ${d.getFullYear()}`;
}

// Relative label ("Hoje", "Ontem") or short date.
export function formatEntryRelative(date: string, today: string): string {
  if (date === today) return "Hoje";
  const t = parseLocalDate(today);
  const y = new Date(t);
  y.setDate(y.getDate() - 1);
  const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
  if (date === yStr) return "Ontem";
  return formatEntryShort(date);
}

// Build the HTML fragment that represents a new date entry.
export function buildDateEntryHtml(date: string): string {
  return `<h2 data-entry-date="${date}" id="${entryIdForDate(date)}">${formatEntryLabel(date)}</h2><p></p>`;
}

// Parse a user-typed date in flexible Brazilian formats.
// Accepts: DD.MM.AA, DD.MM.AAAA, DD/MM/AA, DD/MM/AAAA, DD-MM-AA, DD-MM-AAAA,
// or a bare 4-digit year AAAA (mapped to Jan 1st).
// Returns YYYY-MM-DD or null.
export function parseFlexibleDate(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    let y = parseInt(m[3], 10);
    if (m[3].length === 2) y = 2000 + y;
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})$/);
  if (m) {
    const y = parseInt(m[1], 10);
    if (y < 1900 || y > 2200) return null;
    return `${y}-01-01`;
  }
  return null;
}

// Move a date-entry section (heading + all content until the next date-entry
// heading) so it lands before/after the target section. Returns updated HTML,
// or the original HTML if the move is a no-op.
export function reorderNoteEntries(
  html: string,
  fromDate: string,
  toDate: string,
  position: "before" | "after" = "before",
): string {
  if (!html || typeof window === "undefined" || fromDate === toDate) return html;
  const doc = new DOMParser().parseFromString(`<div id="__root__">${html}</div>`, "text/html");
  const container = doc.getElementById("__root__");
  if (!container) return html;

  type Section = { date: string | null; nodes: Element[] };
  const sections: Section[] = [];
  let current: Section = { date: null, nodes: [] };
  sections.push(current);
  Array.from(container.children).forEach((child) => {
    if (child.hasAttribute(DATE_ATTR)) {
      current = { date: child.getAttribute(DATE_ATTR), nodes: [child] };
      sections.push(current);
    } else {
      current.nodes.push(child);
    }
  });

  const fromIdx = sections.findIndex((s) => s.date === fromDate);
  if (fromIdx < 0) return html;
  const [moved] = sections.splice(fromIdx, 1);
  const targetIdx = sections.findIndex((s) => s.date === toDate);
  if (targetIdx < 0) {
    sections.splice(fromIdx, 0, moved);
    return html;
  }
  const insertIdx = position === "after" ? targetIdx + 1 : targetIdx;
  sections.splice(insertIdx, 0, moved);

  container.innerHTML = "";
  sections.forEach((sec) => sec.nodes.forEach((n) => container.appendChild(n)));
  return container.innerHTML;
}

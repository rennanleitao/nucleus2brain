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

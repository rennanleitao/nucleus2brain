// Full-text search helpers for notes: matches title, body text, tags and
// participants (rendered by the participants node in the editor).

export function noteToPlainText(html: string | null | undefined): string {
  return (html || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Names stored on the participants block (data-names="a, b") plus "Participantes: ..." lines. */
export function extractParticipants(html: string | null | undefined): string[] {
  const source = html || "";
  const names = new Set<string>();

  for (const m of source.matchAll(/data-names="([^"]*)"/gi)) {
    m[1]
      .split(/[,;]/)
      .map((n) => n.trim())
      .filter(Boolean)
      .forEach((n) => names.add(n));
  }

  const plain = noteToPlainText(source);
  for (const m of plain.matchAll(/participantes?\s*:\s*([^.\n]{1,200})/gi)) {
    m[1]
      .split(/[,;]| e /i)
      .map((n) => n.trim())
      .filter((n) => n.length > 1 && n.length < 60)
      .forEach((n) => names.add(n));
  }

  return [...names];
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export interface SearchableNote {
  title?: string | null;
  content?: string | null;
  tags?: string[] | null;
}

export interface NoteSearchMatch {
  matched: boolean;
  /** Where the term was found, for display purposes. */
  field?: "title" | "content" | "tag" | "participant";
  /** Excerpt around the match (content matches only). */
  snippet?: string;
}

/** Multi-term (AND) search across title, body, tags and participants. */
export function searchNote(note: SearchableNote, query: string): NoteSearchMatch {
  const q = query.trim();
  if (!q) return { matched: true };

  const terms = normalize(q).split(/\s+/).filter(Boolean);
  const title = normalize(note.title || "");
  const plain = noteToPlainText(note.content);
  const body = normalize(plain);
  const tags = (note.tags || []).map(normalize);
  const participants = extractParticipants(note.content).map(normalize);

  const allMatch = terms.every(
    (t) =>
      title.includes(t) ||
      body.includes(t) ||
      tags.some((tag) => tag.includes(t)) ||
      participants.some((p) => p.includes(t)),
  );
  if (!allMatch) return { matched: false };

  const first = terms[0];
  if (title.includes(first)) return { matched: true, field: "title" };
  if (tags.some((tag) => tag.includes(first))) return { matched: true, field: "tag" };
  if (participants.some((p) => p.includes(first))) {
    return { matched: true, field: "participant" };
  }

  const idx = body.indexOf(first);
  if (idx >= 0) {
    const start = Math.max(0, idx - 45);
    const end = Math.min(plain.length, idx + first.length + 90);
    const snippet = `${start > 0 ? "…" : ""}${plain.slice(start, end).trim()}${end < plain.length ? "…" : ""}`;
    return { matched: true, field: "content", snippet };
  }

  return { matched: true };
}

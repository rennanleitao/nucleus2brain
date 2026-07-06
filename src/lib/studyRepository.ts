import type { StudyEntry } from "@/hooks/useStudies";

export interface RepositorySource {
  id: string;
  title: string;
  url: string;
  text: string;
  kind: "link" | "text";
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  storagePath?: string;
}

interface RepositoryPayload {
  version: 1;
  sources: RepositorySource[];
}

export function createEmptyRepositorySource(): RepositorySource {
  return {
    id: crypto.randomUUID(),
    title: "",
    url: "",
    text: "",
    kind: "link",
  };
}

export function parseRepositorySources(entry?: Pick<StudyEntry, "content" | "source_url"> | null): RepositorySource[] {
  if (!entry) return [createEmptyRepositorySource()];

  const parsed = parseRepositoryPayload(entry.content);
  if (parsed?.sources.length) {
    return parsed.sources.map((source) => ({
      ...createEmptyRepositorySource(),
      ...source,
      kind: source.kind === "text" ? "text" : "link",
    }));
  }

  if (entry.source_url) {
    return [{
      ...createEmptyRepositorySource(),
      title: getSourceHost(entry.source_url),
      url: entry.source_url,
      kind: "link",
    }];
  }

  if (entry.content?.trim()) {
    return [{
      ...createEmptyRepositorySource(),
      title: "Texto livre",
      text: entry.content,
      kind: "text",
    }];
  }

  return [createEmptyRepositorySource()];
}

export function serializeRepositorySources(sources: RepositorySource[]) {
  const cleaned = cleanRepositorySources(sources);
  if (!cleaned.length) return null;
  const payload: RepositoryPayload = { version: 1, sources: cleaned };
  return JSON.stringify(payload);
}

export function cleanRepositorySources(sources: RepositorySource[]) {
  return sources
    .map((source) => ({
      id: source.id || crypto.randomUUID(),
      title: source.title.trim(),
      url: source.url.trim(),
      text: source.text.trim(),
      kind: source.kind,
      fileName: source.fileName?.trim() || undefined,
      fileSize: typeof source.fileSize === "number" ? source.fileSize : undefined,
      mimeType: source.mimeType?.trim() || undefined,
      storagePath: source.storagePath?.trim() || undefined,
    }))
    .filter((source) => source.title || source.url || source.text);
}

export function getPrimarySourceUrl(sources: RepositorySource[]) {
  return cleanRepositorySources(sources).find((source) => source.url)?.url || null;
}

export function htmlToPlainText(html: string) {
  const container = document.createElement("div");
  container.innerHTML = html;
  return (container.textContent || "").replace(/\s+/g, " ").trim();
}

export function ensureHtml(value: string) {
  if (!value.trim()) return "<p></p>";
  if (/<[a-z][\s\S]*>/i.test(value)) return value;
  return `<p>${escapeHtml(value).replace(/\n/g, "<br>")}</p>`;
}

export function getSourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Abrir fonte";
  }
}

export function isImageSource(source: Pick<RepositorySource, "url" | "mimeType">) {
  if (source.mimeType?.startsWith("image/")) return true;
  return /\.(avif|gif|jpe?g|png|webp|svg)(\?|#|$)/i.test(source.url);
}

export function isPdfSource(source: Pick<RepositorySource, "url" | "mimeType">) {
  if (source.mimeType === "application/pdf") return true;
  return /\.pdf(\?|#|$)/i.test(source.url);
}

export function formatFileSize(size?: number) {
  if (!size || size < 1) return null;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function parseRepositoryPayload(content?: string | null): RepositoryPayload | null {
  if (!content?.trim()) return null;
  try {
    const parsed = JSON.parse(content) as Partial<RepositoryPayload>;
    if (parsed.version !== 1 || !Array.isArray(parsed.sources)) return null;
    return {
      version: 1,
      sources: parsed.sources.filter(isRepositorySource),
    };
  } catch {
    return null;
  }
}

function isRepositorySource(value: unknown): value is RepositorySource {
  if (!value || typeof value !== "object") return false;
  const source = value as Partial<RepositorySource>;
  return (
    typeof source.id === "string" &&
    typeof source.title === "string" &&
    typeof source.url === "string" &&
    typeof source.text === "string" &&
    (source.kind === "link" || source.kind === "text")
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

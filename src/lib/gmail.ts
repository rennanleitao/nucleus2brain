import { supabase } from "@/integrations/supabase/client";

export type GmailListMessage = { id: string; threadId: string };
export type GmailMessageHeader = { name: string; value: string };
export type GmailMessagePart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailMessageHeader[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailMessagePart[];
};
export type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
  sizeEstimate?: number;
};
export type GmailThread = {
  id: string;
  historyId?: string;
  messages: GmailMessage[];
};

async function callGmail<T>(path: string, opts?: { method?: string; body?: unknown; query?: Record<string, string | string[] | undefined> }): Promise<T> {
  const cleanQuery: Record<string, string | string[]> = {};
  if (opts?.query) {
    for (const [k, v] of Object.entries(opts.query)) if (v !== undefined) cleanQuery[k] = v as string | string[];
  }
  const { data, error } = await supabase.functions.invoke("gmail-api", {
    body: { path, method: opts?.method ?? "GET", body: opts?.body, query: cleanQuery },
  });
  if (error) {
    let detail = error.message ?? "unknown";
    try {
      const ctx = (error as unknown as { context?: { text?: () => Promise<string> } }).context;
      if (ctx?.text) detail = await ctx.text();
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return data as T;
}

export async function listMessages(params: { q?: string; labelIds?: string[]; maxResults?: number; pageToken?: string } = {}) {
  const query: Record<string, string | string[]> = {};
  if (params.q) query.q = params.q;
  if (params.labelIds?.length) query.labelIds = params.labelIds;
  if (params.maxResults) query.maxResults = String(params.maxResults);
  if (params.pageToken) query.pageToken = params.pageToken;
  return callGmail<{ messages?: GmailListMessage[]; nextPageToken?: string; resultSizeEstimate?: number }>("/gmail/v1/users/me/messages", { query });
}

export async function getMessage(id: string, format: "full" | "metadata" | "minimal" = "metadata") {
  return callGmail<GmailMessage>(`/gmail/v1/users/me/messages/${id}`, { query: { format } });
}

export async function getThread(id: string) {
  return callGmail<GmailThread>(`/gmail/v1/users/me/threads/${id}`, { query: { format: "full" } });
}

export async function modifyMessage(id: string, add: string[], remove: string[]) {
  return callGmail<GmailMessage>(`/gmail/v1/users/me/messages/${id}/modify`, {
    method: "POST",
    body: { addLabelIds: add, removeLabelIds: remove },
  });
}

export async function trashMessage(id: string) {
  return callGmail<GmailMessage>(`/gmail/v1/users/me/messages/${id}/trash`, { method: "POST" });
}

export async function sendRawEmail(rfc2822: string) {
  const raw = base64UrlEncode(rfc2822);
  return callGmail<{ id: string; threadId: string }>("/gmail/v1/users/me/messages/send", {
    method: "POST",
    body: { raw },
  });
}

export function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

export function getHeader(msg: GmailMessage, name: string): string {
  const headers = msg.payload?.headers ?? [];
  const h = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

export type ExtractedBody = { text: string; html: string; attachments: Array<{ partId?: string; filename: string; mimeType: string; attachmentId?: string; size?: number }> };

export function extractBody(msg: GmailMessage): ExtractedBody {
  const out: ExtractedBody = { text: "", html: "", attachments: [] };
  const walk = (part?: GmailMessagePart) => {
    if (!part) return;
    const mime = part.mimeType ?? "";
    if (part.filename && part.body?.attachmentId) {
      out.attachments.push({
        partId: part.partId,
        filename: part.filename,
        mimeType: mime,
        attachmentId: part.body.attachmentId,
        size: part.body.size,
      });
    } else if (mime === "text/plain" && part.body?.data && !out.text) {
      out.text = base64UrlDecode(part.body.data);
    } else if (mime === "text/html" && part.body?.data && !out.html) {
      out.html = base64UrlDecode(part.body.data);
    }
    if (part.parts) for (const p of part.parts) walk(p);
  };
  walk(msg.payload);
  if (!out.text && !out.html && msg.snippet) out.text = msg.snippet;
  return out;
}

export function buildReplyRfc2822(opts: {
  to: string;
  subject: string;
  inReplyTo?: string;
  references?: string;
  bodyText: string;
  cc?: string;
  bcc?: string;
}): string {
  const lines: string[] = [];
  lines.push(`To: ${opts.to}`);
  if (opts.cc) lines.push(`Cc: ${opts.cc}`);
  if (opts.bcc) lines.push(`Bcc: ${opts.bcc}`);
  lines.push(`Subject: ${opts.subject}`);
  if (opts.inReplyTo) lines.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) lines.push(`References: ${opts.references}`);
  lines.push("MIME-Version: 1.0");
  lines.push('Content-Type: text/plain; charset="UTF-8"');
  lines.push("");
  lines.push(opts.bodyText);
  return lines.join("\r\n");
}

export function parseAddress(raw: string): { name?: string; email: string } {
  const m = raw.match(/^\s*(?:"?([^"<]*)"?\s*)?<([^>]+)>\s*$/);
  if (m) return { name: m[1]?.trim() || undefined, email: m[2].trim() };
  return { email: raw.trim() };
}

export function formatDate(internalDate?: string): string {
  if (!internalDate) return "";
  const d = new Date(Number(internalDate));
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

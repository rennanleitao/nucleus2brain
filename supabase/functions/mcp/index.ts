// MCP Server for Nucleus — exposes notes/tasks/spaces/tags/links/contexts
// as tools via JSON-RPC over Streamable HTTP. Authenticated via OAuth Bearer.
//
// Enterprise response envelope: every tool response is normalized to a
// structured JSON object with status, entity_type, operation, display_url,
// readback data, ingestion_result, next_actions and correlation_id. Failures
// always come back as { status:"failed", error_code, message } — never as
// JSON-RPC -32601 / raw exceptions.
import { Hono } from "npm:hono@4";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@^0.10.0";
import { z } from "npm:zod@3";
import { zodToJsonSchema } from "npm:zod-to-json-schema@3";
import { type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { marked } from "npm:marked@12";
import { authenticateMcpRequest, corsHeaders, unauthorized, userClient } from "../_shared/mcp-auth.ts";
import { callLovableAI } from "../_shared/lovable-ai.ts";
import {
  type EntityType,
  type Operation,
  urlFor,
} from "./_envelope.ts";

// ---------- Tool helpers ----------
type Ctx = { userId: string; supabase: SupabaseClient };

// Legacy `ok()` / `fail()` keep their signatures so existing handler bodies
// don't need to change. The wrapper below intercepts every response and
// upgrades it to the enterprise envelope.
function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function fail(message: string, code = "db_error") {
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ __mcp_error: true, error_code: code, error: message }) }],
  };
}

// Notes are stored as HTML (rendered by the TipTap editor). Agents (ChatGPT,
// etc.) typically send Markdown, which would otherwise be shown verbatim in
// the editor — flattening headings/lists into raw text like "## Itens 1. …".
// Convert Markdown → HTML before persisting, unless the content already looks
// like HTML (contains block-level tags).
function toEditorHtml(input: string | null | undefined): string {
  if (input == null) return "";
  const s = String(input);
  if (!s.trim()) return "";
  // Heuristic: treat as HTML if it already contains block-level tags.
  const looksLikeHtml = /<(p|h[1-6]|ul|ol|li|blockquote|pre|table|div|br|hr|img|figure|iframe)\b/i.test(s);
  if (looksLikeHtml) return s;
  try {
    return marked.parse(s, { async: false, gfm: true, breaks: true }) as string;
  } catch {
    // Fallback: preserve line breaks as <br> inside a paragraph.
    const escaped = s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<p>${escaped.replace(/\n/g, "<br>")}</p>`;
  }
}

// Map tool name -> (entity_type, operation) used by the envelope.
const TOOL_META: Record<string, { entity: EntityType; op: Operation }> = {
  ping: { entity: "generic", op: "compute" },
  // notes
  create_note: { entity: "note", op: "create" },
  update_note: { entity: "note", op: "update" },
  append_to_note: { entity: "note", op: "update" },
  append_section_to_note: { entity: "note", op: "update" },
  delete_note: { entity: "note", op: "delete" },
  search_notes: { entity: "note", op: "search" },
  get_note: { entity: "note", op: "get" },
  list_notes: { entity: "note", op: "list" },
  // tasks
  create_task: { entity: "task", op: "create" },
  update_task: { entity: "task", op: "update" },
  delete_task: { entity: "task", op: "delete" },
  search_tasks: { entity: "task", op: "search" },
  get_task: { entity: "task", op: "get" },
  list_tasks: { entity: "task", op: "list" },
  complete_task: { entity: "task", op: "update" },
  // spaces
  create_space: { entity: "space", op: "create" },
  update_space: { entity: "space", op: "update" },
  delete_space: { entity: "space", op: "delete" },
  search_spaces: { entity: "space", op: "search" },
  get_space: { entity: "space", op: "get" },
  list_spaces: { entity: "space", op: "list" },
  // tags
  create_tag: { entity: "tag", op: "create" },
  search_tags: { entity: "tag", op: "search" },
  assign_tag_to_note: { entity: "note", op: "update" },
  assign_tag_to_task: { entity: "task", op: "update" },
  remove_tag_from_note: { entity: "note", op: "update" },
  remove_tag_from_task: { entity: "task", op: "update" },
  // links between entities
  link_task_to_note: { entity: "task", op: "update" },
  unlink_task_from_note: { entity: "task", op: "update" },
  link_note_to_space: { entity: "note", op: "update" },
  unlink_note_from_space: { entity: "note", op: "update" },
  link_task_to_space: { entity: "task", op: "update" },
  unlink_task_from_space: { entity: "task", op: "update" },
  // context
  get_note_context: { entity: "note", op: "get" },
  get_space_context: { entity: "space", op: "get" },
  // chatgpt aliases
  search: { entity: "search_result", op: "search" },
  fetch: { entity: "generic", op: "get" },
  // meetings
  list_meetings: { entity: "meeting", op: "list" },
  search_meetings: { entity: "meeting", op: "search" },
  // subtasks
  list_subtasks: { entity: "subtask", op: "list" },
  create_subtask: { entity: "subtask", op: "create" },
  update_subtask: { entity: "subtask", op: "update" },
  delete_subtask: { entity: "subtask", op: "delete" },
  // task materials
  list_task_materials: { entity: "task_material", op: "list" },
  create_task_material: { entity: "task_material", op: "create" },
  update_task_material: { entity: "task_material", op: "update" },
  delete_task_material: { entity: "task_material", op: "delete" },
  // bookmark links
  list_links: { entity: "link", op: "list" },
  search_links: { entity: "link", op: "search" },
  create_link: { entity: "link", op: "create" },
  update_link: { entity: "link", op: "update" },
  delete_link: { entity: "link", op: "delete" },
  // study areas
  list_study_areas: { entity: "study_area", op: "list" },
  get_study_area: { entity: "study_area", op: "get" },
  create_study_area: { entity: "study_area", op: "create" },
  update_study_area: { entity: "study_area", op: "update" },
  delete_study_area: { entity: "study_area", op: "delete" },
  // study topics
  list_study_topics: { entity: "study_topic", op: "list" },
  get_study_topic: { entity: "study_topic", op: "get" },
  create_study_topic: { entity: "study_topic", op: "create" },
  update_study_topic: { entity: "study_topic", op: "update" },
  delete_study_topic: { entity: "study_topic", op: "delete" },
  // study entries (event + knowledge)
  list_study_entries: { entity: "study_entry", op: "list" },
  get_study_entry: { entity: "study_entry", op: "get" },
  add_study_entry: { entity: "study_entry", op: "create" },
  update_study_entry: { entity: "study_entry", op: "update" },
  delete_study_entry: { entity: "study_entry", op: "delete" },
  search_study_entries: { entity: "study_entry", op: "search" },
  add_event_entry: { entity: "study_entry", op: "create" },
  add_knowledge_entry: { entity: "study_entry", op: "create" },
  add_book_summary: { entity: "study_entry", op: "create" },
  search_study_content: { entity: "study_entry", op: "search" },
  // study topic repository (knowledge entries scoped to a topic)
  create_study_repository_item: { entity: "study_entry", op: "create" },
  list_study_repository_items: { entity: "study_entry", op: "list" },
  get_study_repository_item: { entity: "study_entry", op: "get" },
  update_study_repository_item: { entity: "study_entry", op: "update" },
  delete_study_repository_item: { entity: "study_entry", op: "delete" },
  // semantic / AI
  search_everything: { entity: "search_result", op: "search" },
  get_recent_activity: { entity: "activity", op: "list" },
  get_daily_briefing: { entity: "briefing", op: "compute" },
  find_related_content: { entity: "search_result", op: "search" },
  extract_action_items: { entity: "ai_suggestion", op: "ai" },
  summarize_space: { entity: "summary", op: "ai" },
  get_context_for_chat: { entity: "context", op: "compute" },
  // time tracking
  list_time_entries: { entity: "generic", op: "list" },
  list_running_time_entries: { entity: "generic", op: "list" },
  start_time_entry: { entity: "generic", op: "create" },
  stop_time_entry: { entity: "generic", op: "update" },
  // space categories
  list_space_categories: { entity: "generic", op: "list" },
  create_space_category: { entity: "generic", op: "create" },
  update_space_category: { entity: "generic", op: "update" },
  delete_space_category: { entity: "generic", op: "delete" },
  set_space_category: { entity: "space", op: "update" },
  // space sharing
  list_space_members: { entity: "generic", op: "list" },
  list_space_invites: { entity: "generic", op: "list" },
  invite_to_space: { entity: "generic", op: "create" },
  remove_space_member: { entity: "generic", op: "delete" },
  update_member_role: { entity: "generic", op: "update" },
  delete_space_invite: { entity: "generic", op: "delete" },
  // reminders
  list_reminders: { entity: "generic", op: "list" },
  // tagged snippets
  create_tagged_snippet: { entity: "generic", op: "create" },
  list_tagged_snippets: { entity: "generic", op: "list" },
  delete_tagged_snippet: { entity: "generic", op: "delete" },
  // task-to-task links
  link_tasks: { entity: "task", op: "update" },
  list_task_task_links: { entity: "task", op: "list" },
  unlink_tasks: { entity: "task", op: "update" },
  // deleted/restore/duplicate/recurrence
  list_deleted_tasks: { entity: "task", op: "list" },
  restore_task: { entity: "task", op: "update" },
  permanently_delete_task: { entity: "task", op: "delete" },
  duplicate_task: { entity: "task", op: "create" },
  generate_next_recurrence: { entity: "task", op: "create" },
  // attachments
  list_space_attachments: { entity: "generic", op: "list" },
  delete_space_attachment: { entity: "generic", op: "delete" },
  get_attachment_url: { entity: "generic", op: "get" },
  // tag management
  list_all_tags: { entity: "tag", op: "list" },
  rename_tag: { entity: "tag", op: "update" },
  delete_tag: { entity: "tag", op: "delete" },
};

const INDEXABLE: Set<EntityType> = new Set([
  "note","task","space","study_topic","study_entry","study_area","link","task_material","subtask","meeting",
]);

function pickTitle(d: any): string | null {
  if (!d || typeof d !== "object") return null;
  return d.title ?? d.name ?? d.heading ?? null;
}
function defaultNextActions(op: Operation): string[] {
  switch (op) {
    case "create": return ["show_entity","refresh_list","search_related_content"];
    case "update": return ["show_entity","refresh_list"];
    case "delete": return ["refresh_list"];
    case "list":   return ["refresh_list","search_related_content"];
    case "get":    return ["show_entity","search_related_content","create_follow_up_task"];
    case "search": return ["refresh_list","find_related_content"];
    case "compute":
    case "ai":     return ["show_entity"];
    default: return [];
  }
}
function classifyError(msg: string): string {
  const m = (msg || "").toLowerCase();
  if (m.includes("permission") || m.includes("not authorized") || m.includes("rls")) return "forbidden";
  if (m.includes("not found") || m.includes("0 rows") || m.includes("no rows")) return "not_found";
  if (m.includes("invalid") || m.includes("violates check") || m.includes("required")) return "invalid_input";
  return "db_error";
}
function rowsFor(data: any): number {
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === "object") {
    if (Array.isArray(data.results)) return data.results.length;
    if (data.deleted) return 1;
    if (data.id) return 1;
  }
  return 0;
}

// Use Zod schemas for tool inputs; mcp-lite converts to JSON schema.
const buildServer = (ctx: Ctx) => {
  const s = new McpServer({ name: "nucleus-mcp", version: "1.0.0", schemaAdapter: (schema) => zodToJsonSchema(schema as any) });
  const db = ctx.supabase;

  // ---------- Envelope wrapper ----------
  // Wrap s.tool so every legacy handler returning ok()/fail() automatically
  // gets a structured enterprise envelope without per-handler refactor.
  const _origTool = s.tool.bind(s);
  (s as any).tool = (name: string, opts: any) => {
    const meta = TOOL_META[name] ?? { entity: "generic" as EntityType, op: "compute" as Operation };
    const origHandler = opts.handler;
    opts.handler = async (input: any) => {
      const correlation_id = crypto.randomUUID();
      const started = Date.now();
      let success = false;
      let rows = 0;
      try {
        const ret = await origHandler(input);
        const text = ret?.content?.[0]?.text ?? "";
        let parsed: any;
        try { parsed = JSON.parse(text); } catch { parsed = text; }

        if (ret?.isError || (parsed && parsed.__mcp_error)) {
          const errMsg = parsed?.error ?? "Unexpected error";
          const code = parsed?.error_code ?? classifyError(errMsg);
          const env = {
            status: "failed",
            error_code: code,
            message: errMsg,
            entity_type: meta.entity,
            operation: meta.op,
            details: null,
            correlation_id,
            next_actions: ["retry","refresh_list"],
          };
          return { isError: true, content: [{ type: "text", text: JSON.stringify(env, null, 2) }] };
        }

        success = true;
        rows = rowsFor(parsed);
        const isList = Array.isArray(parsed);
        const single = !isList && parsed && typeof parsed === "object" ? parsed : null;
        const entity_id = single?.id ?? null;
        const title = pickTitle(single);
        const display_url = urlFor(meta.entity, entity_id, single ?? undefined);
        const indexed = INDEXABLE.has(meta.entity) && meta.op !== "delete";
        const isWrite = meta.op === "create" || meta.op === "update" || meta.op === "delete";

        const env: any = {
          status: "success",
          entity_type: meta.entity,
          operation: meta.op,
          correlation_id,
          next_actions: defaultNextActions(meta.op),
        };

        if (isWrite) {
          env.message = `${meta.entity}${title ? ` "${title}"` : ""} ${meta.op === "delete" ? "removido" : meta.op === "create" ? "criado" : "atualizado"}.`;
          env.entity_id = entity_id;
          env.title = title;
          env.display_url = display_url;
          env.data = parsed;
          env.ingestion_result = {
            status: "success",
            indexed: indexed && meta.op !== "delete",
            searchable: indexed && meta.op !== "delete",
            summary: meta.op === "delete"
              ? `${meta.entity} removido do índice.`
              : `${meta.entity}${title ? ` "${title}"` : ""} indexado e disponível para buscas.`,
          };
        } else {
          env.message = isList
            ? `${rows} ${meta.entity}(s) ${meta.op === "search" ? "encontrado(s)" : "listado(s)"}.`
            : (rows ? `${meta.entity} recuperado.` : `Nenhum ${meta.entity} encontrado.`);
          env.count = isList ? rows : (parsed ? 1 : 0);
          if (entity_id) {
            env.entity_id = entity_id;
            env.title = title;
            env.display_url = display_url;
          }
          env.data = parsed;
        }

        return { content: [{ type: "text", text: JSON.stringify(env, null, 2) }] };
      } catch (e: any) {
        const env = {
          status: "failed",
          error_code: "internal_error",
          message: e?.message ? String(e.message) : "Unexpected error",
          entity_type: meta.entity,
          operation: meta.op,
          details: null,
          correlation_id,
          next_actions: ["retry"],
        };
        return { isError: true, content: [{ type: "text", text: JSON.stringify(env, null, 2) }] };
      } finally {
        try {
          console.info(JSON.stringify({
            ts: new Date().toISOString(),
            mcp_log: true,
            tool_name: name,
            user_id: ctx.userId,
            execution_time_ms: Date.now() - started,
            success,
            rows_affected: rows,
            correlation_id,
          }));
        } catch { /* logging must never break the response */ }
      }
    };
    return _origTool(name, opts);
  };

  s.tool("ping", {
    description: "Simple connectivity test",
    inputSchema: z.object({}),
    handler: async () => ({
      content: [{ type: "text" as const, text: "pong" }],
    }),
  });


  // ---------- NOTES ----------
  // Editorial guidance shared across note tools. The Nucleus editor renders rich
  // Markdown (headings, lists, bold, blockquotes). Agents must write like
  // co-authors: preserve structure, format for human reading, and date every
  // contribution.
  const NOTE_STYLE_GUIDE = [
    "PRESERVE FIRST: Before writing, inspect the existing note. If it already",
    "follows a template or has a clear structure (headings, sections, lists),",
    "respect it and write your additions INSIDE that structure — never replace,",
    "reorder or normalize what is already there. Do not impose a new template.",
    "INCREMENTAL: When the request is to complement, only ADD new content.",
    "Never rewrite the whole note. Prefer append_to_note / append_section_to_note;",
    "use update_note.content only when you intentionally re-emit the original",
    "content verbatim plus your additions.",
    "READABILITY: Optimize for human reading.",
    "- One idea per paragraph. Keep paragraphs short (1–3 sentences).",
    "- Leave a blank line between distinct subjects.",
    "- Use bullet/numbered lists for enumerable points.",
    "- Avoid long walls of running text.",
    "- Bold key terms sparingly; do not over-format.",
    "DATES: Make dates explicit in DD-MM-YYYY (BRT) whenever there is context.",
    "Never write vague references like 'this week' without an absolute date.",
    "LIGHT STRUCTURE WHEN NO TEMPLATE: If the note has no template, do not force",
    "one. Just organize ideas in clean paragraphs, and — only when the content",
    "naturally calls for it — separate Contexto, Decisões, Próximos passos and",
    "Referências externas into distinct paragraphs or short subsections.",
    "SOURCES: When citing external knowledge, keep it in its own paragraph or",
    "subsection with title, URL, captured_at (DD-MM-YYYY) and a brief summary,",
    "so it never gets mixed with the user's own notes.",
  ].join(" ");


  s.tool("create_note", {
    description:
      "Create a new note. tags is an array of plain strings. Write the body as " +
      "clean Markdown organized in short, readable paragraphs. If the target " +
      "Space has an established convention, mirror it; otherwise keep the " +
      "structure light and let the content shape itself. " + NOTE_STYLE_GUIDE,
    inputSchema: z.object({
      title: z.string().min(1).max(500),
      content: z.string().optional(),
      space_id: z.string().uuid().nullable().optional(),
      tags: z.array(z.string()).optional(),
    }),
    handler: async (input) => {
      const { data, error } = await db.from("notes").insert({
        user_id: ctx.userId,
        title: input.title,
        content: toEditorHtml(input.content),
        space_id: input.space_id ?? null,
        tags: input.tags ?? [],
      }).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("update_note", {
    description:
      "Update fields of an existing note. Only provided fields change. " +
      "CRITICAL: passing `content` REPLACES the entire body. ALWAYS call " +
      "get_note first, preserve the existing template/structure, headings and " +
      "lists, and act as a co-author that enriches — never as a rewriter. " +
      "If the user only asked to complement the note, do NOT use update_note.content; " +
      "use append_to_note or append_section_to_note instead. Only fall back to " +
      "update_note.content when you have re-emitted the full original content " +
      "verbatim plus your additions. " + NOTE_STYLE_GUIDE,
    inputSchema: z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(500).optional(),
      content: z.string().optional(),
      space_id: z.string().uuid().nullable().optional(),
      tags: z.array(z.string()).optional(),
    }),
    handler: async (input) => {
      const patch: Record<string, unknown> = {};
      for (const k of ["title", "space_id", "tags"] as const) {
        if (input[k] !== undefined) patch[k] = input[k];
      }
      if (input.content !== undefined) patch.content = toEditorHtml(input.content);
      const { data, error } = await db.from("notes").update(patch).eq("id", input.id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("append_to_note", {
    description:
      "Append Markdown to the end of a note, separated by a blank line. " +
      "PREFERRED tool for incremental enrichment — it preserves the existing " +
      "template and structure untouched. Before writing, read the note to match " +
      "its tone and section conventions. Start your addition with a short " +
      "heading (## or ###) or a clear paragraph lead so it visually separates " +
      "from prior content, and keep paragraphs short with one idea each. " + NOTE_STYLE_GUIDE,

    inputSchema: z.object({
      id: z.string().uuid(),
      content: z.string().min(1),
    }),
    handler: async (input) => {
      const { data: note, error: gErr } = await db.from("notes").select("content").eq("id", input.id).single();
      if (gErr) return fail(gErr.message);
      const prev = note.content ?? "";
      const addition = toEditorHtml(input.content);
      const merged = prev ? `${prev}\n${addition}` : addition;
      const { data, error } = await db.from("notes").update({ content: merged }).eq("id", input.id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("append_section_to_note", {
    description:
      "Append a well-formatted section to a note. Use this when enriching a " +
      "note with external knowledge, meeting outcomes, decisions, or next steps. " +
      "The server renders a heading, an optional source citation block (title, " +
      "URL, captured_at), a summary, bullet insights, decisions, and next steps " +
      "— each as its own subsection so the note stays organized and scannable. " +
      "Always provide explicit dates in DD-MM-YYYY format.",
    inputSchema: z.object({
      id: z.string().uuid(),
      heading: z.string().min(1).max(200)
        .describe("Section title rendered as an H2."),
      heading_level: z.number().int().min(2).max(4).optional()
        .describe("Markdown heading level for the section title (2-4). Default 2."),
      summary: z.string().optional()
        .describe("Short paragraph (1-3 sentences) summarizing the addition."),
      key_points: z.array(z.string()).optional()
        .describe("Bullet list of main points / insights."),
      decisions: z.array(z.string()).optional()
        .describe("Bullet list of decisions made."),
      next_steps: z.array(z.string()).optional()
        .describe("Bullet list of action items / next steps. Include owner + date when known."),
      source: z.object({
        title: z.string().optional(),
        url: z.string().url().optional(),
        captured_at: z.string().optional()
          .describe("Date the source was captured (DD-MM-YYYY). Defaults to today."),
      }).optional()
        .describe("Citation for external knowledge added to the note."),
      event_date: z.string().optional()
        .describe("Date the underlying event/meeting happened (DD-MM-YYYY)."),
    }),
    handler: async (input) => {
      const { data: note, error: gErr } = await db.from("notes")
        .select("content").eq("id", input.id).single();
      if (gErr) return fail(gErr.message);

      // Today in BRT (America/Sao_Paulo), formatted DD-MM-YYYY.
      const parts = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit", month: "2-digit", year: "numeric",
      }).formatToParts(new Date());
      const dd = parts.find((p) => p.type === "day")!.value;
      const mm = parts.find((p) => p.type === "month")!.value;
      const yyyy = parts.find((p) => p.type === "year")!.value;
      const today = `${dd}-${mm}-${yyyy}`;
      const h = "#".repeat(input.heading_level ?? 2);
      const lines: string[] = [];
      lines.push(`${h} ${input.heading}`);

      const metaBits: string[] = [];
      if (input.event_date) metaBits.push(`Data do evento: ${input.event_date}`);
      metaBits.push(`Atualizado em: ${today}`);
      lines.push("", `_${metaBits.join(" · ")}_`);

      if (input.summary) {
        lines.push("", input.summary.trim());
      }
      if (input.key_points?.length) {
        lines.push("", `${h}# Principais pontos`);
        for (const p of input.key_points) lines.push(`- ${p.trim()}`);
      }
      if (input.decisions?.length) {
        lines.push("", `${h}# Decisões`);
        for (const d of input.decisions) lines.push(`- ${d.trim()}`);
      }
      if (input.next_steps?.length) {
        lines.push("", `${h}# Próximos passos`);
        for (const n of input.next_steps) lines.push(`- [ ] ${n.trim()}`);
      }
      if (input.source && (input.source.title || input.source.url)) {
        lines.push("", `${h}# Fonte`);
        if (input.source.title) lines.push(`- **Título:** ${input.source.title}`);
        if (input.source.url) lines.push(`- **URL:** <${input.source.url}>`);
        lines.push(`- **Capturado em:** ${input.source.captured_at ?? today}`);
      }

      const sectionHtml = toEditorHtml(lines.join("\n"));
      const prev = note.content ?? "";
      const merged = prev ? `${prev}\n<hr>\n${sectionHtml}` : sectionHtml;

      const { data, error } = await db.from("notes")
        .update({ content: merged }).eq("id", input.id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("delete_note", {
        description: "Delete a note permanently.",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { error } = await db.from("notes").delete().eq("id", input.id);
      if (error) return fail(error.message);
      return ok({ deleted: true, id: input.id });
    },
  });

  s.tool("search_notes", {
        description: "Search notes by free-text query (title/content), space, or tags.",
    inputSchema: z.object({
      query: z.string().optional(),
      space_id: z.string().uuid().nullable().optional(),
      tags: z.array(z.string()).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    handler: async (input) => {
      let q = db.from("notes").select("id,title,content,space_id,tags,created_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(input.limit ?? 25);
      if (input.query) q = q.or(`title.ilike.%${input.query}%,content.ilike.%${input.query}%`);
      if (input.space_id !== undefined) {
        if (input.space_id === null) q = q.is("space_id", null);
        else q = q.eq("space_id", input.space_id);
      }
      if (input.tags && input.tags.length) q = q.overlaps("tags", input.tags);
      const { data, error } = await q;
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("get_note", {
    description:
      "Get a single note by id. ALWAYS call this before updating a note's " +
      "content so you can preserve existing headings, lists, and structure.",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { data, error } = await db.from("notes").select("*").eq("id", input.id).single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  // ---------- TASKS ----------
  // Accept "done" as an alias for "completed" for backward compatibility, then normalize below.
  const taskStatus = z.enum(["todo", "in_progress", "completed", "done", "cancelled"])
    .transform((v) => (v === "done" ? "completed" : v))
    .optional();
  const taskPriority = z.enum(["low", "medium", "high", "urgent"]).optional();
  const taskComplexity = z.enum(["easy", "medium", "hard"]).nullable().optional();

  s.tool("create_task", {
        description: "Create a new task. due_date is an ISO date (YYYY-MM-DD). execution_complexity is the estimated effort/difficulty (easy|medium|hard).",
    inputSchema: z.object({
      title: z.string().min(1).max(500),
      description: z.string().optional(),
      due_date: z.string().optional(),
      status: taskStatus,
      priority: taskPriority,
      execution_complexity: taskComplexity,
      note_id: z.string().uuid().nullable().optional(),
      space_id: z.string().uuid().nullable().optional(),
      tag: z.string().nullable().optional(),
    }),
    handler: async (input) => {
      const { data, error } = await db.from("tasks").insert({
        user_id: ctx.userId,
        title: input.title,
        description: input.description,
        due_date: input.due_date,
        status: input.status ?? "todo",
        priority: input.priority ?? "medium",
        execution_complexity: input.execution_complexity ?? null,
        note_id: input.note_id ?? null,
        space_id: input.space_id ?? null,
        tag: input.tag ?? null,
      }).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("update_task", {
        description: "Update fields of a task. Pass only fields you want to change. execution_complexity: easy|medium|hard or null to clear.",
    inputSchema: z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(500).optional(),
      description: z.string().nullable().optional(),
      due_date: z.string().nullable().optional(),
      status: taskStatus,
      priority: taskPriority,
      execution_complexity: taskComplexity,
      note_id: z.string().uuid().nullable().optional(),
      space_id: z.string().uuid().nullable().optional(),
      tag: z.string().nullable().optional(),
      completed_at: z.string().nullable().optional(),
    }),
    handler: async (input) => {
      const patch: Record<string, unknown> = {};
      for (const k of ["title","description","due_date","status","priority","execution_complexity","note_id","space_id","tag","completed_at"] as const) {
        if (input[k] !== undefined) patch[k] = input[k];
      }
      if (patch.status === "completed" && !("completed_at" in patch)) {
        patch.completed_at = new Date().toISOString();
      }
      const { data, error } = await db.from("tasks").update(patch).eq("id", input.id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });


  s.tool("delete_task", {
        description: "Soft-delete a task (sets deleted_at, purged after 1 day).",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { error } = await db.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", input.id);
      if (error) return fail(error.message);
      return ok({ deleted: true, id: input.id });
    },
  });

  s.tool("search_tasks", {
        description: "Search tasks by query, status, date range, space, note or tag.",
    inputSchema: z.object({
      query: z.string().optional(),
      status: taskStatus,
      due_before: z.string().optional(),
      due_after: z.string().optional(),
      space_id: z.string().uuid().nullable().optional(),
      note_id: z.string().uuid().nullable().optional(),
      tag: z.string().optional(),
      include_deleted: z.boolean().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    handler: async (input) => {
      let q = db.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false })
        .limit(input.limit ?? 25);
      if (!input.include_deleted) q = q.is("deleted_at", null);
      if (input.query) q = q.or(`title.ilike.%${input.query}%,description.ilike.%${input.query}%`);
      if (input.status) q = q.eq("status", input.status);
      if (input.due_before) q = q.lte("due_date", input.due_before);
      if (input.due_after) q = q.gte("due_date", input.due_after);
      if (input.space_id !== undefined) {
        if (input.space_id === null) q = q.is("space_id", null); else q = q.eq("space_id", input.space_id);
      }
      if (input.note_id !== undefined) {
        if (input.note_id === null) q = q.is("note_id", null); else q = q.eq("note_id", input.note_id);
      }
      if (input.tag) q = q.eq("tag", input.tag);
      const { data, error } = await q;
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("get_task", {
        description: "Get a task with its subtasks and materials.",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const [{ data: task, error: tErr }, { data: subs }, { data: mats }] = await Promise.all([
        db.from("tasks").select("*").eq("id", input.id).single(),
        db.from("subtasks").select("*").eq("task_id", input.id),
        db.from("task_materials").select("*").eq("task_id", input.id),
      ]);
      if (tErr) return fail(tErr.message);
      return ok({ ...task, subtasks: subs ?? [], materials: mats ?? [] });
    },
  });

  // ---------- SPACES ----------
  s.tool("create_space", {
        description: "Create a new space (workspace).",
    inputSchema: z.object({
      name: z.string().min(1).max(200),
      description: z.string().optional(),
      icon: z.string().optional(),
    }),
    handler: async (input) => {
      const { data, error } = await db.from("spaces").insert({
        user_id: ctx.userId,
        name: input.name,
        description: input.description,
        icon: input.icon,
      }).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("update_space", {
        description: "Update fields of a space.",
    inputSchema: z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().nullable().optional(),
      icon: z.string().optional(),
    }),
    handler: async (input) => {
      const patch: Record<string, unknown> = {};
      for (const k of ["name","description","icon"] as const) {
        if (input[k] !== undefined) patch[k] = input[k];
      }
      const { data, error } = await db.from("spaces").update(patch).eq("id", input.id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("search_spaces", {
        description: "Search spaces by name/description.",
    inputSchema: z.object({
      query: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    handler: async (input) => {
      let q = db.from("spaces").select("*").order("created_at", { ascending: false }).limit(input.limit ?? 50);
      if (input.query) q = q.or(`name.ilike.%${input.query}%,description.ilike.%${input.query}%`);
      const { data, error } = await q;
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("get_space", {
        description: "Get a single space by id.",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { data, error } = await db.from("spaces").select("*").eq("id", input.id).single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  // ---------- TAGS ----------
  s.tool("create_tag", {
        description: "Idempotently 'create' a tag. Tags are not entities — this validates and normalizes the name.",
    inputSchema: z.object({ name: z.string().min(1).max(50) }),
    handler: async (input) => {
      const normalized = input.name.trim().toLowerCase().replace(/^#+/, "").replace(/\s+/g, "-");
      if (!normalized) return fail("Invalid tag name");
      return ok({ name: normalized });
    },
  });

  s.tool("search_tags", {
        description: "List distinct tags currently in use across notes and tasks (optionally filtered).",
    inputSchema: z.object({
      query: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    handler: async (input) => {
      const [{ data: notesData }, { data: tasksData }] = await Promise.all([
        db.from("notes").select("tags"),
        db.from("tasks").select("tag").is("deleted_at", null).not("tag", "is", null),
      ]);
      const set = new Set<string>();
      (notesData ?? []).forEach((r: { tags: string[] | null }) => (r.tags ?? []).forEach((t) => t && set.add(t)));
      (tasksData ?? []).forEach((r: { tag: string | null }) => r.tag && set.add(r.tag));
      let arr = [...set].sort();
      if (input.query) {
        const q = input.query.toLowerCase();
        arr = arr.filter((t) => t.toLowerCase().includes(q));
      }
      return ok(arr.slice(0, input.limit ?? 100));
    },
  });

  s.tool("assign_tag_to_note", {
        description: "Add a tag to a note's tag array if not already present.",
    inputSchema: z.object({ note_id: z.string().uuid(), tag: z.string().min(1) }),
    handler: async (input) => {
      const { data: note, error: gErr } = await db.from("notes").select("tags").eq("id", input.note_id).single();
      if (gErr) return fail(gErr.message);
      const tags = new Set([...(note.tags ?? []), input.tag]);
      const { data, error } = await db.from("notes").update({ tags: [...tags] }).eq("id", input.note_id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("assign_tag_to_task", {
        description: "Set the tag on a task (tasks currently support a single tag).",
    inputSchema: z.object({ task_id: z.string().uuid(), tag: z.string().min(1) }),
    handler: async (input) => {
      const { data, error } = await db.from("tasks").update({ tag: input.tag }).eq("id", input.task_id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  // ---------- LINKS ----------
  const linkTaskNote = z.object({ task_id: z.string().uuid(), note_id: z.string().uuid() });
  s.tool("link_task_to_note", {
        description: "Associate a task with a note.",
    inputSchema: linkTaskNote,
    handler: async (input) => {
      const { data, error } = await db.from("tasks").update({ note_id: input.note_id }).eq("id", input.task_id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("unlink_task_from_note", {
        description: "Remove the note association from a task.",
    inputSchema: z.object({ task_id: z.string().uuid() }),
    handler: async (input) => {
      const { data, error } = await db.from("tasks").update({ note_id: null }).eq("id", input.task_id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("link_note_to_space", {
        description: "Move a note into a space.",
    inputSchema: z.object({ note_id: z.string().uuid(), space_id: z.string().uuid() }),
    handler: async (input) => {
      const { data, error } = await db.from("notes").update({ space_id: input.space_id }).eq("id", input.note_id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("unlink_note_from_space", {
        description: "Remove a note from any space.",
    inputSchema: z.object({ note_id: z.string().uuid() }),
    handler: async (input) => {
      const { data, error } = await db.from("notes").update({ space_id: null }).eq("id", input.note_id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("link_task_to_space", {
        description: "Move a task into a space.",
    inputSchema: z.object({ task_id: z.string().uuid(), space_id: z.string().uuid() }),
    handler: async (input) => {
      const { data, error } = await db.from("tasks").update({ space_id: input.space_id }).eq("id", input.task_id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("unlink_task_from_space", {
        description: "Remove a task from any space.",
    inputSchema: z.object({ task_id: z.string().uuid() }),
    handler: async (input) => {
      const { data, error } = await db.from("tasks").update({ space_id: null }).eq("id", input.task_id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  // ---------- CONTEXTS ----------
  s.tool("get_note_context", {
        description: "Return a note with its tags, linked tasks, and parent space.",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { data: note, error } = await db.from("notes").select("*").eq("id", input.id).single();
      if (error) return fail(error.message);
      const [{ data: tasks }, { data: space }] = await Promise.all([
        db.from("tasks").select("id,title,status,due_date,priority").eq("note_id", input.id).is("deleted_at", null),
        note.space_id ? db.from("spaces").select("*").eq("id", note.space_id).single() : Promise.resolve({ data: null }),
      ]);
      return ok({ note, tags: note.tags ?? [], tasks: tasks ?? [], space: space ?? null });
    },
  });

  s.tool("get_space_context", {
        description: "Return a space with its notes, tasks, tags in use, and statistics.",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const [{ data: space, error }, { data: notes }, { data: tasks }] = await Promise.all([
        db.from("spaces").select("*").eq("id", input.id).single(),
        db.from("notes").select("id,title,tags,updated_at").eq("space_id", input.id).order("updated_at", { ascending: false }).limit(20),
        db.from("tasks").select("id,title,status,due_date,tag,completed_at").eq("space_id", input.id).is("deleted_at", null),
      ]);
      if (error) return fail(error.message);
      const tagsUsed = new Set<string>();
      (notes ?? []).forEach((n: { tags: string[] | null }) => (n.tags ?? []).forEach((t) => tagsUsed.add(t)));
      (tasks ?? []).forEach((t: { tag: string | null }) => t.tag && tagsUsed.add(t.tag));
      const byStatus: Record<string, number> = {};
      (tasks ?? []).forEach((t: { status: string }) => { byStatus[t.status] = (byStatus[t.status] ?? 0) + 1; });
      const today = new Date().toISOString().slice(0, 10);
      const overdue = (tasks ?? []).filter((t: { due_date: string | null; status: string }) =>
        t.due_date && t.due_date < today && t.status !== "done").length;
      const completedLast7d = (tasks ?? []).filter((t: { completed_at: string | null }) =>
        t.completed_at && t.completed_at >= sevenDaysAgo).length;
      return ok({
        space,
        notes_count: notes?.length ?? 0,
        tasks_count: tasks?.length ?? 0,
        tags_used: [...tagsUsed].sort(),
        recent_notes: notes ?? [],
        recent_tasks: (tasks ?? []).slice(0, 20),
        stats: {
          tasks_by_status: byStatus,
          overdue,
          completed_last_7d: completedLast7d,
        },
      });
    },
  });

  // ---------- ALIASES & CHATGPT REQUIRED TOOLS ----------
  s.tool("search", {
        description: "Global search across notes, tasks and spaces. Returns results with id, title, type and snippet.",
    inputSchema: z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    handler: async (input) => {
      const limit = input.limit ?? 10;
      const q = input.query;
      const [notesRes, tasksRes, spacesRes] = await Promise.all([
        db.from("notes").select("id,title,content,updated_at").or(`title.ilike.%${q}%,content.ilike.%${q}%`).limit(limit),
        db.from("tasks").select("id,title,description,status,due_date").is("deleted_at", null).or(`title.ilike.%${q}%,description.ilike.%${q}%`).limit(limit),
        db.from("spaces").select("id,name,description").or(`name.ilike.%${q}%,description.ilike.%${q}%`).limit(limit),
      ]);
      const results: Array<{ id: string; title: string; type: string; url: string; snippet?: string }> = [];
      (notesRes.data ?? []).forEach((n: any) => results.push({
        id: `note:${n.id}`, title: n.title, type: "note", url: `nucleus://notes/${n.id}`,
        snippet: (n.content ?? "").slice(0, 200),
      }));
      (tasksRes.data ?? []).forEach((t: any) => results.push({
        id: `task:${t.id}`, title: t.title, type: "task", url: `nucleus://tasks/${t.id}`,
        snippet: t.description ?? `status: ${t.status}${t.due_date ? `, due ${t.due_date}` : ""}`,
      }));
      (spacesRes.data ?? []).forEach((sp: any) => results.push({
        id: `space:${sp.id}`, title: sp.name, type: "space", url: `nucleus://spaces/${sp.id}`,
        snippet: sp.description ?? "",
      }));
      return ok({ results });
    },
  });

  s.tool("fetch", {
        description: "Fetch a single entity by composite id ('note:<uuid>', 'task:<uuid>', or 'space:<uuid>').",
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: async (input) => {
      const [type, uuid] = input.id.split(":");
      if (!type || !uuid) return fail("id must be 'type:uuid'");
      const table = type === "note" ? "notes" : type === "task" ? "tasks" : type === "space" ? "spaces" : null;
      if (!table) return fail(`unknown type ${type}`);
      const { data, error } = await db.from(table).select("*").eq("id", uuid).single();
      if (error) return fail(error.message);
      return ok({ id: input.id, type, ...data });
    },
  });

  s.tool("list_spaces", {
        description: "List all spaces the user can access, most recent first.",
    inputSchema: z.object({ limit: z.number().int().min(1).max(200).optional() }),
    handler: async (input) => {
      const { data, error } = await db.from("spaces").select("*")
        .order("created_at", { ascending: false }).limit(input.limit ?? 100);
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("list_notes", {
        description: "List notes (most recently updated first). Optionally filter by space_id.",
    inputSchema: z.object({
      space_id: z.string().uuid().nullable().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    handler: async (input) => {
      let q = db.from("notes").select("id,title,content,space_id,tags,created_at,updated_at")
        .order("updated_at", { ascending: false }).limit(input.limit ?? 50);
      if (input.space_id !== undefined) {
        if (input.space_id === null) q = q.is("space_id", null);
        else q = q.eq("space_id", input.space_id);
      }
      const { data, error } = await q;
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("list_tasks", {
        description: "List tasks. Optionally filter by status, space_id, or include deleted.",
    inputSchema: z.object({
      status: taskStatus,
      space_id: z.string().uuid().nullable().optional(),
      include_deleted: z.boolean().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    handler: async (input) => {
      let q = db.from("tasks").select("*")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(input.limit ?? 50);
      if (!input.include_deleted) q = q.is("deleted_at", null);
      if (input.status) q = q.eq("status", input.status);
      if (input.space_id !== undefined) {
        if (input.space_id === null) q = q.is("space_id", null);
        else q = q.eq("space_id", input.space_id);
      }
      const { data, error } = await q;
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("complete_task", {
        description: "Mark a task as completed (sets status='completed' and completed_at=now).",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { data, error } = await db.from("tasks")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", input.id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  // ---------- MEETINGS ----------
  // Meetings are modeled as notes tagged 'meeting' (Meeting Notes template).
  s.tool("list_meetings", {
        description: "List meeting notes (notes tagged 'meeting'), most recent first.",
    inputSchema: z.object({
      space_id: z.string().uuid().nullable().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    handler: async (input) => {
      let q = db.from("notes").select("id,title,content,space_id,tags,created_at,updated_at")
        .overlaps("tags", ["meeting", "meetings", "meeting-notes"])
        .order("updated_at", { ascending: false })
        .limit(input.limit ?? 25);
      if (input.space_id !== undefined) {
        if (input.space_id === null) q = q.is("space_id", null);
        else q = q.eq("space_id", input.space_id);
      }
      const { data, error } = await q;
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("search_meetings", {
        description: "Search meeting notes by free-text query in title/content.",
    inputSchema: z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    handler: async (input) => {
      const { data, error } = await db.from("notes")
        .select("id,title,content,space_id,tags,created_at,updated_at")
        .overlaps("tags", ["meeting", "meetings", "meeting-notes"])
        .or(`title.ilike.%${input.query}%,content.ilike.%${input.query}%`)
        .order("updated_at", { ascending: false })
        .limit(input.limit ?? 25);
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  // ---------- STUDY ENTRIES (Conhecimentos Gerais) ----------
  s.tool("add_study_entry", {
    description:
      "Add an entry to a study topic (Conhecimentos Gerais). " +
      "Set `kind` to 'event' (timeline / fato datado) or 'knowledge' " +
      "(framework, conceito, livro, playbook — conhecimento permanente). " +
      "For knowledge entries `entry_date` is opcional.",
    inputSchema: z.object({
      topic_id: z.string().uuid(),
      kind: z.enum(["event","knowledge"]).optional(),
      category: z.string().nullable().optional(),
      entry_date: z.string().optional().describe("ISO date YYYY-MM-DD (obrigatório só para kind=event)"),
      title: z.string().min(1).max(500),
      summary: z.string().min(1),
      content: z.string().nullable().optional(),
      source_url: z.string().url().nullable().optional(),
      highlight: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
    }),
    handler: async (input) => {
      const kind = input.kind ?? "event";
      if (kind === "event" && !input.entry_date) return fail("entry_date is required for kind='event'", "invalid_input");
      const { data, error } = await db.from("study_entries").insert({
        user_id: ctx.userId,
        topic_id: input.topic_id,
        kind,
        category: input.category ?? null,
        entry_date: input.entry_date ?? null,
        title: input.title,
        summary: input.summary,
        content: input.content ?? null,
        source_url: input.source_url ?? null,
        highlight: input.highlight ?? null,
        notes: input.notes ?? null,
        tags: input.tags ?? [],
      }).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("search_study_entries", {
    description:
      "Search study entries (events e knowledge) por free-text em title/summary/" +
      "content/source_url/highlight/notes/tags. Filtre por `kind` ('event'|'knowledge'), " +
      "topic_id, area_id, category, tag e intervalo de entry_date.",
    inputSchema: z.object({
      query: z.string().optional(),
      kind: z.enum(["event","knowledge"]).optional(),
      category: z.string().optional(),
      topic_id: z.string().uuid().optional(),
      area_id: z.string().uuid().optional(),
      tag: z.string().optional(),
      date_from: z.string().optional().describe("ISO date YYYY-MM-DD"),
      date_to: z.string().optional().describe("ISO date YYYY-MM-DD"),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    handler: async (input) => {
      let q = db.from("study_entries").select("*")
        .order("entry_date", { ascending: false, nullsFirst: false })
        .limit(input.limit ?? 25);
      if (input.kind) q = q.eq("kind", input.kind);
      if (input.category) q = q.eq("category", input.category);
      if (input.topic_id) q = q.eq("topic_id", input.topic_id);
      if (input.area_id) {
        const { data: topics } = await db.from("study_topics").select("id").eq("area_id", input.area_id);
        const ids = (topics ?? []).map((t: { id: string }) => t.id);
        if (ids.length === 0) return ok([]);
        q = q.in("topic_id", ids);
      }
      if (input.tag) q = q.contains("tags", [input.tag]);
      if (input.date_from) q = q.gte("entry_date", input.date_from);
      if (input.date_to) q = q.lte("entry_date", input.date_to);
      if (input.query) {
        const v = input.query.replace(/[,()]/g, " ");
        q = q.or(
          `title.ilike.%${v}%,summary.ilike.%${v}%,content.ilike.%${v}%,source_url.ilike.%${v}%,highlight.ilike.%${v}%,notes.ilike.%${v}%`
        );
      }
      const { data, error } = await q;
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  // ---------- STUDY TOPIC REPOSITORY ----------
  // The frontend Repositório tab reads study_entries scoped by topic_id and
  // filters kind === "knowledge". These tools expose that exact model without
  // introducing a new table or changing existing study_entry tools.
  const repositoryItemSelect = "*";
  const repositoryContentType = z.string().min(1).max(80)
    .describe("Maps to study_entries.category. Examples: article, note, reference, analysis");
  type RepositoryItemRow = { category?: string | null } & Record<string, unknown>;
  const repositoryItem = (row: RepositoryItemRow | null) =>
    row ? ({ ...row, content_type: row.category ?? null }) : row;

  s.tool("create_study_repository_item", {
    description:
      "Create an item in the internal Repositório tab of a study topic. " +
      "Uses study_entries with kind='knowledge' and the provided topic_id, so it appears inside that topic's Repositório.",
    inputSchema: z.object({
      topic_id: z.string().uuid(),
      title: z.string().min(1).max(500),
      content: z.string().min(1).describe("Repository content or personal summary/relevance text."),
      source_url: z.string().url().nullable().optional(),
      tags: z.array(z.string()).optional(),
      content_type: repositoryContentType.optional(),
      summary: z.string().min(1).optional().describe("Optional shorter summary. Defaults to content when omitted."),
    }),
    handler: async (input) => {
      const { data, error } = await db.from("study_entries").insert({
        user_id: ctx.userId,
        topic_id: input.topic_id,
        kind: "knowledge",
        entry_date: null,
        title: input.title,
        summary: input.summary ?? input.content,
        content: input.content,
        source_url: input.source_url ?? null,
        category: input.content_type ?? null,
        highlight: null,
        notes: null,
        tags: input.tags ?? [],
      }).select(repositoryItemSelect).single();
      if (error) return fail(error.message);
      return ok(repositoryItem(data));
    },
  });

  s.tool("list_study_repository_items", {
    description:
      "List items from the internal Repositório tab of one study topic. " +
      "Only returns study_entries where kind='knowledge' for the required topic_id.",
    inputSchema: z.object({
      topic_id: z.string().uuid(),
      query: z.string().optional(),
      content_type: repositoryContentType.optional(),
      tag: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    handler: async (input) => {
      let q = db.from("study_entries").select(repositoryItemSelect)
        .eq("topic_id", input.topic_id)
        .eq("kind", "knowledge")
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(input.limit ?? 100);
      if (input.content_type) q = q.eq("category", input.content_type);
      if (input.tag) q = q.contains("tags", [input.tag]);
      if (input.query) {
        const v = input.query.replace(/[,()]/g, " ");
        q = q.or(`title.ilike.%${v}%,summary.ilike.%${v}%,content.ilike.%${v}%,source_url.ilike.%${v}%`);
      }
      const { data, error } = await q;
      if (error) return fail(error.message);
      return ok((data ?? []).map(repositoryItem));
    },
  });

  s.tool("get_study_repository_item", {
    description:
      "Get one item from a topic's internal Repositório. Requires both topic_id and id, and only reads kind='knowledge'.",
    inputSchema: z.object({
      topic_id: z.string().uuid(),
      id: z.string().uuid(),
    }),
    handler: async (input) => {
      const { data, error } = await db.from("study_entries").select(repositoryItemSelect)
        .eq("topic_id", input.topic_id)
        .eq("id", input.id)
        .eq("kind", "knowledge")
        .single();
      if (error) return fail(error.message);
      return ok(repositoryItem(data));
    },
  });

  s.tool("update_study_repository_item", {
    description:
      "Update an item in a topic's internal Repositório. Requires topic_id and id, and keeps the row as kind='knowledge'.",
    inputSchema: z.object({
      topic_id: z.string().uuid(),
      id: z.string().uuid(),
      title: z.string().min(1).max(500).optional(),
      content: z.string().min(1).optional(),
      source_url: z.string().url().nullable().optional(),
      tags: z.array(z.string()).optional(),
      content_type: repositoryContentType.nullable().optional(),
      summary: z.string().min(1).optional(),
    }),
    handler: async (input) => {
      const patch: Record<string, unknown> = { kind: "knowledge" };
      if (input.title !== undefined) patch.title = input.title;
      if (input.content !== undefined) patch.content = input.content;
      if (input.source_url !== undefined) patch.source_url = input.source_url;
      if (input.tags !== undefined) patch.tags = input.tags;
      if (input.content_type !== undefined) patch.category = input.content_type;
      if (input.summary !== undefined) patch.summary = input.summary;

      const { data, error } = await db.from("study_entries").update(patch)
        .eq("topic_id", input.topic_id)
        .eq("id", input.id)
        .eq("kind", "knowledge")
        .select(repositoryItemSelect)
        .single();
      if (error) return fail(error.message);
      return ok(repositoryItem(data));
    },
  });

  s.tool("delete_study_repository_item", {
    description:
      "Delete one item from a topic's internal Repositório. Requires topic_id and id, and only deletes kind='knowledge'.",
    inputSchema: z.object({
      topic_id: z.string().uuid(),
      id: z.string().uuid(),
    }),
    handler: async (input) => {
      const { data, error } = await db.from("study_entries").delete()
        .eq("topic_id", input.topic_id)
        .eq("id", input.id)
        .eq("kind", "knowledge")
        .select("id,topic_id,title,kind,category")
        .single();
      if (error) return fail(error.message);
      return ok({ deleted: true, ...repositoryItem(data) });
    },
  });

  s.tool("list_study_topics", {
    description: "List study topics (Conhecimentos Gerais). Optionally filter by area_id.",
    inputSchema: z.object({
      area_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    handler: async (input) => {
      let q = db.from("study_topics").select("*")
        .order("updated_at", { ascending: false })
        .limit(input.limit ?? 100);
      if (input.area_id) q = q.eq("area_id", input.area_id);
      const { data, error } = await q;
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  // ---------- SPACES (delete) ----------
  s.tool("delete_space", {
    description: "Permanently delete a space. Notes/tasks linked to it have their space_id cleared depending on FK rules.",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { error } = await db.from("spaces").delete().eq("id", input.id);
      if (error) return fail(error.message);
      return ok({ deleted: true, id: input.id });
    },
  });

  // ---------- TAGS (remove) ----------
  s.tool("remove_tag_from_note", {
    description: "Remove a tag from a note's tag array.",
    inputSchema: z.object({ note_id: z.string().uuid(), tag: z.string().min(1) }),
    handler: async (input) => {
      const { data: note, error: gErr } = await db.from("notes").select("tags").eq("id", input.note_id).single();
      if (gErr) return fail(gErr.message);
      const tags = (note.tags ?? []).filter((t: string) => t !== input.tag);
      const { data, error } = await db.from("notes").update({ tags }).eq("id", input.note_id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("remove_tag_from_task", {
    description: "Clear the tag from a task.",
    inputSchema: z.object({ task_id: z.string().uuid() }),
    handler: async (input) => {
      const { data, error } = await db.from("tasks").update({ tag: null }).eq("id", input.task_id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  // ---------- SUBTASKS ----------
  const subtaskStatus = z.enum(["todo", "completed"]).optional();

  s.tool("list_subtasks", {
    description: "List subtasks for a given task.",
    inputSchema: z.object({ task_id: z.string().uuid() }),
    handler: async (input) => {
      const { data, error } = await db.from("subtasks").select("*").eq("task_id", input.task_id).order("created_at");
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("create_subtask", {
    description: "Create a subtask under a task.",
    inputSchema: z.object({
      task_id: z.string().uuid(),
      title: z.string().min(1).max(500),
      status: subtaskStatus,
      due_date: z.string().nullable().optional(),
    }),
    handler: async (input) => {
      const { data, error } = await db.from("subtasks").insert({
        user_id: ctx.userId,
        task_id: input.task_id,
        title: input.title,
        status: input.status ?? "todo",
        due_date: input.due_date ?? null,
      }).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("update_subtask", {
    description: "Update a subtask. Setting status='completed' also stamps completed_at.",
    inputSchema: z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(500).optional(),
      status: subtaskStatus,
      due_date: z.string().nullable().optional(),
    }),
    handler: async (input) => {
      const patch: Record<string, unknown> = {};
      for (const k of ["title", "status", "due_date"] as const) {
        if (input[k] !== undefined) patch[k] = input[k];
      }
      if (patch.status === "completed") patch.completed_at = new Date().toISOString();
      if (patch.status === "todo") patch.completed_at = null;
      const { data, error } = await db.from("subtasks").update(patch).eq("id", input.id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("delete_subtask", {
    description: "Delete a subtask permanently.",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { error } = await db.from("subtasks").delete().eq("id", input.id);
      if (error) return fail(error.message);
      return ok({ deleted: true, id: input.id });
    },
  });

  // ---------- TASK MATERIALS ----------
  s.tool("list_task_materials", {
    description: "List materials. Filter by task_id or space_id.",
    inputSchema: z.object({
      task_id: z.string().uuid().nullable().optional(),
      space_id: z.string().uuid().nullable().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    handler: async (input) => {
      let q = db.from("task_materials").select("*").order("created_at", { ascending: false }).limit(input.limit ?? 100);
      if (input.task_id !== undefined) {
        if (input.task_id === null) q = q.is("task_id", null); else q = q.eq("task_id", input.task_id);
      }
      if (input.space_id !== undefined) {
        if (input.space_id === null) q = q.is("space_id", null); else q = q.eq("space_id", input.space_id);
      }
      const { data, error } = await q;
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("create_task_material", {
    description: "Create a reference material (URL) linked to a task and/or space.",
    inputSchema: z.object({
      title: z.string().min(1).max(500),
      url: z.string().url(),
      description: z.string().nullable().optional(),
      task_id: z.string().uuid().nullable().optional(),
      space_id: z.string().uuid().nullable().optional(),
      tag: z.string().nullable().optional(),
    }),
    handler: async (input) => {
      const { data, error } = await db.from("task_materials").insert({
        user_id: ctx.userId,
        title: input.title,
        url: input.url,
        description: input.description ?? null,
        task_id: input.task_id ?? null,
        space_id: input.space_id ?? null,
        tag: input.tag ?? null,
      }).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("update_task_material", {
    description: "Update fields of a material.",
    inputSchema: z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(500).optional(),
      url: z.string().url().optional(),
      description: z.string().nullable().optional(),
      task_id: z.string().uuid().nullable().optional(),
      space_id: z.string().uuid().nullable().optional(),
      tag: z.string().nullable().optional(),
    }),
    handler: async (input) => {
      const patch: Record<string, unknown> = {};
      for (const k of ["title", "url", "description", "task_id", "space_id", "tag"] as const) {
        if (input[k] !== undefined) patch[k] = input[k];
      }
      const { data, error } = await db.from("task_materials").update(patch).eq("id", input.id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("delete_task_material", {
    description: "Delete a material permanently.",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { error } = await db.from("task_materials").delete().eq("id", input.id);
      if (error) return fail(error.message);
      return ok({ deleted: true, id: input.id });
    },
  });

  // ---------- LINKS ----------
  s.tool("list_links", {
    description: "List bookmark links. Optionally filter by space_id.",
    inputSchema: z.object({
      space_id: z.string().uuid().nullable().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    handler: async (input) => {
      let q = db.from("links").select("*").order("created_at", { ascending: false }).limit(input.limit ?? 100);
      if (input.space_id !== undefined) {
        if (input.space_id === null) q = q.is("space_id", null); else q = q.eq("space_id", input.space_id);
      }
      const { data, error } = await q;
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("search_links", {
    description: "Search bookmark links by title/description/url.",
    inputSchema: z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    handler: async (input) => {
      const v = input.query;
      const { data, error } = await db.from("links").select("*")
        .or(`title.ilike.%${v}%,description.ilike.%${v}%,url.ilike.%${v}%`)
        .order("created_at", { ascending: false })
        .limit(input.limit ?? 25);
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("create_link", {
    description: "Create a bookmark link, optionally inside a space.",
    inputSchema: z.object({
      title: z.string().min(1).max(500),
      url: z.string().url(),
      description: z.string().nullable().optional(),
      space_id: z.string().uuid().nullable().optional(),
    }),
    handler: async (input) => {
      const { data, error } = await db.from("links").insert({
        user_id: ctx.userId,
        title: input.title,
        url: input.url,
        description: input.description ?? null,
        space_id: input.space_id ?? null,
      }).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("update_link", {
    description: "Update fields of a bookmark link.",
    inputSchema: z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(500).optional(),
      url: z.string().url().optional(),
      description: z.string().nullable().optional(),
      space_id: z.string().uuid().nullable().optional(),
    }),
    handler: async (input) => {
      const patch: Record<string, unknown> = {};
      for (const k of ["title", "url", "description", "space_id"] as const) {
        if (input[k] !== undefined) patch[k] = input[k];
      }
      const { data, error } = await db.from("links").update(patch).eq("id", input.id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("delete_link", {
    description: "Delete a bookmark link permanently.",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { error } = await db.from("links").delete().eq("id", input.id);
      if (error) return fail(error.message);
      return ok({ deleted: true, id: input.id });
    },
  });

  // ---------- STUDY AREAS ----------
  s.tool("list_study_areas", {
    description: "List study areas (top-level Estudos categories).",
    inputSchema: z.object({ limit: z.number().int().min(1).max(200).optional() }),
    handler: async (input) => {
      const { data, error } = await db.from("study_areas").select("*")
        .order("created_at", { ascending: false }).limit(input.limit ?? 100);
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("get_study_area", {
    description: "Get a single study area by id.",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { data, error } = await db.from("study_areas").select("*").eq("id", input.id).single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("create_study_area", {
    description: "Create a study area (Conhecimentos Gerais top-level).",
    inputSchema: z.object({
      name: z.string().min(1).max(200),
      description: z.string().nullable().optional(),
      icon: z.string().nullable().optional(),
      color: z.string().nullable().optional(),
    }),
    handler: async (input) => {
      const { data, error } = await db.from("study_areas").insert({
        user_id: ctx.userId,
        name: input.name,
        description: input.description ?? null,
        icon: input.icon ?? null,
        color: input.color ?? null,
      }).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("update_study_area", {
    description: "Update a study area.",
    inputSchema: z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().nullable().optional(),
      icon: z.string().nullable().optional(),
      color: z.string().nullable().optional(),
    }),
    handler: async (input) => {
      const patch: Record<string, unknown> = {};
      for (const k of ["name", "description", "icon", "color"] as const) {
        if (input[k] !== undefined) patch[k] = input[k];
      }
      const { data, error } = await db.from("study_areas").update(patch).eq("id", input.id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("delete_study_area", {
    description: "Delete a study area (cascades to its topics and entries).",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { error } = await db.from("study_areas").delete().eq("id", input.id);
      if (error) return fail(error.message);
      return ok({ deleted: true, id: input.id });
    },
  });

  // ---------- STUDY TOPICS ----------
  s.tool("get_study_topic", {
    description: "Get a study topic with its entries.",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const [{ data: topic, error }, { data: entries }] = await Promise.all([
        db.from("study_topics").select("*").eq("id", input.id).single(),
        db.from("study_entries").select("*").eq("topic_id", input.id).order("entry_date", { ascending: false }),
      ]);
      if (error) return fail(error.message);
      return ok({ ...topic, entries: entries ?? [] });
    },
  });

  s.tool("create_study_topic", {
    description: "Create a study topic under an area.",
    inputSchema: z.object({
      area_id: z.string().uuid(),
      title: z.string().min(1).max(500),
      description: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().nullable().optional(),
    }),
    handler: async (input) => {
      const { data, error } = await db.from("study_topics").insert({
        user_id: ctx.userId,
        area_id: input.area_id,
        title: input.title,
        description: input.description ?? null,
        tags: input.tags ?? [],
        notes: input.notes ?? null,
      }).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("update_study_topic", {
    description: "Update a study topic (title, description, free-form notes, tags, or move to another area).",
    inputSchema: z.object({
      id: z.string().uuid(),
      area_id: z.string().uuid().optional(),
      title: z.string().min(1).max(500).optional(),
      description: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().nullable().optional(),
    }),
    handler: async (input) => {
      const patch: Record<string, unknown> = {};
      for (const k of ["area_id", "title", "description", "tags", "notes"] as const) {
        if (input[k] !== undefined) patch[k] = input[k];
      }
      const { data, error } = await db.from("study_topics").update(patch).eq("id", input.id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("delete_study_topic", {
    description: "Delete a study topic (cascades to its entries).",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { error } = await db.from("study_topics").delete().eq("id", input.id);
      if (error) return fail(error.message);
      return ok({ deleted: true, id: input.id });
    },
  });

  // ---------- STUDY ENTRIES (update / delete) ----------
  s.tool("update_study_entry", {
    description: "Update a study entry. Pode alterar o `kind` ('event' | 'knowledge'), categoria e conteúdo longo.",
    inputSchema: z.object({
      id: z.string().uuid(),
      kind: z.enum(["event","knowledge"]).optional(),
      category: z.string().nullable().optional(),
      entry_date: z.string().nullable().optional(),
      title: z.string().min(1).max(500).optional(),
      summary: z.string().optional(),
      content: z.string().nullable().optional(),
      source_url: z.string().url().nullable().optional(),
      highlight: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
    }),
    handler: async (input) => {
      const patch: Record<string, unknown> = {};
      for (const k of ["kind","category","entry_date","title","summary","content","source_url","highlight","notes","tags"] as const) {
        if (input[k] !== undefined) patch[k] = input[k];
      }
      const { data, error } = await db.from("study_entries").update(patch).eq("id", input.id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("list_study_entries", {
    description: "List study entries, optionally filtered by topic_id or area_id, newest first.",
    inputSchema: z.object({
      topic_id: z.string().uuid().optional(),
      area_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    handler: async (input) => {
      let q = db.from("study_entries").select("*")
        .order("entry_date", { ascending: false })
        .limit(input.limit ?? 100);
      if (input.topic_id) q = q.eq("topic_id", input.topic_id);
      if (input.area_id) {
        const { data: topics } = await db.from("study_topics").select("id").eq("area_id", input.area_id);
        const ids = (topics ?? []).map((t: { id: string }) => t.id);
        if (ids.length === 0) return ok([]);
        q = q.in("topic_id", ids);
      }
      const { data, error } = await q;
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("get_study_entry", {
    description: "Get a single study entry by id.",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { data, error } = await db.from("study_entries").select("*").eq("id", input.id).single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("delete_study_entry", {
    description: "Delete a study entry permanently.",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { error } = await db.from("study_entries").delete().eq("id", input.id);
      if (error) return fail(error.message);
      return ok({ deleted: true, id: input.id });
    },
  });

  // ============================================================
  // SEMANTIC + AI LAYER (camada cognitiva)
  // ============================================================

  s.tool("add_event_entry", {
    description: "Atalho para adicionar uma entrada de timeline (kind='event') a um tópico. entry_date é obrigatório.",
    inputSchema: z.object({
      topic_id: z.string().uuid(),
      entry_date: z.string().describe("ISO YYYY-MM-DD"),
      title: z.string().min(1).max(500),
      summary: z.string().min(1),
      category: z.string().nullable().optional(),
      source_url: z.string().url().nullable().optional(),
      highlight: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
    }),
    handler: async (input) => {
      const { data, error } = await db.from("study_entries").insert({
        user_id: ctx.userId, topic_id: input.topic_id, kind: "event",
        entry_date: input.entry_date, title: input.title, summary: input.summary,
        category: input.category ?? null, source_url: input.source_url ?? null,
        highlight: input.highlight ?? null, tags: input.tags ?? [],
      }).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("add_knowledge_entry", {
    description: "Atalho para adicionar uma entrada de Knowledge Base (kind='knowledge') a um tópico — frameworks, conceitos, modelos mentais, playbooks, prompts.",
    inputSchema: z.object({
      topic_id: z.string().uuid(),
      title: z.string().min(1).max(500),
      summary: z.string().min(1),
      content: z.string().nullable().optional(),
      category: z.string().nullable().optional().describe("Ex: 'framework','conceito','playbook','prompt','benchmark','modelo_mental','metodologia'"),
      source_url: z.string().url().nullable().optional(),
      highlight: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
    }),
    handler: async (input) => {
      const { data, error } = await db.from("study_entries").insert({
        user_id: ctx.userId, topic_id: input.topic_id, kind: "knowledge",
        title: input.title, summary: input.summary, content: input.content ?? null,
        category: input.category ?? null, source_url: input.source_url ?? null,
        highlight: input.highlight ?? null, tags: input.tags ?? [],
      }).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("add_book_summary", {
    description: "Adiciona um resumo de livro como entrada de Knowledge Base (category='livro').",
    inputSchema: z.object({
      topic_id: z.string().uuid(),
      title: z.string().min(1).max(500).describe("Título do livro"),
      author: z.string().optional(),
      summary: z.string().min(1),
      key_takeaways: z.array(z.string()).optional(),
      content: z.string().optional(),
      source_url: z.string().url().nullable().optional(),
      tags: z.array(z.string()).optional(),
    }),
    handler: async (input) => {
      const fullTitle = input.author ? `${input.title} — ${input.author}` : input.title;
      const body = [
        input.content ?? "",
        input.key_takeaways?.length ? "\n\n## Principais aprendizados\n" + input.key_takeaways.map((k) => `- ${k}`).join("\n") : "",
      ].join("").trim();
      const { data, error } = await db.from("study_entries").insert({
        user_id: ctx.userId, topic_id: input.topic_id, kind: "knowledge",
        category: "livro", title: fullTitle, summary: input.summary,
        content: body || null, source_url: input.source_url ?? null,
        tags: input.tags ?? [],
      }).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("search_study_content", {
    description: "Busca unificada em todo o módulo Conhecimentos Gerais: areas, topics e entries (events + knowledge).",
    inputSchema: z.object({
      query: z.string().min(1),
      kind: z.enum(["event","knowledge"]).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    handler: async (input) => {
      const v = input.query.replace(/[,()]/g, " ");
      const lim = input.limit ?? 15;
      const [areasR, topicsR, entriesR] = await Promise.all([
        db.from("study_areas").select("id,name,description").or(`name.ilike.%${v}%,description.ilike.%${v}%`).limit(lim),
        db.from("study_topics").select("id,title,description,area_id,tags").or(`title.ilike.%${v}%,description.ilike.%${v}%,notes.ilike.%${v}%`).limit(lim),
        (() => {
          let q = db.from("study_entries").select("id,topic_id,kind,category,title,summary,entry_date,tags")
            .or(`title.ilike.%${v}%,summary.ilike.%${v}%,content.ilike.%${v}%,highlight.ilike.%${v}%,notes.ilike.%${v}%`)
            .order("entry_date", { ascending: false, nullsFirst: false })
            .limit(lim);
          if (input.kind) q = q.eq("kind", input.kind);
          return q;
        })(),
      ]);
      return ok({
        areas: areasR.data ?? [],
        topics: topicsR.data ?? [],
        entries: entriesR.data ?? [],
      });
    },
  });

  s.tool("search_everything", {
    description: "Busca semântica simples (ilike paralelo) em notes, tasks, spaces, links, materials, study_topics e study_entries. Retorna resultados agrupados com display_url.",
    inputSchema: z.object({
      query: z.string().min(1),
      types: z.array(z.enum(["note","task","space","link","task_material","study_topic","study_entry"])).optional(),
      limit_per_type: z.number().int().min(1).max(25).optional(),
    }),
    handler: async (input) => {
      const v = input.query.replace(/[,()]/g, " ");
      const lim = input.limit_per_type ?? 8;
      const want = (t: string) => !input.types || input.types.includes(t as any);
      const [notes, tasks, spaces, links, mats, topics, entries] = await Promise.all([
        want("note") ? db.from("notes").select("id,title,content,space_id,tags,updated_at").or(`title.ilike.%${v}%,content.ilike.%${v}%`).limit(lim) : Promise.resolve({ data: [] }),
        want("task") ? db.from("tasks").select("id,title,description,status,due_date,space_id").is("deleted_at", null).or(`title.ilike.%${v}%,description.ilike.%${v}%`).limit(lim) : Promise.resolve({ data: [] }),
        want("space") ? db.from("spaces").select("id,name,description").or(`name.ilike.%${v}%,description.ilike.%${v}%`).limit(lim) : Promise.resolve({ data: [] }),
        want("link") ? db.from("links").select("id,title,url,description,space_id").or(`title.ilike.%${v}%,description.ilike.%${v}%,url.ilike.%${v}%`).limit(lim) : Promise.resolve({ data: [] }),
        want("task_material") ? db.from("task_materials").select("id,title,url,description,task_id,space_id").or(`title.ilike.%${v}%,description.ilike.%${v}%,url.ilike.%${v}%`).limit(lim) : Promise.resolve({ data: [] }),
        want("study_topic") ? db.from("study_topics").select("id,title,description,area_id").or(`title.ilike.%${v}%,description.ilike.%${v}%,notes.ilike.%${v}%`).limit(lim) : Promise.resolve({ data: [] }),
        want("study_entry") ? db.from("study_entries").select("id,topic_id,kind,category,title,summary,entry_date").or(`title.ilike.%${v}%,summary.ilike.%${v}%,content.ilike.%${v}%`).limit(lim) : Promise.resolve({ data: [] }),
      ]);
      const enrich = (rows: any[], type: EntityType, hint?: (r: any) => any) =>
        (rows ?? []).map((r) => ({ entity_type: type, entity_id: r.id, title: r.title ?? r.name, display_url: urlFor(type, r.id, hint?.(r)), data: r }));
      const results = [
        ...enrich(notes.data ?? [], "note"),
        ...enrich(tasks.data ?? [], "task"),
        ...enrich(spaces.data ?? [], "space"),
        ...enrich(links.data ?? [], "link"),
        ...enrich(mats.data ?? [], "task_material", (r) => ({ task_id: r.task_id })),
        ...enrich(topics.data ?? [], "study_topic"),
        ...enrich(entries.data ?? [], "study_entry", (r) => ({ topic_id: r.topic_id })),
      ];
      return ok({ query: input.query, total: results.length, results });
    },
  });

  s.tool("get_recent_activity", {
    description: "Atividade recente em todas as entidades (notes, tasks, study_entries) ordenada por updated_at desc.",
    inputSchema: z.object({
      since_days: z.number().int().min(1).max(90).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    handler: async (input) => {
      const since = new Date(Date.now() - (input.since_days ?? 7) * 86_400_000).toISOString();
      const lim = input.limit ?? 25;
      const [notes, tasks, entries] = await Promise.all([
        db.from("notes").select("id,title,updated_at,space_id").gte("updated_at", since).order("updated_at", { ascending: false }).limit(lim),
        db.from("tasks").select("id,title,status,updated_at,space_id,completed_at").is("deleted_at", null).gte("updated_at", since).order("updated_at", { ascending: false }).limit(lim),
        db.from("study_entries").select("id,topic_id,kind,title,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(lim),
      ]);
      const items = [
        ...(notes.data ?? []).map((n: any) => ({ entity_type: "note", id: n.id, title: n.title, ts: n.updated_at, display_url: urlFor("note", n.id) })),
        ...(tasks.data ?? []).map((t: any) => ({ entity_type: "task", id: t.id, title: t.title, ts: t.updated_at, status: t.status, display_url: urlFor("task", t.id) })),
        ...(entries.data ?? []).map((e: any) => ({ entity_type: "study_entry", id: e.id, title: e.title, ts: e.created_at, kind: e.kind, display_url: urlFor("study_entry", e.id, { topic_id: e.topic_id }) })),
      ].sort((a, b) => (b.ts ?? "").localeCompare(a.ts ?? "")).slice(0, lim);
      return ok({ since, items });
    },
  });

  s.tool("get_daily_briefing", {
    description: "Briefing diário consolidado: tarefas para hoje, atrasadas, concluídas nos últimos 7 dias, notas atualizadas hoje e novas entradas em Conhecimentos Gerais.",
    inputSchema: z.object({}),
    handler: async () => {
      const tz = "America/Sao_Paulo";
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
      const today = `${parts.find(p=>p.type==="year")!.value}-${parts.find(p=>p.type==="month")!.value}-${parts.find(p=>p.type==="day")!.value}`;
      const sevenAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const [todayT, overdue, recentDone, todayNotes, newKnowledge] = await Promise.all([
        db.from("tasks").select("id,title,status,due_date,priority,space_id").is("deleted_at", null).eq("due_date", today).neq("status","done"),
        db.from("tasks").select("id,title,status,due_date,priority,space_id").is("deleted_at", null).lt("due_date", today).neq("status","done").order("due_date"),
        db.from("tasks").select("id,title,completed_at").gte("completed_at", sevenAgo).eq("status","done").order("completed_at",{ascending:false}).limit(20),
        db.from("notes").select("id,title,updated_at").gte("updated_at", `${today}T00:00:00Z`).order("updated_at",{ascending:false}).limit(20),
        db.from("study_entries").select("id,topic_id,kind,title,created_at").gte("created_at", sevenAgo).order("created_at",{ascending:false}).limit(20),
      ]);
      return ok({
        date: today,
        tasks_today: todayT.data ?? [],
        tasks_overdue: overdue.data ?? [],
        completed_last_7d: recentDone.data ?? [],
        notes_updated_today: todayNotes.data ?? [],
        new_knowledge_last_7d: newKnowledge.data ?? [],
      });
    },
  });

  s.tool("find_related_content", {
    description: "Encontra conteúdo relacionado a uma entidade (note, task, study_topic, study_entry) por tags compartilhadas, mesmo space ou mesmo tópico.",
    inputSchema: z.object({
      entity_type: z.enum(["note","task","study_topic","study_entry"]),
      id: z.string().uuid(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    handler: async (input) => {
      const lim = input.limit ?? 10;
      let tags: string[] = [];
      let space_id: string | null = null;
      let topic_id: string | null = null;
      if (input.entity_type === "note") {
        const { data } = await db.from("notes").select("tags,space_id").eq("id", input.id).single();
        tags = data?.tags ?? []; space_id = data?.space_id ?? null;
      } else if (input.entity_type === "task") {
        const { data } = await db.from("tasks").select("tag,space_id").eq("id", input.id).single();
        tags = data?.tag ? [data.tag] : []; space_id = data?.space_id ?? null;
      } else if (input.entity_type === "study_topic") {
        const { data } = await db.from("study_topics").select("tags").eq("id", input.id).single();
        tags = data?.tags ?? [];
      } else {
        const { data } = await db.from("study_entries").select("tags,topic_id").eq("id", input.id).single();
        tags = data?.tags ?? []; topic_id = data?.topic_id ?? null;
      }
      const [notes, tasks, entries] = await Promise.all([
        tags.length ? db.from("notes").select("id,title,tags,space_id").overlaps("tags", tags).neq("id", input.id).limit(lim) : Promise.resolve({ data: [] }),
        tags.length ? db.from("tasks").select("id,title,tag,space_id").is("deleted_at", null).in("tag", tags).neq("id", input.id).limit(lim) : Promise.resolve({ data: [] }),
        topic_id ? db.from("study_entries").select("id,title,kind,topic_id").eq("topic_id", topic_id).neq("id", input.id).limit(lim)
                 : (tags.length ? db.from("study_entries").select("id,title,kind,topic_id,tags").overlaps("tags", tags).neq("id", input.id).limit(lim) : Promise.resolve({ data: [] })),
      ]);
      const sameSpace = space_id ? await db.from("notes").select("id,title").eq("space_id", space_id).neq("id", input.id).limit(lim) : { data: [] };
      return ok({
        seed: { entity_type: input.entity_type, id: input.id, tags, space_id, topic_id },
        related_notes: notes.data ?? [],
        related_tasks: tasks.data ?? [],
        related_study_entries: entries.data ?? [],
        same_space_notes: sameSpace.data ?? [],
      });
    },
  });

  s.tool("extract_action_items", {
    description: "Usa IA para extrair próximos passos / action items de um texto livre (transcrição de reunião, nota, briefing).",
    inputSchema: z.object({
      text: z.string().min(20),
      context: z.string().optional(),
    }),
    handler: async (input) => {
      try {
        const result = await callLovableAI(
          `${input.context ? `Contexto: ${input.context}\n\n` : ""}Texto:\n${input.text}\n\nExtraia todas as ações concretas (action items / próximos passos).`,
          {
            system: "Você é um analista executivo. Extraia action items objetivos, sem inventar prazos ou responsáveis. Português do Brasil.",
            schema: {
              name: "extract_action_items",
              description: "Lista estruturada de ações",
              parameters: {
                type: "object",
                properties: {
                  action_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        owner: { type: "string" },
                        due_date: { type: "string" },
                        priority: { type: "string", enum: ["low","medium","high","urgent"] },
                      },
                      required: ["title"],
                    },
                  },
                },
                required: ["action_items"],
              },
            },
          },
        );
        return ok(result);
      } catch (e: any) {
        return fail(`AI gateway error: ${e?.message ?? e}`, "ai_unavailable");
      }
    },
  });

  s.tool("create_task_from_note", {
    description: "Cria uma task a partir de uma nota, herdando space_id e linkando via note_id.",
    inputSchema: z.object({
      note_id: z.string().uuid(),
      title: z.string().min(1).max(500),
      description: z.string().optional(),
      due_date: z.string().optional(),
      priority: z.enum(["low","medium","high","urgent"]).optional(),
      execution_complexity: z.enum(["easy","medium","hard"]).nullable().optional(),
    }),
    handler: async (input) => {
      const { data: note, error: nErr } = await db.from("notes").select("space_id,tags").eq("id", input.note_id).single();
      if (nErr) return fail(nErr.message);
      const { data, error } = await db.from("tasks").insert({
        user_id: ctx.userId,
        title: input.title,
        description: input.description ?? null,
        due_date: input.due_date ?? null,
        priority: input.priority ?? "medium",
        execution_complexity: input.execution_complexity ?? null,
        status: "todo",
        note_id: input.note_id,
        space_id: note?.space_id ?? null,
        tag: (note?.tags ?? [])[0] ?? null,
      }).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("append_meeting_to_project", {
    description: "Adiciona uma seção de reunião (decisões, próximos passos) à nota mais recente de um space.",
    inputSchema: z.object({
      space_id: z.string().uuid(),
      heading: z.string().min(1).max(200),
      summary: z.string().optional(),
      decisions: z.array(z.string()).optional(),
      next_steps: z.array(z.string()).optional(),
      meeting_date: z.string().optional(),
    }),
    handler: async (input) => {
      const { data: hub, error } = await db.from("notes").select("id,content").eq("space_id", input.space_id).order("updated_at",{ascending:false}).limit(1).single();
      if (error) return fail(error.message, "not_found");
      const lines = [`## ${input.heading}`, ""];
      if (input.meeting_date) lines.push(`_Reunião em: ${input.meeting_date}_`, "");
      if (input.summary) lines.push(input.summary.trim(), "");
      if (input.decisions?.length) { lines.push("### Decisões"); input.decisions.forEach((d) => lines.push(`- ${d}`)); lines.push(""); }
      if (input.next_steps?.length) { lines.push("### Próximos passos"); input.next_steps.forEach((n) => lines.push(`- [ ] ${n}`)); }
      const merged = `${hub.content ?? ""}${hub.content ? "\n\n---\n\n" : ""}${lines.join("\n")}`;
      const { data, error: uErr } = await db.from("notes").update({ content: merged }).eq("id", hub.id).select().single();
      if (uErr) return fail(uErr.message);
      return ok(data);
    },
  });

  s.tool("summarize_space", {
    description: "Gera um resumo executivo de um space usando IA: em andamento, decisões recentes, riscos e próximos passos.",
    inputSchema: z.object({
      space_id: z.string().uuid(),
      max_notes: z.number().int().min(1).max(20).optional(),
    }),
    handler: async (input) => {
      const limN = input.max_notes ?? 8;
      const [{ data: space }, { data: notes }, { data: tasks }] = await Promise.all([
        db.from("spaces").select("id,name,description").eq("id", input.space_id).single(),
        db.from("notes").select("title,content,updated_at").eq("space_id", input.space_id).order("updated_at",{ascending:false}).limit(limN),
        db.from("tasks").select("title,status,due_date,priority").is("deleted_at", null).eq("space_id", input.space_id).order("updated_at",{ascending:false}).limit(50),
      ]);
      if (!space) return fail("Space not found", "not_found");
      const promptParts = [
        `Space: ${space.name}${space.description ? ` — ${space.description}` : ""}`,
        "",
        "## Notas recentes",
        ...(notes ?? []).map((n: any) => `### ${n.title}\n${(n.content ?? "").slice(0, 1500)}`),
        "",
        "## Tarefas",
        ...(tasks ?? []).map((t: any) => `- [${t.status}] ${t.title}${t.due_date ? ` (due ${t.due_date})` : ""} [${t.priority}]`),
      ].join("\n");
      try {
        const result = await callLovableAI(promptParts, {
          system: "Você é um chief of staff. Produza um resumo executivo em português, conciso, com seções: Em andamento, Decisões recentes, Riscos/atenção, Próximos passos.",
          temperature: 0.3,
          max_tokens: 800,
        });
        return ok({ space, summary: typeof result === "string" ? result : JSON.stringify(result) });
      } catch (e: any) {
        return fail(`AI gateway error: ${e?.message ?? e}`, "ai_unavailable");
      }
    },
  });

  s.tool("get_context_for_chat", {
    description: "Pacote de contexto para abrir uma conversa com o assistente: spaces ativos, tarefas para hoje + atrasadas, notas recentes e tópicos de Conhecimentos Gerais ativos.",
    inputSchema: z.object({
      query: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    handler: async (input) => {
      const lim = input.limit ?? 10;
      const tz = "America/Sao_Paulo";
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
      const today = `${parts.find(p=>p.type==="year")!.value}-${parts.find(p=>p.type==="month")!.value}-${parts.find(p=>p.type==="day")!.value}`;
      const v = input.query ? input.query.replace(/[,()]/g, " ") : null;
      const [spaces, tasksToday, overdue, notes, topics] = await Promise.all([
        db.from("spaces").select("id,name,description").order("updated_at",{ascending:false}).limit(lim),
        db.from("tasks").select("id,title,due_date,status,priority,space_id").is("deleted_at", null).eq("due_date", today).neq("status","done").limit(lim),
        db.from("tasks").select("id,title,due_date,status,priority,space_id").is("deleted_at", null).lt("due_date", today).neq("status","done").order("due_date").limit(lim),
        v ? db.from("notes").select("id,title,updated_at").or(`title.ilike.%${v}%,content.ilike.%${v}%`).limit(lim)
          : db.from("notes").select("id,title,updated_at").order("updated_at",{ascending:false}).limit(lim),
        db.from("study_topics").select("id,title,area_id,last_updated_at").order("last_updated_at",{ascending:false,nullsFirst:false}).limit(lim),
      ]);
      return ok({
        date: today,
        query: input.query ?? null,
        spaces: spaces.data ?? [],
        tasks_today: tasksToday.data ?? [],
        tasks_overdue: overdue.data ?? [],
        recent_notes: notes.data ?? [],
        active_study_topics: topics.data ?? [],
      });
    },
  });

  // ============ TIME TRACKING ============
  s.tool("list_time_entries", {
    description: "List time-tracking entries. Optionally filter by task_id.",
    inputSchema: z.object({ task_id: z.string().uuid().optional(), limit: z.number().int().min(1).max(500).optional() }),
    handler: async (input) => {
      let q = db.from("task_time_entries").select("*, tasks(title, space_id)").order("started_at", { ascending: false }).limit(input.limit ?? 100);
      if (input.task_id) q = q.eq("task_id", input.task_id);
      const { data, error } = await q;
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("list_running_time_entries", {
    description: "List time entries that are currently running (no ended_at).",
    inputSchema: z.object({}),
    handler: async () => {
      const { data, error } = await db.from("task_time_entries").select("*, tasks(title, space_id)").is("ended_at", null);
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("start_time_entry", {
    description: "Start a time tracker for a task. If already running, returns the existing entry.",
    inputSchema: z.object({ task_id: z.string().uuid() }),
    handler: async (input) => {
      const { data: running } = await db.from("task_time_entries").select("*").eq("task_id", input.task_id).eq("user_id", ctx.userId).is("ended_at", null);
      if (running && running.length > 0) return ok(running[0]);
      const { data, error } = await db.from("task_time_entries").insert({ task_id: input.task_id, user_id: ctx.userId, started_at: new Date().toISOString() }).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("stop_time_entry", {
    description: "Stop a running time entry and record its duration.",
    inputSchema: z.object({ entry_id: z.string().uuid() }),
    handler: async (input) => {
      const now = new Date();
      const { data: entry } = await db.from("task_time_entries").select("started_at").eq("id", input.entry_id).single();
      const duration = entry ? Math.round((now.getTime() - new Date(entry.started_at as string).getTime()) / 1000) : 0;
      const { data, error } = await db.from("task_time_entries").update({ ended_at: now.toISOString(), duration_seconds: duration }).eq("id", input.entry_id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  // ============ SPACE CATEGORIES ============
  s.tool("list_space_categories", {
    description: "List all space categories owned by the user.",
    inputSchema: z.object({}),
    handler: async () => {
      const { data, error } = await db.from("space_categories").select("*").order("name", { ascending: true });
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("create_space_category", {
    description: "Create a new space category. Idempotent by name.",
    inputSchema: z.object({ name: z.string().min(1).max(200) }),
    handler: async (input) => {
      const name = input.name.trim();
      const { data, error } = await db.from("space_categories").insert({ user_id: ctx.userId, name }).select().single();
      if (error) {
        if ((error as any).code === "23505") {
          const { data: existing, error: e2 } = await db.from("space_categories").select("*").eq("user_id", ctx.userId).eq("name", name).single();
          if (e2) return fail(e2.message);
          return ok(existing);
        }
        return fail(error.message);
      }
      return ok(data);
    },
  });
  s.tool("update_space_category", {
    description: "Rename a space category.",
    inputSchema: z.object({ id: z.string().uuid(), name: z.string().min(1).max(200) }),
    handler: async (input) => {
      const { data, error } = await db.from("space_categories").update({ name: input.name.trim() }).eq("id", input.id).eq("user_id", ctx.userId).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("delete_space_category", {
    description: "Delete a space category. Spaces referencing it will have category cleared.",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { error } = await db.from("space_categories").delete().eq("id", input.id);
      if (error) return fail(error.message);
      return ok({ deleted: true, id: input.id });
    },
  });
  s.tool("set_space_category", {
    description: "Assign (or clear with null) a category on a space.",
    inputSchema: z.object({ space_id: z.string().uuid(), category_id: z.string().uuid().nullable() }),
    handler: async (input) => {
      const { data, error } = await db.from("spaces").update({ category_id: input.category_id }).eq("id", input.space_id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  // ============ SPACE SHARING ============
  s.tool("list_space_members", {
    description: "List members of a space (owners, editors, viewers).",
    inputSchema: z.object({ space_id: z.string().uuid() }),
    handler: async (input) => {
      const { data, error } = await db.from("space_members").select("*").eq("space_id", input.space_id).order("created_at", { ascending: true });
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("list_space_invites", {
    description: "List pending (not-accepted) invites for a space.",
    inputSchema: z.object({ space_id: z.string().uuid() }),
    handler: async (input) => {
      const { data, error } = await db.from("space_invites").select("*").eq("space_id", input.space_id).eq("accepted", false).order("created_at", { ascending: false });
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("invite_to_space", {
    description: "Create an invitation to a space. Email is optional (blank invite = shareable token).",
    inputSchema: z.object({
      space_id: z.string().uuid(),
      email: z.string().email().nullable().optional(),
      role: z.enum(["owner", "editor", "viewer"]),
    }),
    handler: async (input) => {
      const { data, error } = await db.from("space_invites").insert({
        space_id: input.space_id,
        invited_by: ctx.userId,
        invited_email: input.email ?? null,
        role: input.role,
      }).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("remove_space_member", {
    description: "Remove a member from a space.",
    inputSchema: z.object({ member_id: z.string().uuid() }),
    handler: async (input) => {
      const { error } = await db.from("space_members").delete().eq("id", input.member_id);
      if (error) return fail(error.message);
      return ok({ deleted: true, id: input.member_id });
    },
  });
  s.tool("update_member_role", {
    description: "Change a space member's role.",
    inputSchema: z.object({ member_id: z.string().uuid(), role: z.enum(["owner", "editor", "viewer"]) }),
    handler: async (input) => {
      const { data, error } = await db.from("space_members").update({ role: input.role }).eq("id", input.member_id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("delete_space_invite", {
    description: "Delete/revoke a pending space invite.",
    inputSchema: z.object({ invite_id: z.string().uuid() }),
    handler: async (input) => {
      const { error } = await db.from("space_invites").delete().eq("id", input.invite_id);
      if (error) return fail(error.message);
      return ok({ deleted: true, id: input.invite_id });
    },
  });

  // ============ REMINDERS ============
  s.tool("list_reminders", {
    description: "List pending (not-sent) task reminders ordered by scheduled time.",
    inputSchema: z.object({ limit: z.number().int().min(1).max(500).optional() }),
    handler: async (input) => {
      const { data, error } = await db.from("reminders").select("*").eq("sent", false).order("reminder_time", { ascending: true }).limit(input.limit ?? 100);
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  // ============ TAGGED SNIPPETS ============
  s.tool("create_tagged_snippet", {
    description: "Save a tagged snippet extracted from a note.",
    inputSchema: z.object({ note_id: z.string().uuid(), tag: z.string().min(1), snippet_text: z.string().min(1) }),
    handler: async (input) => {
      const { data, error } = await db.from("tagged_snippets").insert({ user_id: ctx.userId, note_id: input.note_id, tag: input.tag, snippet_text: input.snippet_text }).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("list_tagged_snippets", {
    description: "List tagged snippets, optionally filtered by tag or note.",
    inputSchema: z.object({ tag: z.string().optional(), note_id: z.string().uuid().optional(), limit: z.number().int().min(1).max(500).optional() }),
    handler: async (input) => {
      let q = db.from("tagged_snippets").select("*, notes(title)").order("created_at", { ascending: false }).limit(input.limit ?? 100);
      if (input.tag) q = q.eq("tag", input.tag);
      if (input.note_id) q = q.eq("note_id", input.note_id);
      const { data, error } = await q;
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("delete_tagged_snippet", {
    description: "Delete a tagged snippet.",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { error } = await db.from("tagged_snippets").delete().eq("id", input.id);
      if (error) return fail(error.message);
      return ok({ deleted: true, id: input.id });
    },
  });

  // ============ TASK ↔ TASK LINKS ============
  s.tool("link_tasks", {
    description: "Create a relationship between two tasks (task_id -> linked_task_id).",
    inputSchema: z.object({ task_id: z.string().uuid(), linked_task_id: z.string().uuid() }),
    handler: async (input) => {
      const { data, error } = await db.from("task_links").insert({ task_id: input.task_id, linked_task_id: input.linked_task_id, user_id: ctx.userId }).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("list_task_task_links", {
    description: "List task-to-task relationships originating from a task.",
    inputSchema: z.object({ task_id: z.string().uuid() }),
    handler: async (input) => {
      const { data, error } = await db.from("task_links").select("*, linked_task:linked_task_id(id, title, status, priority, space_id)").eq("task_id", input.task_id);
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("unlink_tasks", {
    description: "Remove a task-to-task relationship by its id.",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { error } = await db.from("task_links").delete().eq("id", input.id);
      if (error) return fail(error.message);
      return ok({ deleted: true, id: input.id });
    },
  });

  // ============ DELETED / RESTORE / DUPLICATE / RECURRENCE ============
  s.tool("list_deleted_tasks", {
    description: "List tasks soft-deleted within the last 24h (restorable window).",
    inputSchema: z.object({ limit: z.number().int().min(1).max(500).optional() }),
    handler: async (input) => {
      const { data, error } = await db.from("tasks").select("*, spaces(name)").not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(input.limit ?? 100);
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("restore_task", {
    description: "Restore a soft-deleted task (clears deleted_at).",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { data, error } = await db.from("tasks").update({ deleted_at: null }).eq("id", input.id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("permanently_delete_task", {
    description: "Permanently delete a task, bypassing the 24h grace period.",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { error } = await db.from("tasks").delete().eq("id", input.id);
      if (error) return fail(error.message);
      return ok({ deleted: true, id: input.id });
    },
  });
  s.tool("duplicate_task", {
    description: "Duplicate a task, preserving fields but resetting status/completion.",
    inputSchema: z.object({ task_id: z.string().uuid() }),
    handler: async (input) => {
      const { data: original, error: fe } = await db.from("tasks").select("*").eq("id", input.task_id).single();
      if (fe || !original) return fail(fe?.message ?? "Task not found", "not_found");
      const o = original as any;
      const { id: _id, created_at: _c, completed_at: _ca, completion_note: _cn, day_order: _do, ...fields } = o;
      const { data, error } = await db.from("tasks").insert({ ...fields, user_id: ctx.userId, status: "todo", completed_at: null, completion_note: null, day_order: null }).select("*, spaces(name)").single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("generate_next_recurrence", {
    description: "Generate the next occurrence of a recurring task (based on its recurrence rule).",
    inputSchema: z.object({ task_id: z.string().uuid() }),
    handler: async (input) => {
      const { data: t, error: fe } = await db.from("tasks").select("*").eq("id", input.task_id).single();
      if (fe || !t) return fail(fe?.message ?? "Task not found", "not_found");
      const task = t as any;
      if (!task.recurrence || task.recurrence === "none" || !task.due_date) {
        return ok({ generated: false, reason: "not_recurrent_or_no_due_date" });
      }
      const base = new Date(`${task.due_date}T12:00:00Z`);
      const next = new Date(base);
      switch (task.recurrence) {
        case "daily": next.setUTCDate(next.getUTCDate() + 1); break;
        case "weekly": next.setUTCDate(next.getUTCDate() + 7); break;
        case "biweekly": next.setUTCDate(next.getUTCDate() + 14); break;
        case "monthly": next.setUTCMonth(next.getUTCMonth() + 1); break;
        case "yearly": next.setUTCFullYear(next.getUTCFullYear() + 1); break;
        default: return ok({ generated: false, reason: "unknown_recurrence" });
      }
      const nextDate = next.toISOString().slice(0, 10);
      const { id: _id, created_at: _c, completed_at: _ca, completion_note: _cn, day_order: _do, ...fields } = task;
      const { data, error } = await db.from("tasks").insert({ ...fields, user_id: ctx.userId, status: "todo", completed_at: null, completion_note: null, day_order: null, due_date: nextDate }).select("*, spaces(name)").single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  // ============ ATTACHMENTS ============
  s.tool("list_space_attachments", {
    description: "List file attachments uploaded to a space.",
    inputSchema: z.object({ space_id: z.string().uuid() }),
    handler: async (input) => {
      const { data, error } = await db.from("attachments").select("*").eq("space_id", input.space_id).order("created_at", { ascending: false });
      if (error) return fail(error.message);
      return ok(data);
    },
  });
  s.tool("delete_space_attachment", {
    description: "Delete an attachment record (does not remove the underlying storage object).",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { error } = await db.from("attachments").delete().eq("id", input.id);
      if (error) return fail(error.message);
      return ok({ deleted: true, id: input.id });
    },
  });
  s.tool("get_attachment_url", {
    description: "Get the public URL for an attachment given its storage file_path.",
    inputSchema: z.object({ file_path: z.string().min(1) }),
    handler: async (input) => {
      const { data } = db.storage.from("attachments").getPublicUrl(input.file_path);
      return ok({ url: data.publicUrl, file_path: input.file_path });
    },
  });

  // ============ TAG MANAGEMENT ============
  s.tool("list_all_tags", {
    description: "List all distinct tags aggregated from notes, snippets and tasks.",
    inputSchema: z.object({}),
    handler: async () => {
      const [notes, snippets, tasks] = await Promise.all([
        db.from("notes").select("tags"),
        db.from("tagged_snippets").select("tag"),
        db.from("tasks").select("tag").is("deleted_at", null),
      ]);
      const set = new Set<string>();
      (notes.data ?? []).forEach((n: any) => (n.tags || []).forEach((t: string) => t && set.add(t)));
      (snippets.data ?? []).forEach((s: any) => s.tag && set.add(s.tag));
      (tasks.data ?? []).forEach((t: any) => t.tag && set.add(t.tag));
      return ok([...set].sort());
    },
  });
  s.tool("rename_tag", {
    description: "Rename a tag across notes, tagged snippets and tasks.",
    inputSchema: z.object({ old_tag: z.string().min(1), new_tag: z.string().min(1) }),
    handler: async (input) => {
      const { data: notesWithTag } = await db.from("notes").select("id, tags").contains("tags", [input.old_tag]);
      if (notesWithTag?.length) {
        for (const n of notesWithTag as any[]) {
          const updated = Array.from(new Set((n.tags || []).map((t: string) => t === input.old_tag ? input.new_tag : t)));
          await db.from("notes").update({ tags: updated }).eq("id", n.id);
        }
      }
      await db.from("tagged_snippets").update({ tag: input.new_tag }).eq("tag", input.old_tag).eq("user_id", ctx.userId);
      await db.from("tasks").update({ tag: input.new_tag }).eq("tag", input.old_tag).eq("user_id", ctx.userId);
      return ok({ renamed: true, old_tag: input.old_tag, new_tag: input.new_tag });
    },
  });
  s.tool("delete_tag", {
    description: "Remove a tag from all notes, snippets and tasks (content preserved).",
    inputSchema: z.object({ tag: z.string().min(1) }),
    handler: async (input) => {
      const { data: notesWithTag } = await db.from("notes").select("id, tags").contains("tags", [input.tag]);
      if (notesWithTag?.length) {
        for (const n of notesWithTag as any[]) {
          const updated = (n.tags || []).filter((t: string) => t !== input.tag);
          await db.from("notes").update({ tags: updated }).eq("id", n.id);
        }
      }
      await db.from("tagged_snippets").update({ tag: null }).eq("tag", input.tag).eq("user_id", ctx.userId);
      await db.from("tasks").update({ tag: null }).eq("tag", input.tag).eq("user_id", ctx.userId);
      return ok({ deleted: true, tag: input.tag });
    },
  });

  return s;
};

// ---------- HTTP layer ----------
const app = new Hono();

app.options("*", () => new Response(null, { headers: corsHeaders }));

app.all("*", async (c) => {
  const req = c.req.raw;

  // Unauthenticated GET (browser probe) — return basic info + 401 for clients.
  if (req.method === "GET") {
    const accept = req.headers.get("accept") ?? "";
    if (!accept.includes("application/json") && !accept.includes("text/event-stream")) {
      return new Response(
        `<h1>Nucleus MCP</h1><p>POST JSON-RPC to this endpoint with a Bearer token.</p>`,
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } },
      );
    }
  }

  // Allow unauthenticated discovery (initialize / tools/list) so clients can
  // fetch the tool catalog before completing OAuth. Tool *invocation* still
  // requires auth at the per-tool level via Supabase RLS.
  let allowAnon = false;
  let bodyText: string | null = null;
  if (req.method === "POST") {
    try {
      bodyText = await req.clone().text();
      const parsed = JSON.parse(bodyText);
      const method = Array.isArray(parsed) ? parsed[0]?.method : parsed?.method;
      if (method === "initialize" || method === "tools/list" || method === "notifications/initialized") {
        allowAnon = true;
      }
    } catch { /* ignore */ }
  }

  const auth = await authenticateMcpRequest(req);
  if (!auth && !allowAnon) return unauthorized();

  const effectiveUserId = auth?.user.id ?? "00000000-0000-0000-0000-000000000000";
  const effectiveToken = auth?.token ?? Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = auth?.supabase ?? userClient(effectiveToken);
  const server = buildServer({ userId: effectiveUserId, supabase });
  const transport = new StreamableHttpTransport();
  const handleMcpRequest = transport.bind(server);

  // ChatGPT refreshes the action catalog through tools/list and is more reliable
  // when the server returns plain JSON instead of an SSE-wrapped JSON-RPC result.
  const mcpReq = req.method === "POST"
    ? (() => {
      const headers = new Headers(req.headers);
      headers.set("Accept", "application/json");
      return new Request(req, { headers });
    })()
    : req;
  const res = await handleMcpRequest(mcpReq, {
    authInfo: { token: effectiveToken, clientId: effectiveUserId, scopes: [] },
  });
  // Merge CORS headers into response
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
});

Deno.serve(app.fetch);

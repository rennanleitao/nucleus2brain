// MCP Server for Nucleus — exposes notes/tasks/spaces/tags/links/contexts
// as tools via JSON-RPC over Streamable HTTP. Authenticated via OAuth Bearer.
import { Hono } from "npm:hono@4";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@^0.10.0";
import { z } from "npm:zod@3";
import { zodToJsonSchema } from "npm:zod-to-json-schema@3";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, getBaseUrl } from "../_shared/mcp-auth.ts";

const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;

function unauthorized(): Response {
  const resourceMetadata = `${getBaseUrl()}/oauth-metadata?type=resource`;
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadata}"`,
    },
  });
}

async function authenticate(req: Request): Promise<
  { user: { id: string; email?: string }; token: string } | null
> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const anon = createClient(SUPA_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: { id: data.user.id, email: data.user.email ?? undefined }, token };
}

function clientFor(token: string): SupabaseClient {
  return createClient(SUPA_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------- Tool helpers ----------
type Ctx = { userId: string; supabase: SupabaseClient };

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function fail(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
  };
}

// Use Zod schemas for tool inputs; mcp-lite converts to JSON schema.
const buildServer = (ctx: Ctx) => {
  const s = new McpServer({ name: "nucleus-mcp", version: "0.1.0", schemaAdapter: (schema) => zodToJsonSchema(schema as any) });
  const db = ctx.supabase;

  // Temporary isolation for ChatGPT discovery debugging: expose only one
  // minimal tool so we can confirm whether the failure is in handshake/OAuth
  // or in one of the full catalog schemas.
  s.tool("ping", {
    description: "Simple connectivity test",
    inputSchema: z.object({}),
    handler: async () => ({
      content: [
        {
          type: "text" as const,
          text: "pong",
        },
      ],
    }),
  });

  return s;

  // ---------- NOTES ----------
  s.tool("create_note", {
        description: "Create a new note. tags is an array of plain strings.",
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
        content: input.content ?? "",
        space_id: input.space_id ?? null,
        tags: input.tags ?? [],
      }).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("update_note", {
        description: "Update fields of an existing note. Only provided fields change.",
    inputSchema: z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(500).optional(),
      content: z.string().optional(),
      space_id: z.string().uuid().nullable().optional(),
      tags: z.array(z.string()).optional(),
    }),
    handler: async (input) => {
      const patch: Record<string, unknown> = {};
      for (const k of ["title", "content", "space_id", "tags"] as const) {
        if (input[k] !== undefined) patch[k] = input[k];
      }
      const { data, error } = await db.from("notes").update(patch).eq("id", input.id).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("append_to_note", {
        description: "Append text to the end of a note's content (with a newline separator).",
    inputSchema: z.object({
      id: z.string().uuid(),
      content: z.string().min(1),
    }),
    handler: async (input) => {
      const { data: note, error: gErr } = await db.from("notes").select("content").eq("id", input.id).single();
      if (gErr) return fail(gErr.message);
      const merged = `${note.content ?? ""}${note.content ? "\n\n" : ""}${input.content}`;
      const { data, error } = await db.from("notes").update({ content: merged }).eq("id", input.id).select().single();
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
        description: "Get a single note by id.",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { data, error } = await db.from("notes").select("*").eq("id", input.id).single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  // ---------- TASKS ----------
  const taskStatus = z.enum(["todo", "in_progress", "done", "cancelled"]).optional();
  const taskPriority = z.enum(["low", "medium", "high", "urgent"]).optional();

  s.tool("create_task", {
        description: "Create a new task. due_date is an ISO date (YYYY-MM-DD).",
    inputSchema: z.object({
      title: z.string().min(1).max(500),
      description: z.string().optional(),
      due_date: z.string().optional(),
      status: taskStatus,
      priority: taskPriority,
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
        note_id: input.note_id ?? null,
        space_id: input.space_id ?? null,
        tag: input.tag ?? null,
      }).select().single();
      if (error) return fail(error.message);
      return ok(data);
    },
  });

  s.tool("update_task", {
        description: "Update fields of a task. Pass only fields you want to change.",
    inputSchema: z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(500).optional(),
      description: z.string().nullable().optional(),
      due_date: z.string().nullable().optional(),
      status: taskStatus,
      priority: taskPriority,
      note_id: z.string().uuid().nullable().optional(),
      space_id: z.string().uuid().nullable().optional(),
      tag: z.string().nullable().optional(),
      completed_at: z.string().nullable().optional(),
    }),
    handler: async (input) => {
      const patch: Record<string, unknown> = {};
      for (const k of ["title","description","due_date","status","priority","note_id","space_id","tag","completed_at"] as const) {
        if (input[k] !== undefined) patch[k] = input[k];
      }
      if (patch.status === "done" && !("completed_at" in patch)) {
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
        description: "Mark a task as done (sets status='done' and completed_at=now).",
    inputSchema: z.object({ id: z.string().uuid() }),
    handler: async (input) => {
      const { data, error } = await db.from("tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
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

  const auth = await authenticate(req);
  if (!auth) return unauthorized();

  const supabase = clientFor(auth.token);
  const server = buildServer({ userId: auth.user.id, supabase });
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
    authInfo: { token: auth.token, clientId: auth.user.id, scopes: [] },
  });
  // Merge CORS headers into response
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
});

Deno.serve(app.fetch);

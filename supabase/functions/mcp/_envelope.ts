// Envelope helpers for the Nucleus MCP — enterprise-grade response shape.
// All tool handlers go through `defTool(...)` which wraps the handler with:
//   - correlation_id generation
//   - structured logging (tool_name, user_id, ms, success, rows_affected)
//   - try/catch (no raw exceptions ever escape)
//   - envelope normalization (success / partial_success / failed)
//   - readback + ingestion_result for write operations
//   - display_url derivation
//
// Handlers should return one of:
//   - For writes:  { entity: Record, message?: string, changed_fields?: string[],
//                    next_actions?: string[], extras?: Record }
//   - For reads:   { data: any, count?: number, message?: string,
//                    next_actions?: string[], extras?: Record }
//   - For batches: { batch: Array<{ ok: boolean; data?: any; error?: ToolFail }>,
//                    message?: string, next_actions?: string[] }
//   - Or throw a ToolError(code, message, details).

import { z } from "npm:zod@3";

export type EntityType =
  | "note"
  | "task"
  | "space"
  | "tag"
  | "link"
  | "task_material"
  | "subtask"
  | "meeting"
  | "study_area"
  | "study_topic"
  | "study_entry"
  | "study_update"
  | "study_source"
  | "study_book"
  | "search_result"
  | "briefing"
  | "context"
  | "activity"
  | "ai_suggestion"
  | "summary"
  | "generic";

export type Operation =
  | "create"
  | "update"
  | "delete"
  | "list"
  | "get"
  | "search"
  | "compute"
  | "ai";

export interface ToolMeta {
  entity_type: EntityType;
  operation: Operation;
}

export class ToolError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export const ERROR_CODES = {
  invalid_input: "invalid_input",
  not_found: "not_found",
  forbidden: "forbidden",
  db_error: "db_error",
  ai_unavailable: "ai_unavailable",
  unsupported_entity: "unsupported_entity",
  unauthenticated: "unauthenticated",
  internal_error: "internal_error",
} as const;

// Map (entity_type, id) -> in-app display URL.
export function urlFor(entity_type: EntityType, id?: string | null, hint?: Record<string, unknown>): string | null {
  if (!id) return null;
  switch (entity_type) {
    case "note": return `/note/${id}`;
    case "meeting": return `/note/${id}`;
    case "task": return `/tasks/${id}`;
    case "space": return `/spaces/${id}`;
    case "link": return `/links`;
    case "task_material": return hint?.task_id ? `/tasks/${hint.task_id}` : `/tasks`;
    case "subtask": return hint?.task_id ? `/tasks/${hint.task_id}` : `/tasks`;
    case "study_area": return `/estudos/area/${id}`;
    case "study_topic": return `/estudos/topic/${id}`;
    case "study_entry":
    case "study_update":
    case "study_source":
    case "study_book":
      return hint?.topic_id ? `/estudos/topic/${hint.topic_id}` : `/estudos`;
    case "tag": return `/tags`;
    default: return null;
  }
}

function pickTitle(entity: any): string | null {
  if (!entity || typeof entity !== "object") return null;
  return entity.title ?? entity.name ?? entity.heading ?? null;
}

function ingestionFor(entity_type: EntityType, operation: Operation, entity: any) {
  const indexable = ["note", "task", "space", "study_topic", "study_entry", "study_update", "study_source", "study_book", "study_area", "link", "task_material", "subtask", "meeting"];
  const isIndexed = indexable.includes(entity_type) && operation !== "delete";
  const title = pickTitle(entity);
  return {
    status: "success" as const,
    summary: operation === "delete"
      ? `${entity_type} removido do índice e não retornará em buscas futuras.`
      : `${entity_type}${title ? ` "${title}"` : ""} indexado e disponível para buscas e recuperação.`,
    indexed: isIndexed,
    searchable: isIndexed,
  };
}

function defaultNextActions(meta: ToolMeta, entityId?: string | null): string[] {
  switch (meta.operation) {
    case "create":
      return entityId
        ? ["show_entity", "refresh_list", "search_related_content"]
        : ["refresh_list"];
    case "update":
      return ["show_entity", "refresh_list"];
    case "delete":
      return ["refresh_list"];
    case "list":
      return ["refresh_list", "search_related_content"];
    case "get":
      return ["show_entity", "search_related_content", "create_follow_up_task"];
    case "search":
      return ["refresh_list"];
    case "compute":
    case "ai":
      return ["show_entity"];
    default:
      return [];
  }
}

export type SuccessReturn = {
  entity?: any;
  data?: any;
  count?: number;
  message?: string;
  changed_fields?: string[];
  next_actions?: string[];
  extras?: Record<string, unknown>;
  url_hint?: Record<string, unknown>;
  status_override?: "partial_success";
  ingestion_override?: Record<string, unknown>;
  batch?: { items: Array<{ status: "success" | "failed"; data?: any; error?: { error_code: string; message: string } }>; success_count: number; failed_count: number };
};

export interface DefToolDeps {
  name: string;
  meta: ToolMeta;
  description: string;
  inputSchema: z.ZodTypeAny;
  userId: string;
  handler: (input: any) => Promise<SuccessReturn>;
  rowCount?: (ret: SuccessReturn) => number | undefined;
}

export interface DefinedTool {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (input: any) => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }>;
}

export function defTool(deps: DefToolDeps): DefinedTool {
  const { name, meta, description, inputSchema, userId, handler } = deps;

  const wrapped = async (input: any) => {
    const correlation_id = crypto.randomUUID();
    const started = Date.now();
    let success = false;
    let rows_affected = 0;
    let payloadText = "";

    try {
      const ret = await handler(input);
      success = true;
      rows_affected = deps.rowCount
        ? deps.rowCount(ret) ?? 0
        : computeRowCount(ret);

      const envelope = buildSuccessEnvelope(meta, ret, correlation_id);
      payloadText = JSON.stringify(envelope, null, 2);
      return { content: [{ type: "text" as const, text: payloadText }] };
    } catch (e: any) {
      success = false;
      const code = e instanceof ToolError ? e.code : ERROR_CODES.internal_error;
      const message = e?.message ? String(e.message) : "Unexpected error";
      const details = e instanceof ToolError ? e.details : undefined;

      const envelope = {
        status: "failed" as const,
        error_code: code,
        message,
        details: details ?? null,
        entity_type: meta.entity_type,
        correlation_id,
        next_actions: ["retry", "refresh_list"],
      };
      payloadText = JSON.stringify(envelope, null, 2);
      return { content: [{ type: "text" as const, text: payloadText }], isError: true };
    } finally {
      try {
        console.info(JSON.stringify({
          ts: new Date().toISOString(),
          mcp_log: true,
          tool_name: name,
          user_id: userId,
          execution_time_ms: Date.now() - started,
          success,
          rows_affected,
          correlation_id,
        }));
      } catch {
        /* logging must never break the response */
      }
    }
  };

  return { name, description, inputSchema, handler: wrapped };
}

function computeRowCount(ret: SuccessReturn): number {
  if (ret.batch) return ret.batch.items.length;
  if (Array.isArray(ret.data)) return ret.data.length;
  if (typeof ret.count === "number") return ret.count;
  if (ret.entity) return 1;
  return 0;
}

function buildSuccessEnvelope(meta: ToolMeta, ret: SuccessReturn, correlation_id: string) {
  const next_actions = ret.next_actions ?? defaultNextActions(meta);
  const status = ret.status_override ?? "success";

  // Batch operation envelope.
  if (ret.batch) {
    return {
      status,
      message: ret.message ?? `${ret.batch.success_count} sucesso(s), ${ret.batch.failed_count} falha(s).`,
      entity_type: meta.entity_type,
      operation: meta.operation,
      success_count: ret.batch.success_count,
      failed_count: ret.batch.failed_count,
      items: ret.batch.items,
      next_actions,
      correlation_id,
      ...(ret.extras ?? {}),
    };
  }

  // Write operations: entity-shaped envelope with readback + ingestion_result.
  if (ret.entity || meta.operation === "create" || meta.operation === "update" || meta.operation === "delete") {
    const entity = ret.entity ?? null;
    const entity_id = entity?.id ?? entity?.entity_id ?? null;
    const title = pickTitle(entity);
    const display_url = urlFor(meta.entity_type, entity_id, ret.url_hint);
    return {
      status,
      message: ret.message ?? defaultMessage(meta, entity, title),
      entity_type: meta.entity_type,
      operation: meta.operation,
      entity_id,
      title,
      changed_fields: ret.changed_fields ?? null,
      display_url,
      data: entity,
      ingestion_result: ret.ingestion_override ?? ingestionFor(meta.entity_type, meta.operation, entity),
      next_actions,
      correlation_id,
      ...(ret.extras ?? {}),
    };
  }

  // Read operations: list/search/get/compute envelope.
  const data = ret.data;
  const count = typeof ret.count === "number"
    ? ret.count
    : Array.isArray(data) ? data.length : (data ? 1 : 0);

  // For single-get reads, expose entity_id/title/display_url too when possible.
  const single = !Array.isArray(data) && data && typeof data === "object" ? data : null;
  const entity_id = single?.id ?? null;
  const title = pickTitle(single);
  const display_url = urlFor(meta.entity_type, entity_id, ret.url_hint);

  return {
    status,
    message: ret.message ?? defaultReadMessage(meta, count),
    entity_type: meta.entity_type,
    operation: meta.operation,
    count,
    ...(entity_id ? { entity_id, title, display_url } : {}),
    data,
    next_actions,
    correlation_id,
    ...(ret.extras ?? {}),
  };
}

function defaultMessage(meta: ToolMeta, entity: any, title: string | null): string {
  const t = title ? ` "${title}"` : "";
  switch (meta.operation) {
    case "create": return `${meta.entity_type}${t} criado com sucesso.`;
    case "update": return `${meta.entity_type}${t} atualizado.`;
    case "delete": return `${meta.entity_type}${entity?.id ? ` ${entity.id}` : ""} removido.`;
    default: return `Operação concluída.`;
  }
}

function defaultReadMessage(meta: ToolMeta, count: number): string {
  switch (meta.operation) {
    case "list":   return `${count} ${meta.entity_type}(s) listado(s).`;
    case "search": return `${count} resultado(s) encontrado(s).`;
    case "get":    return count ? `${meta.entity_type} recuperado.` : `Nenhum ${meta.entity_type} encontrado.`;
    case "compute":return `Cálculo concluído.`;
    case "ai":     return `Resposta gerada pela IA.`;
    default:       return `OK.`;
  }
}

// Helper that takes a Supabase response { data, error } and either throws
// a ToolError or returns the data.
export function unwrap<T>(res: { data: T | null; error: any }, opts?: { notFoundMessage?: string }): T {
  if (res.error) {
    const msg = res.error.message ?? String(res.error);
    if (res.error.code === "PGRST116") {
      throw new ToolError(ERROR_CODES.not_found, opts?.notFoundMessage ?? "Registro não encontrado.", { pg: res.error });
    }
    throw new ToolError(ERROR_CODES.db_error, msg, { pg: res.error });
  }
  if (res.data === null || res.data === undefined) {
    throw new ToolError(ERROR_CODES.not_found, opts?.notFoundMessage ?? "Registro não encontrado.");
  }
  return res.data;
}

export function unwrapList<T>(res: { data: T[] | null; error: any }): T[] {
  if (res.error) {
    throw new ToolError(ERROR_CODES.db_error, res.error.message ?? String(res.error), { pg: res.error });
  }
  return res.data ?? [];
}

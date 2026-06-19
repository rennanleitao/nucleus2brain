// Lightweight Lovable AI Gateway helper for edge functions.
// Uses the OpenAI-compatible Chat Completions endpoint and supports an
// optional response JSON schema via tool calling.

const BASE_URL = "https://ai.gateway.lovable.dev/v1";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

export class LovableAIError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, msg: string) {
    super(msg);
    this.status = status;
    this.body = body;
  }
}

export interface LovableAICallOpts {
  system?: string;
  model?: string;
  schema?: { name: string; description?: string; parameters: Record<string, unknown> };
  temperature?: number;
  max_tokens?: number;
}

/**
 * Returns either a string (no schema) or a parsed object (with schema).
 */
export async function callLovableAI(
  prompt: string,
  opts: LovableAICallOpts = {},
): Promise<string | Record<string, unknown>> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    throw new LovableAIError(500, null, "LOVABLE_API_KEY missing");
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: prompt });

  const body: Record<string, unknown> = {
    model: opts.model ?? DEFAULT_MODEL,
    messages,
    temperature: opts.temperature ?? 0.2,
  };
  if (opts.max_tokens) body.max_tokens = opts.max_tokens;

  if (opts.schema) {
    body.tools = [{
      type: "function",
      function: {
        name: opts.schema.name,
        description: opts.schema.description ?? "",
        parameters: opts.schema.parameters,
      },
    }];
    body.tool_choice = { type: "function", function: { name: opts.schema.name } };
  }

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "edge-direct",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let errBody: unknown = null;
    try { errBody = await res.json(); } catch { errBody = await res.text().catch(() => null); }
    throw new LovableAIError(res.status, errBody, `Lovable AI HTTP ${res.status}`);
  }

  const json = await res.json();
  const choice = json?.choices?.[0];
  if (!choice) throw new LovableAIError(500, json, "No choices in AI response");

  if (opts.schema) {
    const tc = choice.message?.tool_calls?.[0];
    if (!tc?.function?.arguments) {
      throw new LovableAIError(500, json, "No tool_calls in AI response");
    }
    try {
      return JSON.parse(tc.function.arguments);
    } catch {
      throw new LovableAIError(500, json, "Invalid JSON in tool_calls.arguments");
    }
  }

  return choice.message?.content ?? "";
}

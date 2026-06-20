// Integration test for the Nucleus MCP edge function.
// Validates the live /functions/v1/mcp endpoint:
//   1. Returns 401 + WWW-Authenticate when called without a Bearer token.
//   2. Responds to JSON-RPC `initialize` handshake.
//   3. `tools/list` returns a valid catalog containing only the temporary
//      minimal `ping` tool while ChatGPT discovery is being isolated.
//
// Auth: signs in via Supabase password grant using TEST_USER_EMAIL /
// TEST_USER_PASSWORD from the .env file. If those are absent, the
// authenticated portion is skipped (the unauth check still runs).
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const MCP_URL = `${SUPABASE_URL}/functions/v1/mcp`;

// Tools that must always be present in the production catalog.
const REQUIRED_TOOLS = [
  "ping",
  "search","fetch",
  "search_everything","get_recent_activity","get_daily_briefing",
  "find_related_content","extract_action_items","summarize_space",
  "get_context_for_chat",
  "add_event_entry","add_knowledge_entry","add_book_summary","search_study_content",
];

function jsonRpc(id: number, method: string, params: unknown = {}) {
  return JSON.stringify({ jsonrpc: "2.0", id, method, params });
}

async function mcpFetch(body: string, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(MCP_URL, { method: "POST", headers, body });
  const text = await res.text();
  return { res, text };
}

async function signIn(): Promise<string | null> {
  const email = Deno.env.get("TEST_USER_EMAIL");
  const password = Deno.env.get("TEST_USER_PASSWORD");
  if (!email || !password) return null;
  const r = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    },
  );
  const json = await r.json();
  if (!r.ok) throw new Error(`sign-in failed: ${JSON.stringify(json)}`);
  return json.access_token as string;
}

Deno.test("MCP: unauthenticated request returns 401 with WWW-Authenticate", async () => {
  const { res, text } = await mcpFetch(jsonRpc(1, "initialize"));
  assertEquals(res.status, 401);
  const www = res.headers.get("www-authenticate") ?? "";
  assert(www.startsWith("Bearer"), `expected Bearer challenge, got: ${www}`);
  assert(www.includes("resource_metadata="), "missing resource_metadata hint");
  // body must be valid JSON
  JSON.parse(text);
});

Deno.test("MCP: initialize + tools/list returns only the temporary ping tool", async () => {
  const token = await signIn();
  if (!token) {
    console.warn(
      "Skipping authenticated MCP checks: set TEST_USER_EMAIL/TEST_USER_PASSWORD in .env",
    );
    return;
  }

  // initialize handshake
  {
    const { res, text } = await mcpFetch(
      jsonRpc(1, "initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "nucleus-mcp-test", version: "1.0.0" },
      }),
      token,
    );
    assertEquals(res.status, 200, `initialize HTTP ${res.status}: ${text}`);
    const json = JSON.parse(text);
    assertEquals(json.jsonrpc, "2.0");
    assertExists(json.result, "initialize must return a result");
    assertExists(json.result.capabilities?.tools, "server must advertise tools");
    assertEquals(json.result.serverInfo?.name, "nucleus-mcp");
  }

  // tools/list
  const { res, text } = await mcpFetch(jsonRpc(2, "tools/list"), token);
  assertEquals(res.status, 200, `tools/list HTTP ${res.status}: ${text}`);
  const json = JSON.parse(text);
  assertEquals(json.jsonrpc, "2.0");
  assertExists(json.result?.tools, "tools/list must return result.tools");
  const tools = json.result.tools as Array<{
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  }>;
  assert(Array.isArray(tools), "tools must be an array");

  // Every tool: name, description, inputSchema (object JSON Schema)
  const seen = new Set<string>();
  for (const t of tools) {
    assert(typeof t.name === "string" && t.name.length > 0, `tool missing name: ${JSON.stringify(t)}`);
    assert(!seen.has(t.name), `duplicate tool name: ${t.name}`);
    seen.add(t.name);
    assert(
      typeof t.description === "string" && t.description.length > 0,
      `tool ${t.name} missing description`,
    );
    assertExists(t.inputSchema, `tool ${t.name} missing inputSchema`);
    assertEquals(
      (t.inputSchema as { type?: string }).type,
      "object",
      `tool ${t.name} inputSchema.type must be 'object'`,
    );
    const props = (t.inputSchema as { properties?: unknown }).properties;
    assert(
      props === undefined || (typeof props === "object" && props !== null),
      `tool ${t.name} inputSchema.properties must be an object when present`,
    );
  }

  assertEquals([...seen].sort(), TEMPORARY_TOOLS, `unexpected tools payload: ${text}`);

  const ping = tools.find((t) => t.name === "ping");
  assertExists(ping, `ping tool missing from tools/list: ${text}`);
  assertEquals(ping.description, "Simple connectivity test");
});

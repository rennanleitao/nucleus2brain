// Manual validation for study topic repository MCP tools.
//
// Required env:
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_PUBLISHABLE_KEY
//   TEST_USER_EMAIL
//   TEST_USER_PASSWORD
//   TEST_STUDY_TOPIC_ID
//
// Run:
//   deno run --allow-env --allow-net --allow-read supabase/functions/mcp/validate-study-repository-items.ts
//
// Optional:
//   KEEP_TEST_ITEM=true keeps the created repository item instead of deleting it.
import "https://deno.land/std@0.224.0/dotenv/load.ts";

const SUPABASE_URL = requiredEnv("VITE_SUPABASE_URL");
const ANON_KEY = requiredEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
const TOPIC_ID = requiredEnv("TEST_STUDY_TOPIC_ID");
const MCP_URL = `${SUPABASE_URL}/functions/v1/mcp`;

const REQUIRED_EXISTING_TOOLS = [
  "list_study_areas",
  "list_study_topics",
  "get_study_topic",
  "add_study_entry",
  "search_study_entries",
  "create_note",
  "search_notes",
];

const REQUIRED_REPOSITORY_TOOLS = [
  "create_study_repository_item",
  "list_study_repository_items",
  "get_study_repository_item",
  "update_study_repository_item",
  "delete_study_repository_item",
];

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function jsonRpc(id: number, method: string, params: unknown = {}) {
  return JSON.stringify({ jsonrpc: "2.0", id, method, params });
}

async function signIn(): Promise<string> {
  const email = requiredEnv("TEST_USER_EMAIL");
  const password = requiredEnv("TEST_USER_PASSWORD");
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`sign-in failed: ${JSON.stringify(json)}`);
  return json.access_token as string;
}

async function mcp(token: string, method: string, params: unknown = {}) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: jsonRpc(Date.now(), method, params),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} HTTP ${res.status}: ${text}`);
  const json = JSON.parse(text);
  if (json.error) throw new Error(`${method} JSON-RPC error: ${JSON.stringify(json.error)}`);
  return json.result;
}

async function callTool(token: string, name: string, args: Record<string, unknown>) {
  const result = await mcp(token, "tools/call", { name, arguments: args });
  const text = result?.content?.[0]?.text;
  if (!text) throw new Error(`${name} returned no text content`);
  const envelope = JSON.parse(text);
  if (envelope.status === "failed") throw new Error(`${name} failed: ${JSON.stringify(envelope)}`);
  return envelope;
}

const token = await signIn();

await mcp(token, "initialize", {
  protocolVersion: "2025-03-26",
  capabilities: {},
  clientInfo: { name: "nucleus-repository-validator", version: "1.0.0" },
});

const listResult = await mcp(token, "tools/list");
const toolNames = new Set((listResult.tools ?? []).map((tool: { name: string }) => tool.name));
for (const name of [...REQUIRED_EXISTING_TOOLS, ...REQUIRED_REPOSITORY_TOOLS]) {
  if (!toolNames.has(name)) throw new Error(`Missing MCP tool: ${name}`);
}

const stamp = new Date().toISOString();
const created = await callTool(token, "create_study_repository_item", {
  topic_id: TOPIC_ID,
  title: `MCP repository validation ${stamp}`,
  content: "Item temporario criado pelo validador MCP para confirmar exibicao na aba Repositorio.",
  source_url: "https://example.com/nucleus-mcp-repository-validation",
  tags: ["mcp-validation"],
  content_type: "reference",
});
const createdId = created.entity_id ?? created.data?.id;
if (!createdId) throw new Error(`create_study_repository_item did not return an id: ${JSON.stringify(created)}`);

const listed = await callTool(token, "list_study_repository_items", {
  topic_id: TOPIC_ID,
  query: "MCP repository validation",
  limit: 10,
});
const found = (listed.data ?? []).some((item: { id: string; kind: string; topic_id: string }) =>
  item.id === createdId && item.topic_id === TOPIC_ID && item.kind === "knowledge"
);
if (!found) throw new Error(`Created repository item ${createdId} was not found in list_study_repository_items`);

await callTool(token, "get_study_repository_item", { topic_id: TOPIC_ID, id: createdId });
await callTool(token, "update_study_repository_item", {
  topic_id: TOPIC_ID,
  id: createdId,
  summary: "Resumo atualizado pelo validador MCP.",
  tags: ["mcp-validation", "updated"],
});

if (Deno.env.get("KEEP_TEST_ITEM") === "true") {
  console.log(JSON.stringify({ ok: true, created_repository_item_id: createdId, kept: true }, null, 2));
} else {
  await callTool(token, "delete_study_repository_item", { topic_id: TOPIC_ID, id: createdId });
  console.log(JSON.stringify({ ok: true, created_repository_item_id: createdId, deleted_after_validation: true }, null, 2));
}

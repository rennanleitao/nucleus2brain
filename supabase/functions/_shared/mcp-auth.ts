// Shared helpers for MCP OAuth flow.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface McpAuthenticatedContext {
  kind: "supabase_user" | "internal_agent";
  user: { id: string; email?: string };
  token: string;
  supabase: SupabaseClient;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  "Access-Control-Expose-Headers": "mcp-session-id, www-authenticate",
};

export function getBaseUrl(): string {
  // Public functions URL, e.g. https://<ref>.supabase.co/functions/v1
  const url = Deno.env.get("SUPABASE_URL")!;
  return `${url}/functions/v1`;
}

export function unauthorized(): Response {
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

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function userClient(accessToken: string): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

function bearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

function isInternalAgentToken(token: string): boolean {
  const apiKey = Deno.env.get("NUCLEUS_API_KEY")?.trim();
  return Boolean(apiKey) && token === apiKey;
}

export async function authenticateMcpRequest(req: Request): Promise<McpAuthenticatedContext | null> {
  const token = bearerToken(req);
  if (!token) return null;

  if (isInternalAgentToken(token)) {
    return {
      kind: "internal_agent",
      user: {
        id: "00000000-0000-0000-0000-000000000000",
        email: "hermes@nucleus.internal",
      },
      token,
      supabase: serviceClient(),
    };
  }

  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) return null;

  return {
    kind: "supabase_user",
    user: { id: data.user.id, email: data.user.email ?? undefined },
    token,
    supabase: userClient(token),
  };
}

export async function randomToken(bytes = 32): Promise<string> {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64url(buf);
}

export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64url(new Uint8Array(hash));
}

export function base64url(buf: Uint8Array): string {
  let s = btoa(String.fromCharCode(...buf));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function json(body: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

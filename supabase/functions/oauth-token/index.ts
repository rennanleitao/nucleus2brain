// OAuth 2.0 Token endpoint.
// Supports grant_type=authorization_code (with PKCE) and refresh_token.
import {
  base64url,
  corsHeaders,
  json,
  randomToken,
  serviceClient,
  sha256,
} from "../_shared/mcp-auth.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

async function verifyPkce(verifier: string, challenge: string): Promise<boolean> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64url(new Uint8Array(hash)) === challenge;
}

async function parseBody(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    return Object.fromEntries(new URLSearchParams(text));
  }
  if (ct.includes("application/json")) {
    const obj = await req.json();
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  }
  // Try form-data fallback
  const form = await req.formData().catch(() => null);
  if (form) {
    const out: Record<string, string> = {};
    for (const [k, v] of form.entries()) out[k] = String(v);
    return out;
  }
  return {};
}

// Keep ChatGPT/Nucleus OAuth sessions long-lived while access tokens stay short-lived.
const REFRESH_TTL_DAYS = 365;
const ACCESS_TTL_SECONDS = 3600;

async function issueTokens(opts: {
  userId: string;
  clientId: string;
  scope: string;
  accessToken: string;
  supabaseRefreshToken: string;
  expiresIn?: number;
}): Promise<Response> {
  const opaque = await randomToken(32);
  const tokenHash = await sha256(opaque);

  const svc = serviceClient();
  const { error } = await svc.from("oauth_refresh_tokens").insert({
    token_hash: tokenHash,
    user_id: opts.userId,
    client_id: opts.clientId,
    scope: opts.scope,
    supabase_refresh_token: opts.supabaseRefreshToken,
    expires_at: new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000).toISOString(),
  });
  if (error) {
    console.error("oauth-token issueTokens insert error", error);
    return json({ error: "server_error" }, 500);
  }

  return json({
    access_token: opts.accessToken,
    token_type: "Bearer",
    expires_in: opts.expiresIn ?? ACCESS_TTL_SECONDS,
    refresh_token: opaque,
    scope: opts.scope,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const body = await parseBody(req);
  const grantType = body.grant_type ?? "";
  const clientId = body.client_id ?? "";
  const svc = serviceClient();

  if (!clientId) {
    return json({ error: "invalid_request", error_description: "client_id is required" }, 400);
  }

  // Optional client_secret validation
  const { data: clientRow, error: clientErr } = await svc
    .from("oauth_clients")
    .select("client_secret_hash, token_endpoint_auth_method")
    .eq("client_id", clientId)
    .maybeSingle();
  if (clientErr || !clientRow) {
    return json({ error: "invalid_client" }, 401);
  }
  if (clientRow.token_endpoint_auth_method !== "none") {
    const secret = body.client_secret ?? "";
    if (!secret || (await sha256(secret)) !== clientRow.client_secret_hash) {
      return json({ error: "invalid_client" }, 401);
    }
  }

  if (grantType === "authorization_code") {
    const code = body.code ?? "";
    const redirectUri = body.redirect_uri ?? "";
    const codeVerifier = body.code_verifier ?? "";
    if (!code || !redirectUri || !codeVerifier) {
      return json({ error: "invalid_request" }, 400);
    }

    const { data: codeRow } = await svc
      .from("oauth_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (!codeRow) return json({ error: "invalid_grant" }, 400);
    if (codeRow.used_at) return json({ error: "invalid_grant", error_description: "Code already used" }, 400);
    if (new Date(codeRow.expires_at).getTime() < Date.now()) {
      return json({ error: "invalid_grant", error_description: "Code expired" }, 400);
    }
    if (codeRow.client_id !== clientId) return json({ error: "invalid_grant" }, 400);
    if (codeRow.redirect_uri !== redirectUri) return json({ error: "invalid_grant" }, 400);
    if (!(await verifyPkce(codeVerifier, codeRow.code_challenge))) {
      return json({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);
    }

    await svc.from("oauth_codes").update({ used_at: new Date().toISOString() }).eq("code", code);

    // Use the stored supabase refresh token to mint a fresh access token.
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: refreshed, error: refreshErr } = await anon.auth.refreshSession({
      refresh_token: codeRow.supabase_refresh_token,
    });
    if (refreshErr || !refreshed.session) {
      console.error("oauth-token refresh after code error", refreshErr);
      return json({ error: "invalid_grant" }, 400);
    }

    return issueTokens({
      userId: codeRow.user_id,
      clientId,
      scope: codeRow.scope,
      accessToken: refreshed.session.access_token,
      supabaseRefreshToken: refreshed.session.refresh_token,
      expiresIn: refreshed.session.expires_in ?? ACCESS_TTL_SECONDS,
    });
  }

  if (grantType === "refresh_token") {
    const refreshToken = body.refresh_token ?? "";
    if (!refreshToken) return json({ error: "invalid_request" }, 400);

    const tokenHash = await sha256(refreshToken);
    const { data: row } = await svc
      .from("oauth_refresh_tokens")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (!row) return json({ error: "invalid_grant" }, 400);
    if (row.revoked_at) return json({ error: "invalid_grant", error_description: "Token revoked" }, 400);
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return json({ error: "invalid_grant", error_description: "Token expired" }, 400);
    }
    if (row.client_id !== clientId) return json({ error: "invalid_grant" }, 400);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: refreshed, error: refreshErr } = await anon.auth.refreshSession({
      refresh_token: row.supabase_refresh_token,
    });
    if (refreshErr || !refreshed.session) {
      await svc
        .from("oauth_refresh_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", row.id);
      return json({ error: "invalid_grant" }, 400);
    }

    // Rotate: revoke old, issue new
    await svc
      .from("oauth_refresh_tokens")
      .update({ revoked_at: new Date().toISOString(), last_used_at: new Date().toISOString() })
      .eq("id", row.id);

    return issueTokens({
      userId: row.user_id,
      clientId,
      scope: row.scope,
      accessToken: refreshed.session.access_token,
      supabaseRefreshToken: refreshed.session.refresh_token,
      expiresIn: refreshed.session.expires_in ?? ACCESS_TTL_SECONDS,
    });
  }

  return json({ error: "unsupported_grant_type" }, 400);
});

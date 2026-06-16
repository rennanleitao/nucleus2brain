// OAuth 2.0 Authorization endpoint with PKCE (RFC 7636).
//
// Supabase Edge Functions strip/sandbox HTML responses (force text/plain + CSP
// sandbox + nosniff), so we cannot render the consent page from the edge
// function. Instead:
//   GET  -> 302 redirect to the React app at /oauth/authorize?<params>
//   POST -> JSON API: { access_token, ...authParams } -> { redirect_url }
//          (the React page handles login + consent, then POSTs here)
import { corsHeaders, randomToken, serviceClient } from "../_shared/mcp-auth.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

interface AuthParams {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  code_challenge: string;
  code_challenge_method: string;
  state: string;
  scope: string;
}

const APP_URL =
  Deno.env.get("APP_URL") ?? "https://nucleus2brain.lovable.app";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function paramsFromUrl(url: URL): AuthParams {
  return {
    client_id: url.searchParams.get("client_id") ?? "",
    redirect_uri: url.searchParams.get("redirect_uri") ?? "",
    response_type: url.searchParams.get("response_type") ?? "code",
    code_challenge: url.searchParams.get("code_challenge") ?? "",
    code_challenge_method: url.searchParams.get("code_challenge_method") ?? "S256",
    state: url.searchParams.get("state") ?? "",
    scope: url.searchParams.get("scope") ?? "notes:rw tasks:rw spaces:rw",
  };
}

async function validateClient(p: AuthParams): Promise<string | null> {
  if (!p.client_id) return "client_id is required";
  if (!p.redirect_uri) return "redirect_uri is required";
  if (p.response_type !== "code") return "response_type must be 'code'";
  if (!p.code_challenge) return "code_challenge is required (PKCE)";
  if (p.code_challenge_method !== "S256") return "code_challenge_method must be S256";

  const svc = serviceClient();
  const { data, error } = await svc
    .from("oauth_clients")
    .select("redirect_uris")
    .eq("client_id", p.client_id)
    .maybeSingle();
  if (error || !data) return "Unknown client_id";
  if (!data.redirect_uris.includes(p.redirect_uri)) {
    return "redirect_uri not registered for this client";
  }
  return null;
}

function buildRedirectUrl(p: AuthParams, code: string): string {
  const target = new URL(p.redirect_uri);
  target.searchParams.set("code", code);
  if (p.state) target.searchParams.set("state", p.state);
  return target.toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);

  // GET: bounce browser to the React consent page in the app.
  if (req.method === "GET") {
    const target = new URL("/oauth/authorize", APP_URL);
    url.searchParams.forEach((v, k) => target.searchParams.set(k, v));
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: target.toString() },
    });
  }

  // POST: consume access_token + auth params, mint authorization code.
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_request", error_description: "Body must be JSON" }, 400);
  }

  const accessToken = String(body.access_token ?? "");
  const refreshToken = String(body.refresh_token ?? "");
  const p: AuthParams = {
    client_id: String(body.client_id ?? ""),
    redirect_uri: String(body.redirect_uri ?? ""),
    response_type: String(body.response_type ?? "code"),
    code_challenge: String(body.code_challenge ?? ""),
    code_challenge_method: String(body.code_challenge_method ?? "S256"),
    state: String(body.state ?? ""),
    scope: String(body.scope ?? "notes:rw tasks:rw spaces:rw"),
  };

  if (!accessToken) {
    return json({ error: "invalid_request", error_description: "access_token required" }, 400);
  }
  if (!refreshToken) {
    return json({ error: "invalid_request", error_description: "refresh_token required" }, 400);
  }

  const validationErr = await validateClient(p);
  if (validationErr) return json({ error: "invalid_request", error_description: validationErr }, 400);

  // Verify the access token corresponds to a real user.
  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: userRes, error: userErr } = await anon.auth.getUser(accessToken);
  if (userErr || !userRes.user) {
    return json({ error: "invalid_grant", error_description: "Invalid session" }, 401);
  }

  const code = await randomToken(32);
  const svc = serviceClient();
  const { error: insErr } = await svc.from("oauth_codes").insert({
    code,
    client_id: p.client_id,
    user_id: userRes.user.id,
    redirect_uri: p.redirect_uri,
    code_challenge: p.code_challenge,
    code_challenge_method: p.code_challenge_method,
    scope: p.scope,
    supabase_refresh_token: refreshToken,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  });
  if (insErr) {
    console.error("oauth-authorize insert code error", insErr);
    return json({ error: "server_error", error_description: "Failed to issue code" }, 500);
  }

  return json({ redirect_url: buildRedirectUrl(p, code) });
});

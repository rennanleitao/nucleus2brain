// OAuth 2.0 Authorization endpoint with PKCE (RFC 7636).
// Renders a minimal HTML consent screen, authenticates the user via
// Supabase email/password, then redirects to the client with an auth code.
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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
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
  if (!data.redirect_uris.includes(p.redirect_uri)) return "redirect_uri not registered for this client";
  return null;
}

function renderPage(p: AuthParams, errorMsg?: string): Response {
  const fields = Object.entries(p)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${escapeHtml(v)}"/>`)
    .join("");
  const err = errorMsg
    ? `<div class="err">${escapeHtml(errorMsg)}</div>`
    : "";
  const html = `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Autorizar Nucleus</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,system-ui,sans-serif;background:#fafbfc;color:#0f172a;
       display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
  .card{background:#fff;border:1px solid #e8ecf1;border-radius:12px;padding:32px;max-width:420px;width:100%;
        box-shadow:0 8px 24px -8px rgba(15,23,42,.08)}
  h1{margin:0 0 4px;font-size:22px;font-weight:600;letter-spacing:-.01em}
  p{margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.5}
  label{display:block;font-size:13px;font-weight:500;margin:14px 0 6px;color:#334155}
  input[type=email],input[type=password]{width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;
        font-size:14px;font-family:inherit;background:#fff}
  input:focus{outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.15)}
  button{margin-top:20px;width:100%;padding:11px;background:#0f172a;color:#fff;border:0;border-radius:8px;
         font-size:14px;font-weight:600;cursor:pointer}
  button:hover{background:#1e293b}
  .scope{background:#f1f5f9;border-radius:8px;padding:12px;margin:16px 0;font-size:13px;color:#475569}
  .scope strong{color:#0f172a}
  .err{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:12px}
  .foot{margin-top:18px;font-size:12px;color:#94a3b8;text-align:center}
</style></head><body>
<form class="card" method="POST" action="">
  <h1>Autorizar acesso</h1>
  <p>O ChatGPT está pedindo permissão para acessar seu Nucleus.</p>
  <div class="scope">
    <strong>Permissões solicitadas:</strong><br/>
    Ler e escrever suas notas, tarefas e spaces.
  </div>
  ${err}
  <label>Email</label>
  <input type="email" name="email" required autocomplete="email"/>
  <label>Senha</label>
  <input type="password" name="password" required autocomplete="current-password"/>
  ${fields}
  <button type="submit">Entrar e autorizar</button>
  <div class="foot">Use a mesma conta do Nucleus.</div>
</form>
</body></html>`;
  return new Response(html, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

function buildRedirect(p: AuthParams, params: Record<string, string>): Response {
  const target = new URL(p.redirect_uri);
  for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
  if (p.state) target.searchParams.set("state", p.state);
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: target.toString() },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);

  if (req.method === "GET") {
    const p = paramsFromUrl(url);
    const err = await validateClient(p);
    if (err) {
      return new Response(`<h1>Erro</h1><p>${escapeHtml(err)}</p>`, {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return renderPage(p);
  }

  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: corsHeaders });
  }

  const form = await req.formData();
  const p: AuthParams = {
    client_id: String(form.get("client_id") ?? ""),
    redirect_uri: String(form.get("redirect_uri") ?? ""),
    response_type: String(form.get("response_type") ?? "code"),
    code_challenge: String(form.get("code_challenge") ?? ""),
    code_challenge_method: String(form.get("code_challenge_method") ?? "S256"),
    state: String(form.get("state") ?? ""),
    scope: String(form.get("scope") ?? "notes:rw tasks:rw spaces:rw"),
  };
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");

  const validationErr = await validateClient(p);
  if (validationErr) return renderPage(p, validationErr);

  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    return renderPage(p, "Email ou senha inválidos.");
  }

  const code = await randomToken(32);
  const svc = serviceClient();
  const { error: insErr } = await svc.from("oauth_codes").insert({
    code,
    client_id: p.client_id,
    user_id: data.user.id,
    redirect_uri: p.redirect_uri,
    code_challenge: p.code_challenge,
    code_challenge_method: p.code_challenge_method,
    scope: p.scope,
    supabase_refresh_token: data.session.refresh_token,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  });
  if (insErr) {
    console.error("oauth-authorize insert code error", insErr);
    return renderPage(p, "Erro interno. Tente novamente.");
  }

  return buildRedirect(p, { code });
});

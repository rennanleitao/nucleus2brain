// RFC 7591 - OAuth 2.0 Dynamic Client Registration.
import { corsHeaders, json, randomToken, serviceClient, sha256 } from "../_shared/mcp-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_request", error_description: "Invalid JSON body" }, 400);
  }

  const rawRedirectUris = body.redirect_uris;
  const redirect_uris = Array.isArray(rawRedirectUris)
    ? rawRedirectUris.filter((u): u is string => typeof u === "string")
    : [];
  if (redirect_uris.length === 0) {
    return json(
      { error: "invalid_redirect_uri", error_description: "redirect_uris is required" },
      400,
    );
  }
  for (const uri of redirect_uris) {
    try {
      const u = new URL(uri);
      if (u.protocol !== "https:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") {
        return json({ error: "invalid_redirect_uri", error_description: `${uri} must be https` }, 400);
      }
    } catch {
      return json({ error: "invalid_redirect_uri", error_description: `${uri} is invalid` }, 400);
    }
  }

  const client_name = typeof body.client_name === "string" ? body.client_name : "ChatGPT Connector";
  const token_endpoint_auth_method =
    typeof body.token_endpoint_auth_method === "string" ? body.token_endpoint_auth_method : "none";
  const scope = "notes:rw tasks:rw spaces:rw";

  const client_id = `nuc_${await randomToken(16)}`;
  let client_secret: string | undefined;
  let client_secret_hash: string | undefined;
  if (token_endpoint_auth_method !== "none") {
    client_secret = await randomToken(32);
    client_secret_hash = await sha256(client_secret);
  }

  const svc = serviceClient();
  const { error } = await svc.from("oauth_clients").insert({
    client_id,
    client_secret_hash,
    client_name,
    redirect_uris,
    grant_types: ["authorization_code", "refresh_token"],
    token_endpoint_auth_method,
    scope,
  });
  if (error) {
    console.error("oauth-register insert error", error);
    return json({ error: "server_error" }, 500);
  }

  return json({
    client_id,
    ...(client_secret ? { client_secret } : {}),
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name,
    redirect_uris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method,
    scope,
  }, 201);
});

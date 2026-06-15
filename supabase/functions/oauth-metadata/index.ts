// OAuth 2.0 metadata documents (RFC 8414 + RFC 9728).
// Serves either Authorization Server metadata or Protected Resource metadata
// depending on `?type=` (defaults to authorization-server).
import { corsHeaders, getBaseUrl, json } from "../_shared/mcp-auth.ts";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "authorization-server";
  const base = getBaseUrl();

  if (type === "resource") {
    // RFC 9728 - OAuth 2.0 Protected Resource Metadata
    return json({
      resource: `${base}/mcp`,
      authorization_servers: [`${base}/oauth-metadata`],
      bearer_methods_supported: ["header"],
      scopes_supported: ["notes:rw", "tasks:rw", "spaces:rw"],
      resource_documentation: "https://nucleus2brain.lovable.app",
    });
  }

  // RFC 8414 - Authorization Server Metadata
  return json({
    issuer: `${base}/oauth-metadata`,
    authorization_endpoint: `${base}/oauth-authorize`,
    token_endpoint: `${base}/oauth-token`,
    registration_endpoint: `${base}/oauth-register`,
    scopes_supported: ["notes:rw", "tasks:rw", "spaces:rw"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    service_documentation: "https://nucleus2brain.lovable.app",
  });
});

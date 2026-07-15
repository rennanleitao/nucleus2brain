import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Proxies Gmail REST calls through the Lovable connector gateway using the
// signed-in user's per-user connection key. Client sends { path, method, body }
// (path is a Gmail API path starting with "/gmail/v1/...").

const GATEWAY = 'https://connector-gateway.lovable.dev';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const path = String(body?.path ?? '');
    const method = String(body?.method ?? 'GET').toUpperCase();
    const payload = body?.body;
    const query = body?.query as Record<string, string | string[]> | undefined;

    if (!path.startsWith('/gmail/v1/') && !path.startsWith('/upload/')) {
      return new Response(JSON.stringify({ error: 'invalid_path' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: conn, error: connErr } = await admin
      .from('gmail_connections')
      .select('connection_api_key')
      .eq('user_id', userId)
      .maybeSingle();
    if (connErr || !conn?.connection_api_key) {
      return new Response(JSON.stringify({ error: 'not_connected' }), { status: 428, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const url = new URL(`${GATEWAY}/google_mail${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (Array.isArray(v)) for (const item of v) url.searchParams.append(k, item);
        else if (v != null) url.searchParams.set(k, String(v));
      }
    }

    const gwResp = await fetch(url.toString(), {
      method,
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'X-Connection-Api-Key': conn.connection_api_key,
        ...(payload != null ? { 'Content-Type': 'application/json' } : {}),
      },
      body: payload != null ? JSON.stringify(payload) : undefined,
    });

    const respText = await gwResp.text();
    return new Response(respText, {
      status: gwResp.status,
      headers: {
        ...corsHeaders,
        'Content-Type': gwResp.headers.get('Content-Type') ?? 'application/json',
      },
    });
  } catch (e) {
    console.error('gmail-api error', e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

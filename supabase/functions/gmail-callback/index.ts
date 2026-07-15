import { createClient } from 'npm:@supabase/supabase-js@2';

// This edge function is the return_url the connector gateway redirects to
// after the user completes Google OAuth. It runs unauthenticated (the browser
// arrives from Google, no JWT), so we authorize via the sid we passed in and
// look up the pending session in the DB.
//
// Because Lovable does NOT publicly document the exact query params the
// gateway appends to return_url, we defensively scan for plausible keys.

const APP_ORIGIN_FALLBACK = 'https://nucleus2brain.lovable.app';

function html(body: string, status = 200) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Gmail</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;background:#fff;color:#111;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:24px;text-align:center}p{color:#555;max-width:420px;line-height:1.5}code{background:#f4f4f5;padding:2px 6px;border-radius:4px;font-size:12px}</style>
</head><body>${body}</body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

function redirectHtml(target: string) {
  const safe = target.replace(/"/g, '&quot;');
  return html(
    `<div><p>Conta Google conectada. Voltando ao Nucleus…</p></div>
     <script>window.opener?.postMessage({type:'nucleus_gmail_connected'},'*');setTimeout(()=>{window.location.replace("${safe}")},400);</script>`,
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries());
  console.log('gmail-callback params:', JSON.stringify(params));

  const sid = params.sid;
  const appReturnRaw = params.app_return_url || '/emails';
  // Determine app origin: use referer or fallback
  let appOrigin = APP_ORIGIN_FALLBACK;
  try {
    const referer = req.headers.get('referer');
    if (referer) appOrigin = new URL(referer).origin;
  } catch { /* ignore */ }
  const appReturnUrl = appReturnRaw.startsWith('http')
    ? appReturnRaw
    : `${appOrigin}${appReturnRaw.startsWith('/') ? '' : '/'}${appReturnRaw}`;

  if (params.error) {
    return html(`<div><h3>Não foi possível conectar</h3><p>${params.error_description || params.error}</p><p><a href="${appReturnUrl}">Voltar</a></p></div>`, 400);
  }
  if (!sid) {
    return html('<div><h3>Sessão inválida</h3><p>Faltando parâmetro sid.</p></div>', 400);
  }

  // Look up session → user
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: sess, error: sessErr } = await admin
    .from('gmail_oauth_sessions')
    .select('user_id, created_at')
    .eq('session_id', sid)
    .maybeSingle();
  if (sessErr || !sess) {
    return html('<div><h3>Sessão expirada</h3><p>Tente conectar novamente.</p></div>', 400);
  }

  // Try to identify the connection key returned by the gateway
  const candidateKeys = [
    'connection_api_key', 'connection_key', 'credential', 'credential_id',
    'credential_api_key', 'connection_id', 'api_key', 'key', 'app_user_credential',
  ];
  let connectionKey: string | null = null;
  let keyField: string | null = null;
  for (const k of candidateKeys) {
    if (params[k] && typeof params[k] === 'string' && params[k].length >= 20) {
      connectionKey = params[k];
      keyField = k;
      break;
    }
  }

  if (!connectionKey) {
    // Fallback: pick the longest-looking value that isn't the sid/app_return_url
    const skip = new Set(['sid', 'app_return_url', 'state', 'code', 'scope']);
    let best: { k: string; v: string } | null = null;
    for (const [k, v] of Object.entries(params)) {
      if (skip.has(k) || typeof v !== 'string') continue;
      if (v.length >= 40 && (!best || v.length > best.v.length)) best = { k, v };
    }
    if (best) { connectionKey = best.v; keyField = best.k; }
  }

  if (!connectionKey) {
    console.error('no connection key in callback params', params);
    return html(
      `<div><h3>Não recebi a credencial da conexão</h3>
       <p>Parâmetros recebidos: <code>${Object.keys(params).join(', ') || '(vazio)'}</code></p>
       <p>Isso é um bug do Nucleus. Reporte pra ajustarmos.</p></div>`,
      500,
    );
  }
  console.log(`identified connection key from field="${keyField}", length=${connectionKey.length}`);

  // Fetch the user's Gmail email address for display
  let email: string | null = null;
  try {
    const meResp = await fetch('https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/profile', {
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'X-Connection-Api-Key': connectionKey,
      },
    });
    if (meResp.ok) {
      const me = await meResp.json();
      email = me.emailAddress ?? null;
    } else {
      console.warn('profile fetch failed', meResp.status, await meResp.text());
    }
  } catch (e) { console.warn('profile fetch error', e); }

  // Upsert the connection
  const { error: upErr } = await admin.from('gmail_connections').upsert({
    user_id: sess.user_id,
    connection_api_key: connectionKey,
    email,
    scopes: 'gmail.readonly gmail.send gmail.modify',
    updated_at: new Date().toISOString(),
  });
  if (upErr) {
    console.error('connection upsert failed', upErr);
    return html('<div><h3>Erro ao salvar</h3><p>Tente novamente.</p></div>', 500);
  }

  // Clean up the session
  await admin.from('gmail_oauth_sessions').delete().eq('session_id', sid);

  return redirectHtml(appReturnUrl);
});

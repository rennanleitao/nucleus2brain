import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY = 'https://connector-gateway.lovable.dev';
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
];

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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const CLIENT_KEY = Deno.env.get('GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY');
    if (!LOVABLE_API_KEY || !CLIENT_KEY) {
      return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Read where the app wants to be sent back after connect completes
    const body = await req.json().catch(() => ({}));
    const appReturnUrl = typeof body?.app_return_url === 'string' ? body.app_return_url : '/emails';

    // Create a short-lived session so the callback (no JWT) can resolve the user
    const sessionId = crypto.randomUUID();
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { error: sessErr } = await admin.from('gmail_oauth_sessions').insert({
      session_id: sessionId,
      user_id: userId,
    });
    if (sessErr) {
      console.error('session insert failed', sessErr);
      return new Response(JSON.stringify({ error: 'session_failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const callbackUrl = new URL(`${supabaseUrl}/functions/v1/gmail-callback`);
    callbackUrl.searchParams.set('sid', sessionId);
    callbackUrl.searchParams.set('app_return_url', appReturnUrl);

    const gwResp = await fetch(`${GATEWAY}/api/v1/app-users/oauth2/authorize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Client-Api-Key': CLIENT_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connector_id: 'google_mail',
        return_url: callbackUrl.toString(),
        app_user_id: userId,
        credentials_configuration: { scopes: SCOPES },
      }),
    });

    if (!gwResp.ok) {
      const errBody = await gwResp.text();
      console.error(`gateway authorize failed [${gwResp.status}]: ${errBody}`);
      return new Response(JSON.stringify({ error: 'gateway_failed', status: gwResp.status, details: errBody }), { status: gwResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const gw = await gwResp.json();
    return new Response(JSON.stringify({ authorization_url: gw.authorization_url }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('gmail-connect error', e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

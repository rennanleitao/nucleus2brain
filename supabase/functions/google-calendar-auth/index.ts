import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // Step 1: Generate OAuth URL
    if (action === "authorize") {
      const redirectUri = url.searchParams.get("redirect_uri");
      if (!redirectUri) throw new Error("redirect_uri required");

      // Store redirect_uri as state so we can use it in callback
      const state = btoa(JSON.stringify({ redirect_uri: redirectUri }));

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", `${SUPABASE_URL}/functions/v1/google-calendar-auth?action=callback`);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", SCOPES);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);

      return new Response(JSON.stringify({ url: authUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Handle OAuth callback
    if (action === "callback") {
      const code = url.searchParams.get("code");
      const stateParam = url.searchParams.get("state");
      if (!code || !stateParam) throw new Error("Missing code or state");

      const { redirect_uri: appRedirectUri } = JSON.parse(atob(stateParam));

      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: `${SUPABASE_URL}/functions/v1/google-calendar-auth?action=callback`,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenRes.json();
      if (tokens.error) throw new Error(tokens.error_description || tokens.error);

      // Get user email from Google
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userInfoRes.json();

      // We need to pass tokens to the frontend since we don't have user context here
      const tokenData = btoa(JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        google_email: userInfo.email,
      }));

      // Redirect back to the app with token data
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${appRedirectUri}?gcal_tokens=${tokenData}`,
        },
      });
    }

    // Step 3: Save tokens (called from frontend after callback)
    if (action === "save_tokens") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Unauthorized");

      const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
        authHeader.replace("Bearer ", "")
      );
      if (claimsErr || !claims?.claims) throw new Error("Unauthorized");
      const userId = claims.claims.sub as string;

      const body = await req.json();
      const expiresAt = new Date(Date.now() + body.expires_in * 1000).toISOString();

      // Use service role to upsert tokens
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { error } = await adminClient
        .from("google_calendar_tokens")
        .upsert({
          user_id: userId,
          access_token: body.access_token,
          refresh_token: body.refresh_token,
          token_expires_at: expiresAt,
          google_email: body.google_email,
        }, { onConflict: "user_id" });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 4: Disconnect
    if (action === "disconnect") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Unauthorized");

      const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
        authHeader.replace("Bearer ", "")
      );
      if (claimsErr || !claims?.claims) throw new Error("Unauthorized");
      const userId = claims.claims.sub as string;

      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await adminClient.from("google_calendar_tokens").delete().eq("user_id", userId);
      await adminClient.from("google_calendar_selections").delete().eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Google Calendar Auth error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

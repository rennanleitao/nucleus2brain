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

async function getValidToken(userId: string): Promise<string> {
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: tokenRow, error } = await adminClient
    .from("google_calendar_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !tokenRow) throw new Error("Google Calendar not connected");

  // Check if token is expired (with 5min buffer)
  const expiresAt = new Date(tokenRow.token_expires_at).getTime();
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    // Refresh token
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: tokenRow.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const tokens = await res.json();
    if (tokens.error) throw new Error(`Token refresh failed: ${tokens.error}`);

    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    await adminClient
      .from("google_calendar_tokens")
      .update({
        access_token: tokens.access_token,
        token_expires_at: newExpiresAt,
      })
      .eq("user_id", userId);

    return tokens.access_token;
  }

  return tokenRow.access_token;
}

async function getUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Unauthorized");

  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await getUserId(req);
    const url = new URL(req.url);
    let action = url.searchParams.get("action");

    // Also support reading action + params from JSON body (e.g. supabase.functions.invoke)
    let parsedBody: any = null;
    const parseBody = async () => {
      if (parsedBody !== null) return parsedBody;
      try {
        parsedBody = await req.json();
      } catch {
        parsedBody = {};
      }
      return parsedBody;
    };

    if (!action && req.method === "POST") {
      const b = await parseBody();
      action = b?.action ?? null;
    }

    // Helper to read a param from query string or JSON body
    const getParam = async (key: string): Promise<string | null> => {
      const fromQuery = url.searchParams.get(key);
      if (fromQuery) return fromQuery;
      if (req.method === "POST") {
        const b = await parseBody();
        return b?.[key] ?? null;
      }
      return null;
    };

    // List all calendars
    if (action === "list_calendars") {
      const token = await getValidToken(userId);
      const res = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(`Google API error [${res.status}]: ${JSON.stringify(data)}`);

      return new Response(JSON.stringify(data.items || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List events
    if (action === "list_events") {
      const token = await getValidToken(userId);
      const calendarId = url.searchParams.get("calendar_id") || "primary";
      const timeMin = url.searchParams.get("time_min") || new Date().toISOString();
      const timeMax = url.searchParams.get("time_max");

      const params = new URLSearchParams({
        timeMin,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "100",
      });
      if (timeMax) params.set("timeMax", timeMax);

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(`Google API error [${res.status}]: ${JSON.stringify(data)}`);

      return new Response(JSON.stringify(data.items || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create event
    if (action === "create_event") {
      const token = await getValidToken(userId);
      const body = await req.json();
      const calendarId = body.calendar_id || "primary";

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: body.summary,
            description: body.description,
            start: body.start,
            end: body.end,
            location: body.location,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(`Google API error [${res.status}]: ${JSON.stringify(data)}`);

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update event
    if (action === "update_event") {
      const token = await getValidToken(userId);
      const body = await req.json();
      const calendarId = body.calendar_id || "primary";
      const eventId = body.event_id;

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: body.summary,
            description: body.description,
            start: body.start,
            end: body.end,
            location: body.location,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(`Google API error [${res.status}]: ${JSON.stringify(data)}`);

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete event
    if (action === "delete_event") {
      const token = await getValidToken(userId);
      const body = await req.json();
      const calendarId = body.calendar_id || "primary";
      const eventId = body.event_id;

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok && res.status !== 204) {
        const data = await res.json();
        throw new Error(`Google API error [${res.status}]: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check connection status
    if (action === "status") {
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data } = await adminClient
        .from("google_calendar_tokens")
        .select("google_email, created_at")
        .eq("user_id", userId)
        .single();

      return new Response(JSON.stringify({ connected: !!data, email: data?.google_email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Google Calendar API error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: err.message === "Google Calendar not connected" ? 404 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

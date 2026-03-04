import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, data } = await req.json();

    if (type === "evernote") {
      // Parse ENEX XML content
      const notes = parseEnex(data.content);
      const results = { imported: 0, errors: 0 };

      // Find or create "Evernote Import" space
      let spaceId: string;
      const { data: existingSpace } = await supabase
        .from("spaces")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", "Evernote Import")
        .single();

      if (existingSpace) {
        spaceId = existingSpace.id;
      } else {
        const { data: newSpace, error: spaceError } = await supabase
          .from("spaces")
          .insert({ user_id: user.id, name: "Evernote Import", icon: "📓", description: "Imported from Evernote" })
          .select("id")
          .single();
        if (spaceError) throw spaceError;
        spaceId = newSpace.id;
      }

      for (const note of notes) {
        try {
          await supabase.from("notes").insert({
            user_id: user.id,
            space_id: spaceId,
            title: note.title,
            content: note.content,
            tags: note.tags,
          });
          results.imported++;
        } catch {
          results.errors++;
        }
      }

      return new Response(JSON.stringify({ success: true, ...results, spaceId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "notion_markdown") {
      // Parse markdown files from Notion export
      const notes = data.notes as Array<{ title: string; content: string; tags?: string[] }>;
      const results = { imported: 0, errors: 0 };

      let spaceId: string;
      const { data: existingSpace } = await supabase
        .from("spaces")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", "Notion Import")
        .single();

      if (existingSpace) {
        spaceId = existingSpace.id;
      } else {
        const { data: newSpace, error: spaceError } = await supabase
          .from("spaces")
          .insert({ user_id: user.id, name: "Notion Import", icon: "📝", description: "Imported from Notion" })
          .select("id")
          .single();
        if (spaceError) throw spaceError;
        spaceId = newSpace.id;
      }

      for (const note of notes) {
        try {
          await supabase.from("notes").insert({
            user_id: user.id,
            space_id: spaceId,
            title: note.title,
            content: note.content,
            tags: note.tags || [],
          });
          results.imported++;
        } catch {
          results.errors++;
        }
      }

      return new Response(JSON.stringify({ success: true, ...results, spaceId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid import type" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("import error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function parseEnex(xmlContent: string): Array<{ title: string; content: string; tags: string[] }> {
  const notes: Array<{ title: string; content: string; tags: string[] }> = [];

  // Simple XML parsing for ENEX format
  const noteRegex = /<note>([\s\S]*?)<\/note>/gi;
  let match;

  while ((match = noteRegex.exec(xmlContent)) !== null) {
    const noteXml = match[1];

    // Extract title
    const titleMatch = noteXml.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "Untitled";

    // Extract content - strip ENML tags, keep text
    const contentMatch = noteXml.match(/<content>([\s\S]*?)<\/content>/i);
    let content = "";
    if (contentMatch) {
      // Remove CDATA wrapper if present
      content = contentMatch[1]
        .replace(/<!\[CDATA\[/g, "")
        .replace(/\]\]>/g, "")
        // Remove XML declaration
        .replace(/<\?xml[^>]*\?>/g, "")
        // Remove DOCTYPE
        .replace(/<!DOCTYPE[^>]*>/g, "")
        // Remove en-note tags
        .replace(/<\/?en-note[^>]*>/g, "")
        // Convert common HTML to text
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<li[^>]*>/gi, "• ")
        .replace(/<[^>]+>/g, "")
        // Clean up
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    // Extract tags
    const tags: string[] = [];
    const tagRegex = /<tag>([\s\S]*?)<\/tag>/gi;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(noteXml)) !== null) {
      tags.push(tagMatch[1].trim());
    }

    notes.push({ title, content, tags });
  }

  return notes;
}

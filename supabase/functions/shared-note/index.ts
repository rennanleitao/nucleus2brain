import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, share_token, guest_token, guest_name, content, comment, change_summary, content_snapshot, editor_name } = await req.json();

    if (action === "get_note") {
      // Get share config
      const { data: share, error: shareErr } = await supabase
        .from("note_shares")
        .select("*")
        .eq("share_token", share_token)
        .single();
      if (shareErr || !share) {
        return new Response(JSON.stringify({ error: "Link de compartilhamento inválido" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get note
      const { data: note, error: noteErr } = await supabase
        .from("notes")
        .select("id, title, content, tags, updated_at")
        .eq("id", share.note_id)
        .single();
      if (noteErr || !note) {
        return new Response(JSON.stringify({ error: "Nota não encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get owner name
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", share.created_by)
        .single();

      return new Response(JSON.stringify({
        note,
        share: {
          allow_edit: share.allow_edit,
          allow_ai: share.allow_ai,
          allow_comments: share.allow_comments,
        },
        owner_name: ownerProfile?.name || "Usuário",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "register_guest") {
      const { data: guest, error } = await supabase
        .from("note_guests")
        .insert({ guest_name })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ guest }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_note") {
      // Verify share allows editing
      const { data: share } = await supabase
        .from("note_shares")
        .select("*")
        .eq("share_token", share_token)
        .single();
      if (!share || !share.allow_edit) {
        return new Response(JSON.stringify({ error: "Edição não permitida" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update note
      const { error: updateErr } = await supabase
        .from("notes")
        .update({ content, updated_at: new Date().toISOString() })
        .eq("id", share.note_id);
      if (updateErr) throw updateErr;

      // Record edit history
      let guestId = null;
      if (guest_token) {
        const { data: guest } = await supabase
          .from("note_guests")
          .select("id")
          .eq("guest_token", guest_token)
          .single();
        guestId = guest?.id;
      }

      await supabase.from("note_edit_history").insert({
        note_id: share.note_id,
        guest_id: guestId,
        editor_name: editor_name || "Anônimo",
        change_summary: change_summary || "Conteúdo editado",
        content_snapshot: content?.slice(0, 5000),
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "add_comment") {
      const { data: share } = await supabase
        .from("note_shares")
        .select("*")
        .eq("share_token", share_token)
        .single();
      if (!share || !share.allow_comments) {
        return new Response(JSON.stringify({ error: "Comentários não permitidos" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let guestId = null;
      if (guest_token) {
        const { data: guest } = await supabase
          .from("note_guests")
          .select("id")
          .eq("guest_token", guest_token)
          .single();
        guestId = guest?.id;
      }

      const { data: commentData, error } = await supabase
        .from("note_comments")
        .insert({
          note_id: share.note_id,
          guest_id: guestId,
          content: comment,
          author_name: editor_name || "Anônimo",
        })
        .select()
        .single();
      if (error) throw error;

      return new Response(JSON.stringify({ comment: commentData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_comments") {
      const { data: share } = await supabase
        .from("note_shares")
        .select("note_id")
        .eq("share_token", share_token)
        .single();
      if (!share) {
        return new Response(JSON.stringify({ error: "Link inválido" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: comments } = await supabase
        .from("note_comments")
        .select("*")
        .eq("note_id", share.note_id)
        .order("created_at", { ascending: true });

      return new Response(JSON.stringify({ comments: comments || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("shared-note error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

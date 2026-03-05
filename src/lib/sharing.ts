import { supabase } from "@/lib/supabase";

export type SpaceRole = "owner" | "editor" | "viewer";

export interface SpaceMember {
  id: string;
  space_id: string;
  user_id: string;
  role: SpaceRole;
  created_at: string;
  profile?: { name: string | null; avatar_url: string | null } | null;
}

export interface SpaceInvite {
  id: string;
  space_id: string;
  invited_email: string | null;
  invite_token: string;
  role: SpaceRole;
  accepted: boolean;
  created_at: string;
  expires_at: string;
}

export async function fetchSpaceMembers(spaceId: string) {
  const { data, error } = await supabase
    .from("space_members")
    .select("*")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  // Fetch profiles for members
  if (data && data.length > 0) {
    const userIds = data.map((m: any) => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, avatar_url")
      .in("user_id", userIds);
    
    return data.map((m: any) => ({
      ...m,
      profile: profiles?.find((p: any) => p.user_id === m.user_id) || null,
    }));
  }
  return data;
}

export async function fetchSpaceInvites(spaceId: string) {
  const { data, error } = await supabase
    .from("space_invites")
    .select("*")
    .eq("space_id", spaceId)
    .eq("accepted", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function inviteToSpace(spaceId: string, email: string | null, role: SpaceRole) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("space_invites")
    .insert({
      space_id: spaceId,
      invited_by: user.id,
      invited_email: email,
      role,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function acceptInvite(token: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Find the invite
  const { data: invite, error: findError } = await supabase
    .from("space_invites")
    .select("*")
    .eq("invite_token", token)
    .eq("accepted", false)
    .single();
  if (findError || !invite) throw new Error("Convite inválido ou expirado");

  if (new Date(invite.expires_at) < new Date()) {
    throw new Error("Convite expirado");
  }

  // Add user as member
  const { error: memberError } = await supabase
    .from("space_members")
    .insert({
      space_id: invite.space_id,
      user_id: user.id,
      role: invite.role,
    });
  if (memberError) {
    if (memberError.code === "23505") throw new Error("Você já é membro deste espaço");
    throw memberError;
  }

  // Mark invite as accepted
  await supabase
    .from("space_invites")
    .update({ accepted: true })
    .eq("id", invite.id);

  return invite;
}

export async function removeSpaceMember(memberId: string) {
  const { error } = await supabase
    .from("space_members")
    .delete()
    .eq("id", memberId);
  if (error) throw error;
}

export async function updateMemberRole(memberId: string, role: SpaceRole) {
  const { error } = await supabase
    .from("space_members")
    .update({ role })
    .eq("id", memberId);
  if (error) throw error;
}

export async function deleteInvite(inviteId: string) {
  const { error } = await supabase
    .from("space_invites")
    .delete()
    .eq("id", inviteId);
  if (error) throw error;
}

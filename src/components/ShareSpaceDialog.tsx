import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Copy, Trash2, Mail, Link2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  fetchSpaceMembers, fetchSpaceInvites, inviteToSpace, removeSpaceMember,
  updateMemberRole, deleteInvite, SpaceMember, SpaceInvite, SpaceRole,
} from "@/lib/sharing";

interface ShareSpaceDialogProps {
  spaceId: string;
  spaceName: string;
  isOwner: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareSpaceDialog({ spaceId, spaceName, isOwner, open, onOpenChange }: ShareSpaceDialogProps) {
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [invites, setInvites] = useState<SpaceInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<SpaceRole>("editor");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"members" | "invite">("members");

  const load = async () => {
    try {
      const [m, i] = await Promise.all([fetchSpaceMembers(spaceId), fetchSpaceInvites(spaceId)]);
      setMembers(m || []);
      setInvites(i || []);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open, spaceId]);

  const handleInviteByEmail = async () => {
    if (!inviteEmail.trim()) return;
    setLoading(true);
    try {
      await inviteToSpace(spaceId, inviteEmail.trim(), inviteRole);
      toast.success(`Convite enviado para ${inviteEmail}`);
      setInviteEmail("");
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLink = async () => {
    setLoading(true);
    try {
      const invite = await inviteToSpace(spaceId, null, inviteRole);
      const link = `${window.location.origin}/invite/${invite.invite_token}`;
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado para a área de transferência!");
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeSpaceMember(memberId);
      toast.success("Membro removido");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRoleChange = async (memberId: string, role: SpaceRole) => {
    try {
      await updateMemberRole(memberId, role);
      toast.success("Permissão atualizada");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    try {
      await deleteInvite(inviteId);
      toast.success("Convite removido");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Compartilhar "{spaceName}"
          </DialogTitle>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setTab("members")}
            className={`flex-1 text-xs py-1.5 px-3 rounded-md transition-colors ${tab === "members" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
          >
            Membros ({members.length})
          </button>
          {isOwner && (
            <button
              onClick={() => setTab("invite")}
              className={`flex-1 text-xs py-1.5 px-3 rounded-md transition-colors ${tab === "invite" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
            >
              <UserPlus className="h-3 w-3 inline mr-1" /> Convidar
            </button>
          )}
        </div>

        {tab === "members" && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {members.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum membro adicionado</p>
            ) : (
              members.map(m => (
                <div key={m.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.profile?.name || "Usuário"}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isOwner ? (
                      <>
                        <Select value={m.role} onValueChange={(v) => handleRoleChange(m.id, v as SpaceRole)}>
                          <SelectTrigger className="h-7 w-[90px] text-[11px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                        <button onClick={() => handleRemoveMember(m.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">{m.role}</Badge>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Pending invites */}
            {invites.length > 0 && (
              <>
                <p className="text-[11px] text-muted-foreground font-medium pt-2">Convites pendentes</p>
                {invites.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-dashed border-border">
                    <div className="min-w-0">
                      <p className="text-xs truncate">{inv.invited_email || "Link de convite"}</p>
                      <p className="text-[10px] text-muted-foreground">{inv.role}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => copyInviteLink(inv.invite_token)} className="text-muted-foreground hover:text-foreground">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {isOwner && (
                        <button onClick={() => handleDeleteInvite(inv.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === "invite" && isOwner && (
          <div className="space-y-4">
            {/* Role selector */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Permissão</label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as SpaceRole)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">Editor — pode editar tudo</SelectItem>
                  <SelectItem value="viewer">Viewer — apenas visualizar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* By email */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" /> Por email
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary"
                />
                <Button size="sm" onClick={handleInviteByEmail} disabled={loading || !inviteEmail.trim()}>
                  Convidar
                </Button>
              </div>
            </div>

            {/* By link */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Link2 className="h-3 w-3" /> Por link
              </label>
              <Button variant="outline" size="sm" className="w-full" onClick={handleCreateLink} disabled={loading}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Gerar e copiar link de convite
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

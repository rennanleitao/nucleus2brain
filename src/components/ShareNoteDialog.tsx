import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Share2, Copy, Link2, Trash2, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface ShareNoteDialogProps {
  noteId: string;
  noteTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EditHistoryItem {
  id: string;
  editor_name: string;
  change_summary: string;
  content_snapshot: string | null;
  created_at: string;
}

export function ShareNoteDialog({ noteId, noteTitle, open, onOpenChange }: ShareNoteDialogProps) {
  const [share, setShare] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<EditHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [allowEdit, setAllowEdit] = useState(true);
  const [allowAi, setAllowAi] = useState(true);
  const [allowComments, setAllowComments] = useState(true);

  const loadShare = async () => {
    const { data } = await supabase
      .from("note_shares" as any)
      .select("*")
      .eq("note_id", noteId)
      .maybeSingle();
    if (data) {
      setShare(data);
      setAllowEdit((data as any).allow_edit);
      setAllowAi((data as any).allow_ai);
      setAllowComments((data as any).allow_comments);
    }
  };

  const loadHistory = async () => {
    const { data } = await supabase
      .from("note_edit_history" as any)
      .select("*")
      .eq("note_id", noteId)
      .order("created_at", { ascending: false });
    setHistory((data as unknown as EditHistoryItem[]) || []);
  };

  useEffect(() => {
    if (open) {
      loadShare();
      loadHistory();
    }
  }, [open, noteId]);

  const handleCreateShare = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data, error } = await supabase
        .from("note_shares" as any)
        .insert({
          note_id: noteId,
          created_by: user.id,
          allow_edit: allowEdit,
          allow_ai: allowAi,
          allow_comments: allowComments,
        })
        .select()
        .single();
      if (error) throw error;
      setShare(data);
      copyLink((data as any).share_token);
      toast.success("Link de compartilhamento criado!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateShare = async () => {
    if (!share) return;
    try {
      await supabase
        .from("note_shares" as any)
        .update({ allow_edit: allowEdit, allow_ai: allowAi, allow_comments: allowComments })
        .eq("id", (share as any).id);
      toast.success("Permissões atualizadas");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteShare = async () => {
    if (!share) return;
    try {
      await supabase.from("note_shares" as any).delete().eq("id", (share as any).id);
      setShare(null);
      toast.success("Compartilhamento removido");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const copyLink = (token?: string) => {
    const t = token || (share as any)?.share_token;
    if (!t) return;
    navigator.clipboard.writeText(`${window.location.origin}/shared/${t}`);
    toast.success("Link copiado!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Share2 className="h-4 w-4" /> Compartilhar nota
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground truncate">"{noteTitle}"</p>

        {!share ? (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Permitir edição</Label>
                <Switch checked={allowEdit} onCheckedChange={setAllowEdit} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Permitir usar IA</Label>
                <Switch checked={allowAi} onCheckedChange={setAllowAi} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Permitir comentários</Label>
                <Switch checked={allowComments} onCheckedChange={setAllowComments} />
              </div>
            </div>
            <Button className="w-full" onClick={handleCreateShare} disabled={loading}>
              <Link2 className="h-4 w-4 mr-2" />
              {loading ? "Criando..." : "Gerar link de compartilhamento"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-2.5 bg-muted rounded-lg">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs truncate flex-1 text-muted-foreground">
                {window.location.origin}/shared/{(share as any).share_token?.slice(0, 12)}...
              </span>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => copyLink()}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Permitir edição</Label>
                <Switch checked={allowEdit} onCheckedChange={(v) => { setAllowEdit(v); }} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Permitir usar IA</Label>
                <Switch checked={allowAi} onCheckedChange={(v) => { setAllowAi(v); }} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Permitir comentários</Label>
                <Switch checked={allowComments} onCheckedChange={(v) => { setAllowComments(v); }} />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={handleUpdateShare}>
                Salvar permissões
              </Button>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleDeleteShare}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Edit history */}
            <div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <History className="h-3.5 w-3.5" />
                Histórico de edições ({history.length})
              </button>
              {showHistory && history.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto space-y-1.5">
                  {history.map(h => (
                    <div key={h.id} className="p-2 rounded border border-border text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{h.editor_name}</span>
                        <span className="text-muted-foreground">{format(new Date(h.created_at), "dd/MM HH:mm")}</span>
                      </div>
                      {h.change_summary && <p className="text-muted-foreground mt-0.5">{h.change_summary}</p>}
                    </div>
                  ))}
                </div>
              )}
              {showHistory && history.length === 0 && (
                <p className="text-[11px] text-muted-foreground mt-1.5">Nenhuma edição registrada</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

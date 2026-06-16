import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { FileStack } from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
  initialEditing?: { id?: string; name: string; content: string } | null;
}

export function ManageTemplatesDialog({ open, onOpenChange, onChanged, initialEditing }: Props) {
  const [editing, setEditing] = useState<{ id?: string; name: string; content: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEditing(initialEditing ?? { name: "", content: "" });
    } else {
      setEditing(null);
    }
  }, [open, initialEditing]);

  const handleSave = async () => {
    if (!editing || !editing.name.trim()) {
      toast.error("Informe um nome");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      if (editing.id) {
        const { error } = await supabase
          .from("note_templates")
          .update({ name: editing.name.trim(), content: editing.content })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("note_templates")
          .insert({ name: editing.name.trim(), content: editing.content, user_id: user.id });
        if (error) throw error;
      }
      toast.success("Template salvo");
      onChanged?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileStack className="h-4 w-4" />
            {editing?.id ? "Editar template" : "Novo template"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Edite o template como se fosse uma nota — o conteúdo aqui será inserido na nota quando aplicado.
          </DialogDescription>
        </DialogHeader>

        {editing && (
          <div className="space-y-3 flex-1 overflow-y-auto">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground mb-1">Nome</p>
              <Input
                value={editing.name}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
                placeholder="Ex: Retrospectiva semanal"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground mb-1">Conteúdo</p>
              <div className="rounded-md border border-border bg-background min-h-[360px]">
                <RichTextEditor
                  content={editing.content}
                  onChange={(html) => setEditing(prev => prev ? { ...prev, content: html } : prev)}
                  placeholder="Escreva o template como uma nota normal…"
                  className="min-h-[340px]"
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

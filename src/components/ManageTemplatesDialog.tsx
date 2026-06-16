import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, FileStack } from "lucide-react";
import { BUILT_IN_TEMPLATES, type NoteTemplate } from "@/lib/noteTemplates";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
  initialEditing?: { id?: string; name: string; content: string } | null;
}

export function ManageTemplatesDialog({ open, onOpenChange, onChanged, initialEditing }: Props) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [editing, setEditing] = useState<{ id?: string; name: string; content: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("note_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setTemplates(data || []);
  };

  useEffect(() => {
    if (open) {
      load();
      if (initialEditing) setEditing(initialEditing);
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
      setEditing(null);
      await load();
      onChanged?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este template?")) return;
    const { error } = await supabase.from("note_templates").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Template excluído");
    await load();
    onChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileStack className="h-4 w-4" /> Gerenciar templates
          </DialogTitle>
          <DialogDescription className="text-xs">
            Crie e edite seus templates de notas. Você também pode usar os templates internos sem editá-los.
          </DialogDescription>
        </DialogHeader>

        {!editing ? (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground mb-2">Templates internos</p>
              <div className="grid gap-2">
                {BUILT_IN_TEMPLATES.map(t => (
                  <div key={t.id} className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{t.name}</p>
                      {t.description && <p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p>}
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide flex-shrink-0">Interno</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground">Seus templates</p>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setEditing({ name: "", content: "" })}>
                  <Plus className="h-3 w-3" /> Novo
                </Button>
              </div>
              <div className="grid gap-2">
                {templates.length === 0 && (
                  <p className="text-xs text-muted-foreground py-4 text-center">Você ainda não criou templates personalizados.</p>
                )}
                {templates.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                    <p className="text-xs font-medium truncate">{t.name}</p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing({ id: t.id, name: t.name, content: t.content })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
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
              <p className="text-[11px] font-medium text-muted-foreground mb-1">Conteúdo (HTML ou texto)</p>
              <Textarea
                value={editing.content}
                onChange={e => setEditing({ ...editing, content: e.target.value })}
                placeholder={"<h1>Título</h1>\n<h2>Seção 1</h2>\n<p>...</p>"}
                className="min-h-[240px] text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Use tags HTML básicas (h1, h2, p, ul, ol, li, hr). Esse será o esqueleto inserido na nota.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

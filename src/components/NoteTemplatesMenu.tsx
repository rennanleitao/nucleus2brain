import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileStack, Loader2, Pencil, Settings2, Sparkles, Trash2, Copy } from "lucide-react";
import { BUILT_IN_TEMPLATES, type NoteTemplate } from "@/lib/noteTemplates";
import { ManageTemplatesDialog } from "@/components/ManageTemplatesDialog";

export type TemplateAction = "insert" | "organize";

interface Props {
  hasSelection: boolean;
  isEmpty: boolean;
  onApply: (template: NoteTemplate, action: TemplateAction) => Promise<void> | void;
  compact?: boolean;
}

export function NoteTemplatesMenu({ hasSelection, isEmpty, onApply, compact = false }: Props) {
  const [userTemplates, setUserTemplates] = useState<NoteTemplate[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<{ id?: string; name: string; content: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState<NoteTemplate | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("note_templates")
      .select("id,name,content")
      .order("name", { ascending: true });
    if (error) return;
    setUserTemplates(
      (data || []).map((t) => ({ id: t.id, name: t.name, content: t.content, builtIn: false }))
    );
  };

  useEffect(() => { load(); }, []);

  const handleSelect = async (t: NoteTemplate) => {
    if (hasSelection) {
      setLoading(true);
      try { await onApply(t, "organize"); }
      finally { setLoading(false); }
      return;
    }
    if (!isEmpty) {
      setConfirmReplace(t);
      return;
    }
    setLoading(true);
    try { await onApply(t, "insert"); }
    finally { setLoading(false); }
  };

  const duplicateBuiltIn = async (t: NoteTemplate) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Faça login"); return; }
      const { data, error } = await supabase
        .from("note_templates")
        .insert({ name: `${t.name} (cópia)`, content: t.content, user_id: user.id })
        .select("id,name,content")
        .single();
      if (error) throw error;
      toast.success("Template duplicado — agora você pode editá-lo");
      await load();
      setEditingTemplate({ id: data.id, name: data.name, content: data.content });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deleteUserTemplate = async (id: string) => {
    if (!confirm("Excluir este template?")) return;
    const { error } = await supabase.from("note_templates").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Template excluído");
    await load();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {compact ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title={hasSelection ? "Organizar seleção com template" : "Aplicar template"}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileStack className="h-3.5 w-3.5" />}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-primary"
              title={hasSelection ? "Organizar seleção com template" : "Aplicar template"}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileStack className="h-4 w-4" />}
              <span className="hidden sm:inline">Templates</span>
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {hasSelection ? (
              <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> Organizar seleção com…</span>
            ) : (
              "Inserir template"
            )}
          </DropdownMenuLabel>
          {BUILT_IN_TEMPLATES.map(t => (
            <div key={t.id} className="flex items-start gap-1 pr-1">
              <DropdownMenuItem onClick={() => handleSelect(t)} className="text-xs flex-1 flex-col items-start gap-0.5">
                <span className="font-medium">{t.name}</span>
                {t.description && <span className="text-[10px] text-muted-foreground">{t.description}</span>}
              </DropdownMenuItem>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 mt-1 flex-shrink-0 text-muted-foreground hover:text-foreground"
                title="Duplicar como meu template (editável)"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); duplicateBuiltIn(t); }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {userTemplates.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Meus templates
              </DropdownMenuLabel>
              {userTemplates.map(t => (
                <div key={t.id} className="flex items-center gap-1 pr-1">
                  <DropdownMenuItem onClick={() => handleSelect(t)} className="text-xs flex-1">
                    {t.name}
                  </DropdownMenuItem>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground"
                    title="Editar template"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingTemplate({ id: t.id, name: t.name, content: t.content }); }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0 text-destructive hover:text-destructive"
                    title="Excluir template"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteUserTemplate(t.id); }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setManageOpen(true)} className="text-xs gap-2">
            <Settings2 className="h-3 w-3" /> Gerenciar templates
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ManageTemplatesDialog
        open={manageOpen || !!editingTemplate}
        onOpenChange={(o) => { if (!o) { setManageOpen(false); setEditingTemplate(null); } }}
        onChanged={load}
        initialEditing={editingTemplate}
      />

      <AlertDialog open={!!confirmReplace} onOpenChange={(o) => !o && setConfirmReplace(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Substituir conteúdo da nota?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Esta nota já tem conteúdo. Deseja inserir o template <strong>{confirmReplace?.name}</strong> no final ou substituir o conteúdo atual?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const t = confirmReplace; setConfirmReplace(null);
                if (t) { setLoading(true); try { await onApply(t, "insert"); } finally { setLoading(false); } }
              }}
            >
              Inserir no final
            </Button>
            <AlertDialogAction
              onClick={async () => {
                const t = confirmReplace; setConfirmReplace(null);
                if (!t) return;
                setLoading(true);
                try { await onApply({ ...t, id: t.id + ":replace" }, "insert"); }
                finally { setLoading(false); }
              }}
            >
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

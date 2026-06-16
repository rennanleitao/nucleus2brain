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
import { FileStack, Loader2, Settings2, Sparkles } from "lucide-react";
import { BUILT_IN_TEMPLATES, type NoteTemplate } from "@/lib/noteTemplates";
import { ManageTemplatesDialog } from "@/components/ManageTemplatesDialog";

export type TemplateAction = "insert" | "organize";

interface Props {
  hasSelection: boolean;
  isEmpty: boolean;
  onApply: (template: NoteTemplate, action: TemplateAction) => Promise<void> | void;
}

export function NoteTemplatesMenu({ hasSelection, isEmpty, onApply }: Props) {
  const [userTemplates, setUserTemplates] = useState<NoteTemplate[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
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

  const all = [...BUILT_IN_TEMPLATES, ...userTemplates];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-primary"
            title={hasSelection ? "Organizar seleção com template" : "Aplicar template"}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileStack className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {hasSelection ? (
              <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> Organizar seleção com…</span>
            ) : (
              "Inserir template"
            )}
          </DropdownMenuLabel>
          {BUILT_IN_TEMPLATES.map(t => (
            <DropdownMenuItem key={t.id} onClick={() => handleSelect(t)} className="text-xs flex-col items-start gap-0.5">
              <span className="font-medium">{t.name}</span>
              {t.description && <span className="text-[10px] text-muted-foreground">{t.description}</span>}
            </DropdownMenuItem>
          ))}
          {userTemplates.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Meus templates
              </DropdownMenuLabel>
              {userTemplates.map(t => (
                <DropdownMenuItem key={t.id} onClick={() => handleSelect(t)} className="text-xs">
                  {t.name}
                </DropdownMenuItem>
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
        open={manageOpen}
        onOpenChange={setManageOpen}
        onChanged={load}
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

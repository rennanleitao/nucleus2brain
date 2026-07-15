import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildReplyRfc2822, sendRawEmail } from "@/lib/gmail";
import {
  BUILTIN_TEMPLATES,
  loadUserTemplates,
  saveUserTemplates,
  renderTemplate,
  normalizePhone,
  type DelegateTemplate,
} from "@/lib/delegate-messages";
import { promptDialog } from "@/components/ui/dialog-service";

interface DelegateCommDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: {
    title: string;
    description?: string | null;
    due_date?: string | null;
    delegated_to?: string | null;
  };
  defaultEmail?: string;
  defaultPhone?: string;
}

export function DelegateCommDialog({ open, onOpenChange, task, defaultEmail = "", defaultPhone = "" }: DelegateCommDialogProps) {
  const [tab, setTab] = useState<"email" | "whatsapp">("email");
  const [userTemplates, setUserTemplates] = useState<DelegateTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string>(BUILTIN_TEMPLATES[0].id);
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState(defaultPhone);
  const [subject, setSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [waBody, setWaBody] = useState("");
  const [gmailConnected, setGmailConnected] = useState(false);
  const [sending, setSending] = useState(false);

  const name = task.delegated_to?.trim() || "";

  const allTemplates = useMemo<DelegateTemplate[]>(
    () => [...BUILTIN_TEMPLATES, ...userTemplates],
    [userTemplates],
  );
  const currentTemplate = useMemo(
    () => allTemplates.find(t => t.id === templateId) || BUILTIN_TEMPLATES[0],
    [allTemplates, templateId],
  );

  // On open: reset recipients, load Gmail status + saved templates.
  useEffect(() => {
    if (!open) return;
    setEmail(defaultEmail);
    setPhone(defaultPhone);
    setUserTemplates(loadUserTemplates());
    setTemplateId(BUILTIN_TEMPLATES[0].id);

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("gmail_connections")
          .select("email")
          .eq("user_id", user.id)
          .maybeSingle();
        setGmailConnected(!!data);
      }
    })();
  }, [open, defaultEmail, defaultPhone]);

  // Rebuild message whenever the selected template or task changes.
  useEffect(() => {
    if (!open) return;
    const rendered = renderTemplate(currentTemplate, task);
    setSubject(rendered.subject);
    setEmailBody(rendered.body);
    setWaBody(rendered.body);
  }, [open, currentTemplate, task.title, task.description, task.due_date, task.delegated_to]);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleSendEmail = async () => {
    if (!email.trim()) { toast.error("Informe um e-mail"); return; }
    if (!gmailConnected) { toast.error("Conecte o Gmail em E-mails para enviar direto daqui."); return; }
    setSending(true);
    try {
      const rfc = buildReplyRfc2822({ to: email.trim(), subject, bodyText: emailBody });
      await sendRawEmail(rfc);
      toast.success("E-mail enviado!");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Falha ao enviar");
    } finally {
      setSending(false);
    }
  };

  const openMailto = () => {
    if (!email.trim()) { toast.error("Informe um e-mail"); return; }
    const url = `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = url;
  };

  const openWhatsApp = () => {
    const p = normalizePhone(phone);
    const base = p ? `https://wa.me/${p}` : `https://wa.me/`;
    const url = `${base}?text=${encodeURIComponent(waBody)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSaveAsTemplate = async () => {
    const body = tab === "email" ? emailBody : waBody;
    const name = await promptDialog({
      title: "Salvar como template",
      description: "Dê um nome para reutilizar essa mensagem depois.",
      placeholder: "Ex: Cobrança gentil",
      confirmLabel: "Salvar",
      required: true,
    });
    if (!name || !name.trim()) return;
    const next: DelegateTemplate = {
      id: `user-${Date.now()}`,
      name: name.trim(),
      subject: tab === "email" ? subject : "{{title}}",
      body,
    };
    const updated = [...userTemplates, next];
    setUserTemplates(updated);
    saveUserTemplates(updated);
    setTemplateId(next.id);
    toast.success("Template salvo");
  };

  const handleDeleteTemplate = () => {
    if (currentTemplate.builtin) return;
    const updated = userTemplates.filter(t => t.id !== currentTemplate.id);
    setUserTemplates(updated);
    saveUserTemplates(updated);
    setTemplateId(BUILTIN_TEMPLATES[0].id);
    toast.success("Template removido");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="text-base font-semibold">
            Comunicar
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {name ? <>Enviar para <span className="font-medium text-foreground">{name}</span></> : "Enviar mensagem"}
          </p>
        </DialogHeader>

        <div className="px-5 pt-4 space-y-3">
          <div>
            <label className="field-label">Template</label>
            <div className="flex items-center gap-2">
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="field-input flex-1"
              >
                <optgroup label="Padrão">
                  {BUILTIN_TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
                {userTemplates.length > 0 && (
                  <optgroup label="Meus templates">
                    {userTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button
                type="button"
                onClick={handleSaveAsTemplate}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background hover:bg-muted px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                title="Salvar mensagem atual como novo template"
              >
                <Save className="h-3.5 w-3.5" /> Salvar
              </button>
              {!currentTemplate.builtin && (
                <button
                  type="button"
                  onClick={handleDeleteTemplate}
                  className="inline-flex items-center rounded-md border border-border bg-background hover:bg-destructive/10 hover:text-destructive px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors"
                  title="Excluir template"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Variáveis: <code>{`{{firstName}}`}</code>, <code>{`{{title}}`}</code>, <code>{`{{dueDate}}`}</code>, <code>{`{{description}}`}</code>
            </p>
          </div>

          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
            <button type="button" onClick={() => setTab("email")}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${tab === "email" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
              E-mail
            </button>
            <button type="button" onClick={() => setTab("whatsapp")}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${tab === "whatsapp" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
              WhatsApp
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {tab === "email" ? (
            <>
              <div>
                <label className="field-label">Para (e-mail)</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="pessoa@exemplo.com" className="field-input" />
              </div>
              <div>
                <label className="field-label">Assunto</label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="field-input" />
              </div>
              <div>
                <label className="field-label">Mensagem</label>
                <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)}
                  className="field-input h-48 resize-y font-mono text-xs" />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" onClick={handleSendEmail} disabled={sending || !gmailConnected}
                  className="gradient-primary text-primary-foreground border-0" size="sm">
                  {sending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                  Enviar via Gmail
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={openMailto}>
                  Abrir no meu app
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleCopy(emailBody, "E-mail")}>
                  Copiar
                </Button>
              </div>
              {!gmailConnected && (
                <p className="text-[10px] text-muted-foreground">
                  Conecte o Gmail em E-mails para enviar direto daqui. Enquanto isso você pode copiar ou abrir no seu app de e-mail.
                </p>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="field-label">Telefone (com DDD)</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="Ex: 11 91234-5678" className="field-input" />
                <p className="text-[10px] text-muted-foreground mt-1">Opcional — sem número, o WhatsApp abre para você escolher o contato.</p>
              </div>
              <div>
                <label className="field-label">Mensagem</label>
                <textarea value={waBody} onChange={e => setWaBody(e.target.value)}
                  className="field-input h-48 resize-y font-mono text-xs" />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" onClick={openWhatsApp} size="sm"
                  className="gradient-primary text-primary-foreground border-0">
                  Abrir no WhatsApp
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleCopy(waBody, "Mensagem")}>
                  Copiar
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

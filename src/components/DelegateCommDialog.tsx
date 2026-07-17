import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Save, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildReplyRfc2822, sendRawEmail } from "@/lib/gmail";
import {
  BUILTIN_TEMPLATES,
  loadUserTemplates,
  saveUserTemplates,
  renderTemplate,
  normalizePhone,
  TEMPLATE_TOKENS,
  type DelegateTemplate,
  type DelegateTask,
} from "@/lib/delegate-messages";
import { promptDialog } from "@/components/ui/dialog-service";

interface DelegateCommDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: DelegateTask;
  defaultEmail?: string;
  defaultPhone?: string;
}

function stripHtml(html: string): string {
  if (!html) return "";
  const el = document.createElement("div");
  el.innerHTML = html;
  return (el.textContent || el.innerText || "").replace(/\s+/g, " ").trim();
}

export function DelegateCommDialog({ open, onOpenChange, task, defaultEmail = "", defaultPhone = "" }: DelegateCommDialogProps) {
  const [tab, setTab] = useState<"email" | "whatsapp">("email");
  const [userTemplates, setUserTemplates] = useState<DelegateTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string>(BUILTIN_TEMPLATES[0].id);
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState(defaultPhone);
  // Raw template text (with @tokens). The preview below shows the rendered result.
  const [subjectTpl, setSubjectTpl] = useState("");
  const [emailBodyTpl, setEmailBodyTpl] = useState("");
  const [waBodyTpl, setWaBodyTpl] = useState("");
  const [context, setContext] = useState<string>("");
  const [gmailConnected, setGmailConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const emailBodyRef = useRef<HTMLTextAreaElement>(null);
  const waBodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const [lastFocused, setLastFocused] = useState<"subject" | "emailBody" | "waBody">("emailBody");

  const name = task.delegated_to?.trim() || "";

  const allTemplates = useMemo<DelegateTemplate[]>(
    () => [...BUILTIN_TEMPLATES, ...userTemplates],
    [userTemplates],
  );
  const currentTemplate = useMemo(
    () => allTemplates.find(t => t.id === templateId) || BUILTIN_TEMPLATES[0],
    [allTemplates, templateId],
  );

  // Task augmented with the current context (user-edited or auto-fetched).
  const taskWithContext = useMemo<DelegateTask>(() => ({ ...task, context }), [task, context]);

  // Rendered (final) versions used for preview and sending.
  const renderedEmail = useMemo(
    () => renderTemplate({ ...currentTemplate, subject: subjectTpl, body: emailBodyTpl }, taskWithContext),
    [currentTemplate, subjectTpl, emailBodyTpl, taskWithContext],
  );
  const renderedWa = useMemo(
    () => renderTemplate({ ...currentTemplate, subject: "", body: waBodyTpl }, taskWithContext),
    [currentTemplate, waBodyTpl, taskWithContext],
  );

  // On open: reset recipients, load Gmail status + saved templates + note context.
  useEffect(() => {
    if (!open) return;
    setEmail(defaultEmail);
    setPhone(defaultPhone);
    setUserTemplates(loadUserTemplates());
    setTemplateId(BUILTIN_TEMPLATES[0].id);
    setContext((task.context || "").trim());

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

      // Auto-fetch linked-note context if none was provided.
      if (!task.context && task.note_id) {
        try {
          const { data: note } = await supabase
            .from("notes")
            .select("content")
            .eq("id", task.note_id)
            .maybeSingle();
          if (note?.content) {
            const text = stripHtml(note.content);
            if (text) setContext(text.slice(0, 500));
          }
        } catch {
          /* ignore */
        }
      }
    })();
  }, [open, defaultEmail, defaultPhone, task.context, task.note_id]);

  // Load the raw template body (with @tokens) whenever the selection changes.
  useEffect(() => {
    if (!open) return;
    setSubjectTpl(currentTemplate.subject || "");
    setEmailBodyTpl(currentTemplate.body || "");
    setWaBodyTpl(currentTemplate.body || "");
  }, [open, currentTemplate.id]);

  const insertToken = (token: string) => {
    const target =
      lastFocused === "subject" ? subjectRef.current :
      lastFocused === "waBody" ? waBodyRef.current :
      emailBodyRef.current;
    if (!target) return;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    const value = target.value;
    const next = value.slice(0, start) + token + value.slice(end);
    if (lastFocused === "subject") setSubjectTpl(next);
    else if (lastFocused === "waBody") setWaBodyTpl(next);
    else setEmailBodyTpl(next);
    requestAnimationFrame(() => {
      target.focus();
      const pos = start + token.length;
      target.setSelectionRange(pos, pos);
    });
  };

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
      const rfc = buildReplyRfc2822({
        to: email.trim(),
        subject: renderedEmail.subject,
        bodyText: renderedEmail.body,
      });
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
    const url = `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(renderedEmail.subject)}&body=${encodeURIComponent(renderedEmail.body)}`;
    window.location.href = url;
  };

  const openWhatsApp = () => {
    const p = normalizePhone(phone);
    const base = p ? `https://wa.me/${p}` : `https://wa.me/`;
    const url = `${base}?text=${encodeURIComponent(renderedWa.body)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSaveAsTemplate = async () => {
    const bodyTpl = tab === "email" ? emailBodyTpl : waBodyTpl;
    const templateName = await promptDialog({
      title: "Salvar como template",
      description: "Dê um nome. O template guarda os marcadores (@atividade, @responsavel, @contexto…) e não os valores atuais.",
      placeholder: "Ex: Cobrança gentil",
      confirmLabel: "Salvar",
      required: true,
    });
    if (!templateName || !templateName.trim()) return;
    const next: DelegateTemplate = {
      id: `user-${Date.now()}`,
      name: templateName.trim(),
      subject: tab === "email" ? subjectTpl : "@atividade",
      body: bodyTpl,
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

  const tokenChips = (
    <div className="flex flex-wrap gap-1">
      {TEMPLATE_TOKENS.map(t => (
        <button
          key={t.token}
          type="button"
          onClick={() => insertToken(t.token)}
          title={t.hint}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 hover:bg-primary/10 hover:border-primary/50 hover:text-primary px-2 py-0.5 text-[10.5px] font-mono text-muted-foreground transition-colors"
        >
          {t.token}
        </button>
      ))}
    </div>
  );

  const previewBox = (subject: string | null, body: string) => (
    <div className="rounded-md border border-dashed border-border bg-muted/30 p-2.5 space-y-1">
      <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold flex items-center gap-1">
        <Eye className="h-3 w-3" /> Prévia (o que será enviado)
      </p>
      {subject !== null && (
        <p className="text-[11px]"><span className="text-muted-foreground">Assunto:</span> <span className="font-medium">{subject}</span></p>
      )}
      <pre className="text-[11px] whitespace-pre-wrap font-sans leading-relaxed">{body}</pre>
    </div>
  );

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
          </div>

          <div>
            <label className="field-label flex items-center justify-between">
              <span>Marcadores automáticos</span>
              <button
                type="button"
                onClick={() => setShowPreview(v => !v)}
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                title={showPreview ? "Ocultar prévia" : "Mostrar prévia"}
              >
                {showPreview ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showPreview ? "Ocultar prévia" : "Mostrar prévia"}
              </button>
            </label>
            {tokenChips}
            <p className="text-[10px] text-muted-foreground mt-1">
              Clique para inserir. No template ficam os marcadores; na hora de enviar, os valores reais são preenchidos.
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
                <label className="field-label">Assunto (template)</label>
                <input
                  ref={subjectRef}
                  type="text"
                  value={subjectTpl}
                  onChange={e => setSubjectTpl(e.target.value)}
                  onFocus={() => setLastFocused("subject")}
                  className="field-input font-mono text-xs"
                />
              </div>
              <div>
                <label className="field-label">Mensagem (template)</label>
                <textarea
                  ref={emailBodyRef}
                  value={emailBodyTpl}
                  onChange={e => setEmailBodyTpl(e.target.value)}
                  onFocus={() => setLastFocused("emailBody")}
                  className="field-input h-40 resize-y font-mono text-xs"
                />
              </div>
              <div>
                <label className="field-label">Contexto (opcional)</label>
                <textarea
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  placeholder={task.note_id ? "Trecho da nota vinculada — edite se quiser" : "Cole ou escreva o contexto que quer incluir"}
                  className="field-input h-16 resize-y text-xs"
                />
              </div>
              {showPreview && previewBox(renderedEmail.subject, renderedEmail.body)}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" onClick={handleSendEmail} disabled={sending || !gmailConnected}
                  className="gradient-primary text-primary-foreground border-0" size="sm">
                  {sending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                  Enviar via Gmail
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={openMailto}>
                  Abrir no meu app
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleCopy(renderedEmail.body, "E-mail")}>
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
                <label className="field-label">Mensagem (template)</label>
                <textarea
                  ref={waBodyRef}
                  value={waBodyTpl}
                  onChange={e => setWaBodyTpl(e.target.value)}
                  onFocus={() => setLastFocused("waBody")}
                  className="field-input h-40 resize-y font-mono text-xs"
                />
              </div>
              <div>
                <label className="field-label">Contexto (opcional)</label>
                <textarea
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  placeholder={task.note_id ? "Trecho da nota vinculada — edite se quiser" : "Cole ou escreva o contexto que quer incluir"}
                  className="field-input h-16 resize-y text-xs"
                />
              </div>
              {showPreview && previewBox(null, renderedWa.body)}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" onClick={openWhatsApp} size="sm"
                  className="gradient-primary text-primary-foreground border-0">
                  Abrir no WhatsApp
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleCopy(renderedWa.body, "Mensagem")}>
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

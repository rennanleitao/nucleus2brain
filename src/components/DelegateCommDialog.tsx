import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildReplyRfc2822, sendRawEmail } from "@/lib/gmail";

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

function formatDate(d?: string | null) {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatDateShort(d?: string | null) {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  const currentYear = new Date().getFullYear().toString();
  const dayMonth = `${parts[2]}/${parts[1]}`;
  return parts[0] === currentYear ? dayMonth : `${dayMonth}/${parts[0]}`;
}

function normalizePhone(raw: string): string {
  // Keep digits only; assume Brazil if 10-11 digits and no leading 55
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 11 && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

export function DelegateCommDialog({ open, onOpenChange, task, defaultEmail = "", defaultPhone = "" }: DelegateCommDialogProps) {
  const [tab, setTab] = useState<"email" | "whatsapp">("email");
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState(defaultPhone);
  const [subject, setSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [waBody, setWaBody] = useState("");
  const [gmailConnected, setGmailConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const [senderName, setSenderName] = useState("");

  const dueShort = useMemo(() => formatDateShort(task.due_date), [task.due_date]);
  const name = task.delegated_to?.trim() || "";
  const firstName = name.split(/\s+/)[0] || name;

  useEffect(() => {
    if (!open) return;
    setEmail(defaultEmail);
    setPhone(defaultPhone);

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const displayName = (user?.user_metadata as any)?.full_name || user?.email?.split("@")[0] || "";
      setSenderName(displayName);

      if (user) {
        const { data } = await supabase
          .from("gmail_connections")
          .select("email")
          .eq("user_id", user.id)
          .maybeSingle();
        setGmailConnected(!!data);
      }

      const subj = task.title;
      const dueTxt = dueShort ? ` até ${dueShort}` : "";
      const greeting = firstName ? `Oi ${firstName}, tudo certo?` : "Oi, tudo certo?";
      const descLine = task.description?.trim()
        ? `\nMe lembro que noutro momento falamos sobre ${task.description.trim()}.`
        : "";
      const msg = `${greeting} Vc consegue tocar a atividade "${task.title}"${dueTxt}? Se sim, me avisa.${descLine}

Depois me conta se rolou, ok? Se precisar de algum apoio me avisa.`;
      setSubject(subj);
      setEmailBody(msg);
      setWaBody(msg);
    })();
  }, [open, task.title, task.description, task.due_date, task.delegated_to, defaultEmail, defaultPhone, dueShort, firstName]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="text-base font-semibold">Comunicar responsabilidade</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {name ? <>Enviar para <span className="font-medium text-foreground">{name}</span></> : "Enviar mensagem"}
          </p>
        </DialogHeader>

        <div className="px-5 pt-4">
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
                <Button type="button" variant="ghost" size="sm" onClick={() => handleCopy(`${subject}\n\n${emailBody}`, "E-mail")}>
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

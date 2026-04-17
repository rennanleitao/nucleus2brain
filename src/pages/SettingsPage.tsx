import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Bot, Bell, User, Save, ExternalLink, Check, MessageSquare, Copy, Phone, Upload, BookOpen, FileText, CheckCircle2, AlertCircle, Send, LayoutGrid, RotateCcw } from "lucide-react";
import { useSidebarItems } from "@/hooks/useSidebarItems";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const PROVIDERS = [
  {
    id: "lovable",
    name: "Lovable AI",
    description: "Pré-configurado, sem necessidade de API key. Usa Google Gemini e OpenAI via gateway.",
    models: [
      { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash (Recomendado)", description: "Rápido e eficiente" },
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Boa relação custo/velocidade" },
      { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Mais preciso, mais lento" },
      { id: "openai/gpt-5-mini", name: "GPT-5 Mini", description: "Rápido e econômico" },
      { id: "openai/gpt-5", name: "GPT-5", description: "Mais capaz, mais caro" },
    ],
    needsKey: false,
    setupSteps: [],
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "Use diretamente a API da OpenAI com sua própria chave.",
    models: [
      { id: "gpt-4o", name: "GPT-4o", description: "Multimodal, rápido" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Mais econômico" },
      { id: "gpt-5", name: "GPT-5", description: "O mais avançado" },
    ],
    needsKey: true,
    setupSteps: [
      "Acesse platform.openai.com e crie uma conta",
      "Vá em API Keys → Create new secret key",
      "Copie a chave e cole no campo abaixo",
      "Configure um método de pagamento na OpenAI",
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Use a API da Anthropic com os modelos Claude.",
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", description: "Equilibrado" },
      { id: "claude-opus-4-20250514", name: "Claude Opus 4", description: "Mais capaz" },
    ],
    needsKey: true,
    setupSteps: [
      "Acesse console.anthropic.com e crie uma conta",
      "Vá em Settings → API Keys → Create Key",
      "Copie a chave e cole no campo abaixo",
      "Configure billing na Anthropic",
    ],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    description: "Modelos open-source de alta performance.",
    models: [
      { id: "mistral-large-latest", name: "Mistral Large", description: "Mais capaz" },
      { id: "mistral-small-latest", name: "Mistral Small", description: "Rápido e econômico" },
    ],
    needsKey: true,
    setupSteps: [
      "Acesse console.mistral.ai e crie uma conta",
      "Vá em API Keys → Create new key",
      "Copie a chave e cole no campo abaixo",
      "Configure um método de pagamento",
    ],
  },
];

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [provider, setProvider] = useState("lovable");
  const [model, setModel] = useState("google/gemini-3-flash-preview");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifPermission, setNotifPermission] = useState(typeof globalThis.Notification !== "undefined" ? globalThis.Notification.permission : "default");

  // WhatsApp state
  const [waWebhookUrl, setWaWebhookUrl] = useState("");
  const [waPhone, setWaPhone] = useState("");
  const [waEnabled, setWaEnabled] = useState(false);
  const [waSecret, setWaSecret] = useState("");
  const [waSaving, setWaSaving] = useState(false);

  // Telegram state
  const [tgLinked, setTgLinked] = useState(false);
  const [tgUsername, setTgUsername] = useState("");
  const [tgLinkCode, setTgLinkCode] = useState("");
  const [tgEnabled, setTgEnabled] = useState(false);
  const [tgLinking, setTgLinking] = useState(false);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: number } | null>(null);
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("ai_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setProvider(data.provider || "lovable");
        setModel(data.model || "google/gemini-3-flash-preview");
      }

      // Load WhatsApp settings
      const { data: waData } = await supabase
        .from("whatsapp_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (waData) {
        setWaWebhookUrl(waData.zapier_webhook_url || "");
        setWaPhone(waData.phone_number || "");
        setWaEnabled(waData.enabled);
        setWaSecret(waData.webhook_secret);
      }

      // Load Telegram link
      const { data: tgData } = await supabase
        .from("telegram_chat_links")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (tgData) {
        setTgLinked(!!tgData.chat_id);
        setTgUsername(tgData.username || "");
        setTgEnabled(tgData.enabled);
      }

      setLoaded(true);
    };
    load();
  }, [user]);

  const selectedProvider = PROVIDERS.find(p => p.id === provider)!;

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const prov = PROVIDERS.find(p => p.id === newProvider)!;
    setModel(prov.models[0].id);
    setApiKey("");
  };

  const handleSave = async () => {
    if (!user) return;
    if (selectedProvider.needsKey && !apiKey.trim()) {
      toast.error("API key é obrigatória para este provedor");
      return;
    }
    setSaving(true);
    try {
      // Upsert ai_settings
      const { data: existing } = await supabase
        .from("ai_settings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase.from("ai_settings").update({ provider, model }).eq("id", existing.id);
      } else {
        await supabase.from("ai_settings").insert({ user_id: user.id, provider, model });
      }

      // If there's an API key, store it via edge function
      if (selectedProvider.needsKey && apiKey.trim()) {
        const { error } = await supabase.functions.invoke("store-api-key", {
          body: { provider, apiKey: apiKey.trim() },
        });
        if (error) throw error;
      }

      toast.success("Configurações salvas!");
      setApiKey("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const requestNotifPermission = async () => {
    if (!("Notification" in window)) {
      toast.error("Seu navegador não suporta notificações");
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === "granted") {
      setNotifEnabled(true);
      toast.success("Notificações ativadas!");
    } else {
      toast.error("Permissão de notificação negada");
    }
  };

  const handleEvernoteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith(".enex")) { toast.error("Upload um arquivo .enex do Evernote"); return; }
    setImporting(true); setImportResult(null);
    try {
      const content = await file.text();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-notes`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type: "evernote", data: { content } }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setImportResult({ imported: data.imported, errors: data.errors });
      toast.success(`${data.imported} notas importadas do Evernote!`);
    } catch (err: any) { toast.error(err.message); } finally { setImporting(false); }
  };

  const handleNotionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setImporting(true); setImportResult(null);
    try {
      const notes: Array<{ title: string; content: string; tags: string[] }> = [];
      for (const file of Array.from(files)) {
        if (file.name.endsWith(".md")) {
          const content = await file.text();
          notes.push({ title: file.name.replace(/\.md$/, "").replace(/ [a-f0-9]{32}$/, ""), content, tags: ["notion-import"] });
        } else if (file.name.endsWith(".csv")) {
          const content = await file.text();
          const lines = content.split("\n");
          if (lines.length > 1) {
            const headers = lines[0].split(",");
            const titleIdx = headers.findIndex(h => h.toLowerCase().includes("name") || h.toLowerCase().includes("title"));
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(",");
              if (cols[titleIdx || 0]?.trim()) {
                notes.push({ title: cols[titleIdx || 0].replace(/^"|"$/g, "").trim(), content: cols.slice(1).join(", ").replace(/^"|"$/g, "").trim(), tags: ["notion-import"] });
              }
            }
          }
        }
      }
      if (notes.length === 0) { toast.error("Nenhum arquivo .md ou .csv válido"); setImporting(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-notes`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type: "notion_markdown", data: { notes } }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setImportResult({ imported: data.imported, errors: data.errors });
      toast.success(`${data.imported} notas importadas do Notion!`);
    } catch (err: any) { toast.error(err.message); } finally { setImporting(false); }
  };

  if (!loaded) {
    return <div className="p-6 flex items-center justify-center"><p className="text-sm text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-title flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-muted-foreground" /> Settings
        </h1>
        <p className="text-small text-muted-foreground mt-1">Configure seu assistente e preferências</p>
      </div>

      <Tabs defaultValue="ai" className="space-y-4">
        <TabsList className="bg-muted flex-wrap">
          <TabsTrigger value="ai" className="text-xs"><Bot className="h-3 w-3 mr-1" /> Assistant</TabsTrigger>
          <TabsTrigger value="telegram" className="text-xs"><Send className="h-3 w-3 mr-1" /> Telegram</TabsTrigger>
          <TabsTrigger value="whatsapp" className="text-xs"><MessageSquare className="h-3 w-3 mr-1" /> WhatsApp</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs"><Bell className="h-3 w-3 mr-1" /> Lembretes</TabsTrigger>
          <TabsTrigger value="import" className="text-xs"><Upload className="h-3 w-3 mr-1" /> Import</TabsTrigger>
          <TabsTrigger value="sidebar" className="text-xs"><LayoutGrid className="h-3 w-3 mr-1" /> Sidebar</TabsTrigger>
          <TabsTrigger value="account" className="text-xs"><User className="h-3 w-3 mr-1" /> Conta</TabsTrigger>
        </TabsList>

        {/* AI PROVIDER TAB */}
        <TabsContent value="ai" className="space-y-4">
          {/* Provider selection */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold">Provedor de IA</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleProviderChange(p.id)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    provider === p.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{p.name}</span>
                    {!p.needsKey && <Badge variant="secondary" className="text-[10px]">Pré-configurado</Badge>}
                    {provider === p.id && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{p.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Model selection */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">Modelo</h3>
            <div className="space-y-1.5">
              {selectedProvider.models.map(m => (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    model === m.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{m.name}</span>
                      <p className="text-[11px] text-muted-foreground">{m.description}</p>
                    </div>
                    {model === m.id && <Check className="h-4 w-4 text-primary" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* API Key + Setup Steps */}
          {selectedProvider.needsKey && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold">Configuração — {selectedProvider.name}</h3>
              
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Passo a passo:</p>
                <ol className="space-y-1.5">
                  {selectedProvider.setupSteps.map((step, i) => (
                    <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={`Cole sua ${selectedProvider.name} API key...`}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  A chave será armazenada de forma segura e nunca exposta no frontend.
                </p>
              </div>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? "Salvando..." : "Salvar configurações"}
          </Button>
        </TabsContent>

        {/* TELEGRAM TAB */}
        <TabsContent value="telegram" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Integração Telegram</h3>
              {tgLinked && <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">Vinculado</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              Receba lembretes de tarefas e consulte seus compromissos diretamente pelo Telegram.
            </p>

            {tgLinked ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm">Conta vinculada{tgUsername ? ` (@${tgUsername})` : ""}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Notificações ativas</span>
                  <Switch
                    checked={tgEnabled}
                    onCheckedChange={async (checked) => {
                      setTgEnabled(checked);
                      if (user) {
                        await supabase
                          .from("telegram_chat_links")
                          .update({ enabled: checked })
                          .eq("user_id", user.id);
                        toast.success(checked ? "Notificações Telegram ativadas" : "Notificações Telegram desativadas");
                      }
                    }}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!user) return;
                    await supabase.from("telegram_chat_links").delete().eq("user_id", user.id);
                    setTgLinked(false);
                    setTgUsername("");
                    setTgEnabled(false);
                    toast.success("Telegram desvinculado");
                  }}
                >
                  Desvincular
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  onClick={async () => {
                    if (!user) return;
                    setTgLinking(true);
                    try {
                      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                      // Upsert a link record with the code
                      const { data: existing } = await supabase
                        .from("telegram_chat_links")
                        .select("id")
                        .eq("user_id", user.id)
                        .maybeSingle();

                      if (existing) {
                        await supabase
                          .from("telegram_chat_links")
                          .update({ link_code: code, chat_id: 0 })
                          .eq("id", existing.id);
                      } else {
                        await supabase
                          .from("telegram_chat_links")
                          .insert({ user_id: user.id, link_code: code, chat_id: 0, enabled: true });
                      }

                      setTgLinkCode(code);
                    } catch (err: any) {
                      toast.error(err.message || "Erro ao gerar código");
                    } finally {
                      setTgLinking(false);
                    }
                  }}
                  disabled={tgLinking}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  {tgLinking ? "Gerando..." : "Gerar código de vinculação"}
                </Button>

                {tgLinkCode && (
                  <div className="space-y-2 p-3 rounded-lg bg-muted">
                    <p className="text-xs font-medium">Clique no link abaixo para vincular:</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`https://t.me/nucleus_reminders_bot?start=${tgLinkCode}`}
                        className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono outline-none"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(`https://t.me/nucleus_reminders_bot?start=${tgLinkCode}`);
                          toast.success("Link copiado!");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Abra o link no Telegram e clique em "Start" para vincular.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => window.open(`https://t.me/nucleus_reminders_bot?start=${tgLinkCode}`, "_blank")}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Abrir no Telegram
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Commands reference */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">Comandos disponíveis no Telegram</h3>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p>📋 <strong>/tarefas</strong> — Ver todas as tarefas pendentes</p>
              <p>📅 <strong>/hoje</strong> — Tarefas de hoje</p>
              <p>💬 <strong>Texto livre</strong> — Pergunte sobre tarefas, lembretes e compromissos</p>
              <p>⏰ <strong>Lembretes</strong> — Receba automaticamente quando um lembrete disparar</p>
              <p>❓ <strong>/ajuda</strong> — Lista de comandos</p>
            </div>
          </div>
        </TabsContent>

        {/* WHATSAPP TAB */}
        <TabsContent value="whatsapp" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Integração WhatsApp via Zapier</h3>
              <Badge variant="secondary" className="text-[10px]">Beta</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Gerencie suas tasks pelo WhatsApp — por texto ou áudio. Crie, liste, conclua e receba lembretes. 🎤
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Zapier Webhook URL (para envio)</label>
                <input
                  type="url"
                  value={waWebhookUrl}
                  onChange={e => setWaWebhookUrl(e.target.value)}
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  URL do webhook do Zapier que enviará mensagens de volta pelo WhatsApp.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  <Phone className="h-3 w-3 inline mr-1" />
                  Número do WhatsApp
                </label>
                <input
                  type="tel"
                  value={waPhone}
                  onChange={e => setWaPhone(e.target.value)}
                  placeholder="+5511999999999"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Webhook URL for Zapier to call */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">Webhook para receber mensagens</h3>
            <p className="text-xs text-muted-foreground">
              Configure no Zapier/n8n para enviar mensagens do WhatsApp para esta URL:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`}
                className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono outline-none"
              />
              <Button variant="outline" size="sm" onClick={() => {
                navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`);
                toast.success("URL copiada!");
              }}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>

            {waSecret && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Webhook Secret (incluir no body do Zapier)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={waSecret}
                    className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono outline-none"
                  />
                  <Button variant="outline" size="sm" onClick={() => {
                    navigator.clipboard.writeText(waSecret);
                    toast.success("Secret copiado!");
                  }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Inclua como "webhook_secret" no body JSON que o Zapier envia.
                </p>
              </div>
            )}
          </div>

          {/* Setup instructions */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">Como configurar no Zapier</h3>
            <ol className="space-y-2">
              {[
                "Crie um Zap com trigger 'New Message in WhatsApp' (Zapier WhatsApp integration)",
                "Adicione uma ação 'Webhooks by Zapier' → 'POST' para a URL acima",
                'No body JSON, envie: {"message": "{{message}}", "audio_url": "{{audio_url}}", "phone": "{{phone}}", "webhook_secret": "SEU_SECRET"}',
                "Para áudios: passe a URL do áudio no campo 'audio_url' (ou base64 em 'audio_base64'). A IA transcreve automaticamente.",
                "Crie outro Zap: trigger 'Webhooks by Zapier' (Catch Hook) → ação 'Send WhatsApp Message'",
                "Cole a URL do Catch Hook no campo 'Zapier Webhook URL' acima",
              ].map((step, i) => (
                <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Commands reference */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">Comandos disponíveis</h3>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p>📝 <strong>Criar:</strong> "criar task: Reunião com João amanhã"</p>
              <p>📋 <strong>Listar:</strong> "listar tasks", "tasks de hoje", "tasks atrasadas"</p>
              <p>✅ <strong>Concluir:</strong> "concluir Reunião com João"</p>
              <p>🗑️ <strong>Excluir:</strong> "excluir Reunião com João"</p>
              <p>🎤 <strong>Áudio:</strong> Envie um áudio falando o comando — será transcrito automaticamente</p>
              <p>❓ <strong>Ajuda:</strong> "ajuda"</p>
            </div>
          </div>

          <Button onClick={async () => {
            if (!user) return;
            if (!waWebhookUrl.trim()) {
              toast.error("Informe a URL do webhook do Zapier");
              return;
            }
            setWaSaving(true);
            try {
              const { data: existing } = await supabase
                .from("whatsapp_settings")
                .select("id, webhook_secret")
                .eq("user_id", user.id)
                .maybeSingle();

              if (existing) {
                await supabase.from("whatsapp_settings").update({
                  zapier_webhook_url: waWebhookUrl.trim(),
                  phone_number: waPhone.trim() || null,
                  enabled: true,
                }).eq("id", existing.id);
                setWaSecret(existing.webhook_secret);
              } else {
                const { data: newSettings } = await supabase.from("whatsapp_settings").insert({
                  user_id: user.id,
                  zapier_webhook_url: waWebhookUrl.trim(),
                  phone_number: waPhone.trim() || null,
                }).select("webhook_secret").single();
                if (newSettings) setWaSecret(newSettings.webhook_secret);
              }
              toast.success("WhatsApp configurado!");
            } catch (err: any) {
              toast.error(err.message || "Erro ao salvar");
            } finally {
              setWaSaving(false);
            }
          }} disabled={waSaving} className="w-full">
            <Save className="h-4 w-4 mr-1.5" />
            {waSaving ? "Salvando..." : "Salvar configuração WhatsApp"}
          </Button>
        </TabsContent>

        {/* NOTIFICATIONS TAB */}
        <TabsContent value="notifications" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold">Notificações do navegador</h3>
            <p className="text-xs text-muted-foreground">
              Ative notificações para receber lembretes de tasks diretamente no navegador.
            </p>
            
            {notifPermission === "granted" ? (
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm text-primary">Notificações ativadas</span>
              </div>
            ) : (
              <Button variant="outline" onClick={requestNotifPermission}>
                <Bell className="h-4 w-4 mr-1.5" />
                Ativar notificações
              </Button>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">Lembretes</h3>
            <p className="text-xs text-muted-foreground">
              Os lembretes são configurados diretamente nas tasks. Ao editar uma task, defina uma data/hora de lembrete.
              Quando o horário chegar, você receberá uma notificação no navegador.
            </p>
            <p className="text-xs text-muted-foreground">
              O sistema verifica lembretes pendentes periodicamente enquanto o app estiver aberto.
            </p>
          </div>
        </TabsContent>

        {/* IMPORT TAB */}
        <TabsContent value="import" className="space-y-4">
          {importResult && (
            <div className={`rounded-xl border p-4 flex items-center gap-3 ${
              importResult.errors > 0 ? "border-yellow-500/30 bg-yellow-500/5" : "border-primary/30 bg-primary/5"
            }`}>
              {importResult.errors > 0 ? <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" /> : <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />}
              <div>
                <p className="text-small font-medium">{importResult.imported} notas importadas</p>
                {importResult.errors > 0 && <p className="text-xs text-muted-foreground">{importResult.errors} falharam</p>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className={`flex flex-col items-center gap-4 p-6 rounded-xl border-2 border-dashed bg-card transition-all cursor-pointer ${
              importing ? "opacity-50 pointer-events-none" : "border-border hover:border-primary/40"
            }`}>
              <div className="w-12 h-12 rounded-xl bg-[#14CC45]/10 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-[#14CC45]" />
              </div>
              <div className="text-center">
                <h3 className="text-small font-semibold">Evernote</h3>
                <p className="text-xs text-muted-foreground mt-1">Upload <code className="text-[11px] bg-muted px-1 py-0.5 rounded">.enex</code></p>
              </div>
              <input type="file" accept=".enex" onChange={handleEvernoteUpload} className="hidden" />
              <span className="text-xs text-primary font-medium">{importing ? "Importando..." : "Escolher arquivo"}</span>
            </label>

            <label className={`flex flex-col items-center gap-4 p-6 rounded-xl border-2 border-dashed bg-card transition-all cursor-pointer ${
              importing ? "opacity-50 pointer-events-none" : "border-border hover:border-primary/40"
            }`}>
              <div className="w-12 h-12 rounded-xl bg-foreground/5 flex items-center justify-center">
                <FileText className="h-6 w-6 text-foreground/70" />
              </div>
              <div className="text-center">
                <h3 className="text-small font-semibold">Notion</h3>
                <p className="text-xs text-muted-foreground mt-1">Upload <code className="text-[11px] bg-muted px-1 py-0.5 rounded">.md</code> ou <code className="text-[11px] bg-muted px-1 py-0.5 rounded">.csv</code></p>
              </div>
              <input type="file" accept=".md,.csv" multiple onChange={handleNotionUpload} className="hidden" />
              <span className="text-xs text-primary font-medium">{importing ? "Importando..." : "Escolher arquivos"}</span>
            </label>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-micro font-semibold mb-2">Como exportar</h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p><strong>Evernote:</strong> App desktop → Clique direito no notebook → Export → ENEX</p>
              <p><strong>Notion:</strong> Settings → Export all → Markdown & CSV → Download e descompacte</p>
            </div>
          </div>
        </TabsContent>

        {/* SIDEBAR TAB */}
        <TabsContent value="sidebar" className="space-y-4">
          <SidebarItemsSettings />
        </TabsContent>

        {/* ACCOUNT TAB */}
        <TabsContent value="account" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">Conta</h3>
            {user && (
              <div className="space-y-2">
                <p className="text-sm">{user.email}</p>
                <p className="text-[11px] text-muted-foreground">
                  ID: {user.id.slice(0, 8)}...
                </p>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={signOut}>
              Sair da conta
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SidebarItemsSettings() {
  const { visible, toggle, reset, all } = useSidebarItems();
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Itens da sidebar</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Escolha quais atalhos aparecem no menu lateral. Pelo menos um item permanece visível.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={reset} className="text-xs">
          <RotateCcw className="h-3 w-3 mr-1" /> Restaurar
        </Button>
      </div>
      <div className="space-y-2">
        {all.map((item) => {
          const checked = visible.includes(item.key);
          return (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">{item.title}</span>
                <span className="text-[11px] text-muted-foreground">{item.url}</span>
              </div>
              <Switch checked={checked} onCheckedChange={() => toggle(item.key)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

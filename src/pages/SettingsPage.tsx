import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Bot, Bell, User, Save, ExternalLink, Check } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
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
  const [notifPermission, setNotifPermission] = useState(Notification?.permission || "default");

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
        <TabsList className="bg-muted">
          <TabsTrigger value="ai" className="text-xs"><Bot className="h-3 w-3 mr-1" /> Assistant</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs"><Bell className="h-3 w-3 mr-1" /> Lembretes</TabsTrigger>
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

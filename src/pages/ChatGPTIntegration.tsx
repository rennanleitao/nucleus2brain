import { useEffect, useState } from "react";
import { ArrowLeft, Copy, Check, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface OAuthSession {
  id: string;
  client_id: string;
  scope: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
  revoked_at: string | null;
}

const PROJECT_URL = import.meta.env.VITE_SUPABASE_URL as string;
const MCP_URL = `${PROJECT_URL}/functions/v1/mcp`;

export default function ChatGPTIntegration() {
  const [sessions, setSessions] = useState<OAuthSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("oauth_refresh_tokens")
      .select("id, client_id, scope, created_at, last_used_at, expires_at, revoked_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setSessions((data as OAuthSession[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const copyUrl = async () => {
    await navigator.clipboard.writeText(MCP_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const revoke = async (id: string) => {
    const { error } = await supabase
      .from("oauth_refresh_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Sessão revogada");
      load();
    }
  };

  const active = sessions.filter((s) => !s.revoked_at && new Date(s.expires_at) > new Date());
  const inactive = sessions.filter((s) => s.revoked_at || new Date(s.expires_at) <= new Date());

  return (
    <div className="container max-w-3xl py-10 px-4">
      <Link to="/settings" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Conectar ChatGPT</h1>
        <p className="text-muted-foreground">
          Use o ChatGPT como um assistente para criar e gerenciar suas notas, tarefas e spaces.
        </p>
      </header>

      <section className="rounded-xl border bg-card p-6 mb-6">
        <h2 className="text-lg font-medium mb-1">URL do MCP Server</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Cole esta URL ao adicionar um Custom Connector no ChatGPT (Settings → Connectors → Add).
        </p>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted font-mono text-sm break-all">
          <span className="flex-1">{MCP_URL}</span>
          <Button size="sm" variant="ghost" onClick={copyUrl}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-6 mb-6">
        <h2 className="text-lg font-medium mb-3">Como conectar</h2>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>No ChatGPT, vá em <strong>Settings → Connectors → Add custom connector</strong>.</li>
          <li>Cole a URL acima e selecione autenticação <strong>OAuth</strong>.</li>
          <li>O ChatGPT abrirá uma janela para você entrar com email e senha do Nucleus.</li>
          <li>Autorize o acesso. Pronto: o ChatGPT poderá criar/editar suas notas, tarefas e spaces.</li>
        </ol>
      </section>

      <section className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Sessões autorizadas</h2>
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>Atualizar</Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : active.length === 0 && inactive.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma sessão ainda. Conecte o ChatGPT para começar.</p>
        ) : (
          <div className="space-y-3">
            {active.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">{s.client_id}</span>
                    <Badge variant="secondary">ativa</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Criada {new Date(s.created_at).toLocaleString("pt-BR")}
                    {s.last_used_at ? ` · usada por último ${new Date(s.last_used_at).toLocaleString("pt-BR")}` : ""}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => revoke(s.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {inactive.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border opacity-60">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">{s.client_id}</span>
                    <Badge variant="outline">{s.revoked_at ? "revogada" : "expirada"}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Criada {new Date(s.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

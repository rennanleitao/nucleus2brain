import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Laptop, Mic, Plus, Radio, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  normalizeMeetingAnalysis,
  useDeleteMeetingCopilotSession,
  useMeetingCopilotSessions,
  type MeetingCopilotSession,
} from "@/hooks/useMeetingCopilot";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function MeetingsHome() {
  const navigate = useNavigate();
  const { data: sessions = [], isLoading } = useMeetingCopilotSessions();
  const deleteSession = useDeleteMeetingCopilotSession();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      const analysis = normalizeMeetingAnalysis(s.analysis);
      return (
        s.title?.toLowerCase().includes(q) ||
        s.theme?.toLowerCase().includes(q) ||
        analysis.theme_suggestion?.toLowerCase().includes(q) ||
        analysis.summary?.toLowerCase().includes(q)
      );
    });
  }, [sessions, query]);

  const handleDelete = async (session: MeetingCopilotSession) => {
    try {
      await deleteSession.mutateAsync(session.id);
      toast.success("Reunião excluída");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir");
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-2rem)] flex-col bg-background">
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Radio className="h-3 w-3" /> Meeting Copilot
              </Badge>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Reuniões</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Grave, transcreva e organize suas reuniões presenciais ou online.
            </p>
          </div>
          <Button size="lg" onClick={() => navigate("/reunioes/nova")}>
            <Plus className="mr-1.5 h-4 w-4" /> Nova reunião
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-5 flex items-center gap-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por título, tema ou resumo"
            className="max-w-md"
          />
          <span className="text-xs text-muted-foreground">
            {sessions.length} {sessions.length === 1 ? "reunião" : "reuniões"}
          </span>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <div className="rounded-full bg-muted p-4">
                <Radio className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-base font-medium">
                  {query ? "Nenhuma reunião encontrada" : "Nenhuma reunião salva"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {query ? "Ajuste sua busca ou crie uma nova reunião." : "Comece uma nova reunião para gravar e organizar sua conversa."}
                </p>
              </div>
              {!query && (
                <Button onClick={() => navigate("/reunioes/nova")}>
                  <Plus className="mr-1.5 h-4 w-4" /> Nova reunião
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((session) => (
              <MeetingCard
                key={session.id}
                session={session}
                onOpen={() => navigate(`/reunioes/${session.id}`)}
                onDelete={() => handleDelete(session)}
                disabled={deleteSession.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MeetingCard({
  session,
  onOpen,
  onDelete,
  disabled,
}: {
  session: MeetingCopilotSession;
  onOpen: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const analysis = normalizeMeetingAnalysis(session.analysis);
  const isOnline = !!session.meeting_url;
  const title = session.title?.trim() || cleanTheme(session.theme) || "Reunião sem título";
  const theme = cleanTheme(session.theme || analysis.theme_suggestion);
  const date = new Date(session.updated_at);

  return (
    <Card className={cn("group relative overflow-hidden transition hover:border-primary/40 hover:shadow-sm")}>
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              {isOnline ? <Laptop className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
              {isOnline ? "Online" : "Presencial"}
            </Badge>
            <Badge variant={session.status === "active" ? "default" : "secondary"} className="text-[10px]">
              {session.status === "active" ? "ativa" : "encerrada"}
            </Badge>
          </div>
          <div>
            <p className="line-clamp-2 text-sm font-semibold leading-snug">{title}</p>
            {theme && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{theme}</p>}
          </div>
          {analysis.summary && (
            <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
              {analysis.summary}
            </p>
          )}
          <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
            <span>·</span>
            {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </CardContent>
      </button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
            onClick={(e) => e.stopPropagation()}
            disabled={disabled}
            title="Excluir reunião"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir reunião?</AlertDialogTitle>
            <AlertDialogDescription>
              "{title}" e todo o conteúdo capturado serão removidos. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function cleanTheme(value?: string | null) {
  const text = value?.trim();
  if (!text) return "";
  const weak = ["no suggestions", "lack of content", "sem tema", "sem conteúdo", "sem conteudo"];
  return weak.some((s) => text.toLowerCase().includes(s)) ? "" : text;
}

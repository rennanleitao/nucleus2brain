import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Brain,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Lightbulb,
  Link2,
  Mic,
  MicOff,
  MessageSquareText,
  Play,
  Plus,
  Radio,
  Send,
  ShieldAlert,
  Sparkles,
  Square,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_MEETING_ANALYSIS,
  MEETING_COPILOT_PROFILES,
  type MeetingCopilotAnalysis,
  type MeetingCopilotProfile,
  type MeetingCopilotSession,
  normalizeMeetingAnalysis,
  useCreateMeetingCopilotSegment,
  useCreateMeetingCopilotSession,
  useMeetingCopilotSegments,
  useMeetingCopilotSessions,
  useUpdateMeetingCopilotSession,
} from "@/hooks/useMeetingCopilot";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const AUTO_ANALYZE_DELAY = 1800;

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
}

interface BrowserSpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: BrowserSpeechRecognitionAlternative;
}

interface BrowserSpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: BrowserSpeechRecognitionResult;
  };
}

interface BrowserSpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

export default function MeetingCopilot() {
  const { data: sessions = [] } = useMeetingCopilotSessions();
  const createSession = useCreateMeetingCopilotSession();
  const updateSession = useUpdateMeetingCopilotSession();
  const createSegment = useCreateMeetingCopilotSegment();

  const [activeSession, setActiveSession] = useState<MeetingCopilotSession | null>(null);
  const [title, setTitle] = useState("Reunião sem título");
  const [profile, setProfile] = useState<MeetingCopilotProfile>("executive");
  const [incomingText, setIncomingText] = useState("");
  const [transcript, setTranscript] = useState("");
  const [analysis, setAnalysis] = useState<MeetingCopilotAnalysis>(EMPTY_MEETING_ANALYSIS);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [listening, setListening] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [botName, setBotName] = useState("Helena");
  const [invitingBot, setInvitingBot] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);
  const processedRef = useRef("");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const listeningRef = useRef(false);
  const processIncomingRef = useRef<(text: string) => Promise<void>>(async () => {});

  const { data: segments = [] } = useMeetingCopilotSegments(activeSession?.id);
  const activeProfile = MEETING_COPILOT_PROFILES.find((item) => item.id === profile);
  const hasSession = !!activeSession;
  const speechSupported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const ensureSession = useCallback(async () => {
    if (activeSession) return activeSession;
    const created = await createSession.mutateAsync({ title, profile });
    setActiveSession(created);
    return created;
  }, [activeSession, createSession, profile, title]);

  const analyzeMeeting = useCallback(async (nextTranscript: string, latestSegment: string, sessionId: string) => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("meeting-copilot", {
        body: {
          profile,
          transcript: nextTranscript,
          latest_segment: latestSegment,
          previous_analysis: analysis,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const nextAnalysis = normalizeMeetingAnalysis(data?.analysis);
      setAnalysis(nextAnalysis);
      setLastAnalyzedAt(new Date().toISOString());
      await updateSession.mutateAsync({
        id: sessionId,
        title,
        profile,
        transcript: nextTranscript,
        analysis: nextAnalysis,
      });
      return nextAnalysis;
    } finally {
      setAnalyzing(false);
    }
  }, [analysis, profile, title, updateSession]);

  const processIncomingText = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean || clean === processedRef.current) return;

    processedRef.current = clean;
    const session = await ensureSession();
    const nextTranscript = [transcript, clean].filter(Boolean).join("\n\n");
    setTranscript(nextTranscript);
    setIncomingText("");

    try {
      const nextAnalysis = await analyzeMeeting(nextTranscript, clean, session.id);
      await createSegment.mutateAsync({
        session_id: session.id,
        content: clean,
        analysis_snapshot: nextAnalysis,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível analisar a reunião");
    }
  }, [analyzeMeeting, createSegment, ensureSession, transcript]);

  useEffect(() => {
    processIncomingRef.current = processIncomingText;
  }, [processIncomingText]);

  useEffect(() => {
    if (!autoAnalyze || !incomingText.trim()) return;
    const timer = window.setTimeout(() => {
      processIncomingText(incomingText);
    }, AUTO_ANALYZE_DELAY);
    return () => window.clearTimeout(timer);
  }, [autoAnalyze, incomingText, processIncomingText]);

  useEffect(() => {
    return () => {
      listeningRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    setListening(false);
    setInterimTranscript("");
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(async () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechError("Seu navegador não suporta transcrição por voz. Use Chrome/Edge ou cole a transcrição manualmente.");
      return;
    }

    try {
      await ensureSession();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar a sessão");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "pt-BR";

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcriptText = result[0]?.transcript?.trim() ?? "";
        if (!transcriptText) continue;
        if (result.isFinal) finalText = [finalText, transcriptText].filter(Boolean).join(" ");
        else interimText = [interimText, transcriptText].filter(Boolean).join(" ");
      }

      setInterimTranscript(interimText);
      if (finalText) {
        processIncomingRef.current(finalText);
      }
    };

    recognition.onerror = (event) => {
      const message = event.error === "not-allowed"
        ? "Permissão de microfone negada. Autorize o microfone no navegador para o Copilot escutar."
        : `Erro na escuta: ${event.error}`;
      setSpeechError(message);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        stopListening();
      }
    };

    recognition.onend = () => {
      if (!listeningRef.current) return;
      try {
        recognition.start();
      } catch {
        setListening(false);
        listeningRef.current = false;
      }
    };

    recognitionRef.current = recognition;
    listeningRef.current = true;
    setSpeechError(null);
    setListening(true);

    try {
      recognition.start();
    } catch (error) {
      listeningRef.current = false;
      setListening(false);
      setSpeechError(error instanceof Error ? error.message : "Não foi possível iniciar a escuta.");
    }
  }, [ensureSession, stopListening]);

  const inviteMeetingBot = useCallback(async () => {
    const cleanUrl = meetingUrl.trim();
    if (!cleanUrl) {
      toast.error("Informe o link da reunião.");
      return;
    }

    setInvitingBot(true);
    try {
      const session = await ensureSession();
      const { data, error } = await supabase.functions.invoke("meeting-bot", {
        body: {
          session_id: session.id,
          meeting_url: cleanUrl,
          bot_name: botName.trim() || "Helena",
          language_code: "pt",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setActiveSession(data.session);
      setMeetingUrl(cleanUrl);
      toast.success("Copilot convidado para a reunião");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível convidar o Copilot");
    } finally {
      setInvitingBot(false);
    }
  }, [botName, ensureSession, meetingUrl]);

  const startNewSession = () => {
    setActiveSession(null);
    setTitle("Reunião sem título");
    setProfile("executive");
    setIncomingText("");
    setTranscript("");
    setAnalysis(EMPTY_MEETING_ANALYSIS);
    setMeetingUrl("");
    setBotName("Helena");
    setLastAnalyzedAt(null);
    setInterimTranscript("");
    setSpeechError(null);
    processedRef.current = "";
  };

  const loadSession = (session: MeetingCopilotSession) => {
    setActiveSession(session);
    setTitle(session.title);
    setProfile(session.profile);
    setIncomingText("");
    setTranscript(session.transcript ?? "");
    setAnalysis(normalizeMeetingAnalysis(session.analysis));
    setMeetingUrl(session.meeting_url ?? "");
    setBotName(session.bot_name ?? "Helena");
    setLastAnalyzedAt(session.updated_at);
    setInterimTranscript("");
    setSpeechError(null);
    processedRef.current = "";
  };

  const endSession = async () => {
    if (!activeSession) return;
    const ended = await updateSession.mutateAsync({
      id: activeSession.id,
      status: "ended",
      ended_at: new Date().toISOString(),
      title,
      transcript,
      analysis,
    });
    setActiveSession(ended);
    toast.success("Reunião encerrada e salva");
  };

  const stats = useMemo(() => [
    { label: "Trechos", value: segments.length },
    { label: "Decisões", value: analysis.decisions.length },
    { label: "Riscos", value: analysis.risks.length },
    { label: "Próximos passos", value: analysis.next_steps.length },
  ], [analysis, segments.length]);

  return (
    <div className="flex h-full min-h-[calc(100vh-2rem)] flex-col bg-background">
      <div className="border-b border-border px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Radio className="h-3 w-3" /> MVP
              </Badge>
              <Badge variant="outline">{activeProfile?.label}</Badge>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Meeting Copilot</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Assessor executivo em tempo real para identificar riscos, decisões, lacunas e próximos passos durante reuniões.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={startNewSession}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova reunião
            </Button>
            <Button variant="outline" onClick={() => processIncomingText(incomingText)} disabled={!incomingText.trim() || analyzing}>
              <Sparkles className="mr-1.5 h-4 w-4" /> Analisar trecho
            </Button>
            <Button variant={listening ? "destructive" : "outline"} onClick={listening ? stopListening : startListening}>
              {listening ? <MicOff className="mr-1.5 h-4 w-4" /> : <Mic className="mr-1.5 h-4 w-4" />}
              {listening ? "Parar escuta" : "Escutar reunião"}
            </Button>
            <Button onClick={endSession} disabled={!hasSession || activeSession?.status === "ended"}>
              <Square className="mr-1.5 h-4 w-4" /> Encerrar
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <main className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquareText className="h-4 w-4" /> Entrada da transcrição
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <div className="space-y-2">
                  <Label htmlFor="meeting-title">Título</Label>
                  <Input
                    id="meeting-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    onBlur={() => activeSession && updateSession.mutate({ id: activeSession.id, title })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Perfil</Label>
                  <Select value={profile} onValueChange={(value) => setProfile(value as MeetingCopilotProfile)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEETING_COPILOT_PROFILES.map((item) => (
                        <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                {activeProfile?.description}
              </div>

              <div className="rounded-lg border border-border bg-card p-3">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Link2 className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Convidar Copilot por link</p>
                      <p className="text-xs text-muted-foreground">
                        Envia um bot participante para Meet, Zoom ou Teams via provider externo. Ele transcreve todos os lados da reunião.
                      </p>
                    </div>
                  </div>
                  <BotStatusBadge session={activeSession} />
                </div>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
                  <Input
                    value={meetingUrl}
                    onChange={(event) => setMeetingUrl(event.target.value)}
                    placeholder="Cole o link da reunião, incluindo senha/passcode se a plataforma gerar no link"
                  />
                  <Input
                    value={botName}
                    onChange={(event) => setBotName(event.target.value)}
                    placeholder="Nome do bot"
                  />
                  <Button onClick={inviteMeetingBot} disabled={invitingBot || !meetingUrl.trim()}>
                    <Send className="mr-1.5 h-4 w-4" />
                    {invitingBot ? "Convidando..." : "Convidar"}
                  </Button>
                </div>
                {activeSession?.bot_error && (
                  <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {activeSession.bot_error}
                  </p>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  Para produção, configure `RECALL_API_KEY` e `RECALL_WEBHOOK_TOKEN` nas secrets do Supabase. O bot aparece como participante visível na reunião.
                </p>
              </div>

              <div className={cn(
                "rounded-lg border p-3",
                listening ? "border-primary/30 bg-primary/5" : "border-border bg-card"
              )}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {listening ? <Mic className="h-4 w-4 text-primary" /> : <MicOff className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <p className="text-sm font-medium">
                        {listening ? "Escutando pelo navegador" : "Escuta pelo navegador"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Usa o microfone local para transcrever trechos e alimentar o Copilot automaticamente.
                      </p>
                    </div>
                  </div>
                  <Button variant={listening ? "destructive" : "outline"} size="sm" onClick={listening ? stopListening : startListening}>
                    {listening ? "Parar" : "Iniciar escuta"}
                  </Button>
                </div>
                {!speechSupported && (
                  <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    Seu navegador pode não suportar Web Speech API. Se a escuta não iniciar, use Chrome/Edge ou cole a transcrição manualmente.
                  </p>
                )}
                {interimTranscript && (
                  <p className="mt-3 rounded-md bg-background px-3 py-2 text-sm italic text-muted-foreground">
                    {interimTranscript}
                  </p>
                )}
                {speechError && (
                  <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {speechError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="incoming-transcript">Trecho recebido em tempo real</Label>
                  <button
                    type="button"
                    onClick={() => setAutoAnalyze((current) => !current)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                      autoAnalyze ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground"
                    )}
                  >
                    <Play className="h-3 w-3" /> Auto-análise {autoAnalyze ? "ligada" : "desligada"}
                  </button>
                </div>
                <Textarea
                  id="incoming-transcript"
                  value={incomingText}
                  onChange={(event) => setIncomingText(event.target.value)}
                  placeholder="Cole aqui o próximo trecho da transcrição. Após uma pausa curta, o Copilot atualiza o painel automaticamente."
                  className="min-h-40 resize-y"
                />
                <p className="text-xs text-muted-foreground">
                  Cada trecho processado é anexado ao histórico da sessão e salvo no Supabase.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-4">
            {stats.map((item) => (
              <Card key={item.label}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock3 className="h-4 w-4" /> Histórico da sessão
              </CardTitle>
            </CardHeader>
            <CardContent>
              {segments.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Nenhum trecho processado ainda.
                </div>
              ) : (
                <ScrollArea className="h-[260px] pr-3">
                  <div className="space-y-3">
                    {segments.map((segment, index) => (
                      <div key={segment.id} className="rounded-lg border bg-card p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <Badge variant="outline">Trecho {index + 1}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(segment.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{segment.content}</p>
                        {(segment.speaker_name || segment.source) && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {segment.speaker_name ? `${segment.speaker_name} · ` : ""}{segment.source}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </main>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Brain className="h-4 w-4" /> Painel em tempo real
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {analyzing ? "Analisando novo trecho..." : lastAnalyzedAt ? `Atualizado ${new Date(lastAnalyzedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Aguardando transcrição"}
                  </p>
                </div>
                {analyzing && <Badge variant="secondary" className="animate-pulse">IA</Badge>}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-210px)] min-h-[560px]">
                <div className="space-y-4 p-4">
                  <AnalysisSection
                    icon={Lightbulb}
                    title="Resumo Executivo"
                    items={analysis.executive_summary ? [analysis.executive_summary] : []}
                    empty="Sem resumo ainda."
                    featured
                  />
                  <AnalysisSection icon={CheckCircle2} title="Decisões Tomadas" items={analysis.decisions} empty="Nenhuma decisão explícita." />
                  <AnalysisSection icon={ShieldAlert} title="Riscos Identificados" items={analysis.risks} empty="Nenhum risco claro identificado." />
                  <AnalysisSection icon={CircleHelp} title="Perguntas Críticas Não Respondidas" items={analysis.unanswered_questions} empty="Nenhuma lacuna crítica mapeada." />
                  <AnalysisSection icon={Target} title="Próxima Melhor Pergunta" items={analysis.next_best_question ? [analysis.next_best_question] : []} empty="Aguardando contexto suficiente." featured />
                  <AnalysisSection icon={AlertTriangle} title="Objeções Detectadas" items={analysis.objections} empty="Nenhuma objeção detectada." />
                  <AnalysisSection icon={BadgeCheck} title="Sinais de Compra" items={analysis.buying_signals} empty="Nenhum sinal de compra detectado." />
                  <AnalysisSection icon={Sparkles} title="Próximos Passos" items={analysis.next_steps} empty="Nenhum próximo passo definido." />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Reuniões salvas</CardTitle>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma sessão salva ainda.</p>
              ) : (
                <div className="space-y-2">
                  {sessions.slice(0, 6).map((session) => (
                    <button
                      key={session.id}
                      onClick={() => loadSession(session)}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                        activeSession?.id === session.id && "border-primary bg-primary/5"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="line-clamp-1 text-sm font-medium">{session.title}</span>
                        <Badge variant={session.status === "active" ? "secondary" : "outline"} className="text-[10px]">
                          {session.status === "active" ? "ativa" : "encerrada"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(session.updated_at).toLocaleDateString("pt-BR")} · {session.profile}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function BotStatusBadge({ session }: { session: MeetingCopilotSession | null }) {
  if (!session?.bot_id) return <Badge variant="outline">bot não convidado</Badge>;
  const status = session.bot_status ?? "created";
  const label = status === "transcribing" ? "transcrevendo" : status;
  return <Badge variant={status === "transcribing" ? "secondary" : "outline"}>{label}</Badge>;
}

function AnalysisSection({
  icon: Icon,
  title,
  items,
  empty,
  featured = false,
}: {
  icon: typeof Brain;
  title: string;
  items: string[];
  empty: string;
  featured?: boolean;
}) {
  return (
    <section className={cn("rounded-lg border p-3", featured ? "border-primary/20 bg-primary/5" : "bg-card")}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className={cn("h-4 w-4", featured ? "text-primary" : "text-muted-foreground")} />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={`${title}-${index}`} className="flex gap-2 text-sm leading-relaxed">
              {!featured && <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />}
              <p className={cn(featured ? "font-medium text-foreground" : "text-muted-foreground")}>{item}</p>
            </div>
          ))}
        </div>
      )}
      <Separator className="mt-3 opacity-0" />
    </section>
  );
}

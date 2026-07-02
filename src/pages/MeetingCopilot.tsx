import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Brain,
  CheckCircle2,
  CircleHelp,
  Download,
  Hash,
  Link2,
  ListChecks,
  Mic,
  MicOff,
  Play,
  Plus,
  Radio,
  Send,
  Square,
  Tag,
  Users,
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

const AUTO_ANALYZE_DELAY = 1600;

const CAPTURE_TYPES = [
  { value: "conversation", label: "Conversa" },
  { value: "meeting", label: "Reunião" },
  { value: "quick_note", label: "Nota rápida" },
  { value: "interview", label: "Entrevista" },
] as const;

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
  const [title, setTitle] = useState("Conversa sem título");
  const [theme, setTheme] = useState("");
  const [captureType, setCaptureType] = useState("conversation");
  const [profile, setProfile] = useState<MeetingCopilotProfile>("executive");
  const [incomingText, setIncomingText] = useState("");
  const [transcript, setTranscript] = useState("");
  const [analysis, setAnalysis] = useState<MeetingCopilotAnalysis>(EMPTY_MEETING_ANALYSIS);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [botName, setBotName] = useState("Nucleus Reuniões");
  const [invitingBot, setInvitingBot] = useState(false);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const recordingRef = useRef(false);
  const processedRef = useRef("");
  const processIncomingRef = useRef<(text: string, source?: "manual" | "browser" | "recall") => Promise<void>>(async () => {});

  const { data: segments = [] } = useMeetingCopilotSegments(activeSession?.id);
  const activeProfile = MEETING_COPILOT_PROFILES.find((item) => item.id === profile);
  const hasSession = !!activeSession;
  const speechSupported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const recordingSupported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  const ensureSession = useCallback(async () => {
    if (activeSession) return activeSession;
    const created = await createSession.mutateAsync({
      title,
      profile,
      theme: theme.trim() || null,
      capture_type: captureType,
    });
    setActiveSession(created);
    return created;
  }, [activeSession, captureType, createSession, profile, theme, title]);

  const analyzeCapture = useCallback(async (nextTranscript: string, latestSegment: string, sessionId: string) => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("meeting-copilot", {
        body: {
          profile,
          theme: theme.trim(),
          capture_type: captureType,
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
        theme: theme.trim() || nextAnalysis.theme_suggestion || null,
        capture_type: captureType,
        transcript: nextTranscript,
        analysis: nextAnalysis,
      });
      return nextAnalysis;
    } finally {
      setAnalyzing(false);
    }
  }, [analysis, captureType, profile, theme, title, updateSession]);

  const processIncomingText = useCallback(async (text: string, source: "manual" | "browser" | "recall" = "manual") => {
    const clean = text.trim();
    if (!clean || clean === processedRef.current) return;

    processedRef.current = clean;
    const session = await ensureSession();
    const nextTranscript = [transcript, clean].filter(Boolean).join("\n\n");
    setTranscript(nextTranscript);
    setIncomingText("");

    try {
      const nextAnalysis = await analyzeCapture(nextTranscript, clean, session.id);
      await createSegment.mutateAsync({
        session_id: session.id,
        content: clean,
        analysis_snapshot: nextAnalysis,
        source,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível processar a captura");
    }
  }, [analyzeCapture, createSegment, ensureSession, transcript]);

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
    if (!recordingStartedAt || !recording) return;
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - recordingStartedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [recording, recordingStartedAt]);

  useEffect(() => {
    return () => {
      recordingRef.current = false;
      recognitionRef.current?.stop();
      mediaRecorderRef.current?.stop();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startSpeechRecognition = useCallback(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechError("Transcrição automática indisponível neste navegador. A gravação de áudio ainda funciona; você também pode colar notas manualmente.");
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
      if (finalText) processIncomingRef.current(finalText, "browser");
    };

    recognition.onerror = (event) => {
      const message = event.error === "not-allowed"
        ? "Permissão de microfone negada. Autorize o microfone para gravar e transcrever."
        : `Erro na transcrição: ${event.error}`;
      setSpeechError(message);
    };

    recognition.onend = () => {
      if (!recordingRef.current) return;
      try {
        recognition.start();
      } catch {
        setSpeechError("A transcrição automática parou. A gravação continua se o navegador permitir.");
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (error) {
      setSpeechError(error instanceof Error ? error.message : "Não foi possível iniciar a transcrição automática.");
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!recordingSupported) {
      setSpeechError("Seu navegador não oferece gravação de áudio por MediaRecorder. Use a entrada manual de texto.");
      return;
    }

    try {
      await ensureSession();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recordingRef.current = true;
      setRecording(true);
      setSpeechError(null);
      setInterimTranscript("");
      setElapsedSeconds(0);
      setRecordingStartedAt(Date.now());
      recorder.start();
      startSpeechRecognition();
      toast.success("Gravação iniciada");
    } catch (error) {
      recordingRef.current = false;
      setRecording(false);
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar a gravação");
    }
  }, [audioUrl, ensureSession, recordingSupported, startSpeechRecognition]);

  const stopRecording = useCallback(async () => {
    recordingRef.current = false;
    setRecording(false);
    setRecordingStartedAt(null);
    setInterimTranscript("");
    recognitionRef.current?.stop();
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();

    if (activeSession) {
      const ended = await updateSession.mutateAsync({
        id: activeSession.id,
        status: "ended",
        ended_at: new Date().toISOString(),
        title,
        theme: theme.trim() || analysis.theme_suggestion || null,
        capture_type: captureType,
        transcript,
        analysis,
      });
      setActiveSession(ended);
    }
    toast.success("Captura encerrada");
  }, [activeSession, analysis, captureType, theme, title, transcript, updateSession]);

  const inviteMeetingBot = useCallback(async () => {
    const cleanUrl = meetingUrl.trim();
    if (!cleanUrl) {
      toast.error("Informe o link da video-call.");
      return;
    }

    setInvitingBot(true);
    try {
      const session = await ensureSession();
      const { data, error } = await supabase.functions.invoke("meeting-bot", {
        body: {
          session_id: session.id,
          meeting_url: cleanUrl,
          bot_name: botName.trim() || "Nucleus Reuniões",
          language_code: "pt",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setActiveSession(data.session);
      setMeetingUrl(cleanUrl);
      toast.success("Agente convidado para a video-call");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível convidar o agente");
    } finally {
      setInvitingBot(false);
    }
  }, [botName, ensureSession, meetingUrl]);

  const startNewSession = () => {
    setActiveSession(null);
    setTitle("Conversa sem título");
    setTheme("");
    setCaptureType("conversation");
    setProfile("executive");
    setIncomingText("");
    setTranscript("");
    setAnalysis(EMPTY_MEETING_ANALYSIS);
    setMeetingUrl("");
    setBotName("Nucleus Reuniões");
    setLastAnalyzedAt(null);
    setInterimTranscript("");
    setSpeechError(null);
    setElapsedSeconds(0);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    processedRef.current = "";
  };

  const loadSession = (session: MeetingCopilotSession) => {
    setActiveSession(session);
    setTitle(session.title);
    setTheme(session.theme ?? "");
    setCaptureType(session.capture_type ?? "conversation");
    setProfile(session.profile);
    setIncomingText("");
    setTranscript(session.transcript ?? "");
    setAnalysis(normalizeMeetingAnalysis(session.analysis));
    setMeetingUrl(session.meeting_url ?? "");
    setBotName(session.bot_name ?? "Nucleus Reuniões");
    setLastAnalyzedAt(session.updated_at);
    setInterimTranscript("");
    setSpeechError(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    processedRef.current = "";
  };

  const stats = useMemo(() => [
    { label: "Trechos", value: segments.length },
    { label: "Decisões", value: analysis.decisions.length },
    { label: "Tarefas", value: analysis.action_items.length },
    { label: "Temas", value: [analysis.theme_suggestion, ...analysis.related_themes].filter(Boolean).length },
  ], [analysis, segments.length]);

  return (
    <div className="flex h-full min-h-[calc(100vh-2rem)] flex-col bg-background">
      <div className="border-b border-border px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Radio className="h-3 w-3" /> Reuniões
              </Badge>
              <Badge variant="outline">gravação por celular</Badge>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Reuniões</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Grave conversas, reuniões e notas rápidas. O Nucleus transforma a captura em resumo, decisões, tarefas e temas para recuperar depois.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={startNewSession}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova captura
            </Button>
            <Button
              size="lg"
              variant={recording ? "destructive" : "default"}
              onClick={recording ? stopRecording : startRecording}
            >
              {recording ? <Square className="mr-1.5 h-4 w-4" /> : <Mic className="mr-1.5 h-4 w-4" />}
              {recording ? "Encerrar" : "Gravar"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <main className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mic className="h-4 w-4" /> Captura
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                <div className="space-y-2">
                  <Label htmlFor="capture-title">Título</Label>
                  <Input
                    id="capture-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    onBlur={() => activeSession && updateSession.mutate({ id: activeSession.id, title })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={captureType} onValueChange={setCaptureType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CAPTURE_TYPES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <div className="space-y-2">
                  <Label htmlFor="capture-theme">Tema</Label>
                  <Input
                    id="capture-theme"
                    value={theme}
                    onChange={(event) => setTheme(event.target.value)}
                    onBlur={() => activeSession && updateSession.mutate({ id: activeSession.id, theme: theme.trim() || null })}
                    placeholder="Produto, Cliente X, Equipe, Pessoal..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Modo de análise</Label>
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

              <div className={cn(
                "grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto]",
                recording ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20"
              )}>
                <div className="flex items-start gap-3">
                  {recording ? <Mic className="mt-0.5 h-5 w-5 text-primary" /> : <MicOff className="mt-0.5 h-5 w-5 text-muted-foreground" />}
                  <div>
                    <p className="text-sm font-medium">
                      {recording ? `Gravando ${formatDuration(elapsedSeconds)}` : "Pronto para gravar pelo celular"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      A gravação gera um áudio local nesta sessão e, quando o navegador permitir, transcreve em tempo real para organizar por tema.
                    </p>
                    {interimTranscript && (
                      <p className="mt-3 rounded-md bg-background px-3 py-2 text-sm italic text-muted-foreground">
                        {interimTranscript}
                      </p>
                    )}
                  </div>
                </div>
                <Button variant={recording ? "destructive" : "default"} onClick={recording ? stopRecording : startRecording}>
                  {recording ? <Square className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}
                  {recording ? "Parar" : "Iniciar"}
                </Button>
              </div>

              {speechError && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {speechError}
                </p>
              )}

              {audioUrl && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <audio src={audioUrl} controls className="h-9 max-w-full" />
                  <Button variant="outline" size="sm" asChild>
                    <a href={audioUrl} download={`${title || "reuniao"}.webm`}>
                      <Download className="mr-1.5 h-4 w-4" /> Baixar áudio
                    </a>
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="incoming-transcript">Texto manual ou transcrição recebida</Label>
                  <button
                    type="button"
                    onClick={() => setAutoAnalyze((current) => !current)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                      autoAnalyze ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground"
                    )}
                  >
                    <Play className="h-3 w-3" /> Auto {autoAnalyze ? "ligado" : "desligado"}
                  </button>
                </div>
                <Textarea
                  id="incoming-transcript"
                  value={incomingText}
                  onChange={(event) => setIncomingText(event.target.value)}
                  placeholder="Cole uma anotação, trecho de conversa ou transcrição. O Nucleus organiza isso dentro da captura."
                  className="min-h-32 resize-y"
                />
                <Button variant="outline" onClick={() => processIncomingText(incomingText)} disabled={!incomingText.trim() || analyzing}>
                  <Brain className="mr-1.5 h-4 w-4" /> Processar texto
                </Button>
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
                <Link2 className="h-4 w-4" /> Video-calls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Camada futura dentro de Reuniões: convide um agente para Meet, Zoom ou Teams quando quiser capturar chamadas automaticamente.
                </p>
                <BotStatusBadge session={activeSession} />
              </div>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
                <Input
                  value={meetingUrl}
                  onChange={(event) => setMeetingUrl(event.target.value)}
                  placeholder="Link da video-call"
                />
                <Input
                  value={botName}
                  onChange={(event) => setBotName(event.target.value)}
                  placeholder="Nome do agente"
                />
                <Button onClick={inviteMeetingBot} disabled={invitingBot || !meetingUrl.trim()}>
                  <Send className="mr-1.5 h-4 w-4" />
                  {invitingBot ? "Convidando..." : "Convidar"}
                </Button>
              </div>
              {activeSession?.bot_error && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {activeSession.bot_error}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4" /> Histórico da captura
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
                    <Brain className="h-4 w-4" /> Nota organizada
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {analyzing ? "Organizando novo trecho..." : lastAnalyzedAt ? `Atualizada ${new Date(lastAnalyzedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Aguardando captura"}
                  </p>
                </div>
                {analyzing && <Badge variant="secondary" className="animate-pulse">IA</Badge>}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-210px)] min-h-[560px]">
                <div className="space-y-4 p-4">
                  <AnalysisSection icon={Brain} title="Resumo" items={analysis.summary ? [analysis.summary] : []} empty="Sem resumo ainda." featured />
                  <AnalysisSection icon={Hash} title="Tópicos" items={analysis.key_topics} empty="Nenhum tópico identificado." />
                  <AnalysisSection icon={CheckCircle2} title="Decisões" items={analysis.decisions} empty="Nenhuma decisão explícita." />
                  <AnalysisSection icon={ListChecks} title="Tarefas" items={analysis.action_items} empty="Nenhuma tarefa clara." />
                  <AnalysisSection icon={CircleHelp} title="Perguntas abertas" items={analysis.open_questions} empty="Nenhuma pergunta aberta." />
                  <AnalysisSection icon={Users} title="Pessoas citadas" items={analysis.people} empty="Nenhuma pessoa identificada." />
                  <AnalysisSection
                    icon={Tag}
                    title="Temas e tags"
                    items={[analysis.theme_suggestion, ...analysis.related_themes, ...analysis.tags].filter(Boolean)}
                    empty="Nenhum tema sugerido."
                  />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Capturas salvas</CardTitle>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma captura salva ainda.</p>
              ) : (
                <div className="space-y-2">
                  {sessions.slice(0, 8).map((session) => (
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
                          {session.status === "active" ? "ativa" : "salva"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(session.updated_at).toLocaleDateString("pt-BR")} · {session.theme || normalizeMeetingAnalysis(session.analysis).theme_suggestion || "sem tema"}
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
  if (!session?.bot_id) return <Badge variant="outline">agente não convidado</Badge>;
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

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

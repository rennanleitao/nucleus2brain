import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  CircleHelp,
  Download,
  FileText,
  Laptop,
  ListChecks,
  Loader2,
  Mic,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Send,
  Square,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_MEETING_ANALYSIS,
  type MeetingCopilotAnalysis,
  type MeetingCopilotSession,
  normalizeMeetingAnalysis,
  useCreateMeetingCopilotSegment,
  useCreateMeetingCopilotSession,
  useMeetingCopilotSession,
  useUpdateMeetingCopilotSession,
} from "@/hooks/useMeetingCopilot";
import { cn } from "@/lib/utils";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionErrors";
import { SaveMeetingToNoteDialog } from "@/components/meeting/SaveMeetingToNoteDialog";
import { toast } from "sonner";

type MeetingMode = "in_person" | "online";
type RecStatus = "idle" | "recording" | "paused" | "processing";

interface Take {
  id: string;
  url: string;
  mimeType: string;
  durationSeconds: number;
  createdAt: string;
  transcript: string;
  status: "processing" | "ready" | "error";
}

const MEETING_TYPES = [
  { value: "general", label: "Geral" },
  { value: "sales", label: "Cliente/Vendas" },
  { value: "relationship", label: "Relacionamento" },
  { value: "process", label: "Processos" },
] as const;

export default function MeetingCopilot() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId?: string }>();
  const isNew = !sessionId;

  const { data: routedSession } = useMeetingCopilotSession(sessionId);
  const createSession = useCreateMeetingCopilotSession();
  const updateSession = useUpdateMeetingCopilotSession();
  const createSegment = useCreateMeetingCopilotSegment();

  const [mode, setMode] = useState<MeetingMode>("in_person");
  const [activeSession, setActiveSession] = useState<MeetingCopilotSession | null>(null);
  const [title, setTitle] = useState("");
  const [meetingWith, setMeetingWith] = useState("");
  const [theme, setTheme] = useState("");
  const [meetingType, setMeetingType] = useState("general");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [botName, setBotName] = useState("Helena");
  const [manualText, setManualText] = useState("");
  const [transcript, setTranscript] = useState("");
  const [analysis, setAnalysis] = useState<MeetingCopilotAnalysis>(EMPTY_MEETING_ANALYSIS);
  const [editableSummary, setEditableSummary] = useState("");

  const [recStatus, setRecStatus] = useState<RecStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [takes, setTakes] = useState<Take[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [invitingBot, setInvitingBot] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [meetingsFieldsCollapsed, setMeetingsFieldsCollapsed] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const takesRef = useRef<Take[]>([]);
  const activeSessionRef = useRef<MeetingCopilotSession | null>(null);
  const sessionCreationRef = useRef<Promise<MeetingCopilotSession> | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const totalRecordedRef = useRef(0);
  const transcriptRef = useRef("");
  const analysisRef = useRef<MeetingCopilotAnalysis>(EMPTY_MEETING_ANALYSIS);
  const transcriptDirtyRef = useRef(false);

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { analysisRef.current = analysis; }, [analysis]);
  useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);
  useEffect(() => { takesRef.current = takes; }, [takes]);
  useEffect(() => { setEditableSummary(analysis.summary || ""); }, [analysis.summary]);

  useEffect(() => {
    if (!routedSession || activeSession?.id === routedSession.id) return;
    activeSessionRef.current = routedSession;
    setActiveSession(routedSession);
    setMode(routedSession.meeting_url ? "online" : "in_person");
    setTitle(routedSession.title || "");
    setTheme(routedSession.theme ?? "");
    setMeetingType(
      routedSession.profile === "sales" ? "sales"
      : routedSession.profile === "csc" ? "relationship"
      : routedSession.profile === "rpa" ? "process"
      : "general"
    );
    setMeetingUrl(routedSession.meeting_url ?? "");
    setBotName(routedSession.bot_name ?? "Helena");
    setTranscript(routedSession.transcript ?? "");
    setAnalysis(normalizeMeetingAnalysis(routedSession.analysis));
    if ((routedSession.transcript ?? "").trim()) setMeetingsFieldsCollapsed(true);
  }, [routedSession, activeSession?.id]);

  useEffect(() => {
    if (recStatus !== "recording") return;
    const interval = window.setInterval(() => {
      const started = recordingStartedAtRef.current ?? Date.now();
      setElapsedSeconds(totalRecordedRef.current + Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [recStatus]);

  useEffect(() => {
    return () => {
      try {
        if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
      } catch { /* noop */ }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      takesRef.current.forEach((c) => URL.revokeObjectURL(c.url));
    };
  }, []);

  const derivedTitle = useMemo(() => {
    if (title.trim()) return title.trim();
    if (meetingWith.trim() && theme.trim()) return `${meetingWith.trim()} - ${theme.trim()}`;
    if (meetingWith.trim()) return `Reunião com ${meetingWith.trim()}`;
    if (theme.trim()) return `Reunião sobre ${theme.trim()}`;
    return "Reunião sem título";
  }, [meetingWith, theme, title]);

  const canRecord = typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";

  const profileFromType = (t: string) =>
    t === "sales" ? "sales" as const
    : t === "relationship" ? "csc" as const
    : t === "process" ? "rpa" as const
    : "executive" as const;

  const ensureSession = useCallback(async (): Promise<MeetingCopilotSession> => {
    if (activeSessionRef.current) return activeSessionRef.current;
    if (sessionCreationRef.current) return sessionCreationRef.current;

    const creation = createSession.mutateAsync({
      title: derivedTitle,
      profile: profileFromType(meetingType),
      theme: theme.trim() || null,
      capture_type: mode === "online" ? "online_meeting" : "in_person_meeting",
    }).then((created) => {
      activeSessionRef.current = created;
      setActiveSession(created);
      navigate(`/reunioes/${created.id}`, { replace: true });
      return created;
    });

    sessionCreationRef.current = creation;
    try {
      return await creation;
    } finally {
      sessionCreationRef.current = null;
    }
  }, [createSession, derivedTitle, meetingType, mode, navigate, theme]);

  const runAnalysis = useCallback(async (fullTranscript: string, sid: string, appended: string) => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("meeting-copilot", {
        body: {
          profile: profileFromType(meetingType),
          theme: theme.trim(),
          meeting_with: meetingWith.trim(),
          capture_type: mode === "online" ? "online_meeting" : "in_person_meeting",
          transcript: fullTranscript,
          latest_segment: appended,
          previous_analysis: analysisRef.current,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const next = normalizeMeetingAnalysis(data?.analysis);
      setAnalysis(next);
      await updateSession.mutateAsync({
        id: sid,
        title: derivedTitle,
        theme: theme.trim() || next.theme_suggestion || null,
        capture_type: mode === "online" ? "online_meeting" : "in_person_meeting",
        transcript: fullTranscript,
        analysis: next,
      });
      return next;
    } catch (err) {
      toast.error(getEdgeFunctionErrorMessage(err, "Não foi possível organizar a reunião"));
      throw err;
    } finally {
      setAnalyzing(false);
    }
  }, [derivedTitle, meetingType, meetingWith, mode, theme, updateSession]);

  const appendToTranscript = useCallback(async (text: string, source: "manual" | "browser" | "recall" = "manual"): Promise<string | null> => {
    const clean = text.trim();
    if (!clean) return null;
    try {
      const session = await ensureSession();
      const prev = transcriptRef.current.trim();
      const next = prev ? `${prev}\n\n---\n\n${clean}` : clean;
      transcriptRef.current = next;
      setTranscript(next);
      setMeetingsFieldsCollapsed(true);
      await updateSession.mutateAsync({ id: session.id, transcript: next });
      const nextAnalysis = await runAnalysis(next, session.id, clean).catch(() => null);
      await createSegment.mutateAsync({
        session_id: session.id,
        content: clean,
        analysis_snapshot: nextAnalysis,
        source,
      }).catch(() => null);
      return clean;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao anexar texto");
      return null;
    }
  }, [createSegment, ensureSession, runAnalysis, updateSession]);

  const transcribeBlob = useCallback(async (blob: Blob, mimeType: string) => {
    const audioBase64 = await blobToBase64(blob);
    const { data, error } = await supabase.functions.invoke("transcribe-meeting-audio", {
      body: { audio_base64: audioBase64, mime_type: mimeType },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    const text = typeof data?.transcript === "string" ? data.transcript.trim() : "";
    if (!text) throw new Error("A transcrição voltou vazia.");
    return text;
  }, []);

  const finalizeRecording = useCallback(async () => {
    const chunks = audioChunksRef.current;
    audioChunksRef.current = [];
    if (!chunks.length) return;

    const mimeType = mediaRecorderRef.current?.mimeType || chunks[0].type || "audio/webm";
    const blob = new Blob(chunks, { type: mimeType });
    if (blob.size === 0) return;

    const takeId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const take: Take = {
      id: takeId,
      url: URL.createObjectURL(blob),
      mimeType,
      durationSeconds: totalRecordedRef.current,
      createdAt: new Date().toISOString(),
      transcript: "",
      status: "processing",
    };
    setTakes((prev) => [...prev, take]);

    setRecStatus("processing");
    try {
      const text = await transcribeBlob(blob, mimeType);
      setTakes((prev) => prev.map((t) => t.id === takeId ? { ...t, transcript: text, status: "ready" } : t));
      await appendToTranscript(text, "manual");
      toast.success("Gravação transcrita");
    } catch (err) {
      setTakes((prev) => prev.map((t) => t.id === takeId ? { ...t, status: "error" } : t));
      toast.error(getEdgeFunctionErrorMessage(err, "Não foi possível transcrever o áudio"));
    } finally {
      setRecStatus("idle");
      setElapsedSeconds(0);
      totalRecordedRef.current = 0;
    }
  }, [appendToTranscript, transcribeBlob]);

  const startRecording = useCallback(async () => {
    if (!canRecord) {
      setRecError("Este navegador não suporta gravação. Use Chrome, Edge ou Safari atualizado.");
      return;
    }
    try {
      setRecError(null);
      await ensureSession();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];
      totalRecordedRef.current = 0;
      recordingStartedAtRef.current = Date.now();

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        void finalizeRecording();
      };
      recorder.start();
      setRecStatus("recording");
      setElapsedSeconds(0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível iniciar a gravação");
    }
  }, [canRecord, ensureSession, finalizeRecording]);

  const pauseRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.pause();
    const started = recordingStartedAtRef.current ?? Date.now();
    totalRecordedRef.current += Math.floor((Date.now() - started) / 1000);
    recordingStartedAtRef.current = null;
    setRecStatus("paused");
  };

  const resumeRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    recorder.resume();
    recordingStartedAtRef.current = Date.now();
    setRecStatus("recording");
  };

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      const started = recordingStartedAtRef.current ?? Date.now();
      if (recorder.state === "recording") {
        totalRecordedRef.current += Math.floor((Date.now() - started) / 1000);
      }
      recorder.stop();
    }
  }, []);

  const inviteOnlineAgent = useCallback(async () => {
    const cleanUrl = meetingUrl.trim();
    if (!cleanUrl) { toast.error("Cole o link da reunião online."); return; }
    setInvitingBot(true);
    try {
      const session = await ensureSession();
      const { data, error } = await supabase.functions.invoke("meeting-bot", {
        body: { session_id: session.id, meeting_url: cleanUrl, bot_name: botName.trim() || "Helena", language_code: "pt" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setActiveSession(data.session);
      toast.success("Agente enviado para a reunião online");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o agente");
    } finally {
      setInvitingBot(false);
    }
  }, [botName, ensureSession, meetingUrl]);

  const deleteTake = (takeId: string) => {
    setTakes((prev) => {
      const t = prev.find((x) => x.id === takeId);
      if (t) URL.revokeObjectURL(t.url);
      return prev.filter((x) => x.id !== takeId);
    });
  };

  const commitTranscriptEdit = useCallback(async () => {
    if (!transcriptDirtyRef.current) return;
    transcriptDirtyRef.current = false;
    const session = activeSessionRef.current;
    if (!session) return;
    try {
      await updateSession.mutateAsync({ id: session.id, transcript: transcriptRef.current });
    } catch (err) {
      toast.error("Não foi possível salvar a transcrição");
    }
  }, [updateSession]);

  const commitSummaryEdit = useCallback(async () => {
    const session = activeSessionRef.current;
    if (!session) return;
    const next = { ...analysisRef.current, summary: editableSummary };
    setAnalysis(next);
    try {
      await updateSession.mutateAsync({ id: session.id, analysis: next });
      toast.success("Resumo atualizado");
    } catch (err) {
      toast.error("Erro ao salvar resumo");
    }
  }, [editableSummary, updateSession]);

  const reorganize = useCallback(async () => {
    const session = activeSessionRef.current;
    if (!session || !transcriptRef.current.trim()) {
      toast.error("Não há transcrição para reorganizar.");
      return;
    }
    await runAnalysis(transcriptRef.current, session.id, transcriptRef.current.slice(-500)).catch(() => null);
  }, [runAnalysis]);

  const composedMarkdown = useMemo(
    () => composeMeetingMarkdown({
      title: derivedTitle,
      meetingWith,
      theme,
      transcript,
      analysis: { ...analysis, summary: editableSummary },
    }),
    [derivedTitle, meetingWith, theme, transcript, analysis, editableSummary],
  );

  const handleBack = () => navigate("/reunioes");

  const isRecording = recStatus === "recording";
  const isPaused = recStatus === "paused";
  const isProcessing = recStatus === "processing";
  const hasTranscript = Boolean(transcript.trim());

  return (
    <div className="flex min-h-[calc(100vh-2rem)] flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-9 w-9 shrink-0" title="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1 text-[10px]">
                  {mode === "online" ? <Laptop className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                  {mode === "online" ? "Online" : "Presencial"}
                </Badge>
                {isRecording && (
                  <Badge variant="destructive" className="animate-pulse gap-1 text-[10px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" /> REC
                  </Badge>
                )}
                {analyzing && <Badge variant="secondary" className="animate-pulse text-[10px]">Organizando</Badge>}
              </div>
              <h1 className="mt-0.5 truncate text-lg font-semibold tracking-tight sm:text-xl">{isNew && !activeSession ? "Nova reunião" : derivedTitle}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isNew && !activeSession && (
              <div className="flex rounded-md border p-0.5">
                <button onClick={() => setMode("in_person")} className={cn("rounded px-2.5 py-1 text-xs font-medium transition", mode === "in_person" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>Presencial</button>
                <button onClick={() => setMode("online")} className={cn("rounded px-2.5 py-1 text-xs font-medium transition", mode === "online" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>Online</button>
              </div>
            )}
            {hasTranscript && (
              <Button size="sm" onClick={() => setShowSaveDialog(true)}>
                <Save className="mr-1.5 h-4 w-4" /> Salvar em nota
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5 sm:px-6">
        {/* Compact meeting fields */}
        <Card>
          <CardHeader className="cursor-pointer py-3" onClick={() => setMeetingsFieldsCollapsed((v) => !v)}>
            <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> Detalhes da reunião
              </span>
              <span className="text-xs">{meetingsFieldsCollapsed ? "Expandir" : "Recolher"}</span>
            </CardTitle>
          </CardHeader>
          {!meetingsFieldsCollapsed && (
            <CardContent className="space-y-4 pt-0">
              <MeetingFields
                title={title} setTitle={setTitle}
                meetingWith={meetingWith} setMeetingWith={setMeetingWith}
                theme={theme} setTheme={setTheme}
                meetingType={meetingType} setMeetingType={setMeetingType}
              />
              {mode === "online" && (
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                  <div className="space-y-2">
                    <Label htmlFor="meeting-url">Link da reunião</Label>
                    <Input id="meeting-url" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="Google Meet, Teams ou Zoom" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bot-name">Agente</Label>
                    <Input id="bot-name" value={botName} onChange={(e) => setBotName(e.target.value)} />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={inviteOnlineAgent} disabled={invitingBot || !meetingUrl.trim()} className="w-full">
                      <Send className="mr-1.5 h-4 w-4" />
                      {invitingBot ? "Enviando..." : "Enviar"}
                    </Button>
                  </div>
                </div>
              )}
              {mode === "online" && <BotStatus session={activeSession} />}
            </CardContent>
          )}
        </Card>

        {mode === "in_person" && (
          <Card>
            <CardContent className="space-y-4 p-5">
              {/* Big central recorder */}
              <div className={cn(
                "flex flex-col items-center gap-4 rounded-xl border-2 border-dashed p-8 text-center transition",
                isRecording ? "border-primary/50 bg-primary/5"
                : isPaused ? "border-amber-500/40 bg-amber-500/5"
                : "border-border bg-muted/10",
              )}>
                <div className={cn(
                  "flex h-20 w-20 items-center justify-center rounded-full transition",
                  isRecording ? "bg-primary/15 text-primary animate-pulse"
                  : isPaused ? "bg-amber-500/15 text-amber-600"
                  : "bg-muted text-muted-foreground",
                )}>
                  {isProcessing ? <Loader2 className="h-10 w-10 animate-spin" /> : <Mic className="h-10 w-10" />}
                </div>
                <div>
                  <p className="text-4xl font-semibold tabular-nums tracking-tight">{formatDuration(elapsedSeconds)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isRecording ? "Gravando..."
                    : isPaused ? "Pausado"
                    : isProcessing ? "Transcrevendo áudio..."
                    : takes.length > 0 ? "Grave outro trecho para adicionar à mesma reunião" : "Pronto para gravar"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {recStatus === "idle" && (
                    <Button size="lg" onClick={startRecording} disabled={isProcessing} className="h-12 px-6">
                      {takes.length > 0 ? <Plus className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}
                      {takes.length > 0 ? "Nova gravação" : "Iniciar gravação"}
                    </Button>
                  )}
                  {isRecording && (
                    <>
                      <Button size="lg" variant="outline" onClick={pauseRecording}>
                        <Pause className="mr-1.5 h-4 w-4" /> Pausar
                      </Button>
                      <Button size="lg" variant="destructive" onClick={stopRecording}>
                        <Square className="mr-1.5 h-4 w-4" /> Parar
                      </Button>
                    </>
                  )}
                  {isPaused && (
                    <>
                      <Button size="lg" onClick={resumeRecording}>
                        <Play className="mr-1.5 h-4 w-4" /> Retomar
                      </Button>
                      <Button size="lg" variant="destructive" onClick={stopRecording}>
                        <Square className="mr-1.5 h-4 w-4" /> Parar
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {recError && (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  {recError}
                </p>
              )}

              {takes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Gravações desta reunião</Label>
                    <span className="text-xs text-muted-foreground">{takes.length} {takes.length === 1 ? "trecho" : "trechos"}</span>
                  </div>
                  <div className="space-y-2">
                    {takes.map((take, i) => (
                      <div key={take.id} className="rounded-lg border bg-card p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">#{i + 1}</Badge>
                          <span className="text-xs font-medium tabular-nums text-muted-foreground">{formatDuration(take.durationSeconds)}</span>
                          {take.status === "processing" && <Badge variant="secondary" className="gap-1 text-[10px]"><Loader2 className="h-3 w-3 animate-spin" /> transcrevendo</Badge>}
                          {take.status === "error" && <Badge variant="destructive" className="text-[10px]">falha</Badge>}
                          <audio src={take.url} controls className="h-8 flex-1 min-w-40" />
                          <Button variant="ghost" size="icon" asChild title="Baixar áudio">
                            <a href={take.url} download={`reuniao-${i + 1}.${getAudioExtension(take.mimeType)}`}>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteTake(take.id)} title="Remover gravação">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {take.transcript && (
                          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{take.transcript}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <details className="rounded-md border bg-muted/10 p-3">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Adicionar texto colado</summary>
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="Cole uma transcrição, observação ou trecho."
                    className="min-h-20"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => { const r = await appendToTranscript(manualText); if (r) setManualText(""); }}
                    disabled={!manualText.trim() || analyzing}
                  >
                    <Brain className="mr-1.5 h-4 w-4" /> Adicionar
                  </Button>
                </div>
              </details>
            </CardContent>
          </Card>
        )}

        {hasTranscript && (
          <>
            {/* Editable transcript */}
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" /> Transcrição
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">Texto capturado das gravações — edite livremente para corrigir palavras ou nomes.</p>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={transcript}
                  onChange={(e) => { setTranscript(e.target.value); transcriptDirtyRef.current = true; }}
                  onBlur={commitTranscriptEdit}
                  className="min-h-64 resize-y font-mono text-sm leading-relaxed"
                />
              </CardContent>
            </Card>

            {/* Editable organized summary */}
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Brain className="h-4 w-4" /> Sugestão organizada
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">Reorganização feita pela IA. Ajuste livremente antes de exportar.</p>
                </div>
                <Button size="sm" variant="outline" onClick={reorganize} disabled={analyzing}>
                  <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", analyzing && "animate-spin")} />
                  Reorganizar
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Resumo</Label>
                  <Textarea
                    value={editableSummary}
                    onChange={(e) => setEditableSummary(e.target.value)}
                    onBlur={commitSummaryEdit}
                    placeholder="Resumo executivo da reunião..."
                    className="min-h-32 text-sm leading-relaxed"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <AnalysisListBlock icon={CheckCircle2} title="Decisões" items={analysis.decisions} empty="Sem decisões." />
                  <AnalysisListBlock icon={ListChecks} title="Tarefas" items={analysis.action_items} empty="Sem tarefas." />
                  <AnalysisListBlock icon={Users} title="Pessoas" items={analysis.people} empty="Não identificadas." />
                  <AnalysisListBlock icon={CircleHelp} title="Perguntas abertas" items={analysis.open_questions} empty="Nenhuma." />
                  <AnalysisListBlock
                    icon={Tag}
                    title="Temas e tags"
                    items={[analysis.theme_suggestion, ...analysis.key_topics, ...analysis.related_themes, ...analysis.tags].filter(Boolean)}
                    empty="Sem tema."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Preview / final document */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Prévia do documento final</CardTitle>
                <p className="text-xs text-muted-foreground">Como ficará ao enviar para uma nota.</p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[60vh] rounded-lg border bg-muted/10 p-5">
                  <MarkdownView>{composedMarkdown}</MarkdownView>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Sticky bottom action */}
            <div className="sticky bottom-4 z-10 flex justify-end">
              <Button size="lg" onClick={() => setShowSaveDialog(true)} className="shadow-lg">
                <Save className="mr-1.5 h-4 w-4" /> Salvar em nota
              </Button>
            </div>
          </>
        )}

        {!hasTranscript && mode === "in_person" && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <Radio className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Ainda sem conteúdo</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Grave um trecho ou cole um texto para começar. Você pode adicionar várias gravações à mesma reunião.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <SaveMeetingToNoteDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        defaultTitle={derivedTitle}
        markdownContent={composedMarkdown}
        onSaved={(noteId) => navigate(`/notes?id=${noteId}`)}
      />
    </div>
  );
}

/* ---------------------- Reusable pieces ---------------------- */

function MarkdownView({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:leading-relaxed prose-li:my-0.5 prose-strong:text-foreground prose-hr:my-6">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}

function MeetingFields({
  title, setTitle, meetingWith, setMeetingWith, theme, setTheme, meetingType, setMeetingType,
}: {
  title: string; setTitle: (v: string) => void;
  meetingWith: string; setMeetingWith: (v: string) => void;
  theme: string; setTheme: (v: string) => void;
  meetingType: string; setMeetingType: (v: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="meeting-title">Título</Label>
        <Input id="meeting-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reunião sem título" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="meeting-with">Com quem</Label>
        <Input id="meeting-with" value={meetingWith} onChange={(e) => setMeetingWith(e.target.value)} placeholder="Pessoa, cliente ou equipe" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="meeting-theme">Tema</Label>
        <Input id="meeting-theme" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Produto, proposta, alinhamento..." />
      </div>
      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select value={meetingType} onValueChange={setMeetingType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {MEETING_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function BotStatus({ session }: { session: MeetingCopilotSession | null }) {
  if (!session?.bot_id) return <p className="text-sm text-muted-foreground">O agente ainda não foi enviado.</p>;
  return (
    <div className="rounded-lg border p-3 text-sm">
      <p className="font-medium">Agente enviado</p>
      <p className="mt-1 text-muted-foreground">Status: {session.bot_status === "transcribing" ? "transcrevendo" : session.bot_status ?? "criado"}</p>
      {session.bot_error && <p className="mt-2 text-destructive">{session.bot_error}</p>}
    </div>
  );
}

function AnalysisListBlock({
  icon: Icon, title, items, empty,
}: {
  icon: typeof Brain; title: string; items: string[]; empty: string;
}) {
  return (
    <section className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="text-sm leading-relaxed">
              <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-0 prose-strong:text-foreground">
                <ReactMarkdown>{`- ${item}`}</ReactMarkdown>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------------- Utils ---------------------- */

function composeMeetingMarkdown({
  title, meetingWith, theme, transcript, analysis,
}: {
  title: string;
  meetingWith: string;
  theme: string;
  transcript: string;
  analysis: MeetingCopilotAnalysis;
}): string {
  const parts: string[] = [];
  parts.push(`# ${title}`);
  const meta: string[] = [];
  if (meetingWith.trim()) meta.push(`**Com:** ${meetingWith.trim()}`);
  if (theme.trim()) meta.push(`**Tema:** ${theme.trim()}`);
  meta.push(`**Data:** ${new Date().toLocaleDateString("pt-BR")}`);
  if (meta.length) parts.push(meta.join(" · "));

  if (analysis.summary.trim()) {
    parts.push("## Resumo");
    parts.push(analysis.summary.trim());
  }
  if (analysis.decisions.length) {
    parts.push("## Decisões");
    parts.push(analysis.decisions.map((d) => `- ${d}`).join("\n"));
  }
  if (analysis.action_items.length) {
    parts.push("## Tarefas");
    parts.push(analysis.action_items.map((d) => `- ${d}`).join("\n"));
  }
  if (analysis.open_questions.length) {
    parts.push("## Perguntas abertas");
    parts.push(analysis.open_questions.map((d) => `- ${d}`).join("\n"));
  }
  if (analysis.people.length) {
    parts.push("## Pessoas");
    parts.push(analysis.people.map((d) => `- ${d}`).join("\n"));
  }
  const tags = [analysis.theme_suggestion, ...analysis.key_topics, ...analysis.related_themes, ...analysis.tags].filter(Boolean);
  if (tags.length) {
    parts.push("## Temas");
    parts.push(tags.map((d) => `- ${d}`).join("\n"));
  }
  if (transcript.trim()) {
    parts.push("## Transcrição");
    parts.push(transcript.trim());
  }
  return parts.join("\n\n");
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(new Error("Não foi possível preparar o áudio para transcrição"));
    reader.readAsDataURL(blob);
  });
}

function getAudioExtension(mimeType: string) {
  const n = mimeType.toLowerCase();
  if (n.includes("mpeg") || n.includes("mp3")) return "mp3";
  if (n.includes("mp4") || n.includes("m4a")) return "m4a";
  if (n.includes("wav")) return "wav";
  return "webm";
}

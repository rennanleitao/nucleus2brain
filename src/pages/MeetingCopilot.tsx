import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  CircleHelp,
  Download,
  Laptop,
  ListChecks,
  Loader2,
  Mic,
  Pause,
  Play,
  Radio,
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
import { toast } from "sonner";

type MeetingMode = "in_person" | "online";
type RecStatus = "idle" | "recording" | "paused" | "processing";

interface RecordedAudio {
  id: string;
  url: string;
  mimeType: string;
  durationSeconds: number;
  createdAt: string;
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

  const [recStatus, setRecStatus] = useState<RecStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioClips, setAudioClips] = useState<RecordedAudio[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [invitingBot, setInvitingBot] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioClipsRef = useRef<RecordedAudio[]>([]);
  const activeSessionRef = useRef<MeetingCopilotSession | null>(null);
  const sessionCreationRef = useRef<Promise<MeetingCopilotSession> | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const totalRecordedRef = useRef(0);
  const transcriptRef = useRef("");
  const analysisRef = useRef<MeetingCopilotAnalysis>(EMPTY_MEETING_ANALYSIS);

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { analysisRef.current = analysis; }, [analysis]);
  useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);
  useEffect(() => { audioClipsRef.current = audioClips; }, [audioClips]);

  // Load routed session
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
  }, [routedSession, activeSession?.id]);

  // Elapsed timer
  useEffect(() => {
    if (recStatus !== "recording") return;
    const interval = window.setInterval(() => {
      const started = recordingStartedAtRef.current ?? Date.now();
      setElapsedSeconds(totalRecordedRef.current + Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [recStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
      } catch { /* noop */ }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioClipsRef.current.forEach((c) => URL.revokeObjectURL(c.url));
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
      // Navigate to session URL so refresh keeps state and back returns to list.
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

  const runAnalysis = useCallback(async (fullTranscript: string, sessionId: string, appended: string) => {
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
        id: sessionId,
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

  const appendToTranscript = useCallback(async (text: string, source: "manual" | "browser" | "recall" = "manual") => {
    const clean = text.trim();
    if (!clean) return;
    try {
      const session = await ensureSession();
      const prev = transcriptRef.current.trim();
      const next = prev ? `${prev}\n\n---\n\n${clean}` : clean;
      transcriptRef.current = next;
      setTranscript(next);
      // Persist immediately so nothing is lost if analysis fails
      await updateSession.mutateAsync({ id: session.id, transcript: next });
      const nextAnalysis = await runAnalysis(next, session.id, clean).catch(() => null);
      await createSegment.mutateAsync({
        session_id: session.id,
        content: clean,
        analysis_snapshot: nextAnalysis,
        source,
      }).catch(() => null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao anexar texto");
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

    const clip: RecordedAudio = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      url: URL.createObjectURL(blob),
      mimeType,
      durationSeconds: totalRecordedRef.current,
      createdAt: new Date().toISOString(),
    };
    setAudioClips((prev) => [...prev, clip]);

    setRecStatus("processing");
    const toastId = toast.loading("Transcrevendo áudio...");
    try {
      const text = await transcribeBlob(blob, mimeType);
      toast.success("Áudio transcrito", { id: toastId });
      await appendToTranscript(text, "manual");
    } catch (err) {
      toast.error(getEdgeFunctionErrorMessage(err, "Não foi possível transcrever o áudio"), { id: toastId });
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
      toast.success("Gravação iniciada");
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
    const session = activeSessionRef.current;
    if (session && session.status !== "ended") {
      updateSession.mutate({
        id: session.id,
        status: "ended",
        ended_at: new Date().toISOString(),
      });
    }
  }, [updateSession]);

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

  const deleteAudioClip = (clipId: string) => {
    setAudioClips((prev) => {
      const clip = prev.find((c) => c.id === clipId);
      if (clip) URL.revokeObjectURL(clip.url);
      return prev.filter((c) => c.id !== clipId);
    });
  };

  const handleBack = () => navigate("/reunioes");

  const isRecording = recStatus === "recording";
  const isPaused = recStatus === "paused";
  const isProcessing = recStatus === "processing";
  const showModeSelector = isNew && !activeSession;

  return (
    <div className="flex min-h-[calc(100vh-2rem)] flex-col bg-background">
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack} className="mt-1 h-9 w-9 shrink-0" title="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Radio className="h-3 w-3" /> Meeting Copilot
                </Badge>
                {activeSession && (
                  <Badge variant={activeSession.status === "active" ? "default" : "outline"} className="text-[10px]">
                    {activeSession.status === "active" ? "ativa" : "encerrada"}
                  </Badge>
                )}
                {isRecording && (
                  <Badge variant="destructive" className="animate-pulse gap-1 text-[10px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" /> REC
                  </Badge>
                )}
              </div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {isNew ? "Nova reunião" : derivedTitle}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-4 sm:px-6">
        {showModeSelector && (
          <div className="grid gap-3 sm:grid-cols-2">
            <ModeCard
              active={mode === "in_person"}
              icon={Mic}
              title="Reunião Presencial"
              description="Grave o áudio pelo celular ou computador e organize automaticamente."
              onClick={() => setMode("in_person")}
            />
            <ModeCard
              active={mode === "online"}
              icon={Laptop}
              title="Reunião Online"
              description="Envie a Helena para o Google Meet, Teams ou Zoom capturar a chamada."
              onClick={() => setMode("online")}
            />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {mode === "online" ? <Laptop className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              Detalhes da reunião
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MeetingFields
              title={title}
              setTitle={setTitle}
              meetingWith={meetingWith}
              setMeetingWith={setMeetingWith}
              theme={theme}
              setTheme={setTheme}
              meetingType={meetingType}
              setMeetingType={setMeetingType}
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
        </Card>

        {mode === "in_person" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mic className="h-4 w-4" /> Gravação
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Grave a reunião inteira em um clique. Use pausar para intervalos e parar para finalizar e transcrever. Cada nova gravação nesta reunião é adicionada ao mesmo documento.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={cn(
                "flex flex-col gap-4 rounded-lg border p-5 sm:flex-row sm:items-center sm:justify-between",
                isRecording ? "border-primary/40 bg-primary/5"
                : isPaused ? "border-amber-500/30 bg-amber-500/5"
                : "border-border bg-muted/20",
              )}>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full",
                    isRecording ? "bg-primary/15 text-primary"
                    : isPaused ? "bg-amber-500/15 text-amber-600"
                    : "bg-muted text-muted-foreground",
                  )}>
                    {isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Mic className="h-6 w-6" />}
                  </div>
                  <div>
                    <p className="text-2xl font-semibold tabular-nums tracking-tight">
                      {formatDuration(elapsedSeconds)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isRecording ? "Gravando..."
                      : isPaused ? "Pausado"
                      : isProcessing ? "Transcrevendo..."
                      : "Pronto para gravar"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {recStatus === "idle" && (
                    <Button size="lg" onClick={startRecording} disabled={isProcessing}>
                      <Play className="mr-1.5 h-4 w-4" /> Iniciar gravação
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

              {audioClips.length > 0 && (
                <div className="space-y-2">
                  <Label>Áudios desta sessão</Label>
                  <div className="space-y-2">
                    {audioClips.map((clip, i) => (
                      <div key={clip.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                        <span className="min-w-16 text-xs font-medium text-muted-foreground">
                          #{i + 1} · {formatDuration(clip.durationSeconds)}
                        </span>
                        <audio src={clip.url} controls className="h-8 flex-1" />
                        <Button variant="ghost" size="icon" asChild title="Baixar">
                          <a href={clip.url} download={`${derivedTitle}-${i + 1}.${getAudioExtension(clip.mimeType)}`}>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteAudioClip(clip.id)} title="Remover áudio">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="manual-notes">Adicionar nota ou texto colado</Label>
                <Textarea
                  id="manual-notes"
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Cole uma transcrição, observação ou trecho para adicionar ao documento da reunião."
                  className="min-h-24"
                />
                <Button
                  variant="outline"
                  onClick={async () => { await appendToTranscript(manualText); setManualText(""); }}
                  disabled={!manualText.trim() || analyzing}
                >
                  <Brain className="mr-1.5 h-4 w-4" /> Adicionar e organizar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain className="h-4 w-4" /> Organização automática
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Resumo, decisões e tarefas extraídos pela Helena a partir da transcrição.
              </p>
            </div>
            {analyzing && <Badge variant="secondary" className="shrink-0 animate-pulse">Organizando...</Badge>}
          </CardHeader>
          <CardContent className="space-y-3">
            {!transcript && !analyzing ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Comece uma gravação ou cole um texto para gerar o registro organizado.
              </div>
            ) : (
              <>
                <AnalysisTextBlock icon={Brain} title="Resumo" text={analysis.summary} empty="Aguardando transcrição." featured />
                <div className="grid gap-3 xl:grid-cols-2">
                  <AnalysisListBlock icon={CheckCircle2} title="Decisões" items={analysis.decisions} empty="Sem decisões." />
                  <AnalysisListBlock icon={ListChecks} title="Tarefas" items={analysis.action_items} empty="Sem tarefas." />
                  <AnalysisListBlock
                    icon={Tag}
                    title="Temas e tags"
                    items={[analysis.theme_suggestion, ...analysis.key_topics, ...analysis.related_themes, ...analysis.tags].filter(Boolean)}
                    empty="Sem tema."
                  />
                  <AnalysisListBlock icon={Users} title="Pessoas" items={analysis.people} empty="Sem pessoas identificadas." />
                  <AnalysisListBlock icon={CircleHelp} title="Perguntas abertas" items={analysis.open_questions} empty="Sem perguntas abertas." />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {transcript && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documento da reunião</CardTitle>
              <p className="text-xs text-muted-foreground">Todo o conteúdo capturado consolidado em um único documento formatado.</p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[70vh] rounded-lg border bg-muted/10 p-5">
                <MarkdownView>{transcript}</MarkdownView>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
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

function ModeCard({
  active, icon: Icon, title, description, onClick,
}: {
  active: boolean; icon: typeof Mic; title: string; description: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border p-4 text-left transition-colors hover:bg-accent",
        active ? "border-primary bg-primary/5" : "border-border bg-card",
      )}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-muted">
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </button>
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

function AnalysisTextBlock({
  icon: Icon, title, text, empty, featured = false,
}: {
  icon: typeof Brain; title: string; text: string; empty: string; featured?: boolean;
}) {
  return (
    <section className={cn("rounded-lg border p-4", featured ? "border-primary/20 bg-primary/5" : "bg-card")}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className={cn("h-4 w-4", featured ? "text-primary" : "text-muted-foreground")} />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {text ? <MarkdownView>{text}</MarkdownView> : <p className="text-sm text-muted-foreground">{empty}</p>}
    </section>
  );
}

function AnalysisListBlock({
  icon: Icon, title, items, empty,
}: {
  icon: typeof Brain; title: string; items: string[]; empty: string;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
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

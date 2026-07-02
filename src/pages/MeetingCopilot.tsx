import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  ArrowLeft,
  Brain,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  Download,
  History,
  Laptop,
  ListChecks,
  Mic,
  MicOff,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  useDeleteMeetingCopilotSession,
  useMeetingCopilotSession,
  useMeetingCopilotSegments,
  useMeetingCopilotSessions,
  useUpdateMeetingCopilotSession,
} from "@/hooks/useMeetingCopilot";
import { cn } from "@/lib/utils";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionErrors";
import { toast } from "sonner";

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
type MeetingMode = "in_person" | "online";

interface RecordedAudio {
  id: string;
  url: string;
  blob: Blob;
  mimeType: string;
  name: string;
  durationSeconds: number;
  createdAt: string;
  transcript?: string;
}

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
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
  const { data: sessions = [] } = useMeetingCopilotSessions();
  const { data: routedSession } = useMeetingCopilotSession(sessionId);
  const createSession = useCreateMeetingCopilotSession();
  const updateSession = useUpdateMeetingCopilotSession();
  const createSegment = useCreateMeetingCopilotSegment();
  const deleteSession = useDeleteMeetingCopilotSession();

  const [mode, setMode] = useState<MeetingMode | null>(null);
  const [activeSession, setActiveSession] = useState<MeetingCopilotSession | null>(null);
  const [title, setTitle] = useState("Reunião sem título");
  const [meetingWith, setMeetingWith] = useState("");
  const [theme, setTheme] = useState("");
  const [meetingType, setMeetingType] = useState("general");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [botName, setBotName] = useState("Helena");
  const [manualText, setManualText] = useState("");
  const [transcript, setTranscript] = useState("");
  const [analysis, setAnalysis] = useState<MeetingCopilotAnalysis>(EMPTY_MEETING_ANALYSIS);
  const [recording, setRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [invitingBot, setInvitingBot] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [transcribingClipId, setTranscribingClipId] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [audioClips, setAudioClips] = useState<RecordedAudio[]>([]);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioClipsRef = useRef<RecordedAudio[]>([]);
  const activeSessionRef = useRef<MeetingCopilotSession | null>(null);
  const sessionCreationRef = useRef<Promise<MeetingCopilotSession> | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const recordingRef = useRef(false);
  const shouldRestartRecognitionRef = useRef(false);

  const { data: segments = [] } = useMeetingCopilotSegments(activeSession?.id);
  const canRecord = typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
  const isSessionPage = Boolean(sessionId);

  const derivedTitle = useMemo(() => {
    if (title.trim() && title !== "Reunião sem título") return title.trim();
    if (meetingWith.trim() && theme.trim()) return `${meetingWith.trim()} - ${theme.trim()}`;
    if (meetingWith.trim()) return `Reunião com ${meetingWith.trim()}`;
    if (theme.trim()) return `Reunião sobre ${theme.trim()}`;
    return "Reunião sem título";
  }, [meetingWith, theme, title]);

  useEffect(() => {
    if (!recordingStartedAt || !recording) return;
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - recordingStartedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [recording, recordingStartedAt]);

  useEffect(() => {
    audioClipsRef.current = audioClips;
  }, [audioClips]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    return () => {
      recordingRef.current = false;
      shouldRestartRecognitionRef.current = false;
      recognitionRef.current?.stop();
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      audioClipsRef.current.forEach((clip) => URL.revokeObjectURL(clip.url));
    };
  }, []);

  const resetMeeting = () => {
    activeSessionRef.current = null;
    sessionCreationRef.current = null;
    setActiveSession(null);
    setTitle("Reunião sem título");
    setMeetingWith("");
    setTheme("");
    setMeetingType("general");
    setMeetingUrl("");
    setBotName("Helena");
    setManualText("");
    setTranscript("");
    setAnalysis(EMPTY_MEETING_ANALYSIS);
    setSpeechError(null);
    setInterimTranscript("");
    setElapsedSeconds(0);
    audioClips.forEach((clip) => URL.revokeObjectURL(clip.url));
    setAudioClips([]);
  };

  const ensureSession = useCallback(async () => {
    if (activeSessionRef.current) return activeSessionRef.current;
    if (sessionCreationRef.current) return sessionCreationRef.current;

    const creation = createSession.mutateAsync({
      title: derivedTitle,
      profile: meetingType === "sales" ? "sales" : meetingType === "relationship" ? "csc" : meetingType === "process" ? "rpa" : "executive",
      theme: theme.trim() || null,
      capture_type: mode === "online" ? "online_meeting" : "in_person_meeting",
    });
    sessionCreationRef.current = creation;

    const created = await creation.finally(() => {
      sessionCreationRef.current = null;
    });
    activeSessionRef.current = created;
    setActiveSession(created);
    return created;
  }, [createSession, derivedTitle, meetingType, mode, theme]);

  const analyze = useCallback(async (nextTranscript: string, latestSegment: string, sessionId: string) => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("meeting-copilot", {
        body: {
          profile: meetingType === "sales" ? "sales" : meetingType === "relationship" ? "csc" : meetingType === "process" ? "rpa" : "executive",
          theme: theme.trim(),
          meeting_with: meetingWith.trim(),
          capture_type: mode === "online" ? "online_meeting" : "in_person_meeting",
          transcript: nextTranscript,
          latest_segment: latestSegment,
          previous_analysis: analysis,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const nextAnalysis = normalizeMeetingAnalysis(data?.analysis);
      setAnalysis(nextAnalysis);
      await updateSession.mutateAsync({
        id: sessionId,
        title: derivedTitle,
        theme: theme.trim() || nextAnalysis.theme_suggestion || null,
        capture_type: mode === "online" ? "online_meeting" : "in_person_meeting",
        transcript: nextTranscript,
        analysis: nextAnalysis,
      });
      return nextAnalysis;
    } finally {
      setAnalyzing(false);
    }
  }, [analysis, derivedTitle, meetingType, meetingWith, mode, theme, updateSession]);

  const processText = useCallback(async (text: string, source: "manual" | "browser" | "recall" = "manual") => {
    const clean = text.trim();
    if (!clean) return;

    try {
      const session = await ensureSession();
      const context = [
        meetingWith.trim() ? `Com quem: ${meetingWith.trim()}` : "",
        theme.trim() ? `Tema: ${theme.trim()}` : "",
        `Tipo: ${mode === "online" ? "online" : "presencial"}`,
      ].filter(Boolean).join("\n");
      const content = context ? `${context}\n\n${clean}` : clean;
      const nextTranscript = [transcript, content].filter(Boolean).join("\n\n");
      setTranscript(nextTranscript);
      setManualText("");

      const nextAnalysis = await analyze(nextTranscript, content, session.id);
      await createSegment.mutateAsync({
        session_id: session.id,
        content,
        analysis_snapshot: nextAnalysis,
        source,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível organizar a reunião");
    }
  }, [analyze, createSegment, ensureSession, meetingWith, mode, theme, transcript]);

  const transcribeAudioClip = useCallback(async (clip: RecordedAudio) => {
    setTranscribingClipId(clip.id);
    try {
      const audioBase64 = await blobToBase64(clip.blob);
      const { data, error } = await supabase.functions.invoke("transcribe-meeting-audio", {
        body: {
          audio_base64: audioBase64,
          mime_type: clip.mimeType,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const clipTranscript = typeof data?.transcript === "string" ? data.transcript.trim() : "";
      if (!clipTranscript) throw new Error("A transcrição voltou vazia.");

      setAudioClips((current) => current.map((item) => (
        item.id === clip.id ? { ...item, transcript: clipTranscript } : item
      )));
      await processText(clipTranscript, "manual");
      toast.success(`${clip.name} transcrito e organizado`);
    } catch (error) {
      toast.error(getEdgeFunctionErrorMessage(error, "Não foi possível transcrever este áudio"));
    } finally {
      setTranscribingClipId(null);
    }
  }, [processText]);

  const startSpeechRecognition = useCallback(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechError("Este navegador não transcreve automaticamente. O áudio será gravado; você ainda pode colar a transcrição depois.");
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
        const text = result[0]?.transcript?.trim() ?? "";
        if (!text) continue;
        if (result.isFinal) finalText = [finalText, text].filter(Boolean).join(" ");
        else interimText = [interimText, text].filter(Boolean).join(" ");
      }

      setInterimTranscript(interimText);
      if (finalText) processText(finalText, "browser");
    };

    recognition.onerror = (event) => {
      if (event.error === "network" || event.error === "service-not-allowed" || event.error === "not-allowed") {
        shouldRestartRecognitionRef.current = false;
        recognition.stop();
      }
      setSpeechError(event.error === "not-allowed"
        ? "Microfone bloqueado para transcrição. Se a gravação de áudio estiver rodando, ela continua salva."
        : "Transcrição automática indisponível neste navegador agora. O áudio continua sendo gravado e você pode transcrever ou colar o texto depois.");
    };

    recognition.onend = () => {
      if (!recordingRef.current || !shouldRestartRecognitionRef.current) return;
      try {
        recognition.start();
      } catch {
        shouldRestartRecognitionRef.current = false;
        setSpeechError("A transcrição automática parou, mas a gravação de áudio continua.");
      }
    };

    recognitionRef.current = recognition;
    shouldRestartRecognitionRef.current = true;
    try {
      recognition.start();
    } catch {
      shouldRestartRecognitionRef.current = false;
      setSpeechError("Não foi possível iniciar a transcrição automática.");
    }
  }, [processText]);

  const startRecording = useCallback(async () => {
    if (!canRecord) {
      setSpeechError("Este navegador não suporta gravação de áudio. Use Chrome, Edge ou Safari atualizado.");
      return;
    }

    try {
      setSpeechError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await ensureSession();

      audioChunksRef.current = [];
      const startedAt = Date.now();

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) {
          const createdAt = new Date().toISOString();
          const nextClip: RecordedAudio = {
            id: `${createdAt}-${Math.random().toString(36).slice(2)}`,
            url: URL.createObjectURL(blob),
            blob,
            mimeType: recorder.mimeType || blob.type || "audio/webm",
            name: `Áudio ${audioClips.length + 1}`,
            durationSeconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
            createdAt,
          };
          setAudioClips((current) => [...current, nextClip]);
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recordingRef.current = true;
      setRecording(true);
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
  }, [audioClips.length, canRecord, ensureSession, startSpeechRecognition]);

  const stopRecording = useCallback(async () => {
    recordingRef.current = false;
    shouldRestartRecognitionRef.current = false;
    setRecording(false);
    setRecordingStartedAt(null);
    setInterimTranscript("");
    recognitionRef.current?.stop();
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();

    const session = activeSessionRef.current;
    if (session) {
      try {
        const ended = await updateSession.mutateAsync({
          id: session.id,
          status: "ended",
          ended_at: new Date().toISOString(),
          title: derivedTitle,
          theme: theme.trim() || analysis.theme_suggestion || null,
          capture_type: "in_person_meeting",
          transcript,
          analysis,
        });
        activeSessionRef.current = ended;
        setActiveSession(ended);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "A gravação parou, mas não foi possível salvar a reunião");
        return;
      }
    }
    toast.success("Gravação encerrada");
  }, [activeSession, analysis, derivedTitle, theme, transcript, updateSession]);

  const deleteAudioClip = (clipId: string) => {
    setAudioClips((current) => {
      const clip = current.find((item) => item.id === clipId);
      if (clip) URL.revokeObjectURL(clip.url);
      return current.filter((item) => item.id !== clipId);
    });
  };

  const inviteOnlineAgent = useCallback(async () => {
    const cleanUrl = meetingUrl.trim();
    if (!cleanUrl) {
      toast.error("Cole o link da reunião online.");
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
      toast.success("Agente enviado para a reunião online");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o agente");
    } finally {
      setInvitingBot(false);
    }
  }, [botName, ensureSession, meetingUrl]);

  const loadSession = useCallback((session: MeetingCopilotSession) => {
    setMode(session.meeting_url ? "online" : "in_person");
    activeSessionRef.current = session;
    sessionCreationRef.current = null;
    setActiveSession(session);
    setTitle(session.title);
    setTheme(session.theme ?? "");
    setMeetingType(session.profile === "sales" ? "sales" : session.profile === "csc" ? "relationship" : session.profile === "rpa" ? "process" : "general");
    setMeetingUrl(session.meeting_url ?? "");
    setBotName(session.bot_name ?? "Helena");
    setTranscript(session.transcript ?? "");
    setAnalysis(normalizeMeetingAnalysis(session.analysis));
    setManualText("");
    setSpeechError(null);
    setInterimTranscript("");
    audioClips.forEach((clip) => URL.revokeObjectURL(clip.url));
    setAudioClips([]);
  }, [audioClips]);

  useEffect(() => {
    if (!routedSession || activeSession?.id === routedSession.id) return;
    loadSession(routedSession);
  }, [activeSession?.id, loadSession, routedSession]);

  const openSessionPage = (session: MeetingCopilotSession) => {
    navigate(`/reunioes/${session.id}`);
  };

  const startNewMeeting = () => {
    resetMeeting();
    navigate("/reunioes");
  };

  const handleDeleteSession = async (session: MeetingCopilotSession, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const confirmed = window.confirm(`Excluir "${session.title}" e todos os trechos capturados?`);
    if (!confirmed) return;

    try {
      await deleteSession.mutateAsync(session.id);
      if (activeSession?.id === session.id) {
        resetMeeting();
        navigate("/reunioes");
      }
      toast.success("Reunião excluída");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir a reunião");
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-2rem)] flex-col bg-background">
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Radio className="h-3 w-3" /> Meeting Copilot
              </Badge>
              {activeSession && <Badge variant="outline">{activeSession.status === "active" ? "ativa" : "salva"}</Badge>}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Meeting Copilot</h1>
            <p className="mt-1 text-sm text-muted-foreground">Escolha o tipo de reunião e capture somente o que importa.</p>
          </div>
          <Button variant="outline" onClick={startNewMeeting}>Nova reunião</Button>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-4">
          {isSessionPage && activeSession ? (
            <SessionPageHeader
              session={activeSession}
              mode={mode}
              theme={theme || analysis.theme_suggestion}
              onBack={() => navigate("/reunioes")}
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <ModeCard
                  active={mode === "in_person"}
                  icon={Mic}
                  title="Reunião Presencial"
                  description="Grave o áudio pelo celular ou computador e organize por tema, pessoas, decisões e tarefas."
                  onClick={() => setMode("in_person")}
                />
                <ModeCard
                  active={mode === "online"}
                  icon={Laptop}
                  title="Reunião Online"
                  description="Envie a Helena para entrar no Google Meet, Teams ou Zoom e capturar a chamada."
                  onClick={() => setMode("online")}
                />
              </div>

              {!mode && (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Selecione uma opção acima para começar.
                </div>
              )}
            </>
          )}

          {mode === "in_person" && !isSessionPage && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mic className="h-4 w-4" /> Reunião Presencial
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

                <div className={cn(
                  "flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between",
                  recording ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20",
                )}>
                  <div className="flex items-start gap-3">
                    {recording ? <Mic className="mt-0.5 h-5 w-5 text-primary" /> : <MicOff className="mt-0.5 h-5 w-5 text-muted-foreground" />}
                    <div>
                      <p className="text-sm font-medium">
                        {recording ? `Gravando ${formatDuration(elapsedSeconds)}` : "Pronto para gravar"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        A gravação salva o áudio. Depois use Transcrever em cada trecho para organizar a reunião.
                      </p>
                    </div>
                  </div>
                  <Button size="lg" variant={recording ? "destructive" : "default"} onClick={recording ? stopRecording : startRecording}>
                    {recording ? <Square className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}
                    {recording ? "Parar" : "Gravar"}
                  </Button>
                </div>

                {interimTranscript && (
                  <p className="rounded-md bg-muted px-3 py-2 text-sm italic text-muted-foreground">{interimTranscript}</p>
                )}
                {speechError && (
                  <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">{speechError}</p>
                )}

                {audioClips.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Áudios gravados</Label>
                      <span className="text-xs text-muted-foreground">
                        {audioClips.length} {audioClips.length === 1 ? "trecho" : "trechos"}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {audioClips.map((clip, index) => (
                        <div key={clip.id} className="rounded-lg border p-3">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">{clip.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDuration(clip.durationSeconds)} · {new Date(clip.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" asChild title={`Baixar ${clip.name}`}>
                                <a href={clip.url} download={`${derivedTitle}-audio-${index + 1}.${getAudioExtension(clip.mimeType)}`}>
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => transcribeAudioClip(clip)}
                                disabled={transcribingClipId === clip.id}
                              >
                                <Brain className="mr-1.5 h-4 w-4" />
                                {transcribingClipId === clip.id ? "Organizando..." : "Transcrever e organizar"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteAudioClip(clip.id)}
                                title={`Excluir ${clip.name}`}
                                aria-label={`Excluir ${clip.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <audio src={clip.url} controls className="h-9 w-full max-w-full" />
                          {clip.transcript && <AudioTranscriptPreview text={clip.transcript} />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="manual-notes">Adicionar trecho manual ou transcrição</Label>
                  <Textarea
                    id="manual-notes"
                    value={manualText}
                    onChange={(event) => setManualText(event.target.value)}
                    placeholder="Cole aqui um trecho, observação ou transcrição se a captura automática não estiver disponível."
                    className="min-h-28"
                  />
                  <Button variant="outline" onClick={() => processText(manualText)} disabled={!manualText.trim() || analyzing}>
                    <Brain className="mr-1.5 h-4 w-4" /> Organizar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {mode === "online" && !isSessionPage && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Laptop className="h-4 w-4" /> Reunião Online
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
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                  <div className="space-y-2">
                    <Label htmlFor="meeting-url">Link da reunião</Label>
                    <Input
                      id="meeting-url"
                      value={meetingUrl}
                      onChange={(event) => setMeetingUrl(event.target.value)}
                      placeholder="Google Meet, Teams ou Zoom"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bot-name">Agente</Label>
                    <Input id="bot-name" value={botName} onChange={(event) => setBotName(event.target.value)} />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={inviteOnlineAgent} disabled={invitingBot || !meetingUrl.trim()} className="w-full">
                      <Send className="mr-1.5 h-4 w-4" />
                      {invitingBot ? "Enviando..." : "Enviar"}
                    </Button>
                  </div>
                </div>
                <BotStatus session={activeSession} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Brain className="h-4 w-4" /> Organização da reunião
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Resumo, decisões, tarefas e contexto extraídos automaticamente da transcrição.
                </p>
              </div>
              {analyzing && <Badge variant="secondary" className="shrink-0 animate-pulse">Organizando...</Badge>}
            </CardHeader>
            <CardContent className="space-y-3">
              {!transcript && segments.length === 0 && !analyzing ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Grave e transcreva um áudio para gerar o registro organizado da reunião.
                </div>
              ) : (
                <>
                  <AnalysisBlock icon={Brain} title="Resumo" items={analysis.summary ? [analysis.summary] : []} empty="Aguardando transcrição." featured />
                  <div className="grid gap-3 xl:grid-cols-2">
                    <AnalysisBlock icon={CheckCircle2} title="Decisões" items={analysis.decisions} empty="Sem decisões." />
                    <AnalysisBlock icon={ListChecks} title="Tarefas" items={analysis.action_items} empty="Sem tarefas." />
                    <AnalysisBlock icon={Tag} title="Temas e tags" items={[analysis.theme_suggestion, ...analysis.key_topics, ...analysis.related_themes, ...analysis.tags].filter(Boolean)} empty="Sem tema." />
                    <AnalysisBlock icon={Users} title="Pessoas" items={analysis.people} empty="Sem pessoas identificadas." />
                    <AnalysisBlock icon={CircleHelp} title="Perguntas abertas" items={analysis.open_questions} empty="Sem perguntas abertas." />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {(activeSession || transcript || segments.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4" /> Registro da reunião
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{mode === "online" ? "Online" : "Presencial"}</Badge>
                  {meetingWith.trim() && <Badge variant="outline">Com {meetingWith.trim()}</Badge>}
                  {(theme.trim() || analysis.theme_suggestion) && <Badge variant="outline">{theme.trim() || analysis.theme_suggestion}</Badge>}
                  {activeSession?.started_at && (
                    <Badge variant="outline">
                      {new Date(activeSession.started_at).toLocaleDateString("pt-BR")} às {new Date(activeSession.started_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Transcrição consolidada</Label>
                  {transcript ? (
                    <ScrollArea className="h-48 rounded-lg border bg-muted/20 p-3">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{transcript}</p>
                    </ScrollArea>
                  ) : (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhuma transcrição consolidada ainda.</p>
                  )}
                </div>

                {segments.length > 0 && (
                  <div className="space-y-2">
                    <Label>Trechos capturados</Label>
                    <div className="space-y-2">
                      {segments.map((segment, index) => (
                        <div key={segment.id} className="rounded-lg border p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <Badge variant="outline">Trecho {index + 1}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(segment.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{segment.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </main>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reuniões recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma reunião salva.</p>
              ) : (
                <div className="space-y-2">
                  {sessions.slice(0, 12).map((session) => {
                    const cardTitle = getSessionCardTitle(session);
                    const cardSubtitle = getSessionCardSubtitle(session, cardTitle);
                    return (
                    <div
                      key={session.id}
                      className={cn(
                        "flex w-full items-start justify-between gap-2 rounded-lg border p-2 transition-colors hover:bg-accent",
                        activeSession?.id === session.id && "border-primary bg-primary/5",
                      )}
                    >
                      <button type="button" onClick={() => openSessionPage(session)} className="min-w-0 flex-1 p-1 text-left">
                        <p className="line-clamp-2 text-sm font-medium leading-snug">{cardTitle}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {cardSubtitle}
                        </p>
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                        onClick={(event) => handleDeleteSession(session, event)}
                        disabled={deleteSession.isPending}
                        title={`Excluir ${session.title}`}
                        aria-label={`Excluir ${session.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function SessionPageHeader({
  session,
  mode,
  theme,
  onBack,
}: {
  session: MeetingCopilotSession;
  mode: MeetingMode | null;
  theme: string;
  onBack: () => void;
}) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 h-8 px-2 text-muted-foreground">
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Voltar ao histórico
      </Button>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{mode === "online" ? "Online" : "Presencial"}</Badge>
            <Badge variant="secondary">{session.status === "active" ? "ativa" : "salva"}</Badge>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{session.title}</h2>
            {theme && <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted-foreground">{theme}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          {new Date(session.started_at).toLocaleDateString("pt-BR")}
        </div>
      </div>
    </section>
  );
}

function ModeCard({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: typeof Mic;
  title: string;
  description: string;
  onClick: () => void;
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
  title,
  setTitle,
  meetingWith,
  setMeetingWith,
  theme,
  setTheme,
  meetingType,
  setMeetingType,
}: {
  title: string;
  setTitle: (value: string) => void;
  meetingWith: string;
  setMeetingWith: (value: string) => void;
  theme: string;
  setTheme: (value: string) => void;
  meetingType: string;
  setMeetingType: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="meeting-title">Título</Label>
        <Input id="meeting-title" value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="meeting-with">Com quem</Label>
        <Input id="meeting-with" value={meetingWith} onChange={(event) => setMeetingWith(event.target.value)} placeholder="Pessoa, cliente ou equipe" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="meeting-theme">Tema</Label>
        <Input id="meeting-theme" value={theme} onChange={(event) => setTheme(event.target.value)} placeholder="Produto, proposta, alinhamento..." />
      </div>
      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select value={meetingType} onValueChange={setMeetingType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEETING_TYPES.map((item) => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function BotStatus({ session }: { session: MeetingCopilotSession | null }) {
  if (!session?.bot_id) {
    return <p className="text-sm text-muted-foreground">O agente ainda não foi enviado.</p>;
  }
  return (
    <div className="rounded-lg border p-3 text-sm">
      <p className="font-medium">Agente enviado</p>
      <p className="mt-1 text-muted-foreground">Status: {session.bot_status === "transcribing" ? "transcrevendo" : session.bot_status ?? "criado"}</p>
      {session.bot_error && <p className="mt-2 text-destructive">{session.bot_error}</p>}
    </div>
  );
}

function AnalysisBlock({
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
            <p key={`${title}-${index}`} className="text-sm leading-relaxed text-muted-foreground">{item}</p>
          ))}
        </div>
      )}
    </section>
  );
}

function getSessionCardTitle(session: MeetingCopilotSession) {
  const analysis = normalizeMeetingAnalysis(session.analysis);
  const theme = cleanSessionTheme(session.theme || analysis.theme_suggestion);
  if (theme) return theme;
  if (session.transcript?.trim()) return "Registro organizado";
  return "Reunião sem conteúdo suficiente";
}

function getSessionCardSubtitle(session: MeetingCopilotSession, cardTitle: string) {
  const date = new Date(session.updated_at).toLocaleDateString("pt-BR");
  const type = session.meeting_url ? "online" : "presencial";
  const title = session.title?.trim();
  const titlePart = title && title !== cardTitle ? ` · ${title}` : "";
  return `${date} · ${type}${titlePart}`;
}

function cleanSessionTheme(value?: string | null) {
  const text = value?.trim();
  if (!text) return "";
  const weakSignals = [
    "no suggestions possible",
    "lack of content",
    "sem tema",
    "sem conteúdo",
    "sem conteudo",
  ];
  return weakSignals.some((signal) => text.toLowerCase().includes(signal)) ? "" : text;
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function AudioTranscriptPreview({ text }: { text: string }) {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="mt-2 h-8 w-fit px-2 text-xs text-muted-foreground">
          Ver texto organizado
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ScrollArea className="mt-2 max-h-40 rounded-md border bg-muted/30 p-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{text}</p>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
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
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
  if (normalized.includes("mp4") || normalized.includes("m4a")) return "m4a";
  if (normalized.includes("wav")) return "wav";
  return "webm";
}

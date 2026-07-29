import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Pause, Play, Radio, Square, Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionErrors";
import { useCreateMeetingCopilotSession, type MeetingCopilotSession } from "@/hooks/useMeetingCopilot";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Mode = "in_person" | "online";
type RecStatus = "idle" | "recording" | "paused" | "processing";

interface NoteMeetingCaptureProps {
  noteTitle?: string;
  /** Receives HTML that must be appended after the last line of the note. */
  onAppend: (html: string) => void;
  disabled?: boolean;
}

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function transcriptToHtml(label: string, transcript: string) {
  const paragraphs = transcript
    .split(/\n{1,}/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
  return `<p><strong>${escapeHtml(label)}</strong></p>${paragraphs || "<p></p>"}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o áudio"));
    reader.readAsDataURL(blob);
  });
}

export function NoteMeetingCapture({ noteTitle, onAppend, disabled }: NoteMeetingCaptureProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("in_person");
  const [status, setStatus] = useState<RecStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [takeCount, setTakeCount] = useState(0);

  const [meetingUrl, setMeetingUrl] = useState("");
  const [botName, setBotName] = useState("Helena");
  const [invitingBot, setInvitingBot] = useState(false);
  const [onlineSession, setOnlineSession] = useState<MeetingCopilotSession | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<string>("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const appendedLengthRef = useRef(0);

  const createSession = useCreateMeetingCopilotSession();

  const canRecord = typeof window !== "undefined"
    && Boolean(navigator.mediaDevices?.getUserMedia)
    && typeof MediaRecorder !== "undefined";

  useEffect(() => {
    if (status !== "recording") return;
    const id = window.setInterval(() => setSeconds((prev) => prev + 1), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const appendTranscript = useCallback((label: string, transcript: string) => {
    const clean = transcript.trim();
    if (!clean) return;
    onAppend(transcriptToHtml(label, clean));
  }, [onAppend]);

  const transcribe = useCallback(async (blob: Blob, mimeType: string) => {
    const base64 = await blobToBase64(blob);
    const { data, error } = await supabase.functions.invoke("transcribe-meeting-audio", {
      body: { audio_base64: base64, mime_type: mimeType },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    const transcript = typeof data?.transcript === "string" ? data.transcript.trim() : "";
    if (!transcript) throw new Error("A transcrição voltou vazia.");
    return transcript;
  }, []);

  const finalizeRecording = useCallback(async () => {
    const chunks = chunksRef.current;
    chunksRef.current = [];
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (!chunks.length) {
      setStatus("idle");
      return;
    }
    const mimeType = recorderRef.current?.mimeType || chunks[0].type || "audio/webm";
    const blob = new Blob(chunks, { type: mimeType });
    setStatus("processing");
    const index = takeCount + 1;
    try {
      const transcript = await transcribe(blob, mimeType);
      appendTranscript(`Gravação presencial ${index} — ${new Date().toLocaleString("pt-BR")}`, transcript);
      setTakeCount(index);
      toast.success("Transcrição adicionada ao final da nota");
    } catch (err) {
      toast.error(getEdgeFunctionErrorMessage(err, "Não foi possível transcrever a gravação"));
    } finally {
      setStatus("idle");
      setSeconds(0);
    }
  }, [appendTranscript, takeCount, transcribe]);

  const startRecording = useCallback(async () => {
    if (!canRecord) {
      toast.error("Este navegador não suporta gravação de áudio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => { void finalizeRecording(); };
      recorder.start();
      startedAtRef.current = Date.now();
      setSeconds(0);
      setStatus("recording");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível acessar o microfone");
    }
  }, [canRecord, finalizeRecording]);

  const pauseRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state !== "recording") return;
    recorder.pause();
    setStatus("paused");
  }, []);

  const resumeRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state !== "paused") return;
    recorder.resume();
    startedAtRef.current = Date.now();
    setStatus("recording");
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const inviteBot = useCallback(async () => {
    const url = meetingUrl.trim();
    if (!url) {
      toast.error("Cole o link da reunião online.");
      return;
    }
    setInvitingBot(true);
    try {
      const session = await createSession.mutateAsync({
        title: noteTitle?.trim() || "Reunião da nota",
        profile: "executive",
        capture_type: "note_meeting",
      });
      const { data, error } = await supabase.functions.invoke("meeting-bot", {
        body: { session_id: session.id, meeting_url: url, bot_name: botName.trim() || "Helena", language_code: "pt" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      appendedLengthRef.current = 0;
      setOnlineSession(data?.session ?? session);
      setOnlineStatus("Agente entrando na reunião...");
      toast.success("Agente enviado para a reunião");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o agente");
    } finally {
      setInvitingBot(false);
    }
  }, [botName, createSession, meetingUrl, noteTitle]);

  // Poll the remote session transcript and stream new content into the note.
  useEffect(() => {
    if (!onlineSession?.id) return;
    let cancelled = false;
    const tick = async () => {
      const { data } = await supabase
        .from("meeting_copilot_sessions")
        .select("transcript, bot_status")
        .eq("id", onlineSession.id)
        .maybeSingle();
      if (cancelled || !data) return;
      setOnlineStatus(data.bot_status ? `Agente: ${data.bot_status}` : "Aguardando transcrição...");
      const transcript = typeof data.transcript === "string" ? data.transcript : "";
      if (transcript.length > appendedLengthRef.current) {
        const chunk = transcript.slice(appendedLengthRef.current).trim();
        appendedLengthRef.current = transcript.length;
        if (chunk) {
          appendTranscript(
            appendedLengthRef.current === chunk.length
              ? `Reunião online — ${new Date().toLocaleString("pt-BR")}`
              : "Continuação da reunião online",
            chunk,
          );
        }
      }
    };
    void tick();
    const id = window.setInterval(() => { void tick(); }, 8000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [appendTranscript, onlineSession?.id]);

  const stopOnlineCapture = () => {
    setOnlineSession(null);
    setOnlineStatus("");
    appendedLengthRef.current = 0;
  };

  const isRecording = status === "recording";
  const isProcessing = status === "processing";
  const activeCapture = isRecording || status === "paused" || Boolean(onlineSession);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          disabled={disabled}
          title="Gravar reunião na nota"
          className={cn(
            "h-8 w-8 text-muted-foreground hover:text-primary",
            activeCapture && "text-destructive hover:text-destructive",
          )}
        >
          {isProcessing
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : activeCapture ? <Radio className="h-4 w-4 animate-pulse" /> : <Mic className="h-4 w-4" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3 space-y-3">
        <div className="flex items-center gap-1 rounded-md bg-muted p-0.5">
          <button
            type="button"
            onClick={() => setMode("in_person")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
              mode === "in_person" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground",
            )}
          >
            <Mic className="h-3 w-3" /> Presencial
          </button>
          <button
            type="button"
            onClick={() => setMode("online")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
              mode === "online" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground",
            )}
          >
            <Laptop className="h-3 w-3" /> Remoto
          </button>
        </div>

        {mode === "in_person" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {isProcessing ? "Transcrevendo..." : isRecording ? "Gravando" : status === "paused" ? "Pausado" : "Pronto para gravar"}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">{formatClock(seconds)}</span>
            </div>
            <div className="flex items-center gap-2">
              {status === "idle" || isProcessing ? (
                <Button size="sm" className="flex-1 h-8" onClick={startRecording} disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
                  <span className="ml-1.5">Iniciar gravação</span>
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" className="h-8" onClick={isRecording ? pauseRecording : resumeRecording}>
                    {isRecording ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1 h-8" onClick={stopRecording}>
                    <Square className="h-3.5 w-3.5" />
                    <span className="ml-1.5">Encerrar e transcrever</span>
                  </Button>
                </>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Você pode continuar digitando na nota enquanto grava. Ao encerrar, o texto entra sempre depois da última linha.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="Link da reunião (Meet, Zoom, Teams)"
              className="h-8 text-xs"
            />
            <Input
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="Nome do agente"
              className="h-8 text-xs"
            />
            {onlineSession ? (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">{onlineStatus || "Capturando reunião..."}</p>
                <Button size="sm" variant="outline" className="w-full h-8" onClick={stopOnlineCapture}>
                  Parar de trazer para a nota
                </Button>
              </div>
            ) : (
              <Button size="sm" className="w-full h-8" onClick={inviteBot} disabled={invitingBot}>
                {invitingBot ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
                <span className="ml-1.5">Enviar agente para a reunião</span>
              </Button>
            )}
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              A transcrição chega em blocos e é adicionada ao final da nota, sem atrapalhar sua digitação.
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

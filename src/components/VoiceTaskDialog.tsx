import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createTask, createSubtask } from "@/lib/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface VoiceTaskDialogProps {
  spaces: { id: string; name: string }[];
  onCreated: () => void;
}

type ParsedTask = {
  title: string;
  description?: string | null;
  priority: "low" | "medium" | "high";
  due_date?: string | null;
  space_id?: string | null;
  subtasks?: { title: string; due_date?: string | null }[];
};

type Step = "idle" | "recording" | "processing" | "preview" | "saving" | "error";

export function VoiceTaskDialog({ spaces, onCreated }: VoiceTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [transcript, setTranscript] = useState("");
  const [parsed, setParsed] = useState<ParsedTask | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const recognitionRef = useRef<any>(null);

  const resetState = () => {
    setStep("idle");
    setTranscript("");
    setParsed(null);
    setErrorMsg("");
  };

  const startRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMsg("Seu navegador não suporta reconhecimento de voz. Use Chrome ou Safari.");
      setStep("error");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscriptWithRef((finalTranscript + interim).trim());
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "aborted") {
        setErrorMsg(`Erro no reconhecimento: ${event.error}`);
        setStep("error");
      }
    };

    recognition.onend = () => {
      // Will be handled by stopRecording
    };

    recognitionRef.current = recognition;
    recognition.start();
    setStep("recording");
    setTranscript("");
  }, []);

  const transcriptRef = useRef("");

  // Keep ref in sync
  const setTranscriptWithRef = (val: string) => {
    transcriptRef.current = val;
    setTranscript(val);
  };

  const stopRecording = useCallback(async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    // Small delay to capture final results
    await new Promise(r => setTimeout(r, 300));

    setStep("processing");

    try {
      const currentTranscript = transcriptRef.current;
      if (!currentTranscript.trim()) {
        setErrorMsg("Nenhum áudio detectado. Tente novamente.");
        setStep("error");
        return;
      }

      const { data, error } = await supabase.functions.invoke("parse-voice-task", {
        body: {
          transcript: currentTranscript,
          spaces: spaces.map(s => ({ id: s.id, name: s.name })),
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setParsed(data);
      setStep("preview");
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao processar áudio");
      setStep("error");
    }
  }, [transcript, spaces]);

  const confirmTask = async () => {
    if (!parsed) return;
    setStep("saving");

    try {
      const autoStatus = parsed.due_date ? "in_progress" : "todo";
      const task = await createTask({
        title: parsed.title,
        description: parsed.description || null,
        priority: parsed.priority,
        status: autoStatus as any,
        space_id: parsed.space_id || null,
        due_date: parsed.due_date || null,
      });

      if (parsed.subtasks?.length) {
        for (const sub of parsed.subtasks) {
          await createSubtask({
            task_id: task.id,
            title: sub.title,
            due_date: sub.due_date || null,
          });
        }
      }

      toast.success(`Task criada: ${parsed.title}`);
      resetState();
      setOpen(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
      setStep("preview");
    }
  };

  const priorityLabels = { low: "Baixa", medium: "Média", high: "Alta" };
  const priorityColors = { low: "secondary", medium: "default", high: "destructive" } as const;

  const spaceName = parsed?.space_id ? spaces.find(s => s.id === parsed.space_id)?.name : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { resetState(); if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; } } }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="touch-manipulation min-h-[44px]">
          <Mic className="h-4 w-4 mr-1" /> Voz
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Task por Voz</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* IDLE */}
          {step === "idle" && (
            <div className="text-center py-6 space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Mic className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Diga a task, subtasks, prioridade, data e space.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ex: "Criar relatório urgente para amanhã no space Marketing, com subtasks: pesquisar dados e montar slides"
                </p>
              </div>
              <Button onClick={startRecording} className="gradient-primary text-primary-foreground border-0 min-h-[44px] touch-manipulation">
                <Mic className="h-4 w-4 mr-2" /> Iniciar Gravação
              </Button>
            </div>
          )}

          {/* RECORDING */}
          {step === "recording" && (
            <div className="text-center py-6 space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center animate-pulse">
                <Mic className="h-8 w-8 text-destructive" />
              </div>
              <p className="text-sm font-medium">Ouvindo...</p>
              {transcript && (
                <div className="bg-muted rounded-lg p-3 text-left">
                  <p className="text-sm text-foreground">{transcript}</p>
                </div>
              )}
              <Button onClick={stopRecording} variant="destructive" className="min-h-[44px] touch-manipulation">
                <MicOff className="h-4 w-4 mr-2" /> Parar e Processar
              </Button>
            </div>
          )}

          {/* PROCESSING */}
          {step === "processing" && (
            <div className="text-center py-8 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Interpretando com IA...</p>
              {transcript && (
                <div className="bg-muted rounded-lg p-3 text-left">
                  <p className="text-xs text-muted-foreground">{transcript}</p>
                </div>
              )}
            </div>
          )}

          {/* PREVIEW */}
          {step === "preview" && parsed && (
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                <span className="font-medium">Transcrito:</span> {transcript}
              </div>

              <div className="border border-border rounded-lg p-4 space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Título</label>
                  <p className="font-medium text-sm">{parsed.title}</p>
                </div>

                {parsed.description && (
                  <div>
                    <label className="text-xs text-muted-foreground">Descrição</label>
                    <p className="text-sm">{parsed.description}</p>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <Badge variant={priorityColors[parsed.priority]}>
                    {priorityLabels[parsed.priority]}
                  </Badge>
                  {parsed.due_date && (
                    <Badge variant="outline">
                      {new Date(parsed.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                    </Badge>
                  )}
                  {spaceName && (
                    <Badge variant="secondary">{spaceName}</Badge>
                  )}
                  <Badge variant="outline">
                    {parsed.due_date ? "Em Progresso" : "A Fazer"}
                  </Badge>
                </div>

                {parsed.subtasks && parsed.subtasks.length > 0 && (
                  <div>
                    <label className="text-xs text-muted-foreground">Subtasks ({parsed.subtasks.length})</label>
                    <ul className="mt-1 space-y-1">
                      {parsed.subtasks.map((s, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                          {s.title}
                          {s.due_date && (
                            <span className="text-xs text-muted-foreground">
                              ({new Date(s.due_date + "T12:00:00").toLocaleDateString("pt-BR")})
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={resetState} className="flex-1 min-h-[44px] touch-manipulation">
                  Regravar
                </Button>
                <Button onClick={confirmTask} className="flex-1 gradient-primary text-primary-foreground border-0 min-h-[44px] touch-manipulation">
                  <Check className="h-4 w-4 mr-2" /> Criar Task
                </Button>
              </div>
            </div>
          )}

          {/* SAVING */}
          {step === "saving" && (
            <div className="text-center py-8 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Criando task...</p>
            </div>
          )}

          {/* ERROR */}
          {step === "error" && (
            <div className="text-center py-6 space-y-4">
              <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
              <p className="text-sm text-destructive">{errorMsg}</p>
              <Button onClick={resetState} variant="outline" className="min-h-[44px] touch-manipulation">
                Tentar Novamente
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

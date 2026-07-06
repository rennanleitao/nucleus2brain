import { useState, useRef, useEffect } from "react";
import { Bot, Mic, MicOff, Pause, Play, Send, Square, User, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchTasks, fetchSpaces, createTask } from "@/lib/api";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { getBrtToday } from "@/lib/timezone";
import { getFunctionAuthHeaders } from "@/lib/functionAuth";
import { useHelenaSpeechInput } from "@/hooks/useHelenaSpeechInput";
import { useHelenaSpeech } from "@/hooks/useHelenaSpeech";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export default function Assistant() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "assistant", content: "Olá! Sou Helena, sua assistente do Nucleus. Posso criar tarefas, priorizar seu trabalho e ajudar na produtividade. O que você gostaria de fazer?" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const speechInput = useHelenaSpeechInput();
  const speech = useHelenaSpeech();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (speech.error) toast.error(speech.error);
  }, [speech.error]);

  useEffect(() => {
    if (speechInput.error) toast.error(speechInput.error);
  }, [speechInput.error]);

  const sendMessageText = async (text: string, options: { voiceTurn?: boolean } = {}) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // Gather context
    let context: any = {};
    try {
      const [tasks, spaces] = await Promise.all([fetchTasks(), fetchSpaces()]);
      context = {
        tasks: tasks.slice(0, 20).map(t => ({
          id: t.id, title: t.title, status: t.status, priority: t.priority,
          due_date: t.due_date, space: t.spaces?.name,
        })),
        spaces: spaces.map((s: any) => ({ id: s.id, name: s.name })),
        today: getBrtToday(),
      };

      // Add calendar context
      try {
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const { data: calEvents, error: calendarError } = await supabase.functions.invoke("google-calendar-api", {
          body: { action: "list_events", time_min: now.toISOString(), time_max: nextWeek.toISOString() },
        });
        if (!calendarError && Array.isArray(calEvents)) {
          context.calendar_events = calEvents.slice(0, 15).map((e: any) => ({
            summary: e.summary, start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date,
          }));
          context.calendar_connected = true;
        } else {
          context.calendar_connected = false;
        }
      } catch {
        context.calendar_connected = false;
      }
    } catch {}

    let assistantContent = "";
    const assistantMessageId = "ai-" + Date.now();

    try {
      const authHeaders = await getFunctionAuthHeaders();
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          context,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "AI error" }));
        throw new Error(err.error || "AI request failed");
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                if (prev.some(m => m.id === assistantMessageId)) {
                  return prev.map(m => m.id === assistantMessageId ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { id: assistantMessageId, role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Parse actions from response
      const actionMatches = assistantContent.matchAll(/```action\s*\n?([\s\S]*?)```/g);
      for (const actionMatch of actionMatches) {
        try {
          const action = JSON.parse(actionMatch[1]);
          if (action.action === "create_task") {
            await createTask({
              title: action.title,
              priority: action.priority || "medium",
              due_date: action.due_date || null,
              description: action.description || null,
            });
            toast.success(`Task criada: ${action.title}`);
          } else if (action.action === "create_calendar_event") {
            const startDateTime = `${action.date}T${action.start_time}:00`;
            const endDateTime = `${action.date}T${action.end_time}:00`;
            const { data, error } = await supabase.functions.invoke("google-calendar-api", {
              body: {
                action: "create_event",
                summary: action.summary,
                start: { dateTime: startDateTime, timeZone: "America/Sao_Paulo" },
                end: { dateTime: endDateTime, timeZone: "America/Sao_Paulo" },
                description: action.description || "",
                location: action.location || "",
              },
            });
            if (error) {
              toast.error("Erro ao criar evento no calendário");
            } else {
              toast.success(`Evento agendado: ${action.summary}`);
            }
          }
        } catch {}
      }

      if ((speech.autoSpeak || options.voiceTurn) && assistantContent.trim()) {
        setSpeakingMessageId(assistantMessageId);
        speech.speak(assistantContent, () => setSpeakingMessageId(null));
      }
    } catch (err: any) {
      toast.error(err.message);
      if (!assistantContent) {
        setMessages(prev => [...prev, {
          id: "err-" + Date.now(),
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessageText(input);
  };

  const handleVoiceInput = async () => {
    if (isLoading) return;
    if (speechInput.isListening) {
      const spokenText = speechInput.stop();
      if (!spokenText.trim()) {
        toast.error("Não ouvi nada claro. Tente falar novamente.");
        return;
      }
      await sendMessageText(spokenText, { voiceTurn: true });
      speechInput.resetTranscript();
      return;
    }

    if (speech.isSpeaking) handleStopSpeech();
    const started = speechInput.start();
    if (started) toast.info("Helena está ouvindo.");
  };

  const handleSpeakMessage = (msg: Message) => {
    setSpeakingMessageId(msg.id);
    speech.speak(msg.content, () => setSpeakingMessageId(null));
  };

  const handleStopSpeech = () => {
    speech.stop();
    setSpeakingMessageId(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="p-4 border-b border-border">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-h1 flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" /> Helena
            </h1>
            <p className="text-micro text-muted-foreground">Sua assistente de IA — crie tasks, priorize e planeje</p>
          </div>
          <label className={`flex items-center gap-2 text-micro ${speech.isSupported ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
            <input
              type="checkbox"
              checked={speech.autoSpeak}
              onChange={e => speech.setAutoSpeak(e.target.checked)}
              disabled={!speech.isSupported}
              className="h-3.5 w-3.5 rounded border-border accent-primary"
            />
            Responder com voz
          </label>
        </div>
        {!speech.isSupported && (
          <p className="text-micro text-muted-foreground mt-2">Este navegador não suporta reprodução de voz por Web Speech API.</p>
        )}
        {!speechInput.isSupported && (
          <p className="text-micro text-muted-foreground mt-1">Este navegador não suporta entrada de voz por Web Speech API.</p>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 animate-fade-in ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}
              <div className={`${
                msg.role === "user"
                  ? "max-w-[75%] rounded-2xl px-4 py-2.5 bg-primary text-primary-foreground text-[14px] leading-relaxed"
                  : "flex-1 min-w-0 text-[14.5px] leading-[1.65] text-foreground"
              }`}>
                {msg.role === "assistant" ? (
                  <div>
                    <div className="ai-prose">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {speech.isSupported ? (
                        <>
                          {speech.isSpeaking && speakingMessageId === msg.id ? (
                            <>
                              <button
                                type="button"
                                onClick={speech.isPaused ? speech.resume : speech.pause}
                                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-micro text-muted-foreground hover:bg-muted hover:text-foreground"
                              >
                                {speech.isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                                {speech.isPaused ? "Continuar" : "Pausar"}
                              </button>
                              <button
                                type="button"
                                onClick={handleStopSpeech}
                                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-micro text-muted-foreground hover:bg-muted hover:text-foreground"
                              >
                                <Square className="h-3 w-3" /> Parar
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSpeakMessage(msg)}
                              disabled={isLoading && msg.id.startsWith("ai-")}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-micro text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                            >
                              <Volume2 className="h-3 w-3" /> Ouvir
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-micro text-muted-foreground/70">
                          <VolumeX className="h-3 w-3" /> Voz indisponível
                        </span>
                      )}
                    </div>
                  </div>
                ) : msg.content}
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <div className="flex items-center gap-1 pt-2">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-pulse [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-pulse [animation-delay:0.4s]" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t border-border">
        <div className="max-w-2xl mx-auto space-y-2">
          {speechInput.isListening && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-small text-foreground">
              <span className="font-medium text-primary">Ouvindo:</span>{" "}
              {speechInput.transcript || <span className="text-muted-foreground">fale agora...</span>}
            </div>
          )}
          <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Create a task, ask for priorities, plan your day..."
            className="flex-1 bg-card border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/60"
            disabled={isLoading || speechInput.isListening}
          />
          <button
            type="button"
            onClick={handleVoiceInput}
            disabled={isLoading || !speechInput.isSupported}
            className={`rounded-lg px-4 py-2.5 transition-colors disabled:opacity-40 ${
              speechInput.isListening
                ? "bg-destructive text-destructive-foreground"
                : "bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            title={speechInput.isListening ? "Parar e enviar" : "Falar com Helena"}
          >
            {speechInput.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <button type="submit" disabled={!input.trim() || isLoading}
            className="gradient-primary text-primary-foreground rounded-lg px-4 py-2.5 disabled:opacity-40 transition-opacity">
            <Send className="h-4 w-4" />
          </button>
          </div>
        </div>
      </form>
    </div>
  );
}

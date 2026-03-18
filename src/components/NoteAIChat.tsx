import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Wand2, Send, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NoteAIChatProps {
  noteContent: string;
  noteTitle: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function NoteAIChat({ noteContent, noteTitle }: NoteAIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  // Reset chat when note changes
  useEffect(() => {
    setMessages([]);
    setExpanded(false);
  }, [noteTitle]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setExpanded(true);
    const userMsg: ChatMessage = { role: "user", content: question };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("note-ai-chat", {
        body: {
          question,
          noteTitle,
          noteContent,
          history: messages.slice(-6), // last 3 exchanges for context
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
    } catch (err: any) {
      toast.error(err.message || "Erro ao consultar IA");
      setMessages(prev => [...prev, { role: "assistant", content: "Desculpe, ocorreu um erro ao processar sua pergunta." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setExpanded(false);
  };

  const stripHtml = (html: string) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const hasContent = stripHtml(noteContent).trim().length > 20;

  if (!hasContent) return null;

  return (
    <div className="border-t border-border bg-muted/30">
      {/* Chat messages */}
      {expanded && messages.length > 0 && (
        <div className="max-h-60 overflow-y-auto px-4 pt-3 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-xs max-w-none dark:prose-invert [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>h2]:mt-3 [&>h2]:mb-1 [&>h3]:mt-2 [&>h3]:mb-1 [&>hr]:my-2">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-lg px-3 py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <Wand2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSend()}
          onFocus={() => { if (messages.length > 0) setExpanded(true); }}
          placeholder="Pergunte algo sobre esta nota..."
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
          disabled={loading}
        />
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" onClick={handleClear}>
            <X className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
          disabled={!input.trim() || loading}
          onClick={handleSend}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { Bot, Send, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchTasks, fetchSpaces, createTask } from "@/lib/api";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export default function Assistant() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "assistant", content: "Hello! I'm your Nucleus AI assistant. I can help you create tasks, prioritize your work, and manage your productivity. What would you like to do?" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
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
        today: new Date().toISOString().split("T")[0],
      };
    } catch {}

    let assistantContent = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && last.id.startsWith("ai-")) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { id: "ai-" + Date.now(), role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Parse actions from response
      const actionMatch = assistantContent.match(/```action\s*\n?([\s\S]*?)```/);
      if (actionMatch) {
        try {
          const action = JSON.parse(actionMatch[1]);
          if (action.action === "create_task") {
            await createTask({
              title: action.title,
              priority: action.priority || "medium",
              due_date: action.due_date || null,
              description: action.description || null,
            });
            toast.success(`Task created: ${action.title}`);
          }
        } catch {}
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

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="p-4 border-b border-border">
        <h1 className="text-h1 flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" /> AI Assistant
        </h1>
        <p className="text-micro text-muted-foreground">Create tasks, prioritize, plan — powered by AI</p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 animate-fade-in ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
                <Bot className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}
            <div className={`max-w-[75%] rounded-xl px-4 py-2.5 text-small leading-relaxed ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border"
            }`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : msg.content}
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
              <Bot className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <div className="bg-card border border-border rounded-xl px-4 py-2.5">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t border-border">
        <div className="flex gap-2 max-w-2xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Create a task, ask for priorities, plan your day..."
            className="flex-1 bg-card border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/60"
            disabled={isLoading}
          />
          <button type="submit" disabled={!input.trim() || isLoading}
            className="gradient-primary text-primary-foreground rounded-lg px-4 py-2.5 disabled:opacity-40 transition-opacity">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

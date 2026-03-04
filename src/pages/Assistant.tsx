import { useState, useRef, useEffect } from "react";
import { Bot, Send, User } from "lucide-react";
import { ChatMessage } from "@/types";

const initialMessages: ChatMessage[] = [
  {
    id: "1",
    role: "assistant",
    content: "Hello! I'm your AI executive assistant. I can help you create tasks, schedule meetings, set reminders, and prioritize your work. What would you like to do?",
    timestamp: new Date().toISOString(),
  },
];

export default function Assistant() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulated AI response
    setTimeout(() => {
      const response: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: getSimulatedResponse(input),
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, response]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" /> AI Assistant
        </h1>
        <p className="text-xs text-muted-foreground">Your executive secretary — create tasks, schedule, prioritize</p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 animate-fade-in ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
                <Bot className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}
            <div className={`max-w-[70%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border"
            }`}>
              {msg.content}
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
        {isTyping && (
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
            placeholder="Ask me anything — create tasks, schedule meetings, prioritize..."
            className="flex-1 bg-card border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/60"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="gradient-primary text-primary-foreground rounded-lg px-4 py-2.5 disabled:opacity-40 transition-opacity"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

function getSimulatedResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("focus") || lower.includes("priorit")) {
    return "Based on your current tasks, here's what I recommend:\n\n1. **Finish Profectum proposal** — High priority, due today\n2. **Prepare V.Tal meeting deck** — You have a meeting at 15:00\n3. **Follow up with Rafael** — This is overdue\n\nShall I reschedule any lower-priority tasks?";
  }
  if (lower.includes("remind") || lower.includes("tomorrow")) {
    return "I'll create a reminder for that. Once we connect to your backend, I'll be able to set up notifications via browser and email. Would you like me to also create a task for it?";
  }
  if (lower.includes("schedule") || lower.includes("meeting")) {
    return "I can help schedule that! Once Google Calendar is connected, I'll create the event directly. For now, I'll note this as a task. What time works best?";
  }
  if (lower.includes("overdue") || lower.includes("forgot")) {
    return "You have 2 overdue tasks:\n\n• **Follow up with Rafael** (Clients) — was due yesterday\n• **Write product roadmap draft** (Ideas) — was due yesterday\n\nWould you like me to reschedule these or mark any as completed?";
  }
  return "I understand! Once we connect the backend and AI provider, I'll be able to take actions like creating tasks, scheduling meetings, and setting reminders directly. What else can I help you plan?";
}

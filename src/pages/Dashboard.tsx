import { useEffect, useState, useRef, useMemo } from "react";
import { fetchTasks, updateTask, fetchSpaces, createTask, deleteTask } from "@/lib/api";
import { TaskCard } from "@/components/TaskCard";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { VoiceTaskDialog } from "@/components/VoiceTaskDialog";
import { CompletionCommentDialog } from "@/components/CompletionCommentDialog";
import { FollowUpDialog } from "@/components/FollowUpDialog";
import { Clock, AlertTriangle, TrendingUp, Bot, Send, User, ChevronDown, ChevronRight, Trophy, CheckCircle2, Circle, Trash2, History, Calendar, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { AccomplishmentHistory } from "@/components/AccomplishmentHistory";

import { useAuth } from "@/hooks/useAuth";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const today = new Date().toISOString().split("T")[0];

function SectionHeader({ icon: Icon, title, count, isOpen, onToggle }: { icon: React.ElementType; title: string; count: number; isOpen: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-2 mb-3 w-full text-left group">
      {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h2 className="text-h2">{title}</h2>
      <span className="text-micro text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{count}</span>
    </button>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: "1", role: "assistant", content: "Olá! Como posso ajudar? Posso criar tasks, priorizar seu dia ou responder perguntas." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const [t, s] = await Promise.all([fetchTasks(), fetchSpaces()]);
      setTasks(t); setSpaces(s);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: chatInput };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    let context: any = {};
    try {
      context = {
        tasks: tasks.slice(0, 20).map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, due_date: t.due_date, space: t.spaces?.name })),
        spaces: spaces.map((s: any) => ({ id: s.id, name: s.name })),
        today: new Date().toISOString().split("T")[0],
      };
    } catch {}

    let assistantContent = "";
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })), context }),
      });
      if (!resp.ok) throw new Error("AI request failed");
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setChatMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && last.id.startsWith("ai-"))
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                return [...prev, { id: "ai-" + Date.now(), role: "assistant", content: assistantContent }];
              });
            }
          } catch { buffer = line + "\n" + buffer; break; }
        }
      }
      const actionMatch = assistantContent.match(/```action\s*\n?([\s\S]*?)```/);
      if (actionMatch) {
        try {
          const action = JSON.parse(actionMatch[1]);
          if (action.action === "create_task") {
            await createTask({ title: action.title, priority: action.priority || "medium", due_date: action.due_date || null, description: action.description || null });
            toast.success(`Task criada: ${action.title}`);
            load();
          }
        } catch {}
      }
    } catch (err: any) {
      if (!assistantContent) {
        setChatMessages(prev => [...prev, { id: "err-" + Date.now(), role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente." }]);
      }
    } finally {
      setChatLoading(false);
    }
  };

  const todayTasks = tasks.filter(t => t.due_date === today && t.status !== "completed");
  const overdueTasks = tasks.filter(t => t.due_date && t.due_date < today && t.status !== "completed");
  const upcomingTasks = tasks.filter(t => {
    if (!t.due_date || t.status === "completed") return false;
    const d = new Date(t.due_date);
    const in7 = new Date(Date.now() + 7 * 86400000);
    return d > new Date(today) && d <= in7;
  });

  const [completionTask, setCompletionTask] = useState<any | null>(null);
  const [followUpTask, setFollowUpTask] = useState<any | null>(null);

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newStatus = task.status === "completed" ? "todo" : "completed";
    try {
      await updateTask(id, {
        status: newStatus,
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
      });
      if (newStatus === "completed") {
        setCompletionTask(task);
      }
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handlePriorityChange = async (id: string, priority: "low" | "medium" | "high") => {
    try {
      await updateTask(id, { priority });
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const activeCount = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled").length;

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ overdue: true, today: true, upcoming: true });
  const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      await deleteTask(taskToDelete);
      toast.success("Task excluída");
      setTaskToDelete(null);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return <div className="p-6 flex items-center justify-center"><p className="text-sm text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-small text-muted-foreground">
            {activeCount} active · {overdueTasks.length} overdue
          </p>
        </div>
        <div className="flex gap-2">
          <VoiceTaskDialog spaces={spaces.map(s => ({ id: s.id, name: s.name }))} onCreated={load} />
          <CreateTaskDialog spaces={spaces.map(s => ({ id: s.id, name: s.name }))} onCreated={load} />
        </div>
      </div>


      <div className="space-y-6">
        {overdueTasks.length > 0 && (
          <section>
            <SectionHeader icon={AlertTriangle} title="Overdue" count={overdueTasks.length} isOpen={openSections.overdue} onToggle={() => toggleSection("overdue")} />
            {openSections.overdue && (
              <div className="space-y-2">
                {overdueTasks.map(t => <TaskCard key={t.id} task={t} onToggle={toggleTask} onPriorityChange={handlePriorityChange} />)}
              </div>
            )}
          </section>
        )}

        <section>
          <SectionHeader icon={Clock} title="Today" count={todayTasks.length} isOpen={openSections.today} onToggle={() => toggleSection("today")} />
          {openSections.today && (
            <div className="space-y-2">
              {todayTasks.length > 0 ? (
                todayTasks.map(t => <TaskCard key={t.id} task={t} onToggle={toggleTask} />)
              ) : (
                <p className="text-small text-muted-foreground py-4 text-center">No tasks due today</p>
              )}
            </div>
          )}
        </section>

        {upcomingTasks.length > 0 && (
          <section>
            <SectionHeader icon={TrendingUp} title="Upcoming" count={upcomingTasks.length} isOpen={openSections.upcoming} onToggle={() => toggleSection("upcoming")} />
            {openSections.upcoming && (
              <div className="space-y-2">
                {upcomingTasks.map(t => <TaskCard key={t.id} task={t} onToggle={toggleTask} />)}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Daily Accomplishment */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Accomplishment do Dia</span>
        </div>
        <div className="p-4 space-y-3">
          {(() => {
            const completedToday = tasks.filter(t => t.status === "completed" && t.completed_at && t.completed_at.startsWith(today));
            const dueToday = tasks.filter(t => t.due_date === today);
            const dueTodayDone = dueToday.filter(t => t.status === "completed");
            const dueTodayPending = dueToday.filter(t => t.status !== "completed" && t.status !== "cancelled");
            const completionRate = dueToday.length > 0 ? Math.round((dueTodayDone.length / dueToday.length) * 100) : 0;

            return (
              <>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-micro text-muted-foreground mb-1">
                      <span>Previstas hoje: {dueToday.length}</span>
                      <span>{completionRate}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                  </div>
                </div>

                {completedToday.length > 0 && (
                  <div>
                    <p className="text-micro text-muted-foreground mb-1.5 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-primary" /> Concluídas ({completedToday.length})
                    </p>
                    <div className="space-y-1">
                      {completedToday.map(t => (
                        <div key={t.id} className="group/item flex items-center gap-2 text-small rounded-md px-1.5 py-1 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => setSelectedTask(t)}>
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          <span className="line-through text-muted-foreground truncate flex-1">{t.title}</span>
                          <button onClick={(e) => { e.stopPropagation(); setTaskToDelete(t.id); }}
                            className="opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-destructive transition-all flex-shrink-0">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {dueTodayPending.length > 0 && (
                  <div>
                    <p className="text-micro text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Circle className="h-3 w-3" /> Pendentes ({dueTodayPending.length})
                    </p>
                    <div className="space-y-1">
                      {dueTodayPending.map(t => (
                        <div key={t.id} className="group/item flex items-center gap-2 text-small rounded-md px-1.5 py-1 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => setSelectedTask(t)}>
                          <Circle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="truncate flex-1">{t.title}</span>
                          <button onClick={(e) => { e.stopPropagation(); setTaskToDelete(t.id); }}
                            className="opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-destructive transition-all flex-shrink-0">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {dueToday.length === 0 && completedToday.length === 0 && (
                  <p className="text-small text-muted-foreground text-center py-2">Nenhuma tarefa prevista ou concluída hoje</p>
                )}
              </>
            );
          })()}
      </div>

      {/* Accomplishment History */}
      <AccomplishmentHistory tasks={tasks} onSelectTask={setSelectedTask} onDeleteTask={setTaskToDelete} />
      </div>

      {/* Assistant Chat */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Assistant</span>
        </div>
        <div className="max-h-64 overflow-auto p-3 space-y-3">
          {chatMessages.map(msg => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-xs max-w-none dark:prose-invert">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : msg.content}
              </div>
              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                  <User className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          {chatLoading && chatMessages[chatMessages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-3 w-3 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 flex gap-1">
                <div className="w-1 h-1 rounded-full bg-muted-foreground animate-pulse" />
                <div className="w-1 h-1 rounded-full bg-muted-foreground animate-pulse [animation-delay:0.2s]" />
                <div className="w-1 h-1 rounded-full bg-muted-foreground animate-pulse [animation-delay:0.4s]" />
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>
        <form onSubmit={sendChatMessage} className="p-3 border-t border-border flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Pergunte algo ou peça para criar uma task..."
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 sm:py-2 text-sm sm:text-xs outline-none focus:border-primary placeholder:text-muted-foreground/60 min-w-0"
            disabled={chatLoading}
          />
          <button type="submit" disabled={!chatInput.trim() || chatLoading}
            className="bg-primary text-primary-foreground rounded-lg px-3 py-2.5 sm:py-2 disabled:opacity-40 transition-opacity min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      {/* Edit Task Dialog */}
      {selectedTask && (
        <EditTaskDialog
          task={selectedTask}
          spaces={spaces.map(s => ({ id: s.id, name: s.name }))}
          open={!!selectedTask}
          onOpenChange={(open) => { if (!open) setSelectedTask(null); }}
          onUpdated={() => { setSelectedTask(null); load(); }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => { if (!open) setTaskToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir task?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

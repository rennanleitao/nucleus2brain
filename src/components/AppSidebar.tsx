import { useState } from "react";
import { PwaInstallButton } from "@/components/PwaInstallPrompt";
import { 
  LayoutDashboard, 
  FolderOpen, 
  CheckSquare, 
  FileText, 
  Calendar, 
  Bot, 
  Upload,
  Settings,
  Tag,
  Zap,
  LogOut,
  Sun,
  Moon,
  Timer,
  Play,
  Pause,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { usePomodoro } from "@/hooks/usePomodoroStore";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Spaces", url: "/spaces", icon: FolderOpen },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Notes", url: "/notes", icon: FileText },
  { title: "Tags", url: "/tags", icon: Tag },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Pomodoro", url: "/pomodoro", icon: Timer },
  { title: "Assistant", url: "/assistant", icon: Bot },
  
];

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function MiniPomodoro({ collapsed }: { collapsed: boolean }) {
  const pomo = usePomodoro();
  if (pomo.phase === "idle") return null;

  const progress = pomo.totalSeconds > 0 ? ((pomo.totalSeconds - pomo.secondsLeft) / pomo.totalSeconds) * 100 : 0;

  if (collapsed) {
    return (
      <div className="px-2 py-1.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold ${
          pomo.phase === "focus" ? "bg-primary/10 text-primary" : "bg-green-500/10 text-green-500"
        }`}>
          {Math.floor(pomo.secondsLeft / 60)}
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-2 rounded-lg p-2.5 border transition-colors ${
      pomo.phase === "focus" ? "border-primary/30 bg-primary/5" : "border-green-500/30 bg-green-500/5"
    }`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${
          pomo.phase === "focus" ? "text-primary" : "text-green-500"
        }`}>
          {pomo.phase === "focus" ? "🎯 Foco" : "☕ Pausa"}
        </span>
        <button
          onClick={pomo.isRunning ? pomo.pause : pomo.resume}
          className={`p-0.5 rounded transition-colors ${
            pomo.phase === "focus" ? "text-primary hover:bg-primary/10" : "text-green-500 hover:bg-green-500/10"
          }`}
        >
          {pomo.isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        </button>
      </div>
      <p className={`text-lg font-mono font-bold ${
        pomo.phase === "focus" ? "text-primary" : "text-green-500"
      }`}>
        {formatTime(pomo.secondsLeft)}
      </p>
      {pomo.taskTitle && (
        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{pomo.taskTitle}</p>
      )}
      <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            pomo.phase === "focus" ? "bg-primary" : "bg-green-500"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, signOut } = useAuth();
  const collapsed = state === "collapsed";
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains("dark"));

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-accent-foreground">Nucleus</span>
              <span className="text-[10px] text-sidebar-foreground">Make productivity simple</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-micro uppercase tracking-widest text-sidebar-foreground/50">
            Navigate
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Mini Pomodoro Widget */}
        <div className="mt-auto">
          <MiniPomodoro collapsed={collapsed} />
        </div>
      </SidebarContent>

      <SidebarFooter className="space-y-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/settings"
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
              >
                <Settings className="h-4 w-4" />
                {!collapsed && <span>Settings</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => { document.documentElement.classList.toggle("dark"); setIsDark(!isDark); }} className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors cursor-pointer">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {!collapsed && <span>{isDark ? "Light Mode" : "Dark Mode"}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <PwaInstallButton collapsed={collapsed} />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors cursor-pointer">
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!collapsed && user && (
          <div className="px-3 py-2">
            <p className="text-[11px] text-sidebar-foreground truncate">{user.email}</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

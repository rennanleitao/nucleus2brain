import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  FolderOpen, 
  CheckSquare, 
  FileText, 
  Calendar, 
  Bot, 
  Upload,
  History,
  Settings,
  Tag,
  Zap,
  LogOut,
  Sun,
  Moon,
  Smartphone
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
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
  { title: "History", url: "/history", icon: History },
  { title: "AI Assistant", url: "/assistant", icon: Bot },
  { title: "Import", url: "/import", icon: Upload },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, signOut } = useAuth();
  const collapsed = state === "collapsed";
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains("dark"));
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => setIsInstalled(true);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else {
      // For iOS Safari, show instructions
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        alert('Para instalar no iPhone:\n1. Toque no ícone de compartilhar (⬆️) na barra do Safari\n2. Role para baixo e toque em "Adicionar à Tela de Início"');
      } else {
        alert('Para instalar o app:\nAbra o menu do navegador (⋮) e selecione "Instalar aplicativo" ou "Adicionar à tela inicial"');
      }
    }
  };

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
              <span className="text-[10px] text-sidebar-foreground">Personal OS</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
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
      </SidebarContent>

      <SidebarFooter className="space-y-1">
        <SidebarMenu>
          {!isInstalled && (
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleInstall} className="text-primary hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors cursor-pointer">
                <Smartphone className="h-4 w-4" />
                {!collapsed && <span>Instalar App</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
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

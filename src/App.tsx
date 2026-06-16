import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useReminders } from "@/hooks/useReminders";
import { PomodoroProvider } from "@/hooks/usePomodoroStore";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Spaces from "./pages/Spaces";
import Tasks from "./pages/Tasks";
import Notes from "./pages/Notes";
import Tags from "./pages/Tags";
import CalendarPage from "./pages/CalendarPage";
import Assistant from "./pages/Assistant";
import SettingsPage from "./pages/SettingsPage";
import Auth from "./pages/Auth";
import ImportPage from "./pages/ImportPage";
import History from "./pages/History";
import SpaceDetail from "./pages/SpaceDetail";
import AcceptInvite from "./pages/AcceptInvite";
import Pomodoro from "./pages/Pomodoro";
import SharedNote from "./pages/SharedNote";
import MaterialsPage from "./pages/MaterialsPage";
import NotFound from "./pages/NotFound";
import ChatGPTIntegration from "./pages/ChatGPTIntegration";
import OAuthAuthorize from "./pages/OAuthAuthorize";


const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();
  useReminders();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/shared/:token" element={<SharedNote />} />
        <Route path="/oauth/authorize" element={<OAuthAuthorize />} />
        <Route path="*" element={<Auth />} />
      </Routes>
    );
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Assistant />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/spaces" element={<Spaces />} />
        <Route path="/spaces/:id" element={<SpaceDetail />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/tags" element={<Tags />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/pomodoro" element={<Pomodoro />} />
        <Route path="/materials" element={<MaterialsPage />} />
        <Route path="/assistant" element={<Assistant />} />
            <Route path="/import" element={<ImportPage />} />
            
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/integrations/chatgpt" element={<ChatGPTIntegration />} />
            <Route path="/oauth/authorize" element={<OAuthAuthorize />} />
        <Route path="/invite/:token" element={<AcceptInvite />} />
        <Route path="/shared/:token" element={<SharedNote />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PomodoroProvider>
            <AppRoutes />
          </PomodoroProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

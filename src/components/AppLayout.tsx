import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { QuickCapture } from "@/components/QuickCapture";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Search } from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground touch-manipulation" />
            </div>
            <QuickCapture />
            <button
              onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              title="Search (⌘K)"
            >
              <Search className="h-4 w-4" />
              <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono">⌘K</kbd>
            </button>
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
      <GlobalSearch />
    </SidebarProvider>
  );
}

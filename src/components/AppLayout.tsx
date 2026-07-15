import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

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
          <header className="h-14 flex items-center justify-between border-b border-border/60 px-3 sm:px-4 bg-background/80 backdrop-blur-md sticky top-0 z-10 safe-top safe-x">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-10 w-10 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground touch-manipulation" />
            </div>
            <QuickCapture />
            <button
              onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] justify-center touch-manipulation"
              title="Search (⌘K)"
            >
              <Search className="h-4 w-4" />
              <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded border border-border/60 bg-transparent font-mono text-muted-foreground">⌘K</kbd>
            </button>
          </header>
          <main className="flex-1 overflow-auto safe-bottom">
            {children}
          </main>
        </div>
      </div>
      <GlobalSearch />
    </SidebarProvider>
  );
}

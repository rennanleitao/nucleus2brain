import { useState, useEffect } from "react";
import { Download, Share } from "lucide-react";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

export function PwaInstallButton({ collapsed }: { collapsed: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isStandalone()) return null;

  const handleClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setDeferredPrompt(null);
    } else if (isIos()) {
      toast("Toque no ícone de compartilhar e depois em \"Adicionar à Tela de Início\".");
    } else {
      toast.info("Seu navegador não suporta instalação direta. Abra este link no Chrome ou Edge para instalar como app.", {
        duration: 8000,
        action: {
          label: "Copiar link",
          onClick: () => {
            navigator.clipboard.writeText(window.location.origin);
            toast.success("Link copiado!");
          },
        },
      });
    }
  };

  return (
    <SidebarMenuButton
      onClick={handleClick}
      className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors cursor-pointer"
    >
      <Download className="h-4 w-4" />
      {!collapsed && <span>Instalar App</span>}
    </SidebarMenuButton>
  );
}

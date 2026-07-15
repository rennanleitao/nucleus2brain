import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type PromptOptions = {
  title?: string;
  description?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  required?: boolean;
};

type ConfirmRequest = ConfirmOptions & { resolve: (v: boolean) => void };
type PromptRequest = PromptOptions & { resolve: (v: string | null) => void };

let confirmListener: ((req: ConfirmRequest) => void) | null = null;
let promptListener: ((req: PromptRequest) => void) | null = null;

export function confirmDialog(opts: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!confirmListener) {
      // Fallback to native if host not mounted
      resolve(window.confirm(opts.description || opts.title || "Confirmar?"));
      return;
    }
    confirmListener({ ...opts, resolve });
  });
}

export function promptDialog(opts: PromptOptions = {}): Promise<string | null> {
  return new Promise((resolve) => {
    if (!promptListener) {
      const r = window.prompt(opts.description || opts.title || "", opts.defaultValue || "");
      resolve(r);
      return;
    }
    promptListener({ ...opts, resolve });
  });
}

export function DialogServiceHost() {
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [promptReq, setPromptReq] = useState<PromptRequest | null>(null);
  const [promptValue, setPromptValue] = useState("");

  useEffect(() => {
    confirmListener = (req) => setConfirmReq(req);
    promptListener = (req) => {
      setPromptValue(req.defaultValue || "");
      setPromptReq(req);
    };
    return () => {
      confirmListener = null;
      promptListener = null;
    };
  }, []);

  const resolveConfirm = (v: boolean) => {
    confirmReq?.resolve(v);
    setConfirmReq(null);
  };

  const resolvePrompt = (v: string | null) => {
    promptReq?.resolve(v);
    setPromptReq(null);
  };

  return (
    <>
      <AlertDialog open={!!confirmReq} onOpenChange={(o) => !o && resolveConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmReq?.title || "Confirmar"}</AlertDialogTitle>
            {confirmReq?.description && (
              <AlertDialogDescription>{confirmReq.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => resolveConfirm(false)}>
              {confirmReq?.cancelLabel || "Cancelar"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resolveConfirm(true)}
              className={
                confirmReq?.destructive
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {confirmReq?.confirmLabel || "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!promptReq} onOpenChange={(o) => !o && resolvePrompt(null)}>
        <DialogContent
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const input = (e.currentTarget as HTMLElement).querySelector("input");
            (input as HTMLInputElement | null)?.focus();
            (input as HTMLInputElement | null)?.select();
          }}
        >
          <DialogHeader>
            <DialogTitle>{promptReq?.title || "Informe um valor"}</DialogTitle>
            {promptReq?.description && (
              <DialogDescription>{promptReq.description}</DialogDescription>
            )}
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (promptReq?.required && !promptValue.trim()) return;
              resolvePrompt(promptValue);
            }}
            className="space-y-4"
          >
            <Input
              autoFocus
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder={promptReq?.placeholder}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => resolvePrompt(null)}>
                {promptReq?.cancelLabel || "Cancelar"}
              </Button>
              <Button type="submit" disabled={promptReq?.required && !promptValue.trim()}>
                {promptReq?.confirmLabel || "Confirmar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { acceptInvite } from "@/lib/sharing";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token || !user) return;
    
    const accept = async () => {
      try {
        const invite = await acceptInvite(token);
        setStatus("success");
        toast.success("Convite aceito! Redirecionando...");
        setTimeout(() => navigate(`/spaces/${invite.space_id}`), 1500);
      } catch (err: any) {
        setStatus("error");
        setErrorMsg(err.message);
        toast.error(err.message);
      }
    };
    accept();
  }, [token, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-3">
        {status === "loading" && (
          <p className="text-sm text-muted-foreground animate-pulse">Aceitando convite...</p>
        )}
        {status === "success" && (
          <p className="text-sm text-foreground">✓ Convite aceito! Redirecionando...</p>
        )}
        {status === "error" && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{errorMsg}</p>
            <button onClick={() => navigate("/")} className="text-xs text-muted-foreground underline">
              Voltar ao início
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

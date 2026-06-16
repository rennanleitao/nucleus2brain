import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const REQUIRED_PARAMS = [
  "client_id",
  "redirect_uri",
  "response_type",
  "code_challenge",
  "code_challenge_method",
] as const;

export default function OAuthAuthorize() {
  const [params] = useSearchParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);

  const missing = REQUIRED_PARAMS.filter((k) => !params.get(k));
  const clientId = params.get("client_id") ?? "";

  useEffect(() => {
    document.title = "Authorize · Nucleus";
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (missing.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full p-6 space-y-2">
          <h1 className="text-lg font-semibold">Invalid authorization request</h1>
          <p className="text-sm text-muted-foreground">
            Missing parameters: {missing.join(", ")}
          </p>
        </Card>
      </div>
    );
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setSigningIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSigningIn(false);
    if (error) toast.error(error.message);
  }

  async function handleAuthorize() {
    setAuthorizing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expired, please sign in again.");
        return;
      }
      const body: Record<string, string> = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      };
      params.forEach((v, k) => { body[k] = v; });

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oauth-authorize`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.redirect_url) {
        toast.error(data.error_description ?? "Authorization failed");
        return;
      }
      window.location.href = data.redirect_url;
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAuthorizing(false);
    }
  }

  function handleDeny() {
    const redirect = params.get("redirect_uri")!;
    const state = params.get("state") ?? "";
    const url = new URL(redirect);
    url.searchParams.set("error", "access_denied");
    if (state) url.searchParams.set("state", state);
    window.location.href = url.toString();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-none">Authorize access</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Client: <code className="font-mono">{clientId}</code>
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
          This application is requesting permission to <strong className="text-foreground">read and write</strong> your notes, tasks and spaces in Nucleus.
        </div>

        {!user ? (
          <form onSubmit={handleSignIn} className="space-y-3">
            <p className="text-sm text-muted-foreground">Sign in to continue.</p>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={signingIn}>
              {signingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Signed in as <strong className="text-foreground">{user.email}</strong>
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleDeny} disabled={authorizing}>
                Deny
              </Button>
              <Button className="flex-1" onClick={handleAuthorize} disabled={authorizing}>
                {authorizing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Authorize
              </Button>
            </div>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground w-full text-center"
              onClick={async () => { await supabase.auth.signOut(); }}
            >
              Use a different account
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

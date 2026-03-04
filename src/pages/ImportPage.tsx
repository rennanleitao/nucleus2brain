import { useState } from "react";
import { Upload, FileText, BookOpen, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export default function ImportPage() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: number } | null>(null);

  const handleEvernoteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".enex")) {
      toast.error("Please upload an .enex file exported from Evernote");
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      const content = await file.text();

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type: "evernote", data: { content } }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);

      setResult({ imported: data.imported, errors: data.errors });
      toast.success(`${data.imported} notes imported from Evernote!`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleNotionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setImporting(true);
    setResult(null);

    try {
      const notes: Array<{ title: string; content: string; tags: string[] }> = [];

      for (const file of Array.from(files)) {
        if (file.name.endsWith(".md")) {
          const content = await file.text();
          const title = file.name.replace(/\.md$/, "").replace(/ [a-f0-9]{32}$/, "");
          notes.push({ title, content, tags: ["notion-import"] });
        } else if (file.name.endsWith(".csv")) {
          const content = await file.text();
          const lines = content.split("\n");
          if (lines.length > 1) {
            const headers = lines[0].split(",");
            const titleIdx = headers.findIndex(h => h.toLowerCase().includes("name") || h.toLowerCase().includes("title"));
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(",");
              if (cols[titleIdx || 0]?.trim()) {
                notes.push({
                  title: cols[titleIdx || 0].replace(/^"|"$/g, "").trim(),
                  content: cols.slice(1).join(", ").replace(/^"|"$/g, "").trim(),
                  tags: ["notion-import"],
                });
              }
            }
          }
        }
      }

      if (notes.length === 0) {
        toast.error("No valid .md or .csv files found");
        setImporting(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type: "notion_markdown", data: { notes } }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);

      setResult({ imported: data.imported, errors: data.errors });
      toast.success(`${data.imported} notes imported from Notion!`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Upload className="h-5 w-5 text-muted-foreground" /> Import
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Bring your notes from Evernote and Notion</p>
      </div>

      {result && (
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${
          result.errors > 0 ? "border-priority-medium/30 bg-priority-medium/5" : "border-status-completed/30 bg-status-completed/5"
        }`}>
          {result.errors > 0 ? (
            <AlertCircle className="h-5 w-5 text-priority-medium flex-shrink-0" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-status-completed flex-shrink-0" />
          )}
          <div>
            <p className="text-sm font-medium">{result.imported} notes imported successfully</p>
            {result.errors > 0 && <p className="text-xs text-muted-foreground">{result.errors} notes failed to import</p>}
            <p className="text-xs text-muted-foreground mt-0.5">Check your Notes page to see them!</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Evernote */}
        <label className={`flex flex-col items-center gap-4 p-6 rounded-xl border-2 border-dashed bg-card transition-all cursor-pointer ${
          importing ? "opacity-50 pointer-events-none" : "border-border hover:border-primary/40 hover:shadow-elevated"
        }`}>
          <div className="w-12 h-12 rounded-xl bg-[#14CC45]/10 flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-[#14CC45]" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-semibold">Evernote</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Upload your <code className="text-[11px] bg-muted px-1 py-0.5 rounded">.enex</code> file
            </p>
            <p className="text-[11px] text-muted-foreground mt-2">
              Export from Evernote: Notebook → ⋯ → Export
            </p>
          </div>
          <input type="file" accept=".enex" onChange={handleEvernoteUpload} className="hidden" />
          <span className="text-xs text-primary font-medium">{importing ? "Importing..." : "Choose file"}</span>
        </label>

        {/* Notion */}
        <label className={`flex flex-col items-center gap-4 p-6 rounded-xl border-2 border-dashed bg-card transition-all cursor-pointer ${
          importing ? "opacity-50 pointer-events-none" : "border-border hover:border-primary/40 hover:shadow-elevated"
        }`}>
          <div className="w-12 h-12 rounded-xl bg-foreground/5 flex items-center justify-center">
            <FileText className="h-6 w-6 text-foreground/70" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-semibold">Notion</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Upload <code className="text-[11px] bg-muted px-1 py-0.5 rounded">.md</code> or <code className="text-[11px] bg-muted px-1 py-0.5 rounded">.csv</code> files
            </p>
            <p className="text-[11px] text-muted-foreground mt-2">
              Export from Notion: Settings → Export
            </p>
          </div>
          <input type="file" accept=".md,.csv" multiple onChange={handleNotionUpload} className="hidden" />
          <span className="text-xs text-primary font-medium">{importing ? "Importing..." : "Choose files"}</span>
        </label>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-xs font-semibold mb-2">How to export your notes</h3>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p><strong>Evernote:</strong> Open desktop app → Right-click a notebook → Export Notes → Choose ENEX format → Save</p>
          <p><strong>Notion:</strong> Go to Settings & Members → Settings → Export all workspace content → Choose Markdown & CSV → Download and unzip</p>
        </div>
      </div>
    </div>
  );
}

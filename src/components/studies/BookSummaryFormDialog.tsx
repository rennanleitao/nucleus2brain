import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateBookSummary, type BookSummary } from "@/hooks/useStudies";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  topicId: string;
  summary?: BookSummary | null;
}

export function BookSummaryFormDialog({ open, onOpenChange, topicId }: Props) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [year, setYear] = useState<string>("");
  const [executive, setExecutive] = useState("");
  const [mainIdeas, setMainIdeas] = useState("");
  const [keyConcepts, setKeyConcepts] = useState("");
  const [quotes, setQuotes] = useState("");
  const [applications, setApplications] = useState("");
  const [reviewQuestions, setReviewQuestions] = useState("");
  const [notebooklm, setNotebooklm] = useState("");
  const create = useCreateBookSummary();

  useEffect(() => {
    if (open) {
      setTitle(""); setAuthor(""); setYear(""); setExecutive(""); setMainIdeas("");
      setKeyConcepts(""); setQuotes(""); setApplications(""); setReviewQuestions(""); setNotebooklm("");
    }
  }, [open]);

  const submit = async () => {
    if (!title.trim()) return;
    try {
      await create.mutateAsync({
        topic_id: topicId,
        title: title.trim(),
        author: author.trim() || null,
        year: year ? parseInt(year, 10) : null,
        executive_summary: executive.trim() || null,
        main_ideas: mainIdeas.trim() || null,
        key_concepts: keyConcepts.trim() || null,
        relevant_quotes: quotes.trim() || null,
        practical_applications: applications.trim() || null,
        review_questions: reviewQuestions.trim() || null,
        notebooklm_url: notebooklm.trim() || null,
      });
      toast.success("Resumo de livro adicionado");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Resumo de livro</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1.5">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Ano</Label>
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Autor</Label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Resumo executivo</Label>
            <Textarea value={executive} onChange={(e) => setExecutive(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Principais ideias</Label>
            <Textarea value={mainIdeas} onChange={(e) => setMainIdeas(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Conceitos importantes</Label>
            <Textarea value={keyConcepts} onChange={(e) => setKeyConcepts(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Citações relevantes</Label>
            <Textarea value={quotes} onChange={(e) => setQuotes(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Aplicações práticas</Label>
            <Textarea value={applications} onChange={(e) => setApplications(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Perguntas para revisão</Label>
            <Textarea value={reviewQuestions} onChange={(e) => setReviewQuestions(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Link do NotebookLM</Label>
            <Input value={notebooklm} onChange={(e) => setNotebooklm(e.target.value)} placeholder="https://notebooklm.google.com/..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!title.trim()}>Salvar resumo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

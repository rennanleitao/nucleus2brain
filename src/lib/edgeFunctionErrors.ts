export function getEdgeFunctionErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("Failed to send a request to the Edge Function")) {
    return "A função de transcrição ainda não está publicada no Supabase/Lovable. Peça ao Lovable para deployar a Edge Function transcribe-meeting-audio e tente novamente.";
  }
  return message || fallback;
}

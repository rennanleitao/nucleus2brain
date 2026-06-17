/**
 * Helpers de data específicos do módulo Estudos.
 * Datas chegam como YYYY-MM-DD (timezone BRT). Renderizamos como DD-MM-YYYY.
 */

export function formatDateBR(iso?: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("T")[0].split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

export function formatRelative(iso?: string | null): string {
  if (!iso) return "Sem atualizações";
  const date = new Date(iso);
  const now = Date.now();
  const diff = now - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return formatDateBR(iso.split("T")[0]);
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days < 7) return `${days} dias atrás`;
  if (days < 30) return `${Math.floor(days / 7)} semanas atrás`;
  return formatDateBR(iso.split("T")[0]);
}

// Shared message builder + template storage for the "Comunicar" flows
// (delegation / follow-up messages sent by email or WhatsApp).

export type DelegateTask = {
  title: string;
  description?: string | null;
  due_date?: string | null;
  delegated_to?: string | null;
  /** Optional context extracted from a linked note. */
  context?: string | null;
  note_id?: string | null;
};

export type DelegateTemplate = {
  id: string;
  name: string;
  /** Subject line template. Only used for e-mail. Supports @tokens and {{legacy}}. */
  subject: string;
  /** Body template. Supports @tokens (@atividade, @responsavel, @prazo, @descricao, @contexto). */
  body: string;
  /** Built-in templates cannot be edited or deleted. */
  builtin?: boolean;
};

/** User-facing tokens shown as chips in the editor. */
export const TEMPLATE_TOKENS: { token: string; label: string; hint: string }[] = [
  { token: "@atividade", label: "Atividade", hint: "Título da tarefa" },
  { token: "@responsavel", label: "Responsável", hint: "Primeiro nome de quem foi delegada" },
  { token: "@prazo", label: "Prazo", hint: "Data curta (ex.: 13/12) ou vazio" },
  { token: "@descricao", label: "Descrição", hint: "Descrição da atividade" },
  { token: "@contexto", label: "Contexto", hint: "Trecho de nota vinculada" },
];

export function formatDateShort(d?: string | null): string {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  const currentYear = new Date().getFullYear().toString();
  const dayMonth = `${parts[2]}/${parts[1]}`;
  return parts[0] === currentYear ? dayMonth : `${dayMonth}/${parts[0]}`;
}

export function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 11 && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

function firstNameOf(name?: string | null): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] || trimmed;
}

/** Trim/clean context text to keep messages readable. */
function normalizeContext(raw?: string | null, maxLen = 500): string {
  const text = (raw || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "…";
}

export function buildTemplateVars(task: DelegateTask): Record<string, string> {
  const name = (task.delegated_to || "").trim();
  const firstName = firstNameOf(name);
  const dueShort = formatDateShort(task.due_date);
  const description = (task.description || "").trim();
  const context = normalizeContext(task.context);
  return {
    // @tokens (canonical PT-BR)
    atividade: task.title || "",
    responsavel: firstName,
    prazo: dueShort,
    descricao: description,
    contexto: context,
    // Legacy {{tokens}} kept for backward compat
    firstName,
    name,
    title: task.title || "",
    description,
    dueDate: dueShort,
    context,
  };
}

/**
 * Replaces @token and {{token}} placeholders with values.
 * @tokens are matched greedily against a fixed list (letters, digits, _).
 */
export function renderTemplateString(tpl: string, vars: Record<string, string>): string {
  return tpl
    .replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, key) => {
      if (Object.prototype.hasOwnProperty.call(vars, key)) return vars[key] ?? "";
      return match; // unknown @token — leave as-is (may be an @mention)
    })
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => (vars[key] ?? ""));
}

export const BUILTIN_TEMPLATES: DelegateTemplate[] = [
  {
    id: "builtin-delegate",
    name: "Delegar",
    builtin: true,
    subject: "@atividade",
    body:
      "Oi @responsavel, tudo bem? Você consegue tocar a atividade *@atividade*? Se sim, me avisa quando conseguiria concluir.\n\n@descricao\n\n@contexto",
  },
  {
    id: "builtin-followup",
    name: "Follow-up",
    builtin: true,
    subject: "Follow-up: @atividade",
    body:
      "Oi @responsavel, tranquilo? Consegue me atualizar sobre como está a atividade *@atividade*? Quando você acha que consegue concluir?\n\n@contexto",
  },
];

/** Collapse the awkward blank lines that appear when optional tokens are empty. */
function tidy(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/g, "");
}

/**
 * Renders a template against a task, expanding @tokens and legacy {{helpers}}.
 */
export function renderTemplate(
  tpl: DelegateTemplate,
  task: DelegateTask,
): { subject: string; body: string } {
  const vars = buildTemplateVars(task);
  // Legacy helper tokens for old saved templates
  const greetingLine = vars.responsavel ? `Oi ${vars.responsavel}` : "Oi";
  const dueSuffix = vars.prazo ? ` até ${vars.prazo}` : "";
  const descriptionLine = vars.descricao
    ? `\nMe lembro que noutro momento falamos sobre ${vars.descricao}.`
    : "";
  const full = { ...vars, greetingLine, dueSuffix, descriptionLine };
  return {
    subject: tidy(renderTemplateString(tpl.subject || "", full)),
    body: tidy(renderTemplateString(tpl.body || "", full)),
  };
}

const STORAGE_KEY = "nucleus.delegate.templates.v1";

export function loadUserTemplates(): DelegateTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t) => t && typeof t.id === "string" && typeof t.name === "string" && typeof t.body === "string",
    );
  } catch {
    return [];
  }
}

export function saveUserTemplates(list: DelegateTemplate[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}

export function getAllTemplates(): DelegateTemplate[] {
  return [...BUILTIN_TEMPLATES, ...loadUserTemplates()];
}

/** Convenience helpers for the quick-action popovers under a task card. */
export function buildDelegateMessage(task: DelegateTask): { subject: string; body: string } {
  return renderTemplate(BUILTIN_TEMPLATES[0], task);
}

// Shared message builder + template storage for the "Comunicar" flows
// (delegation / follow-up messages sent by email or WhatsApp).

export type DelegateTask = {
  title: string;
  description?: string | null;
  due_date?: string | null;
  delegated_to?: string | null;
};

export type DelegateTemplate = {
  id: string;
  name: string;
  /** Subject line template. Only used for e-mail. Supports {{variables}}. */
  subject: string;
  /** Body template. Supports {{firstName}} {{name}} {{title}} {{dueDate}} {{description}}. */
  body: string;
  /** Built-in templates cannot be edited or deleted. */
  builtin?: boolean;
};

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

export function buildTemplateVars(task: DelegateTask): Record<string, string> {
  const name = (task.delegated_to || "").trim();
  const firstName = firstNameOf(name);
  const dueShort = formatDateShort(task.due_date);
  return {
    firstName: firstName,
    name: name,
    title: task.title || "",
    description: (task.description || "").trim(),
    dueDate: dueShort,
  };
}

export function renderTemplateString(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => (vars[key] ?? ""));
}

export const BUILTIN_TEMPLATES: DelegateTemplate[] = [
  {
    id: "builtin-delegate",
    name: "Delegar",
    builtin: true,
    subject: "{{title}}",
    body:
      "{{greetingLine}}, tudo certo? Vc consegue tocar a atividade *{{title}}*{{dueSuffix}}? Se sim, me avisa.{{descriptionLine}}\n\nDepois me conta se rolou, ok? Se precisar de algum apoio me avisa.",
  },
  {
    id: "builtin-followup",
    name: "Follow-up",
    builtin: true,
    subject: "Follow-up: {{title}}",
    body:
      "{{greetingLine}}, tranquilo? Consegue me atualizar sobre como está a atividade *{{title}}*? Acha que consegue concluir quando?",
  },
];

/**
 * Renders a template against a task, expanding both simple variables
 * ({{title}}, {{firstName}}, …) and a couple of convenience helpers
 * used by the built-in templates ({{greetingLine}}, {{dueSuffix}},
 * {{descriptionLine}}).
 */
export function renderTemplate(
  tpl: DelegateTemplate,
  task: DelegateTask,
): { subject: string; body: string } {
  const vars = buildTemplateVars(task);
  const greetingLine = vars.firstName ? `Oi ${vars.firstName}` : "Oi";
  const dueSuffix = vars.dueDate ? ` até ${vars.dueDate}` : "";
  const descriptionLine = vars.description
    ? `\nMe lembro que noutro momento falamos sobre ${vars.description}.`
    : "";
  const full = { ...vars, greetingLine, dueSuffix, descriptionLine };
  return {
    subject: renderTemplateString(tpl.subject || "", full),
    body: renderTemplateString(tpl.body || "", full),
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

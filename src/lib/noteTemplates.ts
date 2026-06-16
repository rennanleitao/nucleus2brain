// Built-in note templates. The `content` field is the HTML structure inserted
// into the TipTap editor. Keep markup compatible with the editor's extensions
// (paragraph, heading, bullet/ordered list, task list, blockquote, hr, table).

export interface NoteTemplate {
  id: string;
  name: string;
  description?: string;
  content: string;
  builtIn?: boolean;
}

export const BUILT_IN_TEMPLATES: NoteTemplate[] = [
  {
    id: "builtin:meeting-notes",
    name: "Meeting Notes",
    description: "Estrutura padrão para anotações de reunião.",
    builtIn: true,
    content: `
<h1>Meeting Notes</h1>
<p><strong>Data:</strong> </p>
<p><strong>Participantes:</strong> </p>
<p><strong>Objetivo:</strong> </p>
<hr/>
<h2>Resumo</h2>
<p>Breve descrição do contexto e dos principais pontos discutidos.</p>
<hr/>
<h2>Key Takeaways</h2>
<ul>
  <li>Ponto principal 1</li>
  <li>Ponto principal 2</li>
  <li>Ponto principal 3</li>
</ul>
<hr/>
<h2>Decisões</h2>
<ul>
  <li>Decisão tomada e justificativa</li>
</ul>
<hr/>
<h2>Ações</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Ação — Responsável — Prazo</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Ação — Responsável — Prazo</p></div></li>
</ul>
<hr/>
<h2>Próximos passos</h2>
<ol>
  <li>Passo — <strong>Responsável:</strong> — <strong>Data:</strong> --/--/----</li>
  <li>Passo — <strong>Responsável:</strong> — <strong>Data:</strong> --/--/----</li>
  <li>Passo — <strong>Responsável:</strong> — <strong>Data:</strong> --/--/----</li>
</ol>
`.trim(),
  },
  {
    id: "builtin:daily-standup",
    name: "Daily Standup",
    description: "Ontem / Hoje / Bloqueios.",
    builtIn: true,
    content: `
<h1>Daily Standup</h1>
<p><strong>Data:</strong> </p>
<h2>Ontem</h2>
<ul><li></li></ul>
<h2>Hoje</h2>
<ul><li></li></ul>
<h2>Bloqueios</h2>
<ul><li></li></ul>
`.trim(),
  },
  {
    id: "builtin:brainstorm",
    name: "Brainstorm",
    description: "Captura livre de ideias com priorização.",
    builtIn: true,
    content: `
<h1>Brainstorm</h1>
<p><strong>Tema:</strong> </p>
<h2>Ideias</h2>
<ul><li>Ideia 1</li><li>Ideia 2</li><li>Ideia 3</li></ul>
<hr/>
<h2>Top 3 a explorar</h2>
<ol><li></li><li></li><li></li></ol>
<hr/>
<h2>Próximos passos</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Validar ideia</p></div></li>
</ul>
`.trim(),
  },
  {
    id: "builtin:one-on-one",
    name: "1:1",
    description: "Reunião individual com pauta e follow-ups.",
    builtIn: true,
    content: `
<h1>1:1</h1>
<p><strong>Com:</strong> </p>
<p><strong>Data:</strong> </p>
<h2>Atualizações</h2>
<ul><li></li></ul>
<h2>Tópicos</h2>
<ul><li></li></ul>
<h2>Feedback</h2>
<ul><li></li></ul>
<h2>Follow-ups</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>
</ul>
`.trim(),
  },
  {
    id: "builtin:project-brief",
    name: "Project Brief",
    description: "Resumo objetivo de um novo projeto.",
    builtIn: true,
    content: `
<h1>Project Brief</h1>
<h2>Contexto</h2>
<p></p>
<h2>Objetivo</h2>
<p></p>
<h2>Escopo</h2>
<ul><li>Incluído: </li><li>Não incluído: </li></ul>
<h2>Stakeholders</h2>
<ul><li></li></ul>
<h2>Riscos</h2>
<ul><li></li></ul>
<h2>Cronograma</h2>
<ul><li>Marco 1 — </li><li>Marco 2 — </li></ul>
`.trim(),
  },
];

export function findTemplate(all: NoteTemplate[], id: string) {
  return all.find((t) => t.id === id);
}

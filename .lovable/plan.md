
# Restyle editorial global do Nucleus

Extender o padrão editorial validado no módulo Notes (Instrument Serif, hairlines, hierarquia respirada, densidade calma) para todo o aplicativo em uma passada, com risco controlado via tokens globais primeiro e depois página por página.

## Princípios de design (linguagem visual)

- **Tipografia:** `Instrument Serif` em todos os headings (H1, H2, H3) e labels de agrupamento; body/UI segue em `Figtree`/`Inter`. Itálico do serif reservado para labels de seção e metadados editoriais (ex: "Hoje", "Space", contagens).
- **Hierarquia:** títulos grandes com peso 400 (serif já carrega a presença), body em 13-14px, micro em 11-12px uppercase com tracking largo apenas quando semântico.
- **Divisão:** hairlines (`border-border/60`, 1px) substituem cards pesados; separação por respiro vertical (space-y-4/6) em vez de fundos coloridos.
- **Superfícies:** `bg-background` como base; `bg-muted/40` apenas para inputs/pills sutis. Menos cards, mais fluxo editorial.
- **Cor:** paleta atual preservada (Cloud White + accent primário). Sem gradientes chamativos em headings.
- **Densidade:** linhas mais respiráveis, mas escaneáveis — padrão de min-h 44-48px em rows, padding p-3/p-4 em containers.

## Fase 1 — Tokens e primitivos globais

1. Confirmar `Instrument Serif` já carregado (feito no Notes) e expor classe utilitária global.
2. `src/index.css`:
   - Reescrever `h1`, `h2`, `h3`, `.text-title`, `.text-h1`, `.text-h2` para usar `var(--font-serif)` com weight 400, letter-spacing -0.01em, sizes ajustados (H1 28-32px, H2 22px, H3 18px).
   - Adicionar utilitários `.eyebrow` (uppercase micro), `.hairline` (border helper), `.page-header` (padding + border-b padrão).
3. Ajustar `tailwind.config.ts` — nada estrutural (fontes já mapeadas).

## Fase 2 — Shell (aparece em toda a app)

- **`AppSidebar.tsx`**: seções com labels serif itálico + hairline, itens mais respirados, contadores em pills sutis.
- **`AppLayout.tsx`**: header/topbar com hairline inferior, sem sombra, sem fundo cinza.
- **Breadcrumbs / page titles**: componente comum de `PageHeader` (título serif + eyebrow + hairline).

## Fase 3 — Páginas principais (uma varredura)

Aplicar `PageHeader` + hierarquia editorial + hairlines + serif nos headings de:

- Dashboard
- Tasks (lista + Kanban headers de coluna)
- Spaces (grid de cards com títulos serif)
- SpaceDetail
- Calendar (títulos de mês/semana em serif)
- Studies / Topics
- History / Accomplishments
- Pomodoro
- Assistant
- Settings
- Tags
- Materials / TimeTracking / MeetingCopilot / ImportPage / ChatGPTIntegration

Cada página: substituir cards pesados por seções com hairline, títulos serif, labels itálico onde fizer sentido, e reduzir chrome visual (bordas duplas, fundos redundantes).

## Fase 4 — Componentes compartilhados

- **Dialogs** (`CreateTask`, `EditTask`, `CreateNote`, etc.): título em serif, footer com hairline.
- **TaskCard / SpaceCard / KanbanView**: títulos em serif, metadados em micro uppercase, remover sombras fortes.
- **DayPlanner / calendar views**: cabeçalhos de dia em serif itálico, grid com hairlines.
- **NoteAIChat / Assistant prose**: manter `.ai-prose` mas alinhar headings ao serif.

## Fase 5 — Verificação

- Playwright em viewport mobile (393×618) e desktop (1280×1800) capturando: Dashboard, Tasks, Spaces, SpaceDetail, Calendar, Studies, Settings, Notes (regressão).
- Checar contraste e legibilidade do serif em rótulos pequenos — se ficar frágil em <13px, cair para sans nesses locais específicos.
- Ler console para erros/regressões pós-restyle.

## Detalhes técnicos

- Não tocar em lógica de negócio, dados ou edge functions.
- Apenas classes Tailwind e tokens em `index.css`. Sem novos pacotes.
- Manter compat com dark mode (tokens já cobrem).
- Serif já está no `index.html` via Google Fonts (não migrar para @fontsource nesta rodada para evitar mudar loader; se a orientação do sistema exigir, faço em passo separado).
- Escopo: só frontend / apresentação. Nenhum change em rotas, auth, RLS ou schema.

## Riscos e mitigações

- **Serif em telas densas (Kanban, Tasks list)** pode pesar. Mitigação: usar serif só nos títulos de coluna/página; itens de lista permanecem sans.
- **Regressão visual em dialogs muito populados**: revisar caso a caso, manter compat de spacing.
- **Volume grande em uma passada**: dividir em commits lógicos por página durante a implementação, verificando cada bloco com screenshot.

## Entregável

App inteiro com linguagem editorial consistente: serif nos headings, hairlines no lugar de bordas pesadas, respiro vertical calibrado, e o mesmo "senioridade" visual do módulo Notes aplicada em toda a navegação, páginas e componentes.

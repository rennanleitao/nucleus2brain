## Módulo Estudos - Plano de Implementação

Nova área no Nucleus para curadoria de conhecimento: **Áreas → Temas → Atualizações/Fontes/Livros**.

### 1. Banco de dados (migration única)

Cinco tabelas com RLS por `user_id` (auth.uid()), GRANTs para `authenticated`/`service_role`, trigger `updated_at`:

- **study_areas** — `id, user_id, name, description, icon, color, created_at, updated_at`
- **study_topics** — `id, user_id, area_id (FK→areas), title, description, current_reading, status (enum), tags text[], last_updated_at, created_at, updated_at`
- **study_updates** — `id, user_id, topic_id (FK→topics), type (enum), date, title, summary, why_it_matters, what_changed, source_name, source_url, tags text[], created_at, updated_at`
- **study_sources** — `id, user_id, topic_id, name, url, source_type, captured_at, notes, created_at, updated_at`
- **book_summaries** — `id, user_id, topic_id, title, author, year, executive_summary, main_ideas, key_concepts, relevant_quotes, practical_applications, review_questions, notebooklm_url, created_at, updated_at`

Enums: `study_topic_status` (monitorar, em_mudanca, estavel, pressionado, critico, arquivado), `study_update_type` (noticia, artigo, livro, relatorio, video, paper, insight, reuniao), `study_source_type` (noticia, blog_oficial, relatorio, paper, livro, video, podcast, documento_oficial).

Política: cada CASCADE on delete da hierarquia. Apagar área apaga temas, etc.

### 2. Navegação

- Adicionar item **Estudos** (ícone `BookOpen` ou `GraduationCap`) no `AppSidebar`, respeitando a ordem vertical já memorizada (rule: sidebar order).
- Nova rota `/estudos` em `App.tsx`, com sub-rotas opcionais via query (`?area=...&topic=...`) para manter URL compartilhável sem explodir o roteamento.

### 3. Hooks (React Query)

`src/hooks/useStudyAreas.ts`, `useStudyTopics.ts`, `useStudyUpdates.ts`, `useStudySources.ts`, `useBookSummaries.ts` — padrão dos hooks existentes (`useNotes`/`useTasks`), com mutations que invalidam queries e atualizam `last_updated_at` no topic quando uma update/fonte é criada.

### 4. Telas/Componentes

Pasta `src/components/studies/` e `src/pages/Studies.tsx`.

**Tela inicial (`/estudos` sem seleção):**
- Header: título "Estudos", subtítulo, botões `+ Novo tema` / `Nova área`.
- 4 stat cards: Temas acompanhados, Atualizações esta semana, Sem atualização (>14d), Em mudança.
- Grid de cards de áreas (com contagem de temas).
- Lista "Temas recentes" + "Últimas atualizações" + "Temas em mudança".

**Layout 3 colunas (quando uma área é aberta):**
- Coluna 1 (`AreasColumn`): lista de áreas, item ativo destacado, botão `+ Nova área`.
- Coluna 2 (`TopicsColumn`): cards de temas da área selecionada (título, status badge, última atualização, contagem). Botão `+ Novo tema`.
- Coluna 3 (`TopicDetail`): blocos:
  1. **Leitura atual** (texto editável inline).
  2. **Atualizações recentes** (cards cronologia inversa, modal de criação).
  3. **O que mudou** (lista derivada do campo `what_changed` das updates recentes).
  4. **Pontos para acompanhar** (checklist — guardado em `study_topics.tracking_points jsonb`).
  5. **Fontes principais** (lista com URL, tipo, captured_at).

Em telas pequenas (mobile/393px): colapsar para uma coluna por vez com navegação back.

### 5. Modais/Forms

- `AreaFormDialog` — nome, descrição, cor/ícone opcionais.
- `TopicFormDialog` — área, título, descrição, status, tags, leitura atual.
- `UpdateFormDialog` — obrigatórios: data (DD-MM-YYYY via `@/lib/timezone`), tipo, título, resumo, por que importa. Opcionais: fonte, URL, o que mudou, tags. Se tipo=Livro, mostra link para `BookSummaryFormDialog`.
- `BookSummaryFormDialog` — formulário completo (todos opcionais exceto título), com link NotebookLM.
- `SourceFormDialog` — nome, URL, tipo, observações.

Adicionar `tracking_points jsonb default '[]'` em `study_topics` para o checklist.

### 6. Design

Seguir o design system existente (minimal, light-mode, Inter, tokens semânticos). Cards `rounded-lg border bg-card shadow-sm`, badges de status com cores semânticas (não hardcoded). Sem emojis na UI. Espaçamento generoso, hover sutil.

### 7. Escopo fora

Sem IA automática, sem grafo, sem integração com módulo Notas, sem dashboard avançado — só CRUD limpo e visual.

### Detalhes técnicos

- Migration única com enums + 5 tabelas + grants + RLS + triggers `updated_at` + trigger que atualiza `study_topics.last_updated_at` quando insere em `study_updates`.
- Cascade delete em toda hierarquia.
- Rota `/estudos` adicionada antes do catch-all em `App.tsx`.
- Item de sidebar inserido na posição correta conforme regra de ordenação memorizada (vou verificar `mem://features/navigation/sidebar` antes de editar).
- Persistência de seleção de área/tema via querystring para deep-linking.

Posso prosseguir?

## Objetivo
Refatorar `supabase/functions/mcp/index.ts` (1440 linhas, ~65 tools já registradas) para o padrão enterprise descrito, preservando: endpoint atual `/mcp`, OAuth Bearer, `user_id`, RLS, schemas Zod e o registro `mcp-lite`. Nada de novo MCP — evolução em cima do existente.

## 1. Camada de envelopes (núcleo da mudança)
Criar `supabase/functions/mcp/_envelope.ts` com helpers reutilizáveis:

- `success({ entity_type, entity, changed_fields?, message?, next_actions?, extras? })` — faz readback opcional, monta `display_url`, `ingestion_result` e devolve via `ok(...)` (text/json no `content`).
- `partial({...})`, `failed({ error_code, message, details? })`.
- `batchResult({ items, success_count, failed_count })`.
- `urlFor(entity_type, id)` → mapeia para `/spaces/{id}`, `/notes/{id}`, `/tasks/{id}`, `/meetings/{id}` (notas com `meeting=true`), `/estudos/topic/{id}`, `/estudos/area/{id}`, `/estudos/entry/{id}`.
- `withCorrelation(handler)` HOF: gera `correlation_id` (uuid), mede `execution_time`, faz `console.info` estruturado (`tool_name`, `user_id`, `success`, `rows_affected`, `correlation_id`) e injeta `correlation_id` em toda resposta.
- `toolError(code, msg, details)` para erros de validação/Supabase em vez de `fail(string)`.

Formato final de toda resposta de escrita:
```json
{
  "status": "success",
  "message": "...",
  "entity_type": "note",
  "entity_id": "...",
  "title": "...",
  "changed_fields": [...],
  "display_url": "/notes/...",
  "data": { ...readback... },
  "ingestion_result": { "status": "success", "summary": "...", "indexed": true, "searchable": true },
  "next_actions": [...],
  "correlation_id": "..."
}
```

Operações de leitura ganham envelope mais simples (`status`, `data`, `count`, `correlation_id`, `next_actions`) mas continuam expondo `id`/`title`/`display_url` por item.

## 2. Migração das ferramentas existentes
Trocar cada `return ok(data)` / `return fail(msg)` pelos helpers, por área:

- Notes: `create_note`, `update_note`, `append_to_note`, `append_section_to_note`, `delete_note`, `search_notes`, `get_note`, `list_notes`.
- Tasks: `create_task`, `update_task`, `delete_task`, `complete_task`, `search_tasks`, `get_task`, `list_tasks`, `list_subtasks`/`create_subtask`/`update_subtask`/`delete_subtask`, `list_task_materials` (+create/update/delete).
- Spaces: `create_space`, `update_space`, `delete_space`, `search_spaces`, `get_space`, `list_spaces`.
- Tags/Links: assign/remove tag, link/unlink note↔space e task↔note/space, `list_links`/`search_links`/`create_link`/`update_link`/`delete_link`.
- Meetings (notas com flag): `list_meetings`, `search_meetings` + nova `summarize_and_save_meeting`.
- Estudos: `list_study_areas`, `get_study_area`, `create_study_area`, `update_study_area`, `delete_study_area`, `list_study_topics`, `get_study_topic`, `create_study_topic`, `update_study_topic`, `delete_study_topic`, `list_study_entries`, `get_study_entry`, `add_study_entry`, `update_study_entry`, `delete_study_entry`, `search_study_entries`.

Cada handler de escrita executa um SELECT pós-mutação (readback) e devolve a entidade completa; cada handler retorna `next_actions` plausíveis (`show_entity`, `refresh_list`, `search_related_content`, `create_follow_up_task`).

## 3. Novas ferramentas exigidas pelo briefing
Adicionar (todas com schema Zod, handler e validação):

Estudos – aliases/novas:
- `search_study_topics` (filtra `study_topics` por title/area).
- `add_study_update` → wrapper de `add_study_entry` com `kind='event'`.
- `list_study_updates` → wrapper de `list_study_entries` filtrando `kind='event'`.
- `add_study_source` → cria entry `kind='knowledge'`, `category='source'`, com `title`, `url`, `summary`.
- `add_book_summary` → entry `kind='knowledge'`, `category='book'` com `author`, `summary`, `key_takeaways`.
- `search_study_content` → busca unificada em `study_topics` + `study_entries`.

Semânticas (novas):
- `search_everything(query, limit?, types?)` → roda `ilike` em paralelo sobre notes, tasks, spaces, meetings, study_topics, study_entries; devolve lista normalizada com `entity_type`, `id`, `title`, `snippet`, `display_url`, `score` (heurístico por relevância de título vs corpo + recência).
- `get_recent_activity(limit?, since?)` → últimos itens criados/atualizados nas 5 áreas, ordenados por `updated_at` desc.
- `get_daily_briefing(date?)` → agrega: tarefas com due_date hoje, reuniões do dia, notas tocadas hoje, study updates do dia, próximas tarefas pendentes.
- `find_related_content(entity_type, id, limit?)` → carrega entidade base, extrai termos (título + tags + space) e devolve top-N relacionados via `search_everything` filtrado.
- `extract_action_items(text? | note_id? | meeting_id?)` → chama Lovable AI (`google/gemini-3-flash-preview` via `LOVABLE_API_KEY`) com `Output.array` Zod para extrair `{title, due_date?, priority?}`; NÃO grava — devolve sugestões com `next_actions: ["create_task"]`.
- `create_task_from_note(note_id, title?, override?)` → lê nota, cria task, faz `link_task_to_note`, herda `space_id`, retorna ambos com `display_url`.
- `append_meeting_to_project(meeting_id, space_id)` → muda `space_id` da nota-reunião e cria/atualiza link.
- `summarize_space(space_id, scope?)` → reúne contagens + últimas 10 notas/tasks/study e chama LLM para um resumo executivo curto; retorna `summary`, `stats`, `display_url`.
- `get_context_for_chat(query?, space_id?, max_tokens?)` → devolve um pacote estruturado (top notas relevantes, tasks abertas, reuniões recentes, study topics relacionados) pronto para alimentar agentes conversacionais; nada de prosa, apenas JSON com `display_url` em cada item.

Para o subset que usa LLM (`extract_action_items`, `summarize_space`), criar helper `callLovableAI(prompt, schema?)` em `supabase/functions/_shared/lovable-ai.ts`, lendo `LOVABLE_API_KEY` (já existe). Erros de IA viram `partial_success` com `error_code: "ai_unavailable"`.

## 4. Erros e validação
- Substituir todas as exceções/erros Supabase por `failed({ error_code, message, details })`. Códigos: `invalid_input`, `not_found`, `forbidden`, `db_error`, `ai_unavailable`, `unsupported_entity`.
- Garantir try/catch externo em cada handler (HOF `withCorrelation`) para nunca vazar exceção bruta.
- Confirmar que toda tool em `tools/list` tem handler — varredura `s.tool(...)` ↔ implementação; remover qualquer registro órfão (não há atualmente, mas o teste vai validar).

## 5. Observabilidade
- `console.info(JSON.stringify({ ts, correlation_id, tool_name, user_id, ms, success, rows_affected }))` em todo handler.
- `correlation_id` propagado em respostas de sucesso e erro.

## 6. Testes
Atualizar `supabase/functions/mcp/index.test.ts`:
- Smoke: para cada nome em `tools/list`, executa `tools/call` com input mínimo válido (ou espera 400 estruturado, nunca `-32601`).
- Verifica envelope: presença de `status`, `correlation_id`, e — em escritas — `entity_id`, `display_url`, `ingestion_result`, `data`.
- Roundtrip: cria nota → readback contém o conteúdo; `search_everything` encontra a nota recém-criada.

## 7. Estrutura de arquivos
```
supabase/functions/mcp/
  index.ts                  # tools refatoradas (continua único arquivo, mas modular via helpers)
  _envelope.ts              # success/failed/batchResult/urlFor/withCorrelation
  _semantic.ts              # search_everything, recent_activity, daily_briefing, related, context
  _study.ts                 # tools de Estudos (CRUD + wrappers + search)
  _ai.ts                    # extract_action_items, summarize_space (chama Lovable AI)
  index.test.ts             # cobertura ampliada
supabase/functions/_shared/
  lovable-ai.ts             # cliente Lovable AI + Output schemas
```
`index.ts` apenas registra os módulos (`registerNotes(s, ctx)`, `registerTasks(s, ctx)`, `registerStudy(s, ctx)`, `registerSemantic(s, ctx)`, `registerAI(s, ctx)`), reduzindo risco de regressão.

## 8. O que NÃO muda
- Endpoint `/functions/v1/mcp`, OAuth, headers, `tools/list`/`tools/call` JSON-RPC.
- Tabelas, RLS, GRANTs, schemas Supabase.
- Nomes das tools existentes que o ChatGPT/Claude já usam — continuam funcionando; envelope passa a ser mais rico (compatível, agentes apenas leem campos extras).

## 9. Rollout
1. Helpers (`_envelope.ts`, `lovable-ai.ts`).
2. Modularização do `index.ts` (sem mudar comportamento) + smoke test verde.
3. Aplicar envelope em Notes/Tasks/Spaces.
4. Aplicar em Estudos + adicionar wrappers/novas tools de estudo.
5. Adicionar tools semânticas e de IA.
6. Atualizar testes; rodar `bunx vitest run supabase/functions/mcp` (ou equivalente Deno) e validar via `tools/list` no Inspector.

## 10. Critérios de aceitação cobertos
Todos os itens da lista do briefing (envelope, readback, ingestion_result, next_actions, display_url, erros padronizados, correlation_id, novas tools semânticas e de Estudos, sem `-32601`, RLS preservada, endpoint preservado).

> Tarefa grande (~1.5k linhas tocadas + ~600 novas). Posso executar tudo em sequência sem novas perguntas — só preciso do "ok, manda ver".


# Integração ChatGPT ↔ Nucleus via MCP Server

Vou expor o Nucleus como um **MCP Server remoto** (Streamable HTTP) hospedado em Supabase Edge Functions, com **OAuth 2.1 + PKCE** para autenticar o usuário do ChatGPT contra o Supabase Auth. Toda a UI atual fica intacta.

## 1. Arquitetura

```text
ChatGPT (Connectors)
   │  1. OAuth 2.1 (auth code + PKCE)
   ▼
/functions/v1/oauth-authorize  ── tela de consentimento (login Supabase)
/functions/v1/oauth-token      ── troca code por access_token (JWT Supabase)
/functions/v1/oauth-register   ── Dynamic Client Registration (RFC 7591)
/.well-known/oauth-authorization-server (servido pela edge fn metadata)
   │
   │  2. POST JSON-RPC (Authorization: Bearer <token>)
   ▼
/functions/v1/mcp  ── MCP server (mcp-lite + Hono)
   │
   │  3. tool handlers chamam Supabase com JWT do usuário
   ▼
Postgres (RLS já garante isolamento por user_id)
```

- **MCP transport:** Streamable HTTP (POST único `/mcp`), compatível com ChatGPT Connectors e Claude.
- **Auth:** OAuth 2.1 + PKCE. O Nucleus age como **Authorization Server**. Tela de consentimento reusa Supabase Auth (email/senha + Google). Access token devolvido é o próprio JWT do Supabase → RLS continua aplicando.
- **Sem migração de schema** (Tags ficam como `text[]` / `text`).

## 2. Endpoints OAuth (novos edge functions)

| Função | Rota | Função |
|---|---|---|
| `oauth-metadata` | `GET /.well-known/oauth-authorization-server` (via edge) | Anuncia issuer, endpoints, PKCE S256, scopes. |
| `oauth-register` | `POST /oauth-register` | Dynamic Client Registration (ChatGPT registra-se automaticamente). |
| `oauth-authorize` | `GET /oauth-authorize` | Renderiza HTML mínimo: login + botão "Autorizar ChatGPT a acessar seu Nucleus". |
| `oauth-token` | `POST /oauth-token` | Troca `code` → access token + refresh token (JWT do Supabase). |

Tabelas novas (migration):
- `oauth_clients` (client_id, client_secret_hash, redirect_uris[], name)
- `oauth_codes` (code, client_id, user_id, code_challenge, redirect_uri, expires_at, scopes)
- `oauth_refresh_tokens` (token_hash, user_id, client_id, expires_at, revoked_at)

Todas com RLS bloqueando acesso do cliente; só service role lê.

## 3. MCP Server (edge function `mcp`)

- Stack: `mcp-lite` + `Hono` (Deno via `npm:` specifiers).
- Cada request lê `Authorization: Bearer`, valida via `supabase.auth.getUser(token)` e cria um `supabase` client **com o JWT do usuário** → reaproveita RLS automaticamente.
- Schemas das tools com Zod, descrições otimizadas para LLM.

### Tools expostas (todas de uma vez)

**Notes**
- `create_note` `{title, content?, space_id?, tags?[]}` → Note
- `update_note` `{id, title?, content?, space_id?, tags?[]}`
- `append_to_note` `{id, content}` → concatena ao `content`
- `delete_note` `{id}`
- `search_notes` `{query?, space_id?, tags?[], limit?}` → ILIKE em title/content + filtro por space/tag
- `get_note` `{id}` → nota completa

**Tasks**
- `create_task` `{title, description?, due_date?, status?, priority?, note_id?, space_id?, tag?}`
- `update_task` `{id, ...campos parciais}`
- `delete_task` `{id}` (soft delete via `deleted_at`)
- `search_tasks` `{query?, status?, due_before?, due_after?, space_id?, note_id?, tag?, limit?}`
- `get_task` `{id}` → task + subtasks + materials

**Spaces**
- `create_space` `{name, description?, icon?}`
- `update_space` `{id, name?, description?, icon?}`
- `search_spaces` `{query?, limit?}`
- `get_space` `{id}`

**Tags (array-based)**
- `create_tag` `{name}` → no-op idempotente; valida formato e retorna nome normalizado
- `search_tags` `{query?, limit?}` → agrega `DISTINCT unnest(notes.tags)` ∪ `DISTINCT tasks.tag`
- `assign_tag_to_note` `{note_id, tag}` → `array_append` se ainda não existir
- `assign_tag_to_task` `{task_id, tag}` → seta `tasks.tag` (campo único hoje)

**Links**
- `link_task_to_note` `{task_id, note_id}` → `update tasks set note_id=$2`
- `unlink_task_from_note` `{task_id}`
- `link_note_to_space` `{note_id, space_id}`
- `unlink_note_from_space` `{note_id}`
- `link_task_to_space` `{task_id, space_id}`
- `unlink_task_from_space` `{task_id}`

**Contextos compostos**
- `get_note_context` `{id}` → `{ note, tags, tasks: [...tasks where note_id=$id], space }`
- `get_space_context` `{id}` → `{ space, notes_count, tasks_count, tags_used: [], recent_notes, recent_tasks, stats: { tasks_by_status, overdue, completed_last_7d } }`

### Tratamento de erro padrão

Cada handler retorna `content: [{type:"text", text: JSON.stringify(result)}]`. Erros viram MCP errors com código `invalid_params`, `not_found`, `permission_denied`, `internal_error`. Validação Zod → mensagem amigável para o LLM corrigir.

## 4. UI mínima (sem mexer no app principal)

- Adiciono **uma página** `/settings/integrations/chatgpt` com:
  - Botão "Conectar ChatGPT" → mostra a URL do MCP server (`https://<project>.functions.supabase.co/mcp`) e instruções de colar no ChatGPT (Settings → Connectors → Add custom connector).
  - Lista de "Sessões autorizadas" (linhas de `oauth_refresh_tokens` por client) com botão **Revogar**.
- Tela `oauth-authorize` é HTML puro renderizado pela edge function (não conta como mexer na UI do app).

## 5. Segurança

- PKCE S256 obrigatório, `code` single-use com TTL 60s.
- Refresh tokens rotacionados a cada uso, hash SHA-256 no banco.
- Scopes: `notes:rw`, `tasks:rw`, `spaces:rw`. Por enquanto pedimos os três; estrutura pronta para granularizar.
- Rate limit simples por user_id no edge (in-memory).
- RLS continua sendo a fronteira real — todas as queries usam o JWT do usuário.

## 6. Entregáveis (ordem de implementação)

1. Migration: tabelas OAuth + grants + RLS.
2. Edge function `_shared/mcp-auth.ts` (valida bearer → user).
3. Edge functions OAuth (`oauth-metadata`, `oauth-register`, `oauth-authorize`, `oauth-token`).
4. Edge function `mcp` com mcp-lite, registrando as ~22 tools.
5. Página `/settings/integrations/chatgpt` (somente leitura + revogação).
6. Teste end-to-end com MCP Inspector (`npx @modelcontextprotocol/inspector`) e depois conectando no ChatGPT.

## 7. Notas sobre a sua proposta original

- **MCP > OpenAPI Actions:** confirmado. MCP é o padrão emergente do ChatGPT Connectors, descobre tools dinamicamente e o ChatGPT já entende JSON-RPC nativo. OpenAPI exigiria manter spec separada.
- **Tags como tabela:** evitamos porque (a) você pediu "não modificar a interface" e a UI hoje lê `notes.tags text[]` + `tasks.tag text`, (b) o ganho prático para o assistente é zero — `search_tags` agrega via `unnest`. Se um dia quiser normalizar, é uma segunda fase.
- **`tasks.tag` é singular hoje** — `assign_tag_to_task` substitui em vez de adicionar. Posso mudar para multi-tag depois (vira `text[]`), mas isso sim afetaria UI.

# Notas com seções datadas + navegação por data

Adiciona um sistema de journaling dentro das notas: cada nota é composta por seções datadas ("entradas"). O usuário continua sempre escrevendo na última data usada, com botão explícito para abrir uma nova data. Uma coluna lateral de datas permite pular direto para a seção correspondente — tanto dentro da nota quanto na tela principal de Notas.

## Comportamento

**Dentro de uma nota**
- O conteúdo é dividido visualmente em seções, cada uma com cabeçalho de data (ex: "06 Jul 2026 · Segunda").
- Ao abrir a nota, o cursor vai para o fim da última entrada — o usuário continua escrevendo naquela data.
- Botão "+ Nova data" no topo do editor e no menu lateral: abre um seletor de data (padrão: hoje) e insere um novo cabeçalho + bloco vazio abaixo da entrada atual.
- Coluna lateral direita ("Datas desta nota") lista todas as datas presentes, ordem decrescente, clicável para rolar até a seção. Data ativa fica destacada conforme o scroll.

**Tela principal de Notas**
- Nova coluna lateral esquerda ("Linha do tempo") lista todas as datas com atividade no conjunto de notas do usuário, agrupadas por mês.
- Clicar em uma data filtra a lista central para mostrar apenas notas que têm entradas naquele dia, com um preview do trecho daquela data.
- Botão "Limpar" volta para a listagem exaustiva padrão.

## Implementação técnica

**Modelo de dados** — usa apenas o conteúdo existente da nota (TipTap/HTML), sem migração de schema:
- Cabeçalho de data = um nó heading nível 2 com atributo `data-entry-date="YYYY-MM-DD"` e classe visual dedicada. Facilmente parseável a partir do HTML.
- Função utilitária `parseNoteEntries(html)` retorna `[{date, headingId, snippet}]`, usada tanto para a sidebar da nota quanto para o índice global.
- "Última data usada" = maior `data-entry-date` presente na nota; se a nota não tem nenhum, criar o primeiro cabeçalho automaticamente com a data de hoje ao começar a editar.

**Componentes novos**
- `src/components/editor/DateEntryExtension.ts` — extensão TipTap que renderiza os headings datados com estilo próprio (badge de data + separador hairline acima).
- `src/components/NoteDateSidebar.tsx` — coluna direita dentro da página de nota, lista datas + scroll-spy para destacar a ativa.
- `src/components/NoteDatePicker.tsx` — popover com calendário shadcn que insere `<h2 data-entry-date=...>` na posição atual.
- `src/components/NotesTimelineSidebar.tsx` — coluna esquerda em `Notes.tsx`, agrupada por mês, com contador de notas por data.
- `src/lib/noteEntries.ts` — helpers `parseNoteEntries`, `getLastEntryDate`, `insertDateEntry`, `formatEntryLabel`.

**Arquivos alterados**
- `src/pages/Notes.tsx` — adiciona `NotesTimelineSidebar` à esquerda; estado `selectedDate` filtra a lista central.
- `src/components/RichTextEditor.tsx` — registra `DateEntryExtension` e expõe API para inserir data e navegar até heading.
- Página de detalhe/edição de nota (identificar onde o editor é usado em tela cheia) — adiciona `NoteDateSidebar` à direita e botão "+ Nova data" no toolbar.
- `src/lib/api.ts` — adiciona `getNotesWithDates()` que retorna índice `date → notes[]` para a timeline global (parse client-side sobre notas já carregadas).

## Layout

```text
┌─ Tela Notas ───────────────────────────────────────────────┐
│  LINHA DO TEMPO   │  NOTAS (filtradas)                     │
│                   │                                         │
│  Julho 2026       │  [busca]                               │
│  · Hoje       12  │                                         │
│  · Ontem       3  │  ▸ Reunião cliente X                   │
│  · 04 Jul      5  │    "…decidimos avançar com…"           │
│  ─                │                                         │
│  Junho 2026       │  ▸ Estudo IA                           │
│  · 28 Jun      2  │    "…paper sobre LoRA…"                │
└────────────────────────────────────────────────────────────┘

┌─ Dentro de uma nota ───────────────────────────────────────┐
│  Título da nota                              [+ Nova data] │
│                                                             │
│  ── 06 Jul 2026 · Segunda ──────────  │  DATAS DESTA NOTA │
│  conteúdo escrito hoje...             │  · 06 Jul (hoje)  │
│                                        │  · 04 Jul         │
│  ── 04 Jul 2026 · Sábado ───────────  │  · 28 Jun         │
│  entrada anterior...                   │                   │
└────────────────────────────────────────────────────────────┘
```

Visual mantém o Consulting shell atual: hairlines, sem gradientes, tipografia Inter, badges de data com `text-[10px] uppercase tracking-[0.14em]`.

## Fora de escopo
- Migração de schema no banco (tudo vive no HTML da nota).
- Reordenação/edição de datas passadas (só criar novas por enquanto).
- Sincronização com o calendário do Google.
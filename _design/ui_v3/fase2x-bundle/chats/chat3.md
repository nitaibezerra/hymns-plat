# UX Hinaria Priorizacao

_Started 2026-05-28 14:29 UTC_

---

## User

acesse o documento /hymns-plat/_plan/plano-revisoes-ux-priorizacao-editorial.md

Ele é um handoff do claude code e traz melhorias que precisamos fazer no Hinaria

## Assistant

_[tool: local_read]_

Documento lido. É um plano de revisões para o `hinaria.com.br` cobrindo 6 blocos de mudanças:

**Backend/Django** (executado localmente):
- **B1** — Header: renomear "Editor" → "Fila de revisão"
- **B2** — Home: seção "Em destaque" curada com sorteio determinístico por hora
- **B3** — Admin + painel staff inline no `hymnbook_detail` para marcar `priority` (P1/P2/P3) e `is_featured`

**Handoff Claude Code** (sessão separada):
- **B4** — Workspace Editorial: 4 micro-barras de métricas (REV/EST/REP/AUD) por card + badge de prioridade + filtros (sort × priority)
- **B5** — Revisão ágil: input livre de estilo (presets viram atalhos que preenchem o input)
- **B6** — Bug: atalhos 1/2/3/4 disparando dentro de qualquer `<input>`/`<textarea>`/`contentEditable`

Inclui design system de visualização (pills `P1=rust/cream`, `P2=gold/night`, `P3=outline`, barras `bg-cream/15` + fill `gold` a 6px), migration 0016 additive, e suite de testes nova (5 arquivos `tests/unit/` + 1 `tests/e2e/`).

---

O que você quer fazer agora? Algumas direções possíveis:

1. **Visualizar o redesign do card do Workspace** — mockup HTML hi-fi mostrando os 4 estados de métrica + as 3 variantes de pill (P1/P2/P3), na estética atual do projeto. Útil pra validar densidade visual antes de codar.
2. **Mockup do painel "Curadoria editorial"** no `hymnbook_detail` (B3) — radio prioridade + checkbox destaque, posicionado no contexto da página.
3. **Mockup da Revisão Ágil** com o novo input de estilo livre + estado ativo dos presets (B5).
4. **Storyboard/wireframe** de todos os blocos lado a lado num design_canvas pra revisão geral.
5. **Outra coisa** — refinar o plano, explorar uma decisão específica (ex: P3 default vs. null), gerar copy alternativa pra "Fila de revisão", etc.

Me diga qual direção quer seguir (ou várias).

## User

me ajude você a decidir como prosseguir. Se precisar podes me perguntar para ajudar a decidir. Meu objetivo é implementarmos as evoluções a partir do design que já temos para que depois o claude code implemente o código de fato no app

## Assistant

_[tool: list_files]_

_[tool: local_ls]_

_[tool: list_files]_

_[tool: list_files]_

_[tool: list_files]_

_[tool: local_ls]_

_[tool: local_ls]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: questions_v2]_

Tenho uma visão clara agora. Deixa eu propor um caminho e fazer 3 perguntas curtas pra destravar.

## Proposta de execução

**Edição in-place nos 4 arquivos JSX existentes** — sem criar variantes paralelas — porque o plano já é uma progressão pra frente, não uma exploração de alternativas. Mantém o canvas limpo e o Claude Code recebe um único "alvo" visual.

| Bloco | Onde mexer | Esforço |
|---|---|---|
| B1 — rename "Editor" → "Fila de revisão" | `_shared.jsx` (AppBar) | trivial |
| B2 — home featured | sem impacto visual (mesmo grid, só mudo a fonte dos dados) | nenhum |
| B3 — painel "Curadoria editorial" staff | `hymnbook-detail.jsx` (novo bloco condicional) | médio — design novo |
| B4 — card workspace + filtros | `editor-queue.jsx` (`QueueRow` reescrito + chips de prioridade + sort "menos áudios") | **grande — design novo** |
| B5 — input livre de estilo | `quick-review.jsx` (input abaixo dos 3 botões + estado ativo dinâmico) | pequeno |
| B6 — bug atalhos | spec-only, sem visual | nenhum |

Também vou estender os dados de exemplo (`QUEUE` em `_shared.jsx`) com `priority` e `audio_pct` pros 4 hinários, e dar variedade pras barras renderizarem realisticamente.

## 3 perguntas que destravam tudo

## User

Questions answered:
- priority_label_style: Decida você
- card_layout: Mudar pra grid de cards verticais (2 ou 3 por linha) — métricas ganham respiro, lista fica mais espaçada
- status_pill_fate: Remover — a barra REV já comunica 0/100/parcial; menos ruído
- extra_signal: Ícone/glifo pequeno indicando que o hinário está 'em destaque' na home (estrela no canto, ao lado do nome), Sparkline ou 'última atividade' (quem revisou por último + quando)

## Assistant

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

Decisões absorvidas. Vou usar:
- **P1/P2 com palavra** ("P1 Urgente", "P2 Atenção"), **P3 só código** (estado default, baixo ruído)
- **Grid vertical 2 colunas** no Workspace
- **Sem pill de status** — a barra REV basta
- **Estrela do brand** no canto quando `is_featured` + **linha de "última atividade"** na base do card

Vou ler os arquivos restantes em paralelo e começar a editar.

_[tool: update_todos]_

_[tool: str_replace_edit]_

Now the editor-queue redesign. Replacing the bulk of the file.

_[tool: write_file]_

_[tool: str_replace_edit]_

Now B3 — staff editorial panel. I'll insert it as a strip between cover and mode tabs, clearly labeled as staff-only.

_[tool: str_replace_edit]_

Now B5 + B6 in quick-review.

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: done]_

_[tool: update_todos]_

_[tool: fork_verifier_agent]_

Pronto. Apliquei as 6 mudanças no design canvas:

**Mudanças visíveis:**
- **B1** — Header agora diz "Fila de revisão" (em todas as telas via AppBar)
- **B3** — Painel "CURADORIA EDITORIAL · visível apenas para staff" no `hymnbook-detail`, com 3 radio cards (P1 Urgente vermelho / P2 Atenção dourado / P3 Baixa neutro) + checkbox "Em destaque" + Salvar
- **B4** — `editor-queue` reescrito: grid 2-col de cards verticais, badge de prioridade no canto sup. direito (P1 sólido rust, P2 sólido gold, P3 outline), 4 micro-barras REV/EST/REP/AUD, estrela do brand quando `is_featured`, sparkline de atividade + linha "quem revisou X hinos · quando", filtros separados por Ordenar + Prioridade (combináveis), novo sort "Menos áudios", KPI extra "P1 URGENTE" no header
- **B5** — Input de texto livre abaixo dos 3 botões Marcha/Valsa/Mazurca em `quick-review`. Buttons preenchem o input (source of truth). Badge "CUSTOM" aparece quando o valor não bate com nenhum preset
- **B6** — Handler de atalhos refatorado pra ignorar foco em qualquer `<input>/<textarea>/<select>/contenteditable` (não só `repsInputRef`)

**Dados:** estendi `QUEUE` em `_shared.jsx` com `priority`, `is_featured`, `style_pct`, `reps_pct`, `audio_pct`, `last_activity` — espelha o schema da migration 0016 + anotações do manager.

**Próximos passos sugeridos:**
1. Revisar visualmente no canvas; iterar em alguma parte se algo destoar
2. Quando aprovado, o handoff ao Claude Code fica mais fácil — basta apontar para esses 4 arquivos JSX como "alvo visual" para os Blocos 4 e 5, e para o `plano-revisoes-ux-priorizacao-editorial.md` como spec funcional
3. Opcional: gerar um print PDF do canvas pra anexar no PR de implementação

## User

Verifier agent check completed

## Assistant

Verificação ✓ — tudo renderizando como esperado. Design pronto pra handoff.

## User

Quero que o item "Fila de revisão" apareça como um botão ao lado do badge do user logado qu fica no canto direito. Aparecer no meio do menu não é intuitivo

## Assistant

_[tool: str_replace_edit]_

Agora o estilo CSS do botão:

_[tool: str_replace_edit]_

_[tool: done]_

Feito. **"Fila de revisão"** saiu do nav central e virou um botão-CTA ao lado das ações da conta (entre o search e o sino de notificações), com:

- ícone de fila + label
- **contador "4"** em pill dourado (número de hinários na fila — sugere urgência sem ser ruidoso)
- borda + tint dourado discretos no estado default
- vira **sólido preto** quando ativo (igual indica "você está aqui")

A ordem agora no header direito é: `🔍 Buscar | [📋 Fila de revisão · 4] | 🔔 | MR`.

## User

Apply comment

## Assistant

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

Pronto. Painel staff agora é uma **strip horizontal compacta** (uma linha):

`STAFF | Prioridade [P1 P2 P3] | ☐ Em destaque na home | Salvar`

- Removidos os textos explicativos longos
- Prioridade virou um **segmented control inline** com dot colorido (não-ativo) ou bg sólido (ativo)
- "Em destaque" virou checkbox + label simples, sem card
- Salvar é botão ghost discreto

Altura dos artboards reduzida de 1400 → 1260 (recuperou os 140px que o painel antigo ocupava).

## User

precisamos fazer uma atualização (aqui pois isso já foi implementado) na tela de um hinário. Não existe mais a barra "Modo leitura". A abordagem foi simplificada.

agora existe esse botão "Abrir hinário" que por padrão abre no modo corrido e tem a opção de trocar para carrossel. O modo indice não é de fato um modo de leitura.

Se precisar olhe o código fonte que está em hymns-plat/

## Assistant

_[tool: local_grep]_

Vou olhar o código pra entender a estrutura exata antes de mexer.

_[tool: local_read]_

_[tool: local_read]_

_[tool: read_file]_

Entendi a nova estrutura. Vou:
1. Remover a tab "Modo de leitura" da hymnbook-detail
2. Adicionar os botões **"Tocar hinário"** + **"Abrir hinário"** no cover, ao lado de `12 HINOS · 12 ÁUDIOS`
3. Mostrar direto o índice (lista) abaixo
4. Criar uma tela nova `HymnbookReadScreen` com a chrome do `hymnbook_read.html` (breadcrumb + 2 tabs underline CORRIDO/CARROSSEL) e usar nos artboards 03/04
5. Espelhar os botões de play (▶) nos itens da lista quando o hino tem áudio

_[tool: write_file]_

Agora atualizo os artboards no HTML pra usar `HymnbookReadScreen` nos modos de leitura e relabel:

_[tool: str_replace_edit]_

_[tool: done]_

Atualizado pra refletir o que está implementado:

**Artboard 02 · Hinário · detalhe** (`HymnbookDetailScreen`):
- ❌ Removida a tab "Modo de leitura"
- ✅ **"Tocar hinário"** (botão sólido gold-soft com ▶) + **"Abrir hinário"** (outline gold-soft com ícone de livro aberto) inline com a meta no cover
- ✅ Lista de hinos direto abaixo do painel staff, com **botão de play (▶) circular** por item quando tem áudio, ou `⊘` desabilitado quando não

**Artboards 03 e 04 · Abrir hinário** (`HymnbookReadScreen`):
- ✅ Breadcrumb `‹ O Cruzeiro` centralizado no topo
- ✅ Tabs underline minimalistas: **CORRIDO** / **CARROSSEL** (sem Índice), com underline rust quando ativo
- ✅ Default `corrido`
- ✅ Body de leitura como antes (flow ou carousel)

Componentes exportados: `HymnbookDetailScreen` e `HymnbookReadScreen` (a primeira não aceita mais `initialMode`).

## User

Address these comments from my teammates:

**Nitai** (on `Hymns Platform Fase 2.html` at `#root > div:nth-child(1) > div:nth-child(1) > div:nth-child(3) > div:nth-child(2) > div:nth-child(4) > div:nth-child(3) > div:nth-child(1) > div:nth-child(3) > aside:nth-child(2) > div:nth-child(3) > div:nth-child(5) > span:nth-child(1)`):
Também quero remover esse Origem daqui

**Nitai** (on `Hymns Platform Fase 2.html` at `[data-comment-anchor="85317b8ff6-div-84-13"]`):
quero remover esse componente e termos apenas a opção de editar o texto "escrever". Também quero remover de qualquer

## Assistant

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Identifiquei os dois alvos:

**1. Comment 1 (Origem)** → `hymn-detail.jsx` — linha `<MetaRow label="Origem" value="Manual" />`  
**2. Comment 2 (write/ocr/diff toggle)** → `revise-hymn.jsx` — toggle "Escrever / OCR cru / Diff vs OCR", manter só "Escrever"

E pelo "também remover de qualquer..." → remover também o pill `OCR` / `Manual` (origem) dos cards do Workspace (`editor-queue.jsx` QueueCard). Mantenho o `OcrWizardScreen` (é a feature de upload OCR, não um indicador). Confirme se quer remover essa wizard também.

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: grep]_

_[tool: str_replace_edit]_

O pill já foi removido do QueueCard antes — o comentário deve ter sido feito numa versão em cache. Vou limpar os campos `source` mortos dos dados também, e dar done pra forçar reload.

_[tool: done]_

Removidos os 3 itens:

1. **`hymn-detail.jsx`** — `<MetaRow label="Origem" value="Manual" />` removido do card de detalhes
2. **`revise-hymn.jsx`** — toggle "Escrever / OCR cru / Diff vs OCR" removido + branches OCR e Diff inteiras; agora o editor mostra direto a textarea de escrita
3. **`editor-queue.jsx` + `_shared.jsx`** — pill `OCR` / `Manual` removido do QueueCard e o campo `source` excluído dos dados (estava órfão)

Mantive o **OcrWizardScreen** (`screens/wizards.jsx`) intacto — é uma feature de upload, não um indicador. Me avise se quer remover essa tela também.

## User

agora vamos fazer o handoff para o claude code. Crie um arquivo MD descrevendo o que foi implementado de novo, detalhes comportamentais, assets imporantes, etc. Precisamos facilitar a vida do claude code

## Assistant

_[tool: local_grep]_

_[tool: local_grep]_

Vou verificar o estado atual da implementação no hymns-plat pra dimensionar o que falta antes de escrever o handoff.

_[tool: local_read]_

_[tool: local_read]_

_[tool: local_grep]_

_[tool: local_grep]_

_[tool: local_grep]_

_[tool: local_read]_

_[tool: local_grep]_

_[tool: write_file]_

Excelente — descobri que **B1, B2, B3, B5 e B6 já estão implementados**. Restam só:
- **B4** (workspace cards redesign) — o grande
- Atualizações de design feitas após o plano original

Vou criar o handoff focado nisso.

_[tool: show_to_user]_

Handoff criado em `_plan/handoff-claude-code-fase2x.md`. Estrutura:

**TL;DR matriz** — mostra status de cada bloco (B1, B2, B3, B5, B6 já estão implementados; só **B4** e algumas mudanças pós-design ficaram pendentes).

**7 seções de spec**:
- §1 — **B4 workspace** (o grande): anatomia do card vertical, 4 micro-barras, pill de prioridade (3 variantes), filtros sort+priority combináveis, snippet do `with_review_progress` com Subquery, KPI P1 URGENTE
- §2 — Mover "Fila de revisão" do nav central → CTA pill ao lado do avatar
- §3 — Strip compacta no painel staff (substitui o card atual)
- §4 — Remover toggle Escrever/OCR/Diff do `revise_hymn`
- §5 — Remover "Origem" do `hymn_detail`
- §6 — `hymnbook_detail/read` (só conferir — já implementado)
- §7 — Quick review + bug atalhos (já implementado)

**Cobre**:
- Cores exatas (tokens + hex)
- CSS pronto pra colar (`.priority-pill--*`, `.editor-cta`, etc.)
- Snippet Python do manager
- Caminhos de arquivos a editar (consolidado no final)
- Ordem de implementação sugerida
- Testes a criar
- Nota sobre auto-merge + branch

**Próximo passo**: copiar `_plan/handoff-claude-code-fase2x.md` para `hymns-plat/_plan/handoff-claude-code-fase2x.md` e abrir uma sessão do Claude Code apontando pra ele.


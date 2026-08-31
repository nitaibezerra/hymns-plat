# Paridade visual da SPA — estratégia incremental

## Contexto

A SPA SvelteKit está no ar em `beta.hinaria.com.br`, em paralelo ao monolito Django em `hinaria.com.br`. O critério de aceite do Marco 4 (`_plan/plano-headless-graphql.md`) é **≥95% das rotas com diff de pixels ≤5%**. Medido em 2026-08-27 (`_plan/marco4-diff-notes.md`): **7 de 11 rotas = 64%**, e **4 dos 7 "passes" são falsos** — passam porque a página é majoritariamente fundo, não porque as telas se parecem. A conclusão do próprio documento: *"nenhuma das 11 rotas tem paridade visual"*.

O objetivo agora é fechar essa distância. O documento de medição deixou 3 opções abertas ((a) mudar a promessa, (b) fazer o passe de design, (c) trocar o instrumento) e nenhuma foi decidida. **Este plano faz (b) e (c) juntos**, porque a medição atual não consegue detectar progresso — o threshold de viewport inteiro esconde divergência de casca em página vazia e afoga progresso real em página densa.

### A causa-raiz que ninguém tinha visto

Verifiquei o bundle CSS publicado em produção (`beta.hinaria.com.br/_app/immutable/assets/0.nLyL_9-y.css`, 38.988 bytes):

- **Não existe nenhuma regra `.font-display`.** Toda ocorrência de `class="font-display"` na SPA gera CSS nenhum. Os H1 renderizam em Inter Tight herdado de `body`, não em Cormorant Garamond.
- **Não existe `@config`** no CSS. No Tailwind 4 a config JS só é carregada por `@config "..."`, e `web/src/app.css` só tem `@import "tailwindcss"`. Portanto **`web/tailwind.config.ts` é código morto** — nunca foi lido pelo build.
- Nenhuma utility de cor (`bg-cream`, `text-ink`) existe no bundle: a SPA nunca teve a paleta Tailwind do Django.
- `@font-face` só para 3 famílias. **JetBrains Mono é declarada em `--font-mono` e nunca carregada** — todo texto mono/eyebrow/badge cai no monospace do sistema.
- `var(--font-display)` aparece em **2 regras** no bundle inteiro (marca do header e do footer).

Isto explica em uma linha o item "Tipografia de H1: Django `font-display` (Cormorant) | SvelteKit sans-serif na home" da tabela de divergências. **A identidade tipográfica do site simplesmente não chegou na SPA**, e a causa é uma diretiva faltando.

Pior: `web/tests/unit/typography-parity.spec.ts` asserta que `tailwind.config.ts` declara as três famílias — e **passa**, validando um arquivo que o build ignora. É um teste verde que não prova nada, exatamente a classe de problema que já apareceu três vezes neste projeto.

### O que já está pronto e deve ser reusado

- **O instrumento de medição funciona e se autovalida.** `HINARIA_E2E_SELF_COMPARE=1` deu **0,00% de diff nas 11 rotas** (0 pixels de 921.600). Compara Django ao vivo × SvelteKit ao vivo na mesma corrida, com fixture determinística (`apps/hymns/management/commands/seed_e2e.py`).
- `assertVisualParity` em `web/tests/e2e/_helpers/parity-report.ts` **já aceita `maxDiffPixelRatio` por rota** — é o gancho pronto para um ratchet.
- `inkRatio` e `contentBalance` em `_helpers/image-diff.ts` já existem como primeira aproximação de diff por região.
- Os hexes da paleta **já estão portados** em `web/src/app.css` (com nomes renomeados) e 3 das 4 fontes já são self-hosted via `@fontsource/*`.
- Boa cobertura de `data-testid` na SPA — habilita asserção estrutural.
- **~20 componentes da SPA têm comentário `"Paridade com <template Django>"`** nomeando a fonte que replicam. É um mapa pronto de onde olhar no monolito para cada peça.
- A superfície pública do Django é pequena: **970 linhas** de template no total.

### Decisões tomadas nesta sessão

| Tema | Decisão |
|---|---|
| 12 telas Django que nunca passaram pelo redesign da Fase 2 (paleta antiga `#2c5282`/`#c33`, classes inexistentes) — inclui 3 das 11 rotas medidas | **Paridade com a intenção.** A SPA aplica "Luz do Firmamento" nelas; a divergência entra formalmente em "Diferenças aceitas". É o único ponto onde a skill `/frontend-design` se aplica. |
| Filtro local em `/hinarios` (SPA-only, sem paginação) | **Manter** — divergência aceita |
| `?mode=` em vez da rota `/ler/` | **Manter** — divergência aceita, mas exige redirect (Fase 6) |
| Rótulo acima do número nos stats | **Manter** — divergência aceita |
| "Revisados" nos cards de hinário | **Remover** — alinhar ao Django (autor + `N HINOS · N ÁUDIOS`) |
| Player global (barra 76px, overlay, fila, modo trabalho) | **Frente separada, depois.** Fica oculto quando idle, logo não afeta nenhuma das 11 medições. Os botões ▶ por hino, que **sim** entram nas capturas, ficam nas fases de rota. |

**Nota sobre a skill `/frontend-design`:** ela é para inventar identidade visual distintiva. Aqui a identidade já existe e é canônica (`static/css/design-tokens.css`, paleta "Luz do Firmamento"). O trabalho é replicação medida, e usar a skill no miolo produziria divergência, não paridade. Ela entra só na Fase 7, onde produção não tem design a copiar.

---

## Linha de base

### Medida em 2026-08-27 (antes da Fase 1)

7 de 11 rotas dentro de 5% = **64%**, com 4 dos 7 passes falsos.

### Remedida em 2026-08-31, com a Fase 1 em `development`

Colunas: diff total · teto do ratchet · equilíbrio de densidade · tinta Django/shell · diff por região.

| | rota | diff | teto | equilíbrio | tinta D/S | header | corpo | rodapé |
|---|---|---|---|---|---|---|---|---|
| ract | `hymnbook-indice` | 59,65% | 61,65% | 5,09% | 68,17 / 3,47 | 3,43% | 65,21% | n/d |
| ract | `hinarios-list` | 48,24% | 50,24% | 84,53% | 58,38 / 49,34 | 3,43% | 52,69% | n/d |
| ract | `home` | 9,47% | 11,47% | 38,12% | 27,38 / 10,44 | 3,42% | 10,07% | n/d |
| ract | `notifications` | 8,38% | 10,38% | 60,11% | 4,99 / 8,30 | 4,34% | 10,70% | 1,56% |
| PAR | `profile` | 3,33% | 5,33% | 64,12% | 12,53 / 8,03 | 3,39% | 3,32% | n/d |
| PAR | `hymn-detail` | 2,25% | 4,25% | 85,60% | 13,06 / 11,18 | 3,39% | 2,14% | n/d |
| PAR | `profile-followers` | 2,07% | 4,07% | 55,81% | 3,82 / 2,13 | 4,34% | 2,10% | 1,56% |
| PAR? | `hymnbook-carrossel` | 2,06% | 4,06% | 5,63% | 48,31 / 2,72 | **8,04%** | 1,47% | n/d |
| PAR? | `hymnbook-corrido` | 1,81% | 3,81% | 5,06% | 40,36 / 2,04 | 3,43% | 1,65% | n/d |
| PAR | `profile-following` | 1,62% | 3,62% | 52,07% | 3,41 / 1,78 | 4,34% | 1,49% | 1,56% |
| PAR? | `busca` | 1,46% | 3,46% | 15,53% | 6,17 / 0,96 | 3,41% | 1,26% | n/d |

Rótulos: **PAR** cumpre o critério de ≤5% · **PAR?** cumpre mas com densidade desequilibrada (passe suspeito) · **ract** dentro do próprio teto do ratchet, acima do critério — não regrediu e também não chegou · **FORA** regressão.

**O que a Fase 1 fez, medido.** O diff total quase não se moveu, mas o equilíbrio de densidade saltou: `hinarios-list` de 31,49% para **84,53%** (tinta do shell 18,32% → 49,34%) e `hymn-detail` de 21,25% para **85,60%**. As páginas deixaram de ser esqueleto e ganharam tipografia real. `hymn-detail` deixou de ser passe suspeito e virou passe genuíno. `home` caiu de 11,10% para 9,47% e `busca` de 1,95% para 1,46%.

**O que o diff por região achou de imediato.** O `header` gira em ~3,4% em quase toda rota — é a linha de base da casca e o número que a Fase 2 tem que derrubar nas 11 de uma vez. A exceção é `hymnbook-carrossel` com **8,04%**: a rota `/ler/` do Django tem header PRÓPRIO (minimalista, com as abas Corrido/Carrossel), então ali o seletor compara dois elementos diferentes — divergência estrutural que o número único escondia.

---

## Estratégia

Sete fases. As Fases 0→2 são serializadas e desbloqueiam todo o resto; a Fase 4 paraleliza por rota. Cada fase é 1 PR (`feature/*` → `development` squash → `main` merge commit), com os 5 required checks vigentes.

O eixo é um **ratchet**: cada rota ganha um `maxDiffPixelRatio` fixado no valor medido hoje. O CI reprova se qualquer rota piorar; cada PR de rota abaixa o próprio número. Isso transforma "64% → 95%" de um salto único em uma sequência de entregas verificáveis, e é o que torna o trabalho incremental de verdade.

---

### Fase 0 — Afinar o instrumento ✅ CONCLUÍDA

Sem isso, nenhuma fase seguinte é mensurável e os 4 passes falsos continuam mentindo.

**Entregue:** ratchet por rota e por região com os tetos fixados nos valores medidos; diff por região (`header`/`corpo`/`rodapé`) recortando as capturas pelo bounding box real dos elementos do lado Django; rótulos de três estados (PAR / ract / FORA), porque com o ratchet "verde" passou a significar "não piorou" e não "está em paridade"; job de CI informativo. Verificado que o gate reprova: uma única linha de CSS trocando o fundo do header deixou **as 11 rotas FORA**.

**Fora desta fase, com motivo:** a asserção estrutural (mesmos rótulos, mesma ordem) e o conserto da máscara assimétrica de timestamp. A máscara só morde em `notifications` — que você roteou para a Fase 7 como divergência aceita — e em `profile` a banda mascarada é lacuna real de conteúdo (o shell não renderiza "Membro há"), não artefato do instrumento.

`web/tests/e2e/visual-parity.spec.ts`, `_helpers/parity-report.ts`, `_helpers/capture.ts`, `_helpers/image-diff.ts`:

1. **Ratchet por rota.** Fixar `maxDiffPixelRatio` de cada rota no valor medido acima, num mapa único e comentado. Reprovar se piorar.
2. **Diff por região.** Recortar cada captura em `header` / `hero` / `corpo` / `rodapé` e medir separadamente (`CaptureOptions` já tem o encanamento; falta `clip`). É o que mata o passe falso: `hymnbook-corrido` a 1,95% no viewport inteiro esconde `contentBalance` de 5,34%.
3. **Asserção estrutural.** Mesmos rótulos visíveis, mesma ordem, mesma contagem dos elementos-chave — usando os `data-testid` da SPA contra o texto do Django. Divergência de conteúdo deixa de poder passar como "cosmética".
4. **Consertar a máscara assimétrica** (follow-up #8 do doc): atributo `data-parity-volatile` nos dois lados em vez de seletores diferentes por lado. Vale ~4pp em `notifications`.
5. **Medir abaixo da dobra.** Hoje a captura é viewport-only 1280×720; tudo abaixo de 720px nunca foi medido. `fullPage` nas rotas de conteúdo, ou segunda captura.
6. **Cortar a dependência do banco de dev.** `ci-web.yml` documenta que `visual-parity.spec.ts` está fora do `test:e2e:ci` porque *"depende de dados do banco de dev (`o-justiceiro`, o usuário `nitaibezerra`) que o `seed_e2e` não cria"* — o que contradiz a nota de medição, que diz que a suíte roda contra a fixture `e2e-paridade`. Resolver a contradição (provavelmente defaults de env que caem no banco de dev) antes de ligar em CI, senão o job falha por ausência de dado e não por regressão.
7. Ligar `test:e2e:parity` no `pnpm test:e2e:ci` (fica como job não-required até a Fase 2 fechar; depois promover a required).

**Aceite:** a tabela de 11 rotas sai com número por região; `HINARIA_E2E_SELF_COMPARE=1` continua em 0,00%.

---

### Fase 1 — Fundação de design

O maior retorno do plano inteiro, e não toca lógica de rota nenhuma.

`web/src/app.css`:
1. **Declarar a paleta Tailwind em `@theme`** — `cream/soft/deep`, `ink/soft/mute`, `rule/soft`, `firmament/2/3`, `gold/soft`, `moss`, `rust`, `vermilion`, `status-not/mid/ok`, `night/deep`, + `boxShadow.soft`. Valores verbatim do `tailwind.config` inline em `templates/base.html:61-98`. **Estáticos** — não invertem no dark; a inversão é responsabilidade das variantes `dark:` no markup, como no Django.
2. **Resolver a colisão de nomes.** ✅ *Feito — a solução saiu diferente do previsto.* O `@theme` emite `--color-ink`, `--color-gold`, `--color-rule`, `--color-firmament*` e `--color-status-*` em `:root`, os mesmos nomes que o Django usa como tokens semânticos que **invertem** no escuro. Medida a colisão real, ela é pequena: apenas `--color-gold`, `--color-gold-soft` e `--color-status-{not,mid,ok}` existem nas duas camadas, e no tema claro os valores são idênticos. Então em vez de prefixar a camada semântica com `--t-*` (que mexeria em ~40 arquivos do shell), **o rename foi aplicado ao CSS portado**, mapeando os nomes do Django para os nomes semânticos que o shell já usa (`--color-ink` → `--color-text`, `--color-rule` → `--color-border`, `--color-firmament` → `--color-accent`, `--color-bg-soft` → `--color-bg-elevated`). Uma transformação mecânica em um arquivo, sem churn no resto, e os componentes portados herdam o dark mode do shell de graça.
   **Além disso, `@theme static`:** o Tailwind 4 faz tree-shaking das variáveis do tema e só emite as que consegue ver referenciadas. Uma paleta de design system é lida por `var()` de qualquer lugar — inclusive de `<style>` escopado de Svelte, que o scanner **não** enxerga. Medido: sem `static`, `--color-rule-soft`, `--color-firmament-2`, `--color-firmament-3` e `--color-vermilion` desapareciam do bundle. `static` torna a emissão incondicional.
3. **Definir os 3 tokens usados e nunca declarados** — `--color-surface`, `--color-surface-soft`, `--color-on-accent`, referenciados em **15 arquivos** e ausentes de `app.css`. Bug ao vivo: fundo transparente herdado silenciosamente.
4. **Carregar JetBrains Mono** — `pnpm add @fontsource/jetbrains-mono`, importar 400/500.
5. **Unificar o contrato de dark mode**: Django usa `html.theme-light|theme-dark|dark`, a SPA usa `:root[data-theme="dark"]`. Escolher um e alinhar `app.html` + `stores/theme.ts`.

`web/src/lib/styles/components.css` (novo) — portar o subconjunto **público** de `static/css/components.css` (~90 dos 220 seletores; o resto é workspace editorial, Marco 5): `.label-mono`, `.eyebrow`, `.hairline`, `.card-soft`, `.btn-pill`, `.btn-primary`, `.btn-gold`, `.btn-ghost`, `.pill*`, `.hymn-page`, `.hymn-body-centered`, `.hymn-grid` + `.repetition-bar`, `.dot-leader`, `.audio-*`, `.carousel-*`, `.reading-toggle`, `.kbd*`, `.featured-glyph`, `.preview-*`, `mark`. Importar globalmente pelo `+layout.svelte`.

**Consertar o teste que não prova nada:** `web/tests/unit/typography-parity.spec.ts` deve assertar o **CSS construído** (que `.font-display` existe e resolve para Cormorant), não o conteúdo de `tailwind.config.ts`. E decidir o destino do `tailwind.config.ts` morto: wire via `@config` ou deletar.

**Aceite:** o bundle construído contém `.font-display`/`.font-serif`/`.font-mono` e as utilities de cor; `@font-face` para 4 famílias; nenhuma rota piora no ratchet.

---

### Fase 2 — Casca ✅ CONCLUÍDA

Paga em todas as 11 rotas de uma vez — e pagou.

**Resultado medido:** a região `header` foi de ~3,4% para **0,00% em 10 das 11 rotas** (paridade exata de pixel na casca). O total de cada rota desceu, e o ratchet foi reabaixado nas 11:

| rota | antes | depois | header |
|---|---|---|---|
| `hymnbook-indice` | 59,65% | 59,42% | 3,43% → **0,00%** |
| `hinarios-list` | 48,24% | 47,95% | 3,43% → **0,00%** |
| `home` | 9,47% | 8,87% | 3,42% → **0,00%** |
| `notifications` | 8,38% | 7,82% | 4,34% → **0,00%** |
| `profile` | 3,33% | 2,94% | 3,39% → **0,00%** |
| `hymn-detail` | 2,25% | 1,98% | 3,39% → **0,00%** |
| `hymnbook-carrossel` | 2,06% | 1,71% | 8,04% → 4,62% |
| `hymnbook-corrido` | 1,81% | 1,50% | 3,43% → **0,00%** |
| `profile-followers` | 2,07% | 1,43% | 4,34% → **0,00%** |
| `busca` | 1,46% | 1,17% | 3,41% → **0,00%** |
| `profile-following` | 1,62% | 1,10% | 4,34% → **0,00%** |

`profile-followers` e `profile-following` chegaram a **99,2%** e **99,3%** de equilíbrio de densidade.

A única exceção do header é `hymnbook-carrossel` (4,62%): a rota `/ler/` do Django tem header **próprio**, minimalista, com as abas Corrido/Carrossel. Some quando a Fase 4 portar a tela de leitura.

**Falha da Fase 1 que só apareceu aqui.** As 3 rotas autenticadas travaram em 1,52% de header enquanto as outras 8 iam a zero. Testei a hipótese óbvia (o ponto de não-lidas do sino) e ela estava **errada** — injetar o ponto piorou para 1,56%. A causa real: `.editor-cta` mora na seção do *workspace editorial* do `components.css` (linha ~1231), fora da faixa 1–404 que a Fase 1 portou, mas o seletor é usado no **header global**. A CTA "Fila de revisão" renderizava sem estilo. Portada, as 3 rotas foram a 0,00%.

*A lição, registrada porque vale para o resto do porte:* classificar CSS por posição no arquivo é heurística, não critério. O critério é onde o seletor é **usado**.

`web/src/lib/components/Header.svelte` — portar de `templates/_partials/_header.html` (108 linhas, já lido): marca `Hinaria` em `font-display text-2xl` + logo SVG (`_logo_mark.html`, timão de 8 raios em `text-gold`); nav `Início / Hinários / Buscar` com item ativo em `text-firmament` + `border-b border-gold`; busca inline em pílula com `<kbd>⌘K</kbd>`; sino de notificações com dot; avatar circular `bg-moss` com iniciais; "Entrar" preenchido em `bg-firmament`; CTA `.editor-cta` "Fila de revisão" com contagem; hambúrguer + drawer off-canvas mobile. Sticky com `backdrop-blur`.

`web/src/lib/components/Footer.svelte` — de `_footer.html`: `HINARIA · HINARIA.COM.BR` em label-mono + epígrafe em `font-serif italic`, duas colunas.

`web/src/routes/+layout.svelte` e `src/app.html` — classes de `<body>` (`bg-cream text-ink antialiased font-sans dark:bg-night dark:text-cream`) e skip link "Pular para conteúdo".

`web/src/routes/login/+page.svelte` — hoje **sem nenhum `<style>`**, HTML cru. Estilizar com os tokens.

**Aceite:** região `header` e `rodapé` do diff por região ≤5% em todas as 11 rotas.

---

### Fase 3 — Lacunas de API (backend)

Duas coisas são **impossíveis** de replicar no frontend hoje. Deve entrar antes da Fase 4.

`apps/api/types.py` — expor `HymnBookType.accentColor`, refletindo `HymnBook.display_accent` (`apps/hymns/models.py:139`: `accent_color` explícito, senão `HYMNBOOK_ACCENT_PALETTE[md5(slug) % 8]`, linhas 15-24). Sem isso o gradiente do card e o hero do hinário — as duas piores rotas — não têm como existir.

`apps/api/schema.py` — `Query.search` devolve listas cruas. Falta o **`headline`** (o `SearchHeadline` do Postgres com `<mark>`, `max_words=20, min_words=8`, config `portuguese`, já implementado em `apps/hymns/views.py::search_view`), as contagens não truncadas, e o filtro `in_hymnbook`. É por isso que o `/busca` do beta lista 169 linhas de texto contra 521 do Django: **a SPA não mostra trecho nenhum, só títulos.**

**Aceite:** testes de unidade da API verdes; `schema.graphql` regenerado; `HymnType.style` confirmado já exposto (é — só não é renderizado).

---

### Fase 4 — Rota por rota, pior primeiro

Paralelizável (arquivos disjuntos). O ratchet dá a ordem.

**Feito até agora: 4b (card + lista) e 4c (home).**

| rota | antes | depois | equilíbrio |
|---|---|---|---|
| `hinarios-list` | 47,95% | **12,71%** | 81,94% → 89,50% |
| `home` | 8,87% | **1,15%** ✅ cumpre o critério | 33,67% → 95,39% |

O critério de ≤5% passou de 7 para **8 de 11 rotas**.

**O ratchet provou o valor dele em operação.** Ao portar o card SEM portar o hero da home, a `home` subiu de 8,87% para **12,94%** e a suíte reprovou: os cards ficaram mais altos e mais pesados (`aspect-[3/4]` em 3 colunas no lugar de 4), e o hero antigo da SPA desalinhou tudo abaixo. Sem o teto por rota isso passaria batido — a rota já estava no vermelho e continuaria no vermelho. A saída foi portar o hero, que era o passo seguinte de todo jeito.

**Duas dívidas estruturais resolvidas no caminho:**

- **Grade dos cards.** A SPA usava `repeat(auto-fill, minmax(260px, 1fr))`, que no container de 1152px dá QUATRO colunas; o monolito usa `lg:grid-cols-3`. Com o card em `aspect-[3/4]`, o número de colunas define a altura de tudo — cada card saía ~25% menor e nenhum elemento caía na mesma linha.
- **Container do `<main>`.** No monolito o `<main>` não tem container: cada template traz o seu, e é isso que permite a faixa de cor full-bleed do hero. No shell o container morava no `<main>`, então nenhuma rota conseguia sangrar. Agora existe uma lista explícita de rotas sem container no `+layout.svelte` — o **livro-caixa da migração**: cada rota portada entra nela, e quando todas estiverem, o container sai do `<main>` de vez.

**4a — `hymnbook-indice` (59,86%).** `web/src/routes/hinarios/[slug]/+page.svelte`, `HymnIndex.svelte`. De `templates/hymns/hymnbook_detail.html` (153 linhas): hero de ~470px com gradiente `display_accent`, cover-card `aspect-[3/4]` com monograma `text-[12rem]`, H1 `font-display text-5xl md:text-6xl`, contagens em label-mono, CTAs "▶ Tocar hinário" e "Abrir hinário"; índice agrupado por seção com `.dot-leader`, botão ▶ por hino (`⊘` quando sem áudio) e tag de estilo à direita.

**4b — `hinarios-list` ✅ CONCLUÍDA (47,95% → 12,71%).** `HymnbookCard.svelte`, `routes/hinarios/+page.svelte`. De `_partials/_hymnbook_card.html` (68 linhas): gradiente diagonal `linear-gradient(140deg, accent 0%, color-mix(in srgb, accent 60%, black) 100%)`, variante desktop `aspect-[3/4]` full-bleed com scrim `linear-gradient(to top, rgba(0,0,0,0.78)…)`, monograma `text-[14rem] text-cream/20`, badge `EST. YYYY` e `RASCUNHO`, título com `text-shadow`, autor, `N HINOS · <bolinha dourada> N ÁUDIOS`; variante mobile `sm:hidden` horizontal com avatar 80×80. **Remover "Revisados"** conforme decidido. Filtro local permanece (divergência aceita) → a região `corpo` desta rota ganha threshold documentado, não 5%.

**4c — `home` ✅ CONCLUÍDA (8,87% → 1,15%, agora cumpre o critério).** `routes/+page.svelte`. De `templates/hymns/home.html` (76 linhas): faixa `bg-cream-deep` com grid `md:grid-cols-[1.4fr_1fr]`, H1 `font-display text-5xl md:text-6xl leading-[1.05]` em 3 linhas com `<em>` em opacidade reduzida, círculo decorativo `blur-xl` à direita, **campo de busca em pílula como CTA** (hoje são dois botões), `<dl>` de 4 stats com número em `font-display text-3xl text-gold`. Ordem rótulo/número: divergência aceita.

**4d — `busca` (passe falso).** `routes/busca/+page.svelte` — **é a pior página do app** e precisa ser reescrita, não ajustada: é a única de todo o `web/` em Tailwind cru, sem `<style>`, usando `border-ink/15` e `text-ink/40` (cores que não existiam) e `.label-mono` (nunca definida ali). A Fase 1 já faz essas classes funcionarem. De `templates/hymns/search.html` (84 linhas): cards `.card-soft` com ícone/label, tabs `● Tudo (N) / ● Em hinos (N) / ● Em hinários (N)`, chip removível de filtro, e o trecho com `<mark>` da Fase 3.

**4e — `hymn-detail` (passe falso).** `routes/hinos/[pk]/+page.svelte`, `HymnBody.svelte`, `HymnAudioList.svelte`. De `hymn_detail.html` (169 linhas): grid `lg:grid-cols-[minmax(0,1fr)_320px]`, card `.hymn-page` com corpo centralizado `width: max-content`, **barras de repetição** (`apps/hymns/repetitions.py`, `LINE_HEIGHT_EM=1.55`, `BAR_COLUMN_WIDTH_PX=9`, `TEXT_GUTTER_PX=13.5`), glifo `.hymn-end`, sidebar de 4 blocos `card-soft`, waveform SVG real com clipPath animado.

**4f — `hymnbook-corrido` + `hymnbook-carrossel` (passes falsos).** `HymnCorrido.svelte`, `HymnCarousel.svelte`. De `hymnbook_read.html` (83 linhas): card com borda e faixa de fundo, glifos alternados `☀ ☾ ★` / `✡` a cada 3º hino, pílula contadora `NN / total`, dots com o ativo alongando para 24×6px em `--color-rust`, dica de teclado. **Bug de conteúdo:** `HymnBody.svelte` colapsa as linhas em branco entre quadras — 3 estrofes de 4 linhas viram um bloco corrido de 12. Não é estilo, é renderização.

**Aceite por rota:** todas as regiões ≤5%, exceto divergências aceitas com threshold e justificativa registrados.

---

### Fase 5 — Contrato de URL e conteúdo

- **`/hinarios/<slug>/ler/?modo=…` dá 404 no beta.** Como `?mode=` foi mantido, adicionar redirect da rota `/ler/` → `/hinarios/<slug>?mode=…` para que links compartilhados hoje não morram no cutover.
- **Toda URL do Django é 308 no beta** (`/hinarios/` → `/hinarios`). Decidir se o trailing slash é preservado ou se o 308 é aceito — afeta SEO no cutover.
- Efeito colateral de `/notificacoes/`: o Django marca como lidas ao renderizar, a SPA só lê.

---

### Fase 6 — Player global (frente separada)

`templates/hymns/_player_global.html` (143) + `static/js/player.js` (513) + `static/css/player.css` (543). Barra fixa de 76px com chrome **sempre escuro** independente do tema, overlay expandido `z-index:60`, drawer de fila 380px, `.player-workmode` `z-index:65`, sleep timer 15/30/60min, `body.player-active { padding-bottom: 76px }`. Base parcial já existe: `AudioPlayer.svelte`, `Waveform.svelte`, `stores/audio.ts`. Inclui o follow-up #10 aberto: `PlayButton` não recupera o player após dismiss (`test.fixme`).

---

### Fase 7 — Telas sem design canônico (onde a skill entra)

As 12 telas que nunca passaram pelo redesign: `hymnbook_form`, `hymn_form`, os dois `confirm_delete`, `upload_audio`, `profile_edit`, `notifications`, `followers_list`, `following_list`, `upload_confirm`, `upload_disambiguate`, `password_reset`. Usam `#2c5282`/`#c33`/`#ddd` inline e classes (`.card`, `.btn`, `.form-control`) que não existem em nenhum CSS — renderizam com o `style=` cru.

Aqui **não há design a copiar**, então é decisão de design dentro dos tokens existentes. Usar `/frontend-design` com o brief travado na paleta "Luz do Firmamento" e nos componentes da Fase 1. Registrar cada tela na seção "Diferenças aceitas (intencionais)" de `_plan/marco4-diff-notes.md`, hoje deliberadamente vazia.

Três dessas telas (`notifications`, `followers_list`, `following_list`) estão nas 11 rotas medidas — os thresholds delas passam a ser "divergência aceita", não 5%.

---

## Verificação

```bash
# 1. Subir os dois lados com fixture determinística
cd web && ./scripts/dev-fullstack.sh          # semeia seed_e2e + Django :9000 + SvelteKit :5173

# 2. Provar que o instrumento mede (deve dar 0,00% nas 11 rotas)
HINARIA_E2E_SELF_COMPARE=1 pnpm test:e2e:parity

# 3. Medir de verdade — a tabela por rota/região sai no output
pnpm test:e2e:parity

# 4. Suítes que não podem regredir
pnpm test && pnpm check && pnpm build
cd .. && uv run pytest tests/unit -q          # inclui test_typography_setup.py
```

Inspeção visual dos artefatos: `web/test-results/visual-parity/<rota>-{django,svelte,diff}.png` (gitignored). Placar por rota em `web/test-results/visual-parity/medicoes/<rota>.json`.

**Verificação da Fase 1 especificamente** — o bug de fundação precisa de prova direta no bundle, não em config:

```bash
cd web && pnpm build
grep -c '\.font-display' .svelte-kit/output/client/_app/immutable/assets/*.css   # deve ser > 0
grep -o '@font-face{[^}]*font-family:[^;]*' .svelte-kit/output/client/_app/immutable/assets/*.css \
  | grep -oE 'font-family:[^;]*' | sort -u                                       # deve listar 4 famílias
```

Depois do deploy, o mesmo grep contra `https://beta.hinaria.com.br/_app/immutable/assets/0.*.css` — foi assim que o problema foi encontrado.

## Ao final

Atualizar `_plan/plano-headless-graphql.md` (status do Marco 4 e critério de aceite), `_plan/marco4-diff-notes.md` (tabela nova + seção "Diferenças aceitas" preenchida) e `CLAUDE.md` (a seção de Frontend descreve o mundo server-rendered).

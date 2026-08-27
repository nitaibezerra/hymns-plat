# Marco 4.I — Notas de diferenças visuais Django ↔ SvelteKit

> Última atualização: 2026-08-27 (Frente B — **o critério do 4.I foi medido pela
> primeira vez e NÃO é cumprido**; ver "Execução de 2026-08-27" e o veredito
> abaixo)

Este documento registra **o que foi testado**, **o que foi medido**, **o que
ficou pendente e por quê** e **quais diferenças são intencionais/aceitas**
entre o monolito Django e o shell SvelteKit.

A suíte vive em [`web/tests/e2e/visual-parity.spec.ts`](../web/tests/e2e/visual-parity.spec.ts),
apoiada nos helpers de [`web/tests/e2e/_helpers/`](../web/tests/e2e/_helpers/),
e roda quando `HINARIA_E2E_PLAYWRIGHT_READY=1` está setado (o script
`pnpm test:e2e:parity` já seta).

---

## VEREDITO (2026-08-27)

**O critério de aceite do Sub-marco 4.I — ">=95% das rotas com diff <=5%" —
não é cumprido. Medido: 7 de 11 rotas (64%).**

E o número real é pior que isso, porque **4 dos 7 "passou" são falsos**. O
critério conta pixels divergentes do viewport inteiro; numa página que é
majoritariamente fundo creme, QUALQUER divergência de conteúdo cabe nos 5%.
Comparando as capturas lado a lado (`test-results/visual-parity/`):

- `profile-followers` deu **2,16% de diff — PASSA** — e as duas telas são
  outra coisa: o Django tem título "Seguidores" + subtítulo + avatar colorido
  por seguidor + links "Ver Perfil"/"Seguir de Volta" + cards preenchidos; o
  shell tem "Seguidores de e2e-editor" + contador "3 SEGUIDORES" + caixas
  vazias com só o username.
- `hymnbook-corrido` deu **1,95% — PASSA** — com 40,36% de tinta no Django
  contra 2,16% no shell. O Django envolve a letra num card com borda e faixa
  de fundo; o shell não tem card, não tem faixa, e **colapsa as linhas em
  branco entre as quadras** (as 3 estrofes viram um bloco de 12 linhas).

Conclusão honesta: **nenhuma das 11 rotas tem paridade visual.** O shell
SvelteKit foi construído como um port FUNCIONAL do monolito, não como réplica
visual — mesma informação, sistema de design diferente. O que o Sub-marco 4.I
mediria com o instrumento que ele mesmo especificou (diff de pixels do viewport
≤5%) é insuficiente pra detectar essa classe de divergência: ele reprova as
rotas com faixa de cor grande e aprova as rotas esparsas.

**O threshold não foi tocado.** Nem o de 5%, nem os de anti-alias/sub-pixel.
Baixar o critério pra caber no resultado apagaria o achado. A suíte reporta o
percentual medido de todas as rotas e ROTULA os passes suspeitos (`OK?` na
tabela, e uma linha "ATENÇÃO" no fim), pra que "7 de 11" não seja lido como
"64% de paridade".

**Por isso a suíte fica FORA de `pnpm test:e2e:ci`.** Ela é determinística
agora (roda contra a fixture semeada, em qualquer máquina e no CI), mas o
veredito é negativo por um motivo de produto, não de regressão — um check
required vermelho permanente treina o time a ignorar o check. Ela é o
INSTRUMENTO de medição; entra no CI quando o shell alcançar paridade, ou quando
o critério for substituído por um que meça o que interessa (ver "Recomendação"
no fim).

---

## Como a comparação funciona (mecânica)

Pra cada rota, na **mesma corrida e no mesmo browser**:

1. Captura a rota no Django e, em seguida, a rota equivalente no SvelteKit —
   mesmo viewport (1280×720), mesmo tema, animações congeladas,
   `prefers-reduced-motion: reduce`, mesmas máscaras.
2. Confere que os **dois** lados renderizaram conteúdo real: status HTTP < 400,
   ausência de estado de erro (`data-testid="error"`), ausência de estado
   VAZIO, e (onde contar diz algo) um piso de itens listados.
3. Compara pixel a pixel com `pixelmatch` e falha se o diff passar do
   threshold, **emitindo o percentual medido** (passando ou falhando).

**Não existe baseline em disco.** As duas capturas nascem e morrem na corrida.
Artefatos de inspeção (as duas capturas + o PNG de diff, por rota) vão pra
`web/test-results/visual-parity/`, coberto por `web/.gitignore`.

| Peça | Arquivo | Responsabilidade |
|---|---|---|
| Comparador | `_helpers/image-diff.ts` | `diffPngBuffers` (pixels/ratio/PNG de diff), `inkRatio`, `contentBalance`, `formatRatio` |
| Assertiva + placar | `_helpers/parity-report.ts` | threshold, artefatos, mensagem de falha, `formatParityLine`, placar em disco |
| Captura | `_helpers/capture.ts` | viewport, tema, reduced-motion, freeze de animação, máscaras, `hide`, status+HTML |
| Guardas | `_helpers/render-guard.ts` | estado de erro, estado vazio, contagem de itens |
| Sessão | `_helpers/editor-session.ts` | login pela mutation real → `storageState` |
| Fixture | `apps/hymns/management/commands/seed_e2e.py` + `_helpers/seed-fixture.ts` | dados determinísticos das duas pontas |
| Orquestração | `web/scripts/dev-fullstack.sh` | sobe Django + SvelteKit, portas e banco configuráveis |

Os helpers têm testes próprios, que rodam sem servidor nenhum:
`pnpm test:e2e:helpers` (60 testes). Eles são o antídoto contra a regressão do
4.I: provam que o comparador mede, que a máscara neutraliza timestamp, que o
`hide` remove overlay, que a guarda de vazio pega o falso verde da `/busca/` e
que a assertiva falha com o número na mensagem.

### O placar vive em disco, e o motivo não é estético

**O Playwright reinicia o worker depois de cada teste que falha**, pra garantir
estado limpo. Um placar acumulado num array de módulo perde tudo que foi medido
antes da primeira falha: a primeira corrida real desta suíte imprimiu "7 de 8
rotas" numa tabela de 11. Numa suíte cujo PRODUTO é o placar, isso não é
detalhe. Agora cada rota grava
`test-results/visual-parity/medicoes/<rota>.json` e o `afterAll` lê o
diretório; a primeira rota da tabela limpa o placar da corrida anterior.

### Auto-verificação da suíte

`HINARIA_E2E_SELF_COMPARE=1` aplica as máscaras e os `hide` do Django aos dois
lados. Aponte as duas bases pro mesmo app e o diff **tem** que cair no chão de
ruído:

```bash
HINARIA_E2E_SELF_COMPARE=1 \
  HINARIA_DJANGO_BASE_URL=http://localhost:9020 \
  HINARIA_SVELTE_BASE_URL=http://localhost:9020 \
  pnpm test:e2e:parity
```

Medido em 2026-08-27: **0,00% nas 11 rotas** (0 pixels divergentes em 921.600,
em todas). É o que prova que os números da tabela abaixo vêm de duas capturas
ao vivo, e não de uma baseline comparada consigo mesma.

---

## Como reproduzir a medição

A suíte roda contra a **fixture semeada** — não contra o banco de dev. Isso é o
que a tornou reproduzível em qualquer máquina e no CI.

```bash
cd web
./scripts/dev-fullstack.sh          # semeia (seed_e2e) e sobe Django :9000 + SvelteKit :5173
pnpm test:e2e:parity
./scripts/dev-fullstack.sh down
```

Com outra frente ocupando as portas default, escolha as suas — o script aborta
em vez de sequestrar o servidor alheio:

```bash
DJANGO_PORT=9020 SVELTE_PORT=5193 \
  DJANGO_CSRF_TRUSTED_ORIGINS=http://localhost:9020,http://localhost:5193 \
  ./scripts/dev-fullstack.sh
HINARIA_DJANGO_BASE_URL=http://localhost:9020 \
  HINARIA_SVELTE_BASE_URL=http://localhost:5193 \
  pnpm test:e2e:parity
```

`DJANGO_CSRF_TRUSTED_ORIGINS` é **obrigatório** com porta fora do default: a
lista de `config/settings/local.py` cobre só 5173 e 9000, e sem ela a mutation
`login` que a fixture de sessão usa toma 403 de Origin.

### O banco é compartilhado entre worktrees — isole o seu

As portas são isoladas por frente; o **banco não é**. `DATABASE_URL` cai no
default de `config/settings/base.py` (`…/hymnplat`), então todas as frentes
semeiam e mutam o MESMO Postgres. **Medido em 2026-08-27:** um `seed_e2e
--reset` de outra frente apagou o hinário de paridade no meio de uma corrida, e
a suíte reportou 404 em rotas que estavam 200 dois minutos antes. Pra medir em
paralelo:

```bash
docker exec hymnplat-postgres psql -U hymnplat -d postgres \
  -c 'CREATE DATABASE hymnplat_minhafrente OWNER hymnplat;'
export DATABASE_URL=postgresql://hymnplat:hymnplat@localhost:5432/hymnplat_minhafrente
DJANGO_SETTINGS_MODULE=config.settings.local uv run python manage.py migrate
# (opcional) partir dos dados de dev em vez de banco vazio:
#   pg_dump -U hymnplat hymnplat | psql -U hymnplat -d hymnplat_minhafrente
```

### Modo banco de dev (opcional, pra conferir a fixture)

```bash
HINARIA_E2E_HYMNBOOK_SLUG=o-justiceiro \
  HINARIA_E2E_SEARCH_QUERY=luz \
  pnpm test:e2e:parity
```

Serve pra responder "a fixture não está escondendo divergência?". Foi feito; os
dois modos deram o mesmo resultado (ver a segunda tabela abaixo). Não serve pra
CI — o banco de dev não existe lá.

---

## A fixture de paridade (o que substituiu o banco de dev)

Até 2026-08-27 a suíte apontava pro hinário `o-justiceiro` e pro usuário
`nitaibezerra`, que só existem no Postgres de uma máquina. Consequência: as 8
specs de paridade e as 2 de player falhavam por ausência de dado, ficaram fora
da seleção do CI, e o critério do 4.I nunca foi verificado. Uma spec que só
roda na máquina de uma pessoa apodrece.

`seed_e2e` passa a semear um 5º hinário, **`e2e-paridade`** (`E2E Paridade
Visual`, P3, publicado):

| O que | Quanto | Por quê |
|---|---|---|
| Hinos | 24 | é o que enche o índice em duas colunas a 1280×720 |
| Linhas de letra por hino | 12 (3 quadras) | corrido e carrossel renderizam a letra inteira; 2 linhas deixariam o viewport vazio |
| Letras distintas | 24 de 24 | letra repetida faria medir a mesma tela 24 vezes |
| Estilo/repetições | preenchidos | o índice do Django mostra a tag de estilo por linha |
| Áudio | 1 aprovado e **tocável** | ver "player-persists" abaixo |
| Seguidores do editor | 3 | sem eles `/seguidores/` renderiza vazio nos dois lados |
| Seguidos pelo editor | 2 | idem `/seguindo/` |
| Notificações não lidas | 3 | idem `/notificacoes/` |

**A fixture não subestima a divergência** — foi o principal risco da escolha e
foi verificado medindo os dois: com `e2e-paridade` (24 hinos, letra sintética) e
com `o-justiceiro` (124 hinos, letra e áudios reais), os 11 números batem em
ordem de grandeza e o placar é idêntico (7 de 11 nos dois). A divergência é de
sistema de design; ela aparece em qualquer conteúdo.

Bug de fixture corrigido no caminho: `seed_e2e` **não definia `owner_user`** em
hinário nenhum, e `publish_readiness` exige o check "Dono do hinário
identificado" — os 4 semeados nasciam com `canPublish: false`, inclusive o
rascunho que existe justamente pra ser publicado num teste.

E um bug de idempotência que só apareceu com o hinário grande: o áudio aprovado
nascia com `is_match=None` e a corrida SEGUINTE corrigia o campo; esse `save()`
acordava o signal que incrementa `HymnBook.sync_version`, ou seja **todo segundo
seed invalidava o cache offline de quem estivesse sincronizado**, sem nada ter
mudado. O teste de idempotência antigo não pegava porque olhava só o hinário de
revisão, cujos áudios são todos pendentes.

---

## Rotas cobertas (11)

| # | ID | Path Django | Path SvelteKit | Notas |
|---|---|---|---|---|
| 1 | `home` | `/` | `/` | público |
| 2 | `hinarios-list` | `/hinarios/` | `/hinarios/` | público |
| 3 | `hymnbook-indice` | `/hinarios/<slug>/?mode=indice` | idem | público |
| 4 | `hymnbook-corrido` | `/hinarios/<slug>/ler/?modo=corrido` | `/hinarios/<slug>/?mode=corrido` | **paths diferentes** — ver abaixo |
| 5 | `hymnbook-carrossel` | `/hinarios/<slug>/ler/?modo=carrossel` | `/hinarios/<slug>/?mode=carrossel` | **paths diferentes** |
| 6 | `hymn-detail` | `/hinos/<uuid>/` | idem | pk descoberto na hora no índice do Django |
| 7 | `busca` | `/busca/?q=<q>` | idem | |
| 8 | `profile` | `/perfil/<username>/` | idem | público nos dois |
| 9 | `profile-followers` | `/perfil/<username>/seguidores/` | idem | **exige sessão** — ver divergência de gate |
| 10 | `profile-following` | `/perfil/<username>/seguindo/` | idem | **exige sessão** |
| 11 | `notifications` | `/notificacoes/` | idem | exige sessão nos dois |

### Divergência de ROTA (achado, não descuido na tabela)

No Django, `?mode=corrido|carrossel` em `/hinarios/<slug>/` **redireciona** pra
`/hinarios/<slug>/ler/?modo=…`: a leitura virou view própria
(`HymnBookDetailView.get` trata o `?mode=` como share link legado). O shell
manteve o `?mode=` na mesma rota. A tabela aponta pro destino final de cada
lado em vez de depender do redirect legado, que pode sair a qualquer momento —
mas o contrato de URL das duas leituras **não é o mesmo**, e um link de
carrossel compartilhado por um usuário do monolito não abre no carrossel do
shell (abre, via redirect; o inverso não).

### Divergência de GATE de autenticação (achado)

`/perfil/<u>/seguidores/` e `/perfil/<u>/seguindo/` são `@login_required` no
Django (`apps/users/views_social.py`) e **públicas no shell**. Medido: como
anônimo, o Django devolve 302 pro `/accounts/login/` e o shell renderiza a
lista. É por isso que a medição anterior dessas duas rotas comparava página de
login com página real (o guard de densidade acusou: Django 4,98% de tinta
contra 1,23% do shell). A suíte agora mede as duas com sessão.

O ponto de produto é maior que a paridade: **o shell expõe anonimamente uma
lista que o monolito protege.** Quem decide qual dos dois está certo não é esta
frente; fica registrado.

### Efeito colateral do Django em `/notificacoes/` (achado)

`views_social.notifications_list` **marca as não lidas como lidas** ao
renderizar; o shell só lê (a mutation de marcar é explícita). Duas
consequências:

1. de produto: abrir a lista no monolito zera o badge, no shell não;
2. de medição: a ordem de captura importa. A suíte captura o **Django
   primeiro** de propósito — assim os dois lados mostram os mesmos itens já
   lidos. Na ordem inversa, o shell mostraria "não lida" e o Django não, e o
   diff mediria o efeito colateral.

---

## Threshold e tolerâncias

- **Threshold:** `DEFAULT_MAX_DIFF_RATIO = 0.05` (5%) em
  `_helpers/parity-report.ts`. **Não alterado.**
- **Anti-alias:** `includeAA: false` (default do pixelmatch) mantém a detecção
  de anti-aliasing ativa — pixels de borda anti-aliasada não entram na
  contagem. Cobre Tailwind Play CDN (Django) vs build do Tailwind 4 (SvelteKit).
- **Sub-pixel de fonte:** `pixelThreshold = 0.15` (distância de cor por pixel)
  absorve a diferença entre fonte self-hosted (`@fontsource/*`) e Google Fonts.
- **Overrides por rota:** `maxDiffPixelRatio` no `RouteCase`. **Nenhum em uso** —
  não há diferença de design classificada como aceita (ver abaixo).

### O gate de densidade saiu, e virou rótulo

A versão anterior recusava medir quando o equilíbrio de tinta entre os dois
lados ficava abaixo de 50% (`MIN_CONTENT_BALANCE`). A intenção era boa — pegar
o falso verde da `/busca/` — mas o efeito, com o CSRF já corrigido, foi barrar
justamente a medição que o 4.I pede: o shell é um design MAIS ESPARSO por
construção, então a tinta desequilibra por design, não por falha de render
(`hymnbook-indice`: 68,17% de tinta no Django contra 3,85% no shell, os dois com
os 24 hinos na tela). Um gate de densidade transforma o achado em "não medi".

No lugar dele:

- **guarda de estado vazio** (`findEmptyState`), que é o que o falso verde da
  `/busca/` realmente era — marcadores `data-testid="*-empty"`/`placeholder` do
  shell e uma lista explícita de frases dos templates do Django ("Nenhum hino
  cadastrado", "Nenhum seguidor ainda"…). Lista explícita e não regex genérica
  de "Nenhum…": falso positivo aqui não é teste vermelho, é medição que deixa de
  acontecer;
- **piso de itens** por rota (`countOccurrences` de `href="/hinos/` e
  `href="/hinarios/` no HTML CRU dos dois lados — casam nos dois apps porque as
  rotas são as mesmas);
- **o equilíbrio de densidade continua sendo medido e reportado**, e um "passou"
  com equilíbrio < 50% sai rotulado `OK?` / "PASSE SUSPEITO".

### Máscaras (regiões voláteis) — e o viés que elas introduzem

| Lado | Seletores | Motivo |
|---|---|---|
| Django | `p:has-text("Membro há")`, `p:has-text("atrás")`, `span:has-text("atrás")` | tempo relativo renderizado no servidor com `\|timesince` |
| SvelteKit | `.meta` | mesmo dado, formatado no cliente |

**As duas máscaras não cobrem a mesma área, e isso infla o diff.** Medido em
`notifications`: no Django a máscara cai num `<span>` inline (~90×14 px por
item); no shell o `.meta` é um bloco de largura cheia (~1040×12 px por item).
Três itens × ~12.500 px ≈ **4% da viewport de diferença que é MÁSCARA, não
design** — numa rota cujo diff medido foi 8,35%. A correção certa é um hook
estável nos dois lados (`data-parity-volatile`), que exige mexer em
`templates/**` e `web/src/**`; fora do escopo desta frente. Enquanto isso, o
número de `notifications` deve ser lido como um teto.

### `hide` (chrome que existe só num lado)

| Lado | Seletor | Motivo |
|---|---|---|
| Django | `#djDebug` | `django-debug-toolbar` do dev server: painel fixo, aberto, cobrindo ~220px da direita — ~16% da viewport. Não existe no shell. |

---

## Diferenças aceitas (intencionais)

**Lista vazia, e agora por um motivo diferente do anterior.** Antes estava vazia
porque nada havia sido medido. Agora está vazia porque **nenhuma divergência
medida é pequena o bastante pra ser "tolerada"**: não são diferenças de
anti-alias ou de sub-pixel, são telas diferentes. Classificar qualquer uma como
"aceita, threshold elevado pra 60%" seria transformar o critério em decoração.

Slot template pra quando houver uma de verdade:

```markdown
### `<route-id>` — diferença aceita (threshold elevado pra X%)

- **Observação:** <descrição textual + caminho do PNG de diff>
- **Razão:** <ex.: chrome do player só existe no shell>
- **Decisão:** aceitar, threshold `maxDiffPixelRatio: 0.X`.
- **Reverter quando:** <condição pra equiparar>
```

---

## Histórico de execuções

| Data | Branch | Rotas medidas | Diff ≤ 5% | Notas |
|---|---|---|---|---|
| 2026-06-16 | (sub-marco 4.I) | 0 (infra criada) | n/a | smoke inicial; pipeline pronto |
| 2026-08-26 | `fix/headless-web-build-4i` | 0 de 11 | n/a | "10 de 10 falharam por snapshot ausente"; a suíte não comparava Django com SvelteKit |
| 2026-08-26 | `fix/headless-visual-parity-real` | 0 de 11 com dado real · 11 de 11 em auto-comparação | auto-comparação: 11/11 a 0,00% | mecânica corrigida; medição real pendente do fix de CSRF |
| 2026-08-27 | `fix/headless-paridade-medida` | **11 de 11** | **7 de 11 (64%)**, dos quais 4 são passes suspeitos | primeira medição real completa; **critério do 4.I NÃO cumprido** |

---

## Execução de 2026-08-27 — Frente B (a medição)

Ambiente: macOS arm64 (Darwin 25.3), Chromium do Playwright 1.60, viewport
1280×720, tema claro forçado, animações congeladas, `django-debug-toolbar`
escondido. Django `config.settings.local` em `:9020` e SvelteKit dev em `:5193`
(worktree `fix/headless-paridade-medida`,
`VITE_GRAPHQL_URL=http://localhost:9020/graphql/`), **banco isolado
`hymnplat_paridade`** (migrado do zero e semeado com `seed_e2e --reset`, sem
nenhum dado de dev). Sessão via mutation `login` com o editor da fixture.

### Tabela medida — fixture `e2e-paridade`

Colunas: diff de pixels · equilíbrio de densidade (`min(tinta)/max(tinta)`) ·
tinta Django / tinta shell. `OK?` = passou no threshold mas com densidade
desequilibrada (passe suspeito).

| Veredito | Rota | Diff | Equilíbrio | Tinta Django / shell |
|---|---|---|---|---|
| **FORA** | `hymnbook-indice` | **59,86%** | 5,64% | 68,17% / 3,85% |
| **FORA** | `hinarios-list` | **48,49%** | 31,49% | 58,19% / 18,32% |
| **FORA** | `home` | **11,10%** | 43,63% | 27,36% / 11,93% |
| **FORA** | `notifications` | **8,35%** | 57,26% | 4,83% / 8,44% |
| OK | `profile` | 3,33% | 65,88% | 12,16% / 8,01% |
| OK? | `hymn-detail` | 2,42% | 21,25% | 13,06% / 2,78% |
| OK? | `hymnbook-carrossel` | 2,21% | 5,88% | 48,31% / 2,84% |
| OK | `profile-followers` | 2,16% | 58,43% | 3,80% / 2,22% |
| OK? | `hymnbook-corrido` | 1,95% | 5,34% | 40,36% / 2,16% |
| OK? | `busca` | 1,95% | 20,41% | 6,35% / 1,30% |
| OK | `profile-following` | 1,69% | 54,77% | 3,39% / 1,86% |

**7 de 11 dentro do threshold de 5% (64%). Critério: >=95%. NÃO CUMPRIDO.**
4 dos 7 são passes suspeitos (`hymn-detail`, `hymnbook-carrossel`,
`hymnbook-corrido`, `busca`).

### Tabela medida — banco de dev (`o-justiceiro`, 124 hinos)

Mesma corrida de comandos, `HINARIA_E2E_HYMNBOOK_SLUG=o-justiceiro`, contra uma
CÓPIA do banco de dev (`hymnplat_devcopy`, via `pg_dump`) pra não disputar o
banco com outra frente.

| Rota | Diff (dev) | Diff (fixture) | Δ |
|---|---|---|---|
| `hymnbook-indice` | 59,56% | 59,86% | 0,30 pp |
| `hinarios-list` | 48,00% | 48,49% | 0,49 pp |
| `home` | 11,07% | 11,10% | 0,03 pp |
| `notifications` | 8,36% | 8,35% | 0,01 pp |
| `profile` | 3,33% | 3,33% | 0 |
| `hymn-detail` | 2,65% | 2,42% | 0,23 pp |
| `hymnbook-carrossel` | 2,21% | 2,21% | 0 |
| `profile-followers` | 2,16% | 2,16% | 0 |
| `hymnbook-corrido` | 2,10% | 1,95% | 0,15 pp |
| `busca` | 1,87% | 1,95% | 0,08 pp |
| `profile-following` | 1,70% | 1,69% | 0,01 pp |

Placar idêntico: **7 de 11 (64%)**, os mesmos 4 passes suspeitos. É a prova de
que a fixture serve pra medir: trocar 24 hinos sintéticos por 124 hinos reais
não move o resultado.

### Auto-comparação (controle)

11 de 11 rotas a **0,00%** — 0 pixels divergentes em 921.600, em todas.
Instrumento verificado.

---

## Hipóteses de causa, por rota

A causa dominante é a mesma em tudo: **o shell não é uma réplica visual do
monolito.** As diferenças abaixo foram lidas nas capturas de
`test-results/visual-parity/`, não inferidas do código.

### Divergências de sistema de design (afetam TODAS as rotas)

| O que | Django | SvelteKit |
|---|---|---|
| Marca no header | "Hinaria" + ícone de sol, Cormorant Garamond | "hinária" minúsculo, sem ícone |
| Header | busca embutida com atalho `⌘K`, botão "Entrar" preenchido, toggle de tema, sino, avatar | links + toggle de tema + "Entrar" em texto |
| Tipografia de H1 | `font-display` (Cormorant Garamond) | sans-serif na home; serif em algumas rotas |
| Fundo | bandas de cor (hero verde no hinário, faixa bege na home) | fundo creme uniforme |
| Cards de lista | preenchidos, com badge de tipo e avatar colorido | caixa com borda fina, sem preenchimento |
| Rodapé | duas colunas com a assinatura "HINARIA · HINARIA.COM.BR" e epígrafe | uma linha com "Portal de Hinários do Santo Daime" + GitHub |

### Por rota

- **`hymnbook-indice` (59,86%) — a pior, e a mais informativa.** O Django tem
  um hero de ~470px de altura com faixa verde, card de capa com monograma,
  nome do hinário em Cormorant 48px, contadores "24 HINOS · 1 ÁUDIO" e dois
  CTAs ("Tocar hinário", "Abrir hinário"); no índice, cada linha tem botão ▶,
  régua pontilhada e a tag de estilo (VALSA/MARCHA/MAZURCA) à direita. O shell
  tem o nome em texto corrido de 16px, três pílulas de modo, e uma lista de
  número + título. Nada do hero, nada dos CTAs, nada das tags. É a rota onde a
  faixa de cor grande do Django faz o diff explodir — e é a única razão pela
  qual esta divergência é visível no número, já que as divergências das rotas
  esparsas são igualmente grandes e "passam".
- **`hinarios-list` (48,49%)** — os cards de hinário do Django são tiles
  grandes com gradiente por hinário e selo "EST. 2026"; os do shell são caixas
  claras com título. Mesma lista, mesmo conteúdo, tiles completamente
  diferentes. Equilíbrio 31% (o shell também tem tinta aqui, o que é por que
  esta rota "reprova" em vez de "passar suspeita").
- **`home` (11,10%)** — mesmo copy palavra por palavra ("Hinários para ouvir,
  estudar e cantar com firmeza"), com três diferenças: o Django quebra o título
  em 3 linhas em Cormorant sobre uma faixa bege com um sol desfocado à direita;
  o shell quebra em 2 linhas em sans-serif sobre fundo chapado. O Django oferece
  um campo de busca grande como CTA, o shell oferece dois botões. Os stats (10
  hinários / 328 hinos / 275 áudios / 1 revisor) aparecem nos dois, com rótulo
  acima do número no shell e abaixo no Django.
- **`notifications` (8,35%)** — o Django pinta cada item como card claro com
  badge de tipo (FAVORITO / ÁUDIO APROVADO / NOVO SEGUIDOR); o shell usa
  faixa de borda esquerda sem preenchimento. **Atenção:** ~4 pontos
  percentuais deste número são a assimetria de máscara descrita acima, não
  design. É a única rota onde o shell tem MAIS tinta que o Django (8,44% vs
  4,83%), pelas faixas de máscara.
- **`hymnbook-corrido` (1,95%) e `hymnbook-carrossel` (2,21%) — passes
  suspeitos.** Tinta 40–48% no Django contra ~2% no shell. Além do card com
  borda e da faixa de fundo que só o Django tem, há uma divergência de
  **conteúdo**: o shell **colapsa as linhas em branco entre as quadras** — as 3
  estrofes de 4 linhas viram um bloco corrido de 12 linhas. O Django preserva
  a separação. Isso é diferença de renderização de letra, não de estilo, e é o
  tipo de coisa que a métrica de pixel do viewport não pega.
- **`hymn-detail` (2,42%) — passe suspeito.** Django: número + título em
  Cormorant grande, letra centralizada em bloco `width: max-content`, lista de
  áudios com player custom e waveform SVG. Shell: título menor, letra em bloco
  esquerdo, lista de áudios com um botão ▶ simples.
- **`busca` (1,95%) — passe suspeito.** Os dois listam resultados; o Django
  agrupa em cards com badge "HINO"/"HINÁRIO" e o shell em seções com contador.
  Tinta 6,35% contra 1,30%.
- **`profile` (3,33%), `profile-followers` (2,16%), `profile-following`
  (1,69%) — os únicos "OK" não suspeitos, e ainda assim NÃO são paridade.**
  Em `profile-followers`: Django tem "Seguidores" + subtítulo "Usuários que
  seguem você" + avatar circular colorido por seguidor + "Ver Perfil" +
  "Seguir de Volta" + cards preenchidos; shell tem "Seguidores de e2e-editor" +
  "3 SEGUIDORES" + caixas com borda contendo só o username. Passam porque a
  página é 90% fundo e as caixas ficam nas mesmas coordenadas.

### Diferenças que o 4.I previa e que NÃO explicam nada disso

As três tolerâncias documentadas — anti-alias entre Tailwind CDN e Tailwind 4,
sub-pixel de fonte self-hosted vs Google Fonts, e timestamps relativos — são
reais e estão cobertas (`includeAA`, `pixelThreshold`, máscaras). Elas valem
frações de 1%: na auto-comparação o chão de ruído é 0,00%, e antes de esconder
o debug toolbar era 0,02–0,05% nas rotas públicas. **Nenhum dos números da
tabela é explicado por elas.**

---

## Recomendação (para quem decidir o rumo do 4.I)

O critério ">=95% das rotas com diff de pixels <=5%" não serve pra este
projeto, em duas direções ao mesmo tempo:

1. **Reprova o que não deveria:** uma faixa de cor de fundo deslocada em 40px
   custa 50% dos pixels e zero de experiência.
2. **Aprova o que não deveria:** duas telas com cabeçalho, tipografia, cards e
   ações diferentes passam com 2% porque a página é fundo.

Três saídas, em ordem de esforço:

- **(a) Assumir que não há paridade visual e mudar a promessa.** O shell é um
  port funcional. Trocar o critério de aceite por paridade de CONTEÚDO e de
  COMPORTAMENTO — que é o que as outras specs já medem — e manter esta suíte
  como observatório da distância, sem gate.
- **(b) Manter a promessa e fazer o passe de design.** Concretamente: portar
  header/rodapé, os três papéis tipográficos (`font-display` Cormorant,
  `font-serif` Source Serif 4, `font-sans` Inter Tight — travados por
  `tests/unit/test_typography_setup.py` do lado Django), as bandas de fundo, o
  hero do hinário e os cards de lista. É trabalho em `web/src/**`.
- **(c) Trocar o instrumento.** Diff por REGIÃO em vez de viewport inteiro
  (header, hero, corpo, rodapé), com threshold por região, mais uma checagem
  estrutural (mesmos elementos, mesma ordem, mesmos rótulos). Pega as duas
  falhas acima. `contentBalance` e `inkRatio` já estão no lugar como primeira
  aproximação disso.

Qualquer das três é decisão humana. Nenhuma foi tomada nesta frente.

---

## Bloqueadores / follow-ups

1. ~~**`visual-parity.spec.ts` não compara Django com SvelteKit.**~~
   **RESOLVIDO** (2026-08-26). Era snapshot-file-based e comparava SvelteKit
   consigo mesmo. Auto-verificação: `HINARIA_E2E_SELF_COMPARE=1`.
2. ~~**Auth não automatizada.**~~ **RESOLVIDO.** A suíte usa
   `_helpers/editor-session.ts` (mutation `login` real, editor da fixture) em
   vez do form do django-admin — aquele exige `is_staff`, e dar staff ao editor
   da fixture o faria passar por gates que um editor comum não passa.
3. ~~**`HINARIA_E2E_HYMN_PK` default inválido.**~~ **RESOLVIDO** — pk
   descoberto na hora no índice do Django.
4. ~~**Baselines PNG na máquina.**~~ **SEM SENTIDO** — não existe baseline.
5. ~~**`POST /graphql/` responde 403 pro SSR.**~~ **RESOLVIDO** por outra
   frente (`apps/api/csrf.py`: `csrf_exempt` na view + exigência reintroduzida
   só para operações que mudam estado). Verificado nesta frente: todas as 11
   rotas do shell renderizam conteúdo real.
6. ~~**A suíte depende do banco de dev.**~~ **RESOLVIDO** — fixture
   `e2e-paridade` no `seed_e2e`.
7. **`VITE_GRAPHQL_URL` não tem default coerente com o dev.** `src/lib/config.ts`
   cai em `http://localhost:8000/graphql/` e avisa alto no boot; o
   `dev-fullstack.sh` exporta a env certa. Continua enganoso pra quem sobe as
   coisas à mão (`src/**` fora do escopo).
8. **Máscara de timestamp é assimétrica e infla o diff.** Quantificado acima
   (~4 pp em `notifications`). O conserto é um hook estável nos dois lados
   (`data-parity-volatile`); exige `templates/**` e `web/src/**`.
9. **URL de mídia relativa quebra o áudio fora do domínio do Django.**
   `HymnAudioType.url` devolve `FileField.url` (`/media/…`, relativo). O
   `<audio src>` do shell resolve contra a origem do SHELL: medido, 404 em
   `:5173` e 200 em `:9000`. Em produção é pior — o shell é servido por outro
   domínio (`adapter-cloudflare`) e a mídia vive em `media.hinaria.com.br`. A
   spec de player contorna com `page.route`, o que resolve o TESTE e não o
   produto. Conserto em `apps/api/types.py` (devolver URL absoluta) ou em
   `web/src/**` (prefixar com a origem da API).
10. **`PlayButton` não recupera o player depois do dismiss.** Ver abaixo.
11. **O banco é compartilhado entre worktrees.** Ver "Como reproduzir".
12. **CI não roda a suíte de paridade.** Por decisão, não por bloqueio técnico:
    o veredito é negativo (ver VEREDITO). O job "Web E2E (Playwright)" já
    orquestra Postgres + Redis + `seed_e2e` + os dois servidores, então ligar a
    suíte é acrescentar uma linha em `pnpm test:e2e:ci` — quando fizer sentido.

---

## `player-persists.spec.ts` — o teste-âncora do 4.F, verificado

**Resultado: o comportamento PASSA.** O áudio segue tocando ao navegar
`/hinos/<uuid>/` → `/hinarios/` por client-side routing; o `<audio>` é o mesmo
elemento e `currentTime` continua progredindo. Este é critério de aceite do
Marco 4 e nunca havia sido verificado.

**Por que nunca havia rodado — e não era o que se pensava.** A hipótese
registrada era "depende de dados do banco de dev". Na verdade a spec era um
esqueleto sob `test.skip`, jamais executado, apontando pra coisas que não
existem em nenhum dos dois apps:

- a rota `/hinos/justiceiro/1` — o detalhe de hino é `/hinos/<uuid>/` nos DOIS
  lados (`apps/hymns/urls.py` usa `<uuid:pk>`; o shell tem
  `src/routes/hinos/[pk]`). Nunca houve rota `slug/numero`;
- o testid `hymn-play-button` — o botão real é `data-testid="play-button"`.

Três coisas foram necessárias pra ela rodar de verdade:

1. **Áudio decodificável.** `currentTime` só avança com som real. O resto da
   fixture grava bytes falsos de propósito (a fila de pendentes usa
   `preload="none"`); pro hino nº 1 de `e2e-paridade` o seed grava uma senoide
   WAV de 3 s, gerada no próprio comando (nada de binário versionado, nada de
   ffmpeg).
2. **Mídia acessível do shell** — ver bloqueador 9. A spec redireciona as
   requisições de mídia pro Django com `page.route`.
3. **Esperar a hidratação.** `page.goto` com o default (`load`) volta antes do
   Svelte anexar os handlers e o click no botão vira no-op; a barra
   simplesmente não aparecia e o teste falhava como se o produto estivesse
   quebrado.

A prova de identidade do elemento ficou mais forte que a original: em vez de
"o seletor ainda casa" (que casaria num elemento novo também), a spec crava uma
propriedade no `<audio>` antes de navegar e confere que ela sobreviveu.

Verificado também, e também nunca antes: **o dismiss esconde a barra sem
desmontar o `<audio>`** (o ponto de projeto do 4F.10 — não resetar o buffer).

### ACHADO: o player fica inalcançável depois do dismiss

Depois de `dismiss()`, clicar no `PlayButton` da MESMA faixa **não** traz a
barra de volta — e não há outro caminho na UI, porque a barra (dona dos
controles) está escondida. A faixa fica inalcançável até o usuário tocar OUTRO
áudio ou recarregar a página.

Causa, lida no código: `PlayButton.handleClick` chama `audioPlayer.play()` só
quando a faixa NÃO é a ativa; sendo a ativa, chama `togglePlay()`. `play()`
limpa `isDismissed` (`web/src/lib/stores/audio.ts`), `togglePlay()` não — ele
só inverte `isPlaying`. O comentário do próprio `AudioPlayer.svelte` declara a
intenção ("isDismissed=true → some completamente; recriado quando play() é
chamado"), então é o `PlayButton` que curto-circuita a intenção.

Conserto de uma linha, em `web/src/**` (fora do escopo desta frente): ou
`handleClick` chama `play(track)` quando `isDismissed`, ou `togglePlay()` limpa
`isDismissed` ao voltar a tocar. Está travado como `test.fixme` em
`player-persists.spec.ts` — pendência declarada no código, que o guard do job
de CI aceita, em vez de um teste vermelho sem dono.

### Seleção do CI

`player-persists.spec.ts` **entrou** em `pnpm test:e2e:ci` (a lista mora em
`web/package.json`, de propósito, pra crescer sem abrir o YAML). Ficou
determinística: aponta pra fixture, resolve o pk na hora, espera hidratação e
não depende de nada do banco de dev. Medido com a seleção completa do CI, banco
recém-semeado: **99 passaram, 1 skipped** (o `fixme`).

`visual-parity.spec.ts` ficou **fora**, pelo motivo do VEREDITO. O porquê está
também no cabeçalho da própria spec e no `dev-fullstack.sh`.

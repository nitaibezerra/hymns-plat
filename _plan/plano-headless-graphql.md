# Plan: Refatoração Headless — GraphQL API + SPA Web (SvelteKit PWA offline)

## Contexto

O `hymns-plat` hoje é um monolito Django 5 + Wagtail server-rendered (~6.3k LOC de templates + Tailwind CDN + JS custom para player/carrossel). Existem endpoints JSON pontuais em `apps/hymns/api_views.py` (stats, history, editor resume), mas não há contrato de API formal nem cliente JS estruturado. As regras de negócio estão bem desenhadas (`apps/hymns/permissions.py`, `signals.py`, services de OCR/audio).

A motivação da refatoração não é "modernizar por modernizar": é **destravar features que o stack atual não comporta sem virar gambiarra**:

1. **Offline-first** — ler hinário e ouvir áudios sem conexão (caso de uso real em retiros / locais com sinal ruim). Requer Service Worker + IndexedDB + Cache API, o que só faz sentido com cliente SPA.
2. **Player global persistente** — áudio que não para ao navegar entre hinos (hoje há truque com `<iframe>` / sticky reload).
3. **Mobile nativo no futuro** — Expo/RN consumindo o mesmo GraphQL.
4. **UX de revisão otimista** — marcar REVIEWED com rollback se a mutation falhar; transições suaves no carrossel.

Sister project `gestao-feitio` já validou SvelteKit + PWA offline; reaproveitar a curva de aprendizado.

**Backend continua Django** (Wagtail admin permanece, OCR permanece, signals permanecem). **Frontend web** é reescrito do zero em SvelteKit, consumindo GraphQL. Wagtail admin (`/admin/`) e Django admin (`/django-admin/`) seguem renderizados pelo Django no mesmo domínio ou em subdomínio dedicado.

## Disciplina de TDD (regra geral)

**Toda mudança neste plano é test-first.** O ciclo, em cada marco e cada feature dentro do marco, é:

1. **RED** — escrever o(s) teste(s) que descreve(m) o comportamento desejado. Rodar a suíte; o teste novo deve falhar com a mensagem esperada (não com `ImportError` por código ausente). É legítimo criar stubs vazios (ex: função vazia retornando `None`, schema Strawberry com 1 campo dummy) só pra fazer o teste falhar **por motivo de comportamento**, não de sintaxe.
2. **GREEN** — implementar o mínimo necessário pra o teste passar. Sem refatorar.
3. **REFACTOR** — limpar, sem adicionar comportamento novo (ie. sem teste novo). Suíte deve continuar verde.
4. **Commit** — um commit por ciclo (ou por feature pequena). Mensagens em PT-BR, padrão `marco N: <verbo> <feature>`.

**Regras adicionais:**

- **Unit tests primeiro, E2E depois.** Cada marco tem ambos, mas o unit cobre o domínio/schema/resolver isoladamente e o E2E cobre a integração SvelteKit ↔ GraphQL ↔ Django.
- **Cobertura mínima por marco:** todo resolver/mutation/permissão GraphQL precisa de pelo menos um happy-path + um caso de permissão negada + um caso de input inválido. Não medir percentual de cobertura — medir "todo caminho do código tem teste".
- **Nunca pular `--no-verify`** (CLAUDE.md já fixa isso). Hooks de pre-commit (`black --check`, `isort --check-only`, `ruff check`) rodam sempre.
- **Test factories** — usar `factory-boy` (já no projeto). Criar fixtures novas em `tests/factories.py` quando necessário, não fazer setup manual de modelo em cada teste.
- **GraphQL tests** — usar `strawberry.test.BaseGraphQLTestClient` ou Django `Client` + `POST /graphql/`. Helpers em `tests/unit/api/_helpers.py` com `gql_query(client, query, variables=None, user=None)`.
- **Frontend tests** — Vitest pra units (componentes Svelte isolados); Playwright pra E2E (já no projeto pra Django, expandir).
- **Test names** descrevem comportamento, não implementação. `test_anon_user_only_sees_published_hymnbooks` > `test_hymnbooks_query_with_anon`.

**Anti-padrões proibidos:**
- Escrever código sem teste antes "porque é trivial". OCR pipeline já mostrou que "trivial" mente.
- Mockar Postgres/Redis em testes. Usa Postgres real via `pytest-django` (configurado em `pytest.ini`).
- Snapshot tests pra GraphQL responses — eles travam refatoração; assertar campos específicos.
- Pular o teste de permissão por "óbvio que tá protegido".

**Quando TDD NÃO se aplica neste plano:**
- Configuração de infra puramente declarativa (railway.toml, manifest.webmanifest, svelte.config.js). Testa-se via smoke-test manual + E2E no marco correspondente.
- Migrations Django — Django já garante que aplicam; testes vão na lógica que **usa** o campo migrado.

---

## Decisões fixas

- **GraphQL via Strawberry-Django**, não Graphene. Typed Python (PEP 484), async-friendly, decoradores limpos, code-gen no cliente via `graphql-codegen` ou `gql.tada`.
- **Wagtail-grapple opcional, em Marco 5+**. Não bloqueia MVP. StreamFields editoriais (se houver) ficam pra fase posterior.
- **Frontend = SvelteKit** (não Next.js). Razões: continuidade com `gestao-feitio`, menos boilerplate, SSR/CSR híbrido bem feito, bundle menor, melhor pra solo dev.
- **GraphQL client = `houdini`** (graphql client nativo SvelteKit + cache normalizado + persistência) OU `@urql/svelte` + `@urql/exchange-graphcache`. Decisão final no Marco 3 após spike. Default = `houdini`.
- **Auth web = session cookie do Django** (HttpOnly, SameSite=Lax). SPA e Django no mesmo eTLD+1 (`hinaria.com.br` + `api.hinaria.com.br`). CSRF token via header `X-CSRFToken` em mutations. **Sem JWT no MVP web** — JWT entra só quando o app mobile for desenvolvido.
- **Schema-first do lado do cliente, code-first do lado do servidor.** Strawberry gera o SDL automaticamente; cliente roda codegen contra o SDL exportado.
- **Offline storage = Dexie** (IndexedDB wrapper) pra dados + **Workbox** (precaching + runtime caching) pra áudios/imagens. Background Sync API pra mutations enfileiradas.
- **Permissões reusadas, não reescritas.** Resolvers chamam `can_edit_hymnbook`, `can_review_any_hymnbook` etc. diretamente. Zero duplicação de regra.
- **Domínios:**
  - `hinaria.com.br` → SvelteKit (Vercel ou Cloudflare Pages)
  - `api.hinaria.com.br` → Django + GraphQL (Railway, igual hoje)
  - `admin.hinaria.com.br` (opcional, decisão Marco 6) → Wagtail/Django admin via mesmo serviço Railway
  - `media.hinaria.com.br` → R2 (já existe)
- **Estratégia de migração = paralela, não big-bang.** Django web atual continua servindo `hinaria.com.br` até o Marco 7. SvelteKit sobe primeiro em `app.hinaria.com.br` (ou `beta.hinaria.com.br`) e só assume o domínio root quando todas as telas tiverem paridade.
- **Templates Django só são deletados no último marco**, após paridade verificada. Risco de regressão de SEO/UX é mitigado por ter os dois rodando lado a lado.
- **Não migrar Wagtail StreamFields agora.** Se houver páginas CMS, ficam server-rendered no Django até decisão explícita.
- **CI mantém os 3 jobs atuais** (Lint, Unit, E2E) e ganha 2 novos (Lint+Build SvelteKit, E2E Playwright SvelteKit).

## Marcos

### Marco 1 — Spike de schema GraphQL (read-only, sem auth, sem mutation)

**Objetivo:** validar Strawberry-Django no projeto, sem se comprometer com o resto.

**Ciclos TDD (ordem de execução):**

| Ciclo | RED (teste novo) | GREEN (mínimo pra passar) |
|---|---|---|
| 1.1 | `test_graphql_endpoint_returns_200_on_introspection` em `tests/unit/api/test_endpoint.py` | Criar app `apps.api` + URL `/graphql/` + schema Strawberry vazio (`Query` com 1 campo dummy `hello: str`) |
| 1.2 | `test_introspection_lists_hymnbook_type` | Adicionar `HymnBookType` (só `id`, `name`, `slug`) ao schema |
| 1.3 | `test_introspection_lists_hymn_and_hymnaudio_types` | Adicionar `HymnType` e `HymnAudioType` (campos mínimos) |
| 1.4 | `test_hymnbooks_query_returns_only_published_for_anon` | Resolver `hymnbooks` usando `HymnBook.objects.visible_to(user)` |
| 1.5 | `test_hymnbooks_query_returns_drafts_for_editor` | Verificar que o resolver passa o user do request corretamente |
| 1.6 | `test_hymnbook_by_slug_returns_404_for_unpublished_to_anon` | Resolver `hymnbook(slug)` com gate de publicação |
| 1.7 | `test_hymn_by_pk_returns_hymn` | Resolver `hymn(pk)` |
| 1.8 | `test_global_stats_returns_counts_matching_api_views` | Resolver `globalStats` — assertar paridade exata com `api_global_stats` em `apps/hymns/api_views.py` |
| 1.9 | `test_export_schema_command_writes_sdl_file` | Management command `export_schema` (ou usar o nativo do strawberry) |

**Arquivos a criar (na ordem dos ciclos):**
- `tests/unit/api/__init__.py`, `tests/unit/api/_helpers.py` (helper `gql(client, query, variables=None, user=None)`).
- `tests/unit/api/test_endpoint.py` — ciclos 1.1-1.3.
- `tests/unit/api/test_query_hymnbooks.py` — ciclos 1.4-1.6.
- `tests/unit/api/test_query_hymn.py` — ciclo 1.7.
- `tests/unit/api/test_query_global_stats.py` — ciclo 1.8.
- `tests/unit/api/test_schema_export.py` — ciclo 1.9.
- `apps/api/__init__.py`, `apps/api/apps.py`, `apps/api/schema.py`, `apps/api/types.py`, `apps/api/urls.py`.

**Arquivos a editar:**
- `pyproject.toml` — adicionar `strawberry-graphql-django>=0.50,<1.0`, `strawberry-graphql[django]>=0.250,<1.0`.
- `config/settings/base.py` — `INSTALLED_APPS += ["strawberry_django", "apps.api"]`.
- `config/urls.py` — incluir `apps.api.urls` sob prefix `/graphql/`.

**Critério de aceitação:**
- Todos os 9 ciclos verdes (`uv run pytest tests/unit/api/ -v`).
- Suite atual continua verde (`DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest tests/unit/ -q`).
- `curl -X POST localhost:8000/graphql/ -d '{"query":"{ globalStats { hymnbooks hymns } }"}'` retorna JSON correto.
- Schema SDL exportável: `uv run python manage.py export_schema apps.api.schema:schema > schema.graphql`.
- Lint passa: `uv run black . && uv run isort . && uv run ruff check .`.

### Marco 2 — Mutations + Auth bridge (login, CSRF, sessões)

**Objetivo:** expor mutations protegidas com a mesma session do Django, sem ainda ter cliente JS oficial.

**Ciclos TDD (ordem de execução):**

| Ciclo | RED (teste novo) | GREEN (mínimo pra passar) |
|---|---|---|
| 2.1 | `test_graphql_post_requires_csrf_token` + `test_graphql_post_succeeds_with_csrf` em `tests/unit/api/test_csrf.py` | Habilitar CSRF no `GraphQLView` (remover `@csrf_exempt` se houver; ou usar wrapper) |
| 2.2 | `test_login_mutation_authenticates_valid_credentials`, `test_login_mutation_returns_error_for_invalid_credentials` | Mutation `login(username, password)` via `django.contrib.auth.authenticate` + `login` |
| 2.3 | `test_current_user_returns_null_for_anon`, `test_current_user_returns_user_for_authenticated`, `test_logout_mutation_clears_session` | Query `currentUser` + mutation `logout` |
| 2.4 | `test_set_review_status_editor_succeeds`, `test_set_review_status_anon_blocked`, `test_set_review_status_creates_revision` | Mutation `setReviewStatus(pk, status)` gateando por `can_review_any_hymnbook` |
| 2.5 | `test_update_hymn_editor_can_change_title`, `test_update_hymn_blocks_non_editor`, `test_update_hymn_validates_input` | Mutation `updateHymn(pk, input)` reusando `HymnForm` |
| 2.6 | `test_toggle_favorite_adds_for_authenticated`, `test_toggle_favorite_removes_existing`, `test_toggle_favorite_blocks_anon` | Mutation `toggleFavorite(hymnPk)` |
| 2.7 | `test_cors_preflight_from_svelte_dev_origin`, `test_cors_blocks_untrusted_origin` | Adicionar `django-cors-headers` + config |

**Arquivos a criar:**
- `apps/api/mutations.py` — todas as mutations.
- `apps/api/permissions.py` — helper `gate(user, check, *args)` que levanta `PermissionDenied` (traduzido pra GraphQL error pelo Strawberry).
- `apps/api/context.py` — context getter (se necessário).
- `tests/unit/api/test_csrf.py`, `test_auth_mutations.py`, `test_mutation_set_review_status.py`, `test_mutation_update_hymn.py`, `test_mutation_toggle_favorite.py`, `test_cors.py`.

**Arquivos a editar:**
- `pyproject.toml` — adicionar `django-cors-headers>=4.0,<5.0`.
- `config/settings/base.py` — `CORS_ALLOWED_ORIGINS` em dev, middleware `corsheaders.middleware.CorsMiddleware` antes do `CommonMiddleware`.
- `config/settings/production.py` — `CSRF_COOKIE_DOMAIN`, `SESSION_COOKIE_DOMAIN`, `CSRF_TRUSTED_ORIGINS` (deferred até Marco 7 se ainda não houver subdomínio `app`).
- `apps/api/schema.py` — `Schema(query=Query, mutation=Mutation)`.

**Decisão fixada:** o login web continua via formulário allauth renderizado pelo Django; a mutation `login` é adicionada **mesmo assim** porque (a) será usada pelo mobile no Marco 8 e (b) facilita E2E tests da SPA. Custo de manter é baixo.

**Critério de aceitação:**
- Todos os 7 ciclos verdes.
- Suite completa continua verde.
- Lint passa.
- Smoke manual: `curl` com cookie de sessão consegue fazer mutation; sem cookie falha com erro de CSRF/auth.

### Marco 3 — SvelteKit skeleton + autenticação + listagem de hinários

**Objetivo:** primeira tela funcional no novo frontend, com auth de verdade.

**Repositório:** mesmo monorepo, novo diretório `web/` (sibling de `apps/`). `web/package.json` separado, `pnpm` como gerenciador.

**Arquivos a criar (essenciais):**
- `web/package.json`, `web/svelte.config.js`, `web/vite.config.ts`, `web/tsconfig.json`.
- `web/src/lib/graphql/client.ts` — `houdini` config apontando pra `http://localhost:8000/graphql/` em dev, `https://api.hinaria.com.br/graphql/` em prod. `credentials: 'include'` (manda cookies).
- `web/src/lib/graphql/queries/hymnbooks.gql` — query SDL.
- `web/src/routes/+layout.svelte` — header com link de login (renderizado via Django allauth, redirect com `next=`).
- `web/src/routes/+page.svelte` — home: stats globais + lista de hinários publicados.
- `web/src/routes/hinarios/+page.svelte` — lista completa (paginada).
- `web/houdini.config.js` — codegen contra `schema.graphql` exportado.
- `web/playwright.config.ts` — apontando pra `localhost:5173`.
- `web/tests/e2e/home.spec.ts` — abre home, verifica que stats aparecem.
- `Procfile`/`railway.toml` na pasta `web/` SE for deploy independente.

**Decisão pendente nesse marco:**
- **Houdini vs urql** — spike de 2h em cada antes de fixar. Houdini é mais "Svelte-idiomático"; urql é mais portável (mobile depois).
- **Vercel vs Cloudflare Pages** — Pages alinha com Worker/R2 existentes; Vercel tem melhor DX SSR. **Default: Cloudflare Pages.**

**Critério de aceitação:**
- `cd web && pnpm dev` sobe SvelteKit em `:5173`.
- Home `localhost:5173` consome GraphQL local e mostra stats + 3 hinários publicados.
- E2E Playwright passa.

### Marco 4 — Paridade read-only com a web atual

**Objetivo:** todas as rotas de leitura existentes funcionando no SvelteKit.

**Rotas a portar (read-only):**
- `/` (home)
- `/hinarios/` (lista)
- `/hinarios/<slug>/?mode=indice|corrido|carrossel` (detalhe + 3 modos)
- `/hinarios/<slug>/<numero>/` (hino individual)
- `/buscar/?q=...`
- `/usuarios/<username>/`, `/usuarios/<username>/seguindo/`, `/usuarios/<username>/seguidores/`
- `/notificacoes/`

**Componentes-chave a criar:**
- `web/src/lib/components/AudioPlayer.svelte` — player global persistente em `+layout.svelte`. Recebe `waveform_peaks` via prop, renderiza SVG (porta `static/js/audio-player.js`).
- `web/src/lib/components/HymnCarousel.svelte` — Reader Focus (porta `static/js/hymn-carousel.js`); keyboard nav, dot pagination, `prefers-reduced-motion`.
- `web/src/lib/components/HymnBody.svelte` — bloco `width: max-content` centralizado.
- `web/src/lib/styles/design-tokens.css` — copiar tokens de `static/css/design-tokens.css`.
- `web/src/app.css` — Tailwind 4 (não CDN; build de verdade), com 3 famílias tipográficas (Cormorant Garamond, Source Serif 4, Inter Tight).

**Schema GraphQL — extensões necessárias:**
- `HymnBookType.hymns(filter, order)` retornando connection.
- `HymnType.audios(approvedOnly=True)`.
- `Query.search(q, type=ALL|HYMN|HYMNBOOK)` — porta lógica de `apps/hymns/views.py::search`.
- `Query.userProfile(username)` com `followers`, `following`, `uploads`.

**Critério de aceitação:**
- Visual diff (Playwright screenshots) entre Django atual e SvelteKit MVP mostra paridade ≥ 95% das telas read-only.
- Pin de tipografia (`tests/unit/test_typography_setup.py`) tem equivalente no `web/tests/unit/typography.spec.ts`.

### Marco 5 — CRUD editorial + permissões

**Objetivo:** workspace `/editor/` reescrito no SvelteKit.

**Rotas a portar:**
- `/editor/` (dashboard editor)
- `/editor/hinarios/` (lista pra revisar)
- `/editor/hinarios/<slug>/` (detalhe editorial)
- `/editor/hinos/<pk>/revisar/` (formulário de revisão — a rota mais complexa, 310 LOC de template hoje)
- `/editor/audios/pendentes/` (aprovação de áudios)
- `/editor/quick-review/` (fluxo ágil)
- Modais: histórico de revisões, drawer de áudio, formulários inline.

**Mutations a expor:**
- `createHymnBook`, `updateHymnBook`, `publishHymnBook`, `deleteHymnBook`
- `createHymn`, `updateHymn`, `deleteHymn`, `setReviewStatus`
- `uploadAudio` (multipart via `strawberry.file_uploads.Upload`), `approveAudio`, `deleteAudio`
- `followUser`, `unfollowUser`, `markNotificationRead`

**Decisões:**
- **OCR upload pipeline:** mantém endpoint REST atual (`apps/hymns/views.py::upload_pdf_ocr`). GraphQL não é bom pra streaming/multipart pesado. Frontend chama o REST e depois faz polling/subscription GraphQL pra status.
- **Otimistic UI:** habilitar via houdini optimistic responses pra `setReviewStatus`, `toggleFavorite`, `approveAudio`.

**Critério de aceitação:**
- Editor consegue criar hinário, adicionar hino, revisar, publicar, fazer upload de áudio — **tudo pelo SvelteKit**.
- Signals de auditoria (`HymnRevision`) continuam disparando.
- Permissões testadas: editor consegue, usuário comum recebe 403, anônimo recebe 401.

### Marco 6 — Offline-first (a feature-âncora)

**Objetivo:** PWA instalável com hinário + áudios disponíveis offline.

**Arquivos a criar:**
- `web/src/service-worker.ts` — Workbox: precache shell SvelteKit; runtime cache para áudios (CacheFirst, 30 dias, max 500 MB).
- `web/src/lib/offline/db.ts` — Dexie schema:
  - `hymnbooks` (slug indexado, JSON do hinário)
  - `hymns` (pk indexado, fk hymnbook)
  - `audios` (pk indexado, blob URL, downloaded_at)
  - `mutationQueue` (pendingMutation, retries)
- `web/src/lib/offline/sync.ts` — Background Sync: enfileira mutations quando offline, replays quando volta.
- `web/src/lib/components/DownloadHymnbookButton.svelte` — botão "Baixar pra offline" no detalhe do hinário; pré-cacheia áudios + grava JSON no Dexie.
- `web/static/manifest.webmanifest` — PWA manifest (ícones, theme color, display=standalone).
- `web/src/routes/+layout.ts` — `export const ssr = true; export const csr = true;` com fallback offline.

**Schema GraphQL — extensão:**
- `HymnBookType.syncVersion: Int` — incrementa quando qualquer hino/áudio do hinário muda (signal `post_save`).
- `Query.hymnbook(slug, sinceVersion: Int)` — retorna só delta (otimização pra mobile/offline; opcional MVP).

**Migration backend:**
- `apps.hymns` — adiciona `HymnBook.sync_version` (IntegerField, default=0). Signal `post_save` em Hymn/HymnAudio incrementa `sync_version` do hinário pai.

**Critério de aceitação:**
- Lighthouse PWA score ≥ 90.
- Em DevTools "Offline", consigo abrir hinário previamente baixado e tocar áudio.
- Mutation feita offline (ex: favoritar) entra na fila e sincroniza quando volta online.
- E2E Playwright cobre cenário offline (via `context.setOffline(true)`).

### Marco 7 — Cutover de produção

**Objetivo:** `hinaria.com.br` passa a apontar pro SvelteKit. Templates Django arquivados.

**Passos:**
1. Smoke-test final em `app.hinaria.com.br` (rodando há 2+ semanas pro Marco 6).
2. Mudar Worker `hinaria-proxy` no Cloudflare:
   - Rotas `hinaria.com.br/admin/*` e `/django-admin/*` e `/graphql/*` → Railway.
   - Restante → Cloudflare Pages (SvelteKit).
3. **Manter Django capaz de servir templates** por 30 dias (rollback possível via Worker).
4. Após 30 dias: deletar `templates/hymns/*`, `templates/users/*` (exceto allauth), `static/js/audio-player.js`, `static/js/hymn-carousel.js`, e os testes pinned a templates (`tests/unit/test_typography_setup.py`, `tests/e2e/test_carousel.py` etc.).
5. Remover `apps.hymns.views` e `apps.hymns.editor_views` (mantendo só `api_views.py` legacy se ainda houver consumidores externos).
6. Atualizar CLAUDE.md (raiz + sister project copa-dos-reis se aplicável).

**Critério de aceitação:**
- `hinaria.com.br` serve SvelteKit.
- `api.hinaria.com.br/graphql/` responde.
- Wagtail admin acessível em `hinaria.com.br/admin/` ou `admin.hinaria.com.br/admin/`.
- Backup do branch `pre-headless` taggeado no Git pra rollback bruto se necessário.

### Marco 8 (opcional, fora do escopo MVP) — Cliente mobile

**Objetivo:** Expo app reaproveitando o mesmo GraphQL.

Não detalhado neste plano. Cobrirá:
- Auth JWT (não session — RN não tem cookies de domínio).
- Mutation `loginWithPassword` retorna `accessToken + refreshToken`.
- Push notifications via Expo Push + signals Django.
- Code-share via monorepo (`/packages/graphql-types` com tipos gerados consumidos por `web/` e `mobile/`).

## Riscos & mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Reescrita estourar prazo (3-4 meses) | Alta | Alto | Marcos independentes; Django atual permanece em prod até Marco 7 |
| Perda de SEO no cutover | Média | Alto | SvelteKit SSR + sitemap gerado; teste com Search Console preview por 2 semanas antes do cutover |
| Bug em mutation GraphQL corromper dados | Baixa | Alto | Reusar ModelForms existentes; signals de auditoria (`HymnRevision`) detectam |
| Service Worker travar usuário em versão antiga | Média | Médio | `skipWaiting` + `clientsClaim` + banner "atualização disponível" no SvelteKit |
| Cache offline ocupar muito disco no mobile | Média | Médio | LRU eviction no Workbox (max 500 MB), botão "limpar downloads" explícito |
| Auth cross-domain (api.hinaria vs hinaria) | Alta | Médio | Cookie `Domain=.hinaria.com.br`; testes CSRF cobrindo o fluxo |
| Duplicação de regra de permissão | Média | Médio | Resolvers GraphQL **chamam** os helpers existentes (`can_edit_hymnbook` etc.); zero reimplementação |
| OCR / waveform pipelines quebrarem | Baixa | Alto | Não tocar nesses módulos no MVP; só expor leitura via GraphQL |
| Solo maintainer não conseguir manter 2 stacks | Real | Alto | Marco 7 deleta templates Django; pós-cutover é 1 stack (Django API-only + SvelteKit) |

## Estimativa de esforço (solo dev, tempo parcial)

| Marco | Estimativa |
|---|---|
| 1. Spike GraphQL read-only | 1 semana |
| 2. Mutations + Auth | 1 semana |
| 3. SvelteKit skeleton | 1 semana |
| 4. Paridade read-only | 4-5 semanas |
| 5. CRUD editorial | 3-4 semanas |
| 6. Offline-first PWA | 2-3 semanas |
| 7. Cutover | 1 semana |
| **Total** | **13-17 semanas (~3-4 meses)** |

## Não-objetivos (explícitos)

- Mobile nativo: fica pra Marco 8 (pós-cutover).
- Wagtail StreamField via GraphQL: só se aparecer necessidade.
- Migrar OCR pipeline pra Celery: ortogonal; quando virar problema, vira plano próprio.
- Trocar Postgres / Railway / R2: stack de infra é mantida.
- Substituir Wagtail admin por interface custom no SvelteKit: o admin editorial fica no Wagtail (é o que ele faz bem).
- Real-time subscriptions GraphQL: fora do MVP; entra quando "notificação ao vivo" virar pedido explícito.

## Próximo passo

Após go-ahead, executar **Marco 1** (spike GraphQL read-only) numa branch `feat/api-graphql-spike`. Tempo estimado: 1 semana. Se Strawberry-Django se mostrar incompatível com alguma peça do domínio (ex: Wagtail Page polymorphism), revisar plano antes de seguir pro Marco 2.

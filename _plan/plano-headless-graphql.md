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

**Decisão de client GraphQL (fixada):** **@urql/svelte** em vez de Houdini. Razões: (a) mock de fetch é mais previsível em vitest do que mock dos stores Houdini — facilita TDD; (b) o mesmo client roda em React Native pro Marco 8 (Houdini é Svelte-only); (c) codegen via `graphql-codegen` é desacoplado do dev loop. Trade-off aceito: menos açúcar "Svelte-idiomático" no consumo de queries.

**Ciclos TDD (ordem de execução):**

| Ciclo | RED (teste) | GREEN (mínimo pra passar) |
|---|---|---|
| 3.1 | `tests/build.spec.ts` — `pnpm build` produz `.svelte-kit/output/` válido | Scaffold pnpm + SvelteKit + Vite + adapter-static (ou adapter-node) |
| 3.2 | `src/lib/graphql/client.test.ts` — cliente configurado com URL correta + `credentials: include` | `src/lib/graphql/client.ts` com `createClient` do urql |
| 3.3 | `tests/codegen.spec.ts` — `pnpm codegen` lê `../schema.graphql` e gera `src/lib/graphql/generated.ts` com tipos | `graphql-codegen.yml` + script no package.json |
| 3.4 | `src/routes/+page.test.ts` — home renderiza `globalStats` (com client mockado) | `+page.ts` load fetch via urql + `+page.svelte` que renderiza |
| 3.5 | `src/routes/hinarios/+page.test.ts` — lista hinários do mock | Página `/hinarios/` com query `hymnbooks` |
| 3.6 | `tests/login.spec.ts` (Playwright) — submit do form chama mutation e seta sessão | Form de login chamando `login` mutation; redirect pós-login |

**Arquivos a criar (essenciais):**
- `web/package.json`, `web/svelte.config.js`, `web/vite.config.ts`, `web/tsconfig.json`.
- `web/src/lib/graphql/client.ts` — `createClient({ url, fetchOptions: { credentials: 'include' } })`.
- `web/src/lib/graphql/queries.ts` — queries SDL como const strings (gera tipos via codegen).
- `web/src/routes/+layout.svelte` — header + link de login.
- `web/src/routes/+page.svelte` + `+page.ts` — home: stats globais + 3 hinários publicados.
- `web/src/routes/hinarios/+page.svelte` + `+page.ts` — lista completa.
- `web/src/routes/login/+page.svelte` — form de login.
- `web/graphql.config.yml` ou `web/codegen.config.ts` — config do `graphql-codegen`.
- `web/playwright.config.ts` — apontando pra `localhost:5173`.
- `web/tests/e2e/home.spec.ts` — Playwright básico.
- `web/vitest.config.ts` + `web/src/setup-test.ts`.
- Raiz: `pnpm-workspace.yaml` (opcional) + `Makefile` ou script unificado pra rodar Django + SvelteKit em paralelo.

**Decisões fixadas:**
- **Hosting:** Cloudflare Pages (mesmo ecossistema do Worker + R2). Adapter `@sveltejs/adapter-cloudflare`.
- **Estratégia SSR/CSR:** SSR-first pro SEO (hinos são conteúdo público indexável). Modo `prerender` para páginas estáticas; CSR pra editor.
- **CI:** workflow `ci-web.yml` adiciona dois jobs (Vitest + Playwright); o workflow Django atual não muda.

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

**Objetivo:** todas as rotas de leitura do monolito Django reescritas em SvelteKit com paridade visual ≥95%, consumindo só GraphQL.

**Mapa do que precisa portar (referência ao código atual em `/Users/nitai/dev/hyms-platform/hymns-plat/`):**

| Rota Django | View | Template | JS associado |
|---|---|---|---|
| `/` | `views.home_view` (linha 315) | `templates/hymns/home.html` (72 LOC) | — |
| `/hinarios/` | `views.HymnBookListView` (74) | `templates/hymns/hymnbook_list.html` (40 LOC) | — |
| `/hinarios/<slug>/?mode=indice|corrido|carrossel` | `views.HymnBookDetailView` (86) | `hymnbook_detail.html` (129 LOC) | `static/js/hymn-carousel.js` (159 LOC) |
| `/hinarios/<slug>/ler/` | `views.HymnBookReadView` (126) | `hymnbook_read.html` (83 LOC) | `hymn-read-sync.js` (87 LOC) |
| `/hinos/<uuid:pk>/` | `views.HymnDetailView` (164) | `hymn_detail.html` (147 LOC) | — |
| `/busca/?q=...` | `views.search_view` (203) | `search.html` (84 LOC) | — |
| `/perfil/<username>/` | `users.views.profile_view` | `users/profile.html` (144 LOC) | — |
| `/perfil/<username>/seguidores/` | `users.views_social.followers_list` | `users/followers_list.html` (116 LOC) | `social.js` (parcial, 274 LOC) |
| `/perfil/<username>/seguindo/` | `users.views_social.following_list` | `users/following_list.html` (113 LOC) | `social.js` (parcial) |
| `/notificacoes/` | `users.views_social.notifications_list` | `users/notifications.html` (99 LOC) | — |
| Player global persistente | `templates/hymns/_player_global.html` (143 LOC) + `_audio_player.html` (66 LOC) | — | `static/js/audio-player.js` (155) + `static/js/player.js` (513 LOC) |

**Helpers Python de leitura que precisam virar resolvers/campos GraphQL:**
- `_annotate_card_counts(queryset)` — conta hinos/áudios por hinário (já reusável; só precisa entrar como `HymnBookType.stats`).
- `_hourly_featured(visible_qs, n=6)` — seleção determinística por hora (já existe; vira resolver `Query.hourlyFeatured`).
- `search_view`: usa `UnaccentFunc` + `Func("trigram_similar")` no Postgres — não migrar pra Python, expor via resolver que **chama** o queryset (a lógica continua no DB).
- `HymnDetailView.get_context_data`: monta "anterior/próximo no hinário" e "outros hinários com mesmo número" — virar resolvers `HymnType.previousInBook` / `nextInBook` / `siblingsWithSameNumber`.

**Estratégia de fatiamento — Marco 4 vira 9 sub-marcos** (4-5 semanas é grande demais pra um único ciclo). Cada sub-marco é uma PR fechada com base no anterior:

#### Sub-marco 4.A — Extensões de schema GraphQL (read-only) — ~1 semana, branch `feat/headless-marco4a-schema`

**Ciclos TDD (em `apps/api/`):**

| Ciclo | RED | GREEN |
|---|---|---|
| 4A.1 | `test_hymnbook_type_exposes_stats_field` (paridade com `_annotate_card_counts`) | `HymnBookType.stats: HymnBookStatsType` (`hymnsTotal`, `hymnsReviewed`, `audiosApproved`) |
| 4A.2 | `test_hymnbook_hymns_field_returns_ordered_by_number` | `HymnBookType.hymns: list[HymnType]` com ordering default |
| 4A.3 | `test_hymn_audios_filters_approved_for_anon`, `test_hymn_audios_returns_pending_for_owner_or_editor` | `HymnType.audios(approvedOnly: bool = True): list[HymnAudioType]` gateando por user |
| 4A.4 | `test_hymn_audio_exposes_waveform_peaks_and_url` | `HymnAudioType.waveformPeaks: list[int]`, `url: str`, `durationSeconds: float`, `uploadedBy: UserType` |
| 4A.5 | `test_hymn_previous_and_next_in_book_returns_neighbors` | `HymnType.previousInBook: HymnType | None`, `nextInBook: HymnType | None` |
| 4A.6 | `test_hymn_siblings_with_same_number_returns_other_books` | `HymnType.siblingsWithSameNumber: list[HymnType]` (respeitando `visible_to(user)`) |
| 4A.7 | `test_search_query_returns_hymns_matching_title_trigram`, `test_search_filters_by_visibility` | `Query.search(q: str, kind: SearchKind = ALL): SearchResultsType` reusando o queryset de `search_view` |
| 4A.8 | `test_hourly_featured_returns_six_visible_hymnbooks` | `Query.hourlyFeatured: list[HymnBookType]` |
| 4A.9 | `test_user_profile_returns_user_with_counts_and_uploads` | `Query.userProfile(username): UserProfileType` com `followersCount`, `followingCount`, `uploadedAudios` |
| 4A.10 | `test_user_followers_and_following_lists`, `test_followers_paginated` | `UserProfileType.followers(first: Int, after: String)` / `following(...)` connections |
| 4A.11 | `test_notifications_returns_for_current_user_only`, `test_notifications_unread_filter` | `Query.notifications(unreadOnly: bool = False): list[NotificationType]` |
| 4A.12 | `test_user_heatmap_returns_daily_counts` (paridade com `api_user_heatmap`) | `UserProfileType.activityHeatmap(days: Int = 365): list[HeatmapBucketType]` |
| 4A.13 | `test_schema_graphql_snapshot_is_up_to_date` | Atualizar `schema.graphql` committado |

**Arquivos a criar/editar:**
- Estender `apps/api/types.py` com `HymnBookStatsType`, `SearchResultsType`, `SearchKind` enum, `UserProfileType`, `NotificationType`, `HeatmapBucketType`.
- Estender `apps/api/schema.py` (`Query` ganha 6 campos novos).
- `tests/unit/api/test_query_search.py`, `test_query_user_profile.py`, `test_query_notifications.py`, `test_hymn_neighbors.py`, `test_hymn_audio_visibility.py`.
- Atualizar `schema.graphql` no root.

**Critério de aceitação 4.A:** todos os 13 ciclos verdes; SDL committada bate com `export_schema`; lint passa.

---

#### Sub-marco 4.B — Layout shell + design tokens + tipografia — ~3-4 dias, branch `feat/headless-marco4b-shell`

**Ciclos TDD (em `web/`):**

| Ciclo | RED | GREEN |
|---|---|---|
| 4B.1 | `tests/unit/typography.spec.ts` — 3 famílias tipográficas estão configuradas no Tailwind (font-display, font-serif, font-sans) | Tailwind 4 + `tailwind.config.ts` com Cormorant Garamond / Source Serif 4 / Inter Tight |
| 4B.2 | `tests/unit/typography.spec.ts` — fontes auto-hospedadas (não Google Fonts CDN) carregam via @fontsource | Instalar `@fontsource/cormorant-garamond`, `@fontsource/source-serif-4`, `@fontsource/inter-tight` |
| 4B.3 | `tests/unit/design-tokens.spec.ts` — variáveis CSS de cor (`--color-bg`, `--color-text`, etc.) presentes no `app.css` | Portar `static/css/design-tokens.css` para `web/src/app.css` |
| 4B.4 | `tests/unit/components/Header.test.ts` — header renderiza nav links, brand "hinária", botão de tema | `web/src/lib/components/Header.svelte` |
| 4B.5 | `tests/unit/components/Header.test.ts` — botão de tema alterna data-theme="dark" no `<html>` | `web/src/lib/components/ThemeToggle.svelte` + `useTheme` store persistido em `localStorage` |
| 4B.6 | `tests/unit/components/Header.test.ts` — quando `currentUser` está autenticado, exibe avatar e link pro perfil; senão, link de login | Header consome `data.currentUser` do layout load |
| 4B.7 | `tests/unit/+layout.test.ts` — `_loadLayout` busca `currentUser` no GraphQL e propaga pra todas as páginas | `web/src/routes/+layout.ts` + `+layout.svelte` |
| 4B.8 | `tests/unit/components/Footer.test.ts` — footer com créditos e link pra repo | `web/src/lib/components/Footer.svelte` |

**Arquivos a criar:**
- `web/tailwind.config.ts`, `web/postcss.config.js`, `web/src/app.css` (Tailwind 4 imports + tokens + 3 famílias).
- `web/src/lib/components/{Header,Footer,ThemeToggle}.svelte`.
- `web/src/lib/stores/theme.ts`.
- `web/src/routes/+layout.svelte` e `+layout.ts` (substituem placeholders do Marco 3).

**Critério de aceitação 4.B:** vitest 100% verde; `pnpm build` ainda passa; rodando `pnpm dev` o shell aparece em `/` com header e footer corretos.

---

#### Sub-marco 4.C — Home + lista de hinários (paridade visual) — ~3-4 dias, branch `feat/headless-marco4c-home-list`

**Ciclos TDD:**

| Ciclo | RED | GREEN |
|---|---|---|
| 4C.1 | `routes/+page.test.ts` — home carrega `hourlyFeatured` + `globalStats` | Estender `_loadHome` pra incluir `hourlyFeatured` |
| 4C.2 | `routes/+page.test.ts` — renderiza 6 cards de hinário com counts (stats) | `web/src/lib/components/HymnbookCard.svelte` + render no `+page.svelte` |
| 4C.3 | `routes/+page.test.ts` — renderiza bloco hero com slogan + CTA | Hero copiado de `home.html` (sem novo conteúdo) |
| 4C.4 | `routes/hinarios/+page.test.ts` — lista exibe todos os hinários publicados com filtro por busca local | Já parcialmente feito no Marco 3; só adicionar filtro de input |
| 4C.5 | `routes/hinarios/+page.test.ts` — usuário editor vê hinários não publicados com badge "rascunho" | Resolver `hymnbooks` já retorna; adicionar UI condicional |
| 4C.6 | Playwright `tests/e2e/home.spec.ts` — abre `/` com Postgres seedado, conta cards | Smoke E2E (rodando contra Django dev local) |

**Critério de aceitação 4.C:** vitest verde; visual diff vs `hymns-plat` home mostra diferenças cosméticas apenas (≤5%); E2E verde.

---

#### Sub-marco 4.D — Detalhe do hinário (3 modos: índice/corrido/carrossel) — ~1 semana, branch `feat/headless-marco4d-hymnbook-detail`

Modo é dirigido por URL (`?mode=`), como hoje (decisão preservada de CLAUDE.md "Reading modes for a hymnbook are URL-driven, not JS-toggled").

**Ciclos TDD:**

| Ciclo | RED | GREEN |
|---|---|---|
| 4D.1 | `routes/hinarios/[slug]/+page.test.ts` — load carrega hinário com `hymns` populado | Rota dinâmica `[slug]/+page.{ts,svelte}` |
| 4D.2 | mode `indice` renderiza lista numerada com link pra cada hino | Componente `HymnIndex.svelte` |
| 4D.3 | mode `corrido` renderiza todos os hinos em coluna, com `HymnBody` centralizado | Componente `HymnCorrido.svelte` + `HymnBody.svelte` (`width: max-content`, página de cantador) |
| 4D.4 | mode inválido (`?mode=foo`) cai pra `indice` (paridade com whitelist do Django) | Validação no load function |
| 4D.5 | `HymnCarousel.test.ts` — renderiza 1 slide por viewport (one slide visible) | `web/src/lib/components/HymnCarousel.svelte` (porta de `static/js/hymn-carousel.js`) |
| 4D.6 | `HymnCarousel.test.ts` — setas ←/→ no teclado navegam, Esc volta pra `?mode=indice` | Listeners de keyboard + `goto()` |
| 4D.7 | `HymnCarousel.test.ts` — dot pagination atualiza ao trocar slide | Dots como `<button>` + `aria-current` |
| 4D.8 | `HymnCarousel.test.ts` — respeita `prefers-reduced-motion` (sem transição) | Media query check |
| 4D.9 | `HymnCarousel.test.ts` — progress bar no topo reflete posição (slide N de M) | Computed progress |
| 4D.10 | toggle pills entre modos são `<a href="?mode=...">` (não botões JS) — back/forward funciona | Component `ModeTogglePills.svelte` |
| 4D.11 | Playwright `tests/e2e/hymnbook-carousel.spec.ts` — abre carrossel, navega com setas, sai com Esc | E2E |

**Componentes-chave a criar (em `web/src/lib/components/`):**
- `HymnBody.svelte` — bloco `width: max-content` centralizado dentro do wrapper, versos left-aligned (página-de-cantador). Compartilhado por corrido/carrossel/hymn_detail (mesma regra do CLAUDE.md).
- `HymnCarousel.svelte` — Reader Focus completo: chrome fixa (top progress bar + counter + prev/next + dot pagination), keyboard nav, `prefers-reduced-motion`.
- `HymnIndex.svelte`, `HymnCorrido.svelte`, `ModeTogglePills.svelte`.

**Critério de aceitação 4.D:** vitest verde; carrossel idêntico ao do Django em screenshot Playwright (≤5% diff); navegação por teclado funciona; modes deep-linkáveis.

---

#### Sub-marco 4.E — Hino individual + vizinhos + irmãos por número — ~3 dias, branch `feat/headless-marco4e-hymn-detail`

**Ciclos TDD:**

| Ciclo | RED | GREEN |
|---|---|---|
| 4E.1 | `routes/hinos/[pk]/+page.test.ts` — load busca hino com `previousInBook`, `nextInBook`, `siblingsWithSameNumber` | Rota `[pk]/+page.{ts,svelte}` |
| 4E.2 | renderiza letra usando `HymnBody` | Reuso |
| 4E.3 | renderiza navegação "anterior/próximo" no hinário com `<a>` (sem JS) | Links pra `?prev` / `?next` |
| 4E.4 | renderiza "outros hinários com mesmo número" como lista de cards | Componente `SiblingHymnsList.svelte` |
| 4E.5 | renderiza lista de áudios aprovados com player inline | `HymnAudioList.svelte` |
| 4E.6 | quando usuário é o uploader OU editor, vê áudios pendentes com badge | UI condicional |

**Critério de aceitação 4.E:** vitest verde; visual diff ≤5%.

---

#### Sub-marco 4.F — Player global persistente — ~4-5 dias, branch `feat/headless-marco4f-player`

Este é o motor da "feature destravada pelo SPA": o player não pode reiniciar ao navegar (problema central do Django atual).

**Decisões:**
- O player vive como **store global** (`audioPlayer` store em `web/src/lib/stores/audio.ts`) + componente singleton no `+layout.svelte` (fica fora do `{@render children()}`).
- Integração com [Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API) (controles do lock screen / smart watches).
- **Não** porta `static/js/player.js` (513 LOC, lógica espalhada). Reescreve do zero usando o store; usa `static/js/audio-player.js` (155 LOC) como referência só pra rendering da waveform.

**Ciclos TDD:**

| Ciclo | RED | GREEN |
|---|---|---|
| 4F.1 | `stores/audio.test.ts` — `play(audio)` seta `currentAudio` e `isPlaying=true` | Store mínimo |
| 4F.2 | `stores/audio.test.ts` — `togglePlay()` alterna, `seek(t)` atualiza posição | Métodos do store |
| 4F.3 | `stores/audio.test.ts` — fechar/abrir o player não interrompe `<audio>` (instância única no DOM) | Singleton via `+layout.svelte` |
| 4F.4 | `components/AudioPlayer.test.ts` — renderiza waveform SVG de `peaks` (paridade com `audio-player.js`) | Componente renderiza barras SVG |
| 4F.5 | `components/AudioPlayer.test.ts` — clique na waveform faz seek pra posição correspondente | Handler de click com `getBoundingClientRect` |
| 4F.6 | `components/AudioPlayer.test.ts` — botões play/pause/prev/next funcionam | Bindings |
| 4F.7 | `components/AudioPlayer.test.ts` — fila de reprodução (próximo áudio do hino, próximo hino) | Queue no store |
| 4F.8 | `components/AudioPlayer.test.ts` — Media Session API registra metadata (title, artist) | `navigator.mediaSession.metadata = ...` |
| 4F.9 | `e2e/player-persists.spec.ts` (Playwright) — toca áudio em `/hinos/X/`, navega pra `/hinarios/`, áudio continua tocando | E2E crítico |
| 4F.10 | `e2e/player-persists.spec.ts` — player tem visual sticky no bottom; dismiss via X esconde mas mantém áudio | UI |

**Componentes a criar:**
- `web/src/lib/stores/audio.ts` (store + tipos + queue logic).
- `web/src/lib/components/AudioPlayer.svelte` (singleton; renderiza barra fixa no bottom).
- `web/src/lib/components/Waveform.svelte` (SVG puro, recebe `peaks`).
- `web/src/lib/components/PlayButton.svelte` (botão pequeno embutível em listas de áudio).

**Critério de aceitação 4.F:** vitest verde; **E2E "player persiste em navegação" verde** (este é o teste-âncora do refactor — se falha, o refactor não vale a pena).

---

#### Sub-marco 4.G — Busca — ~2-3 dias, branch `feat/headless-marco4g-search`

**Ciclos TDD:**

| Ciclo | RED | GREEN |
|---|---|---|
| 4G.1 | `routes/busca/+page.test.ts` — load com `?q=...` chama `search` GraphQL | `+page.{ts,svelte}` + form |
| 4G.2 | renderiza resultados agrupados (hinos / hinários) | Render |
| 4G.3 | `?q=` vazio mostra placeholder/instrução | Render condicional |
| 4G.4 | input tem debounce de 300ms (não dispara query a cada tecla) | `debounce` do `$effect` |
| 4G.5 | clique em resultado navega; query é preservada no histórico | `goto` com `keepFocus` |

**Critério de aceitação 4.G:** vitest verde; UX similar ao Django mas com filtragem client-side reativa.

---

#### Sub-marco 4.H — Perfis + notificações — ~3-4 dias, branch `feat/headless-marco4h-profiles`

**Ciclos TDD:**

| Ciclo | RED | GREEN |
|---|---|---|
| 4H.1 | `routes/perfil/[username]/+page.test.ts` — load busca `userProfile` | `[username]/+page.{ts,svelte}` |
| 4H.2 | renderiza header com avatar, nome, contagem de seguidores/seguindo, botão "seguir" (se !self) | `ProfileHeader.svelte` |
| 4H.3 | renderiza grid de áudios uploaded | `ProfileUploads.svelte` |
| 4H.4 | renderiza heatmap de atividade (paridade com `api_user_heatmap`) | `ActivityHeatmap.svelte` (SVG 53×7 grid) |
| 4H.5 | `routes/perfil/[username]/seguidores/+page.test.ts` — lista paginada | Rota + componente |
| 4H.6 | `routes/perfil/[username]/seguindo/+page.test.ts` — lista paginada | Rota + componente |
| 4H.7 | `routes/notificacoes/+page.test.ts` — load busca notificações do current user | Rota + render |
| 4H.8 | filtro `não lidas` via query string `?unread=1` | Filtro |
| 4H.9 | redireciona pra `/login?next=/notificacoes/` se anônimo | Guard no load |

**Critério de aceitação 4.H:** vitest verde; heatmap visualmente equivalente.

---

#### Sub-marco 4.I — Visual diff sistemático vs Django — ~2 dias, branch `feat/headless-marco4i-visual-diff`

**Ciclos:**

| Ciclo | RED | GREEN |
|---|---|---|
| 4I.1 | `tests/e2e/visual-parity.spec.ts` — pra cada rota da tabela, tira screenshot do SvelteKit (port 5173) e do Django (port 9000); diff ≤5% | Playwright snapshot matcher |
| 4I.2 | Pin de tipografia em web (`tests/unit/typography.spec.ts`) bate com `tests/unit/test_typography_setup.py` do Django | Snapshot dos `font-family` resolvidos |

**Pré-requisito de infra:** o E2E precisa subir Django (port 9000) + SvelteKit (port 5173) lado a lado contra o mesmo Postgres. Adicionar `web/scripts/dev-fullstack.sh` que sobe ambos (ou `docker-compose.dev.yml`).

**Critério de aceitação 4.I:** ≥95% das rotas da tabela com diff ≤5%; restante documentado em `_plan/marco4-diff-notes.md` (diferenças intencionais).

---

**Critério de aceitação geral do Marco 4:**
- Todos os sub-marcos 4.A-4.I com CI verde (rodado integradamente na branch-mãe).
- Demo gravada: navegar pelo SvelteKit em `:5173` cobrindo todas as rotas da tabela enquanto o player toca ininterrupto.
- Tabela final de paridade (pin no PR description) com % de diff por rota.

**Esforço estimado revisado:** 4-5 semanas em série, **~2-3 semanas com paralelização por subagentes** (ver "Estratégia de execução com subagentes" abaixo).

---

### Marco 5 — CRUD editorial + permissões

**Objetivo:** expor todas as mutations editoriais via GraphQL e reescrever o workspace `/editor/` em SvelteKit, com paridade funcional completa ao Django atual (`editor_views.py`, `views.py`, `views_social.py`). Inclui CRUD de hinários e hinos, fluxo de revisão com diff visual OCR↔texto, aprovação de áudios, follow/unfollow e marcação de notificações.

**Escopo de 3 semanas com paralelização:** 1 semana backend (5.A) + 2 semanas frontend (5.B-5.E em paralelo).

**Branch-mãe:** `feat/headless-marco5` (base: `feat/headless-marco4-spa`). **1 PR único** contra `development`.

---

**Mapa de rotas Django → SvelteKit:**

| Rota Django | View/função (arquivo:linha) | Rota SvelteKit |
|---|---|---|
| `/hinarios/novo/` | `views.py:hymnbook_create_view` | `/editor/hinarios/novo/` |
| `/hinarios/<slug>/editar/` | `views.py:hymnbook_edit_view` | `/editor/hinarios/[slug]/editar/` |
| `/hinarios/<slug>/deletar/` | `views.py:hymnbook_delete_view` | modal inline (sem rota própria) |
| `/hinarios/<slug>/publicar/` (POST) | `views.py:hymnbook_publish_view` | mutation + modal de checklist |
| `/hinarios/<slug>/despublicar/` (POST) | `views.py:hymnbook_unpublish_view` | mutation `unpublishHymnBook` |
| `/hinarios/<slug>/hinos/novo/` | `views.py:hymn_create_view` | `/editor/hinarios/[slug]/hinos/novo/` |
| `/hinos/<pk>/editar/` | `views.py:hymn_edit_view` | `/editor/hinos/[pk]/editar/` |
| `/hinos/<pk>/deletar/` | `views.py:hymn_delete_view` | modal inline |
| `/hinos/<pk>/revisar/` (POST) | `views.py:revise_hymn_view` | mutation `updateHymn` + `setReviewStatus` |
| `/editor/` | `editor_views.py:editor_hymnbook_list` | `/editor/` |
| `/editor/hinarios/<slug>/` | `editor_views.py:editor_hymnbook_detail` | `/editor/hinarios/[slug]/` |
| `/editor/hinos/<pk>/revisar/` | `editor_views.py:editor_revise_hymn` (~280 LOC) | `/editor/hinos/[pk]/revisar/` |
| `/editor/hinarios/<slug>/revisao-agil/` | `editor_views.py:editor_quick_review` | `/editor/hinarios/[slug]/revisao-agil/` |
| `/editor/audios/pendentes/` | `editor_views.py:editor_pending_audios` | `/editor/audios/pendentes/` |
| `/hinos/<pk>/audios/upload/` | `views_social.py:upload_audio` | drawer lateral (sem rota própria) |
| `/hinos/<pk>/historico/` | `views.py:hymn_history_view` | drawer lateral via `HymnType.revisions` |
| `/perfil/<username>/seguir/` (POST) | `users/views_social.py:toggle_follow` | mutations `followUser`/`unfollowUser` |
| `/notificacoes/<id>/lida/` (POST) | `users/views_social.py:mark_notification_read` | mutations `markNotificationRead`/`markAllNotificationsRead` |

**Endpoints REST mantidos (não migrar para GraphQL):**
- `upload_pdf_ocr` — streaming multipart OCR; frontend faz polling de `Query.ocrTask(id)`.
- `editor_preview_render` (POST `/editor/preview/`) — renderiza `render_hymn_body_for_text` sem DB; REST puro, sem overhead de migração para GraphQL.

---

**Helpers/serviços a reusar (zero duplicação):**

| Helper/serviço | Arquivo:função | Reuso no GraphQL |
|---|---|---|
| `can_create_hymnbook` | `permissions.py:27` | Chamado diretamente nas mutations |
| `can_edit_hymnbook` | `permissions.py:32` | Idem |
| `can_publish_hymnbook` | `permissions.py:37` | Idem |
| `_is_editor_or_admin` | `permissions.py:18` | Via `gate()` em `apps/api/permissions.py` |
| `_has_editor_access` | `editor_views.py:30` | Guard em resolvers do workspace editorial |
| `_editor_visible_books` | `editor_views.py:43` | Resolver `Query.editorHymnbooks` |
| `_pending_audios_for` | `editor_views.py:49` | Resolver `Query.pendingAudios` |
| `_next_pending_hymn` | `editor_views.py:322` | Campo `HymnBookType.nextPendingHymn` |
| `_parse_sort`/`_toggle_sort`/`_encode_sort` | `editor_views.py:117-157` | Portado para TypeScript no SvelteKit (sort é client-side via URL) |
| `_sort_expression` | `editor_views.py:160` | Resolver `editorHymnbooks(sort: [SortInput])` constrói ORDER BY |
| `publish_readiness` | `services/review.py:13` | Query `publishReadiness(slug)` + type `PublishReadinessType` |
| `HymnForm` | `forms.py:38` | Mutations `createHymn`/`updateHymn` chamam `HymnForm(data, instance)` |
| `HymnBookForm` | `forms.py:10` | Mutations `createHymnBook`/`updateHymnBook` |
| `QuickReviewForm` | `forms.py:115` | Mutation `quickReviewHymn` |
| `HymnAudioUploadForm` | `forms.py:279` | Mutation `uploadAudio` valida antes de salvar |
| `_compute_inline_diff` | `editor_views.py:548` | Campo `HymnType.inlineDiff: InlineDiffType` |
| `_compute_ocr_line_confidences` | `editor_views.py:622` | Campo `HymnType.ocrLineConfidences: [Int]` |
| Signal `_create_hymn_revision_on_edit` | `signals.py:97` | Dispara automaticamente em qualquer `hymn.save()` — mutations não criam `HymnRevision` explicitamente |
| Signal `_generate_waveform_for_audio` | `signals.py:144` | Dispara automaticamente após `audio.save()` na mutation `uploadAudio` |

---

**Decisões fixadas (não reavaliar):**

- **OCR:** REST `upload_pdf_ocr` inalterado. SvelteKit chama `fetch('/ocr/upload/', {method:'POST', body: formData})` e faz polling de `Query.ocrTask(id)`. GraphQL expõe `OCRTaskType` com `status`, `progressPct`, `resultData`.
- **Optimistic UI:** `setReviewStatus`, `toggleFavorite`, `approveAudio` — atualização local imediata via store, rollback em `onError`. Padrão @urql/svelte: `optimisticResponse` no cache.
- **Autosave no editor de revisão:** `$effect` com debounce de 2s observa campos do formulário e dispara `updateHymn`. Autosave não redireciona — só atualiza `savedAt` no estado local.
- **Preview do corpo do hino:** chama REST `POST /editor/preview/` direto (não via GraphQL); stateless e síncrono.
- **Sort multi-critério do dashboard:** lógica `_parse_sort`/`_toggle_sort` migra para TypeScript. URL `?sort=review:asc,audio:desc` preservada. Resolver `Query.editorHymnbooks(sort: [SortInput!])` recebe lista ordenada e constrói `ORDER BY` via `_sort_expression`.
- **`unpublishHymnBook`:** adicionada (view `hymnbook_unpublish_view` existe em `views.py:497` mas estava ausente no plano inicial).
- **`reviewAudio`:** substitui REST `editor_hymn_audio_review`; aceita `isMatch`, `qualityRating`, `qualityObservations`, `mismatchReason`.
- **`quickReviewHymn`:** atualiza só `style` e `repetitions` via `QuickReviewForm`; não toca em `review_status`.
- **`updateHymnBookEditorial`:** atualiza `priority` e `is_featured`; restringe a `user.is_staff`.
- **`markAllNotificationsRead`:** adicionada para bulk-mark (lógica presente em `notifications_list` que já faz bulk update mas não havia mutation).
- **Workspace editorial como grupo de rotas:** `web/src/routes/(editor)/` com `+layout.ts` que verifica `currentUser.isEditor` — evita duplicar guard em cada página.

---

**Queries/campos adicionais ao schema (não presentes no Marco 4):**

- `Query.editorHymnbooks(sort: [SortInput], priority: String): [HymnBookType]` — `_editor_visible_books` + `with_review_progress()` + sort dinâmico.
- `Query.editorDashboardStats: EditorDashboardStatsType` — totalHinarios, pendingHymns, recentReviewed7d, p1Count, pendingAudiosCount, resumeHymn.
- `Query.pendingAudios: [HymnAudioType]` — `_pending_audios_for(user)`.
- `Query.publishReadiness(slug: String!): PublishReadinessType` — paridade com `hymnbook_publish_check_view`.
- `Query.ocrTask(id: UUID!): OCRTaskType` — polling de progresso OCR.
- `HymnBookType.nextPendingHymn(currentPk: UUID): HymnType` — porta `_next_pending_hymn`.
- `HymnBookType.nextIncompleteHymn: HymnType` — primeiro hino com `style=""` ou `repetitions=""`.
- `HymnType.inlineDiff: InlineDiffType` — porta `_compute_inline_diff(ocr_text, text)`.
- `HymnType.ocrLineConfidences: [Int]` — porta `_compute_ocr_line_confidences`.
- `HymnType.revisions: [HymnRevisionType]` — drawer de histórico de revisões.
- `HymnType.commonStyles(top: Int = 5): [String]` — porta `_common_field_values(book, "style", top)`.
- `HymnType.commonRepetitions(top: Int = 5): [String]` — porta `_common_field_values(book, "repetitions", top)`.

---

#### Sub-marco 5.A — Mutations + queries editoriais backend — ~1 semana, branch `feat/headless-marco5a-mutations`

Backend puro (Django/Python). Entrega SDL atualizado para os sub-marcos de frontend.

**Ciclos TDD:**

| Ciclo | RED | GREEN |
|---|---|---|
| 5A.1 | `test_create_hymnbook_editor_succeeds`, `test_create_hymnbook_anon_blocked`, `test_create_hymnbook_validates_name_unique` | Mutation `createHymnBook(input: HymnBookInput!)` via `HymnBookForm`; gate `can_create_hymnbook` |
| 5A.2 | `test_update_hymnbook_editor_succeeds`, `test_update_hymnbook_non_editor_blocked` | Mutation `updateHymnBook(slug: String!, input: HymnBookInput!)` via `HymnBookForm` |
| 5A.3 | `test_publish_hymnbook_succeeds_when_readiness_ok`, `test_publish_hymnbook_fails_with_pending_check`, `test_publish_hymnbook_non_publisher_blocked` | Mutation `publishHymnBook(slug: String!): PublishResult` reusando `publish_readiness` |
| 5A.4 | `test_unpublish_hymnbook_publisher_succeeds`, `test_unpublish_hymnbook_non_publisher_blocked` | Mutation `unpublishHymnBook(slug: String!)` |
| 5A.5 | `test_delete_hymnbook_editor_succeeds`, `test_delete_hymnbook_non_editor_blocked`, `test_delete_hymnbook_cascade` | Mutation `deleteHymnBook(slug: String!): DeleteResult` |
| 5A.6 | `test_update_hymnbook_editorial_staff_succeeds`, `test_update_hymnbook_editorial_non_staff_blocked` | Mutation `updateHymnBookEditorial(slug, priority, isFeatured)` gateada por `user.is_staff` |
| 5A.7 | `test_create_hymn_editor_succeeds`, `test_create_hymn_validates_number_unique`, `test_create_hymn_non_editor_blocked` | Mutation `createHymn(hymnbookSlug: String!, input: HymnInput!)` via `HymnForm` |
| 5A.8 | `test_delete_hymn_editor_succeeds`, `test_delete_hymn_non_editor_blocked` | Mutation `deleteHymn(pk: UUID!): DeleteResult` |
| 5A.9 | `test_quick_review_hymn_updates_style_repetitions`, `test_quick_review_does_not_touch_review_status`, `test_quick_review_creates_revision_signal` | Mutation `quickReviewHymn(pk: UUID!, style: String!, repetitions: String!)` via `QuickReviewForm`; signal dispara `HymnRevision` |
| 5A.10 | `test_upload_audio_authenticated_succeeds`, `test_upload_audio_validates_size_25mb`, `test_upload_audio_validates_format`, `test_upload_audio_anon_blocked` | Mutation `uploadAudio(hymnPk: UUID!, file: Upload!, ...)` via `HymnAudioUploadForm`; waveform signal dispara |
| 5A.11 | `test_approve_audio_editor_succeeds`, `test_approve_audio_non_editor_blocked` | Mutation `approveAudio(pk: UUID!): HymnAudioType` |
| 5A.12 | `test_reject_audio_editor_succeeds_and_deletes`, `test_reject_audio_non_editor_blocked` | Mutation `rejectAudio(pk: UUID!)` — deleta o áudio |
| 5A.13 | `test_review_audio_match_sets_is_approved_true`, `test_review_audio_mismatch_forces_unapproval`, `test_review_audio_non_editor_blocked` | Mutation `reviewAudio(pk: UUID!, input: AudioReviewInput!)` — paridade com `editor_hymn_audio_review` |
| 5A.14 | `test_delete_audio_editor_succeeds`, `test_delete_audio_uploader_can_delete_own`, `test_delete_audio_other_user_blocked` | Mutation `deleteAudio(pk: UUID!): DeleteResult` |
| 5A.15 | `test_follow_user_creates_follow_and_notification`, `test_follow_already_following_no_dup`, `test_follow_self_blocked` | Mutation `followUser(username: String!)` |
| 5A.16 | `test_unfollow_user_removes_follow`, `test_unfollow_not_following_is_noop` | Mutation `unfollowUser(username: String!)` |
| 5A.17 | `test_mark_notification_read_owner_succeeds`, `test_mark_notification_read_other_user_blocked` | Mutation `markNotificationRead(pk: UUID!)` |
| 5A.18 | `test_mark_all_notifications_read_marks_only_own` | Mutation `markAllNotificationsRead` |
| 5A.19 | `test_editor_hymnbooks_query_superuser_sees_all`, `test_editor_hymnbooks_sort_by_review_pct_desc`, `test_editor_hymnbooks_filter_by_priority_p1` | `Query.editorHymnbooks(sort: [SortInput], priority: String)` |
| 5A.20 | `test_editor_dashboard_stats_correct_counts`, `test_pending_audios_editor_sees_all`, `test_publish_readiness_query_returns_checks`, `test_hymn_type_exposes_inline_diff`, `test_hymn_type_exposes_revisions` | Queries menores + campos de tipo; atualiza `schema.graphql` |

**Arquivos a criar:** `tests/unit/api/test_mutation_hymnbook.py` (5A.1-6), `test_mutation_hymn.py` (5A.7-9), `test_mutation_audio.py` (5A.10-14), `test_mutation_social.py` (5A.15-18), `test_query_editor.py` (5A.19-20).

**Arquivos a editar:** `apps/api/mutations.py`, `apps/api/types.py` (novos input/output types), `apps/api/schema.py`, `schema.graphql`.

**Critério de aceitação 5.A:** 20 ciclos verdes; SDL sem divergência; upload multipart validado via `curl`; lint passa.

---

#### Sub-marco 5.B — Dashboard editorial + detalhe do hinário — ~4-5 dias, branch `feat/headless-marco5b-editor-dashboard`

Depende de 5.A. Rotas `/editor/` e `/editor/hinarios/[slug]/`.

**Ciclos TDD:**

| Ciclo | RED | GREEN |
|---|---|---|
| 5B.1 | `routes/(editor)/+layout.test.ts` — guard redireciona `/login?next=/editor/` se não-editor | `+layout.ts` lê `data.currentUser`; redireciona se `!isEditor` |
| 5B.2 | `routes/editor/+page.test.ts` — load busca `editorDashboardStats` + `editorHymnbooks` | `+page.{ts,svelte}` básico |
| 5B.3 | renderiza 4 cards de stats | `EditorStatsBar.svelte` |
| 5B.4 | renderiza card "Continuar revisão" quando `resumeHymn` não-nulo | `ResumeCard.svelte` |
| 5B.5 | 4 chips de sort cicla off→asc→desc→off, atualiza URL | `SortChips.svelte` com `goto(?sort=..., replaceState: true)` |
| 5B.6 | chips de prioridade filtram via `?priority=` | `PriorityChips.svelte` |
| 5B.7 | tabela mostra barra de progresso de revisão colorida | `ReviewProgressBar.svelte` |
| 5B.8 | `routes/editor/hinarios/[slug]/+page.test.ts` — load + lista de hinos com status badge | `[slug]/+page.{ts,svelte}` + `HymnStatusList.svelte` |
| 5B.9 | botão "Próximo pendente" navega para `nextPendingHymn` | Consome `HymnBookType.nextPendingHymn` + `goto` |
| 5B.10 | Playwright `tests/e2e/editor-dashboard.spec.ts` — login editor, sort por revisão asc, badge áudios pendentes | E2E |

**Arquivos a criar:** `web/src/routes/(editor)/+layout.{ts,svelte}` (guard global), rotas `+page.{ts,svelte}`, componentes em `web/src/lib/components/editor/`, E2E spec.

**Critério 5.B:** 10 ciclos verdes; sort multi-critério funciona; guard bloqueia não-editores.

---

#### Sub-marco 5.C — Formulário de revisão de hino — ~1 semana, branch `feat/headless-marco5c-revise-hymn`

Depende de 5.A. **Paralelo com 5.B e 5.D.** A tela mais complexa do projeto (~280 LOC view + diff visual + autosave).

**Ciclos TDD:**

| Ciclo | RED | GREEN |
|---|---|---|
| 5C.1 | load busca hino com `inlineDiff`, `ocrLineConfidences`, `revisions`, `commonStyles`, `commonRepetitions` | `[pk]/revisar/+page.{ts,svelte}` |
| 5C.2 | `InlineDiff.test.ts` — renderiza linhas com kind `eq`/`replace`/`add`/`del` com marcação colorida | `InlineDiff.svelte` |
| 5C.3 | exibe badges de contagem (N substituições/adições/remoções) | Badges no header |
| 5C.4 | `OcrConfidenceBar.test.ts` — barra de confiança por linha (0-100 como gradiente) | `OcrConfidenceBar.svelte` |
| 5C.5 | formulário edita todos os campos de `HymnForm` | Campos com `bind:value` |
| 5C.6 | pílulas de `CANONICAL_STYLES` (Marcha/Valsa/Mazurca) preenchem campo style | Pílulas `<button type="button">` |
| 5C.7 | pílulas de `CANONICAL_REPETITIONS` preenchem campo repetitions | Idem |
| 5C.8 | autosave: `$effect` com debounce 2s → `updateHymn` sem redirect → "Salvo às HH:MM" | Debounce + mutation |
| 5C.9 | preview: `$effect` nos campos `text`/`repetitions` → REST `/editor/preview/` → HTML | `$effect` + fetch REST debounced |
| 5C.10 | "Salvar e Avançar" → `setReviewStatus(REVIEWED)` + redirect para `nextPendingHymn` (wrap-around) | Botão + mutation + `goto` |
| 5C.11 | "Salvar e Voltar" → `updateHymn` + redirect para `/editor/hinarios/[slug]/` | Botão + mutation + `goto` |
| 5C.12 | indicador "Hino X de Y · Y-X pendentes" atualiza ao salvar | Dados do load |
| 5C.13 | `AudioReviewDrawer.test.ts` — player, controles `is_match`, rating 1-5, observações, mismatch reason | `AudioReviewDrawer.svelte` |
| 5C.14 | `is_match=false` exibe selector de `mismatch_reason` e desabilita rating | UI condicional |
| 5C.15 | submit do drawer chama `reviewAudio` e fecha | Mutation + close |
| 5C.16 | `RevisionHistoryDrawer.test.ts` — lista `HymnType.revisions` em ordem reversa com diff de campos | `RevisionHistoryDrawer.svelte` |
| 5C.17 | Playwright `tests/e2e/revise-hymn.spec.ts` — autosave, avançar, drawer de histórico | E2E |

**Critério 5.C:** 17 ciclos verdes; autosave não redireciona; "Avançar" faz wrap-around; diff visual renderizado.

---

#### Sub-marco 5.D — CRUD de hinários/hinos + aprovação de áudios — ~4-5 dias, branch `feat/headless-marco5d-crud-audios`

Depende de 5.A. **Paralelo com 5.B e 5.C.** Toca arquivos disjuntos.

**Ciclos TDD:**

| Ciclo | RED | GREEN |
|---|---|---|
| 5D.1 | `routes/editor/hinarios/novo/+page.test.ts` — form com campos de `HymnBookForm` | `novo/+page.{ts,svelte}` + `HymnBookFormView.svelte` |
| 5D.2 | submit chama `createHymnBook`, redireciona | Mutation + redirect |
| 5D.3 | `editar/+page.test.ts` — pré-popula form | Rota |
| 5D.4 | submit chama `updateHymnBook` | Mutation + redirect |
| 5D.5 | `DeleteHymnBookModal.test.ts` — confirma nome, chama `deleteHymnBook` | Modal embutido no detalhe editorial de 5.B (placeholder mergeado) |
| 5D.6 | `PublishHymnBookModal.test.ts` — checklist `publishReadiness`, desabilita se checks falharem | Modal consome `Query.publishReadiness` |
| 5D.7 | submit chama `publishHymnBook`/`unpublishHymnBook` conforme estado | Mutations |
| 5D.8 | `routes/.../hinos/novo/+page.test.ts` — form, `number` sugerido = max+1 | Rota + `HymnFormView.svelte` |
| 5D.9 | submit chama `createHymn`, redireciona | Mutation + redirect |
| 5D.10 | `routes/.../hinos/[pk]/editar/+page.test.ts` — pré-popula, `updateHymn` | Rota + mutation |
| 5D.11 | `DeleteHymnModal.test.ts` — confirma, chama `deleteHymn` | Modal inline |
| 5D.12 | `AudioUploadDrawer.test.ts` — file input (mp3/ogg/flac ≤25MB), `uploadAudio` | `AudioUploadDrawer.svelte` |
| 5D.13 | validação client-side de tamanho/extensão | Guard no handler |
| 5D.14 | `routes/.../audios/pendentes/+page.test.ts` — `pendingAudios` com player inline | `pendentes/+page.{ts,svelte}` |
| 5D.15 | "Aprovar" → `approveAudio` com optimistic UI | Mutation + optimistic |
| 5D.16 | "Rejeitar" → `rejectAudio` com confirmação | Mutation + confirm |
| 5D.17 | Playwright `tests/e2e/editor-crud.spec.ts` — criar hinário, adicionar hino, upload+aprovação, publicar | E2E |

**Critério 5.D:** 17 ciclos verdes; fluxo CRUD verificado em E2E.

---

#### Sub-marco 5.E — Revisão ágil + upload inline + social mutations — ~3 dias, branch `feat/headless-marco5e-quick-review`

Depende de 5.A e 5.B. **Paralelo com 5.C e 5.D** após 5.B mergeado. Edita páginas do Marco 4.

**Ciclos TDD:**

| Ciclo | RED | GREEN |
|---|---|---|
| 5E.1 | `routes/.../revisao-agil/+page.test.ts` — load seleciona hino via `?h=<number>`, default = primeiro | `revisao-agil/+page.{ts,svelte}` |
| 5E.2 | pílulas fixas estilo (M/V/Z) + repetições (1-4) com atalhos de teclado | Pílulas + `keydown` handler |
| 5E.3 | submit → `quickReviewHymn` → navega para `nextIncompleteHymn` | Mutation + `goto` |
| 5E.4 | quando todos completos, flash + volta para `/editor/hinarios/[slug]/` | Redirect condicional |
| 5E.5 | indicador N/total, links prev/next via `?h=` | `<a>` links (não JS) |
| 5E.6 | `routes/hinos/[pk]/+page.test.ts` (estende Marco 4) — `isEditor` mostra botão upload → `AudioUploadDrawer` | Condicional no `HymnDetailPage` |
| 5E.7 | botão "Seguir" → `followUser`/`unfollowUser` com optimistic UI | Mutation + optimistic state |
| 5E.8 | `routes/notificacoes/+page.test.ts` (estende Marco 4) — "Marcar tudo como lido" → `markAllNotificationsRead` | Mutation |
| 5E.9 | Playwright `tests/e2e/quick-review.spec.ts` — 3 hinos via atalhos de teclado | E2E |

**Critério 5.E:** 9 ciclos verdes; atalhos teclado funcionam; follow/unfollow com optimistic UI.

---

**Plano de paralelização do Marco 5:**

Análise de dependências:
- **5.A** (mutations backend): sem dependência. Bloqueia 5.B-5.E. Executa primeiro, sozinho.
- **5.B, 5.C, 5.D**: dependem de 5.A. **Paralelos entre si** (arquivos disjuntos).
- **5.E**: depende de 5.A e 5.B. Sequencial após 5.B; paralelo com 5.C/5.D se 5.B mergeado.

**Fases de execução:**

| Fase | Subagentes | Branch base | Critério pra avançar |
|---|---|---|---|
| **F1** (~1 semana) | 5.A único | `feat/headless-marco4-spa` | SDL atualizado committado |
| **F2** (~1 semana) | 5.B + 5.C + 5.D em paralelo | `feat/headless-marco5-base` | Todas 3 branches verdes |
| **F3** (~3 dias) | Merge 5.B+5.C+5.D + spawn 5.E | `feat/headless-marco5-base` | Branch unificada + 5.E verdes |
| **F4** (~1 dia) | Abrir PR contra `development` | `feat/headless-marco5` | Auto-merge fecha |

**Ganho estimado:** F1+F2+F3 ≈ 2,5 semanas vs. 3-4 semanas sequenciais.

**Riscos da paralelização:**
- **Conflito `DeleteHymnBookModal`:** 5.B cria `<!-- TODO: DeleteHymnBookModal slot -->`. Merge resolve substituindo placeholder pelo componente de 5.D.
- **Conflito `routes/hinos/[pk]/+page.svelte`:** 5.E edita arquivo do Marco 4. Toca apenas bloco de botões condicionais — conflito limitado.
- **Upload multipart `strawberry.file_uploads.Upload`:** validar end-to-end em 5A.10 antes do frontend em 5.D. Se incompatibilidade, pausar e reportar.

---

**Critério de aceitação geral do Marco 5:**
- Sub-marcos 5.A-5.E com CI verde na branch-mãe `feat/headless-marco5`.
- Fluxo editorial completo em E2E: login editor → cria hinário → adiciona 3 hinos → upload áudio → aprovação → revisão (formulário + ágil) → publica.
- Signal `HymnRevision` cria trilha de auditoria (verificado em 5A.9; implícito em 5C.8/5C.10).
- Permissões cobertas: editor consegue tudo; usuário comum recebe erro; anônimo recebe 401.
- SDL `schema.graphql` atualizado e committado.
- Templates Django intocados (serão deletados no Marco 7).

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

---

## Política de consolidação de PRs

**Princípio:** sub-marcos existem pra **disciplina de TDD e planejamento**, não pra serem PRs separados. Cada sub-marco continua sendo uma sequência de commits (1 por ciclo TDD) num branch local; o que vai pra `main` é um PR por Marco semântico.

**Histórico (Marcos 1-3) — o que fazer com o que já está aberto:**
- PR #51 (Marco 1) tem auto-merge → aguardar fechar; `main` ganha 1 commit squash com Marco 1.
- PR #52 (Marco 2) já foi mergeado no branch do Marco 1 — não vai virar PR separado contra `main`.
- PR #53 (Marco 3) foi rebaseado sobre Marco 1, então contém Marco 2 + Marco 3. Renomear título do PR pra refletir ("Marcos 2 + 3: mutations + auth + SvelteKit skeleton"). Auto-merge fecha → `main` ganha 1 commit squash com Marcos 2+3.
- **Resultado retroativo:** 2 commits em `main` (Marco 1; Marcos 2+3), não 3 PRs.

**Daqui pra frente — 1 PR por Marco como regra:**

| Marco | PRs contra `main` | Justificativa |
|---|---|---|
| Marco 4 | **2 PRs** (4.A schema + 4.B-I SPA) | Schema é backend isolado, contrato discreto; SPA é monolítica |
| Marco 5 | **1 PR** | CRUD editorial é coeso; backend e frontend andam juntos |
| Marco 6 | **1 PR** | PWA offline é uma feature transversal — rollback unitário tem que ser possível |
| Marco 7 | **1 PR** | Cutover é cirurgia única |

**Total daqui em diante: 5 PRs** (Marco 4 split + Marcos 5, 6, 7 individuais), em vez dos ~30 do plano original (1 PR por sub-marco).

**Mecânica de cada PR:**
- Branch base: **`development`** (não `main` — staging buffer pré-deploy; ver "Workflow de desenvolvimento — duas etapas" abaixo).
- Branch-mãe do Marco: `feat/headless-marco<N>` (ou `marco4-schema` e `marco4-spa` no caso de Marco 4).
- Cada sub-marco vira **uma seção do PR description** com sua tabela de ciclos TDD + lista dos commits que cobrem essa seção. Revisor (você) varre por sub-marco; merge é único squash.
- Auto-merge ativado imediatamente após criar a PR (memória `feedback_auto_merge`).
- CI roda contra a soma de tudo — sub-marco quebrado **dentro** da branch-mãe não passa: a disciplina é rodar `pnpm test && pnpm check && uv run pytest` localmente a cada ciclo.

**Trade-offs aceitos:**
- ✅ Menos overhead de revisão, menos CI runs caros, `main` com histórico semântico claro.
- ❌ PRs maiores (Marco 4 SPA chega a ~3k LOC). Mitigação: revisão guiada pelas seções de sub-marco no PR description.
- ❌ Rollback granular (sub-marco isolado) requer `git revert <commit-range>`, não `revert <PR>`. Aceito porque sub-marcos dentro de um Marco são interdependentes na prática.

---

## Workflow de desenvolvimento — duas etapas (`development` → `main`)

**Problema:** `main` tem auto-deploy pra Railway via `.github/workflows/deploy.yml`. Cada PR mergeado em `main` virava deploy imediato — sem buffer pra integrar mudanças vindas em paralelo (Marco 4 SPA + outras PRs UX) antes que produção sentisse o impacto.

**Solução:** introduzir `development` como branch de staging entre features e produção:

```
feature/* ─PR─▶ development ─PR(release)─▶ main ─auto-deploy─▶ Railway
```

**Regras:**
- **Todo PR de feature aponta pra `development`** (não pra `main`). CI roda normal.
- **Push em `development` NÃO dispara deploy** — só rodam CI checks.
- **`main` só recebe PR vindo de `development`** ("release PRs"). São abertos manualmente quando estiver hora de promover (`gh pr create --base main --head development --title "release: <data ou resumo>"`).
- Branch protection:
  - `main`: required checks (Lint/Unit/E2E), `strict: true`, `enforce_admins: true`.
  - `development`: required checks idênticos, `strict: true`, `enforce_admins: false` (admin pode pushar direto em emergências).

**Implicação prática pros marcos restantes deste plano:**
- Sub-marco 4.I, Marco 5, Marco 6, Marco 7 — todos os PRs apontam pra `development`.
- Quando um conjunto de marcos estiver estável em `development`, abre-se um release PR `development → main` pra promover.
- Marco 7 (cutover) é a primeira release PR que efetivamente troca a UI servida — o último de muitas mergeagens em development.

**Setup operacional** (já feito):
- Branch `development` criada apontando pro HEAD de `main` em 2026-06-16.
- Protections aplicadas via `gh api -X PUT /repos/.../branches/<branch>/protection`.
- PRs #51, #55, #56 retargetados pra `development`.
- Workflow `ci.yml` ajustado pra rodar em PRs contra `development`.
- Workflow `deploy.yml` continua disparando apenas em `push: branches: [main]`.

---

## Estratégia de execução com subagentes

**Princípio:** cada sub-marco é uma **unidade autocontida e testável** — ideal pra delegação a um subagente. O subagente recebe um briefing fechado, opera em git worktree isolado, e só conclui quando todos os testes + lint estão verdes.

**Tipo de subagente:** `general-purpose` (workhorse) com `isolation: "worktree"`. Cada subagente recebe uma cópia git isolada do repo — sem conflitos com trabalho paralelo.

**Contrato de cada subagente (briefing fechado):**
1. **Escopo:** identificador do sub-marco (ex: "4.D — Detalhe do hinário, 3 modos").
2. **Branch:** nome do branch a criar a partir da base indicada.
3. **Tabela de ciclos TDD:** copiada literalmente do plano. O subagente percorre na ordem: RED → GREEN → commit → próximo.
4. **Arquivos a criar/editar:** lista explícita.
5. **Critério de "concluído":**
   - Todos os ciclos da tabela com commit.
   - `pnpm test && pnpm check && pnpm build` no `web/` verdes (ou `uv run pytest tests/unit/api/ && uv run black --check . && uv run isort --check-only . && uv run ruff check .` em sub-marcos backend).
   - Lint passa.
   - Subagente **NÃO** abre PR; apenas garante a branch verde e reporta o SHA final. O coordenador (eu) faz o merge na branch-mãe.
6. **Restrições fixas:**
   - PT-BR em strings de usuário.
   - Sem `--no-verify`.
   - Sem `git push --force`.
   - Reusar helpers existentes (`can_edit_hymnbook`, `_is_editor_or_admin`, `HymnForm`, etc.) em vez de reescrever.
   - Se um teste falhar de forma irrecuperável (ex: precisa de decisão de design), pausar e reportar — não improvisar.

**Plano de paralelização do Marco 4:**

Análise de dependências:
- **4.A** (schema GraphQL): backend puro. Sem dependências. Bloqueia 4.C-4.H (codegen do cliente lê SDL).
- **4.B** (layout shell + tokens + tipografia): frontend puro. Sem dependências do schema novo (usa só queries do Marco 1-3). **Pode rodar paralelo com 4.A**.
- **4.C, 4.D, 4.E, 4.G, 4.H** (rotas read-only): cada uma toca rotas/componentes disjuntos. Dependem de 4.A (SDL) e 4.B (shell). **Podem rodar todas em paralelo**.
- **4.F** (player global persistente): modifica `+layout.svelte` (mesmo arquivo de 4.B). **Sequencial após 4.B**; **paralelo com 4.C-4.H** se 4.B já estiver mergeado.
- **4.I** (visual diff E2E): precisa de tudo. **Sequencial no fim**.

**Linha do tempo proposta:**

```
Tempo →    Semana 1         Semana 2              Semana 3
          ┌─────────┐
4.A ─────►│ schema  │
          └─────────┘
          ┌─────────┐
4.B ─────►│ shell   │
          └─────────┘
                    ┌──────────────┐
4.C ───────────────►│ home + lista │
                    └──────────────┘
                    ┌──────────────┐
4.D ───────────────►│ hinário 3mod │
                    └──────────────┘
                    ┌──────────────┐
4.E ───────────────►│ hino único   │
                    └──────────────┘
                    ┌──────────────┐
4.F ───────────────►│ player       │
                    └──────────────┘
                    ┌──────────────┐
4.G ───────────────►│ busca        │
                    └──────────────┘
                    ┌──────────────┐
4.H ───────────────►│ perfis+notif │
                    └──────────────┘
                                   ┌──────────┐
4.I ──────────────────────────────►│ diff E2E │
                                   └──────────┘
```

**Fases de execução (sob coordenação do agente principal):**

| Fase | Subagentes paralelos | Branches base | Critério pra avançar |
|---|---|---|---|
| **F1** (1 semana) | 4.A + 4.B | `main` | Ambos branches verdes e mergeados em `feat/headless-marco4-base` |
| **F2** (~1 semana) | 4.C + 4.D + 4.E + 4.F + 4.G + 4.H | `feat/headless-marco4-base` | Todas as 6 branches verdes |
| **F3** (~3 dias) | Merge das 6 branches em `feat/headless-marco4-spa`; resolver conflitos (esperados em `+layout.svelte` por 4.F) | — | Branch unificada verde |
| **F4** (~2 dias) | 4.I (sequencial, sozinho) na branch unificada | `feat/headless-marco4-spa` | Visual diff ≥95% |
| **F5** | Abrir 2 PRs contra `main`: schema e SPA | — | Auto-merge fecha ambos |

**Ganho estimado:** F1+F2+F3+F4 ≈ 2,5-3 semanas vs. 4-5 semanas sequenciais.

**Riscos da paralelização:**
- **Conflitos de merge na F3.** Mitigação: 4.B (shell) cria slots/placeholders para player (4.F) e cards (4.C). Cada sub-marco frontend toca arquivos disjuntos por contrato (tabelas TDD já desenharam isso).
- **Schema do 4.A muda durante 4.B**: 4.B não depende de schema novo, então não é afetado. 4.C-4.H pegam o SDL definitivo após 4.A mergeado.
- **Subagente travado em decisão de design.** Mitigação: critério 6 do contrato (pausar e reportar). Coordenador resolve, atualiza briefing, re-spawna se necessário.
- **Custo de tokens.** 6 subagentes simultâneos em F2 ≈ 6× contexto. Aceitável pela aceleração.

**Coordenação prática (agente principal, isto é, eu):**
- F1: 2 chamadas `Agent` em paralelo num único turno (4.A + 4.B).
- F2: 6 chamadas `Agent` em paralelo num único turno.
- Entre fases: verificar branches (`git log`, `pnpm test`, `pytest`), resolver conflitos manualmente, abrir PRs.
- **NÃO** delegar a abertura de PRs aos subagentes — fica no agente principal pra controle e aplicação do auto-merge.

**Marcos 5+ usam o mesmo padrão**, ajustado pela coesão do marco. Marco 5 (CRUD editorial) tem menos paralelização possível porque mutations compartilham mais código; provável split: 2 subagentes (backend mutations + frontend editor UI). Marco 6 (offline PWA) é predominantemente sequencial (service worker + Dexie + Workbox são uma stack acoplada).

---

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

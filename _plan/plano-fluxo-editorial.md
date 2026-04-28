# Plan: Evolução da Plataforma `hymns-plat` — Fase 1 (Features) e Fase 2 (UI)

## Contexto

O `hymns-plat` (`/Users/nitai/dev/hyms-platform/hymns-plat/`) hoje tem todo o miolo de back-end pronto: CRUD de hinários/hinos, busca FTS no Postgres, OCR de PDF via thread daemon (`apps/hymns/services/ocr.py` + `OCRTask`), barras de repetição (`apps/hymns/repetitions.py` + `render_hymn_body`), upload de áudio, perfis e seguidores. O que falta é:

1. **Fluxo de curadoria editorial** — não existe estado de revisão por hino, nem progresso de revisão por hinário, nem ciclo de publicação. `HymnAudio.is_approved` é o único flag de aprovação no projeto e é binário, sem trilha de auditoria. Permissões hoje são apenas "dono ou superuser" (`_can_edit_hymnbook` em `apps/hymns/views.py`); não há grupo `editor` nem ACL por papel.
2. **Identidade visual** — toda a UI é vanilla CSS embutida em `templates/base.html` (~200 linhas inline), sem framework e sem identidade visual. A renderização de hino na web é funcional mas não evoca a experiência do hinário impresso.
3. **Modos de leitura** — só existe a tela "lista de hinos com link", sem leitura corrida tipo PDF nem carrossel.

A motivação é: subir hinários em massa via OCR (passível de erro), permitir que um **editor** revise hino-a-hino com poucos cliques, controlar publicação, e dar ao usuário final uma tela de leitura que pareça o impresso para usar durante trabalhos espirituais.

A entrega é dividida em **duas fases**:

- **Fase 1 — Features sem mexer na UI** (executada agora, com TDD).
- **Fase 2 — Redesign completo de UI** (executada depois pelo Claude Design, com este plano como contexto). Nada da UI atual precisa ser preservado.

---

## Fase 1 — Features (TDD-first, UI atual mantida)

### Princípios de execução

- **TDD estrito**: cada incremento começa com um teste falhando (`pytest`), depois implementação mínima, depois refactor. Nunca commitar código sem teste.
- **Sem tocar templates/CSS**: manter `templates/` e `static/` como estão. Onde a UI existente precisar de um botão novo (ex.: "publicar"), adicionar o mínimo possível e deixar uma marcação clara no commit ("UI provisória — Fase 2 substitui"). Preferência por exposição via Django Admin enquanto a Fase 2 não chega.
- **Migrations defensivas**: cada mudança de modelo entra em uma migration própria e reversível, com `RunPython` separado para backfill quando necessário.
- **Reuso máximo**: `OCRTask`, `HymnBookVersion.uploaded_by`, `HymnBook.owner_user`, `HymnAudio.is_approved` já existem — estender em vez de duplicar.

### Stack de testes

Já configurado: `pytest` + `pytest-django` + Postgres real (test DB). Fixtures em `tests/`. Testes vivem em `apps/<app>/tests/` ou `tests/`. Convenção: um arquivo de teste por módulo modificado.

### Marcos da Fase 1

#### Marco 1.1 — Papel `editor` e infra de permissões

**Por quê**: hoje só dono ou superuser editam. Precisamos de um papel intermediário que pode editar/revisar/publicar qualquer hinário sem ser super admin global.

**Modelo de permissões** (Django Groups + `Meta.permissions`):
- Grupo `editor` criado por data migration idempotente.
- Permissions custom no `HymnBook.Meta.permissions`:
  - `can_review_any_hymnbook` — editar hinos/hinários de qualquer dono.
  - `can_publish_hymnbook` — publicar/despublicar.
- `editor` recebe ambas; superuser bypassa (já bypassa via Django).

**Refatorar** `apps/hymns/views.py:_can_edit_hymnbook` para uma função única `can_edit_hymnbook(user, hymnbook)` que retorna `True` se: `user.is_superuser` OR `user == hymnbook.owner_user` OR `user.has_perm('hymns.can_review_any_hymnbook')`. Análoga `can_publish_hymnbook(user, hymnbook)`.

**Testes (escrever primeiro)**:
- `test_editor_group_created_by_migration` — `Group.objects.get(name="editor")` existe e tem as duas permissions.
- `test_editor_can_edit_others_hymnbook` — usuário no grupo edita hinário de outro.
- `test_random_user_cannot_edit_others_hymnbook` — 403.
- `test_owner_can_edit_own_hymnbook` — comportamento atual preservado.
- `test_superuser_can_edit_any_hymnbook` — comportamento atual preservado.

**Arquivos**: `apps/hymns/models.py` (Meta.permissions), nova migration `apps/hymns/migrations/0008_editor_group_and_perms.py`, `apps/hymns/permissions.py` (novo módulo), `apps/hymns/views.py` (refactor de `_can_edit_hymnbook`).

#### Marco 1.2 — Estado de publicação do `HymnBook`

**Por quê**: hinário recém-cadastrado (especialmente via OCR) não pode aparecer na busca/listas até ser revisado e publicado.

**Modelo**:
- Adicionar `HymnBook.is_published: BooleanField(default=False)`.
- Adicionar `HymnBook.published_at: DateTimeField(null=True)` e `HymnBook.published_by: FK(User, null=True)` para trilha.
- Backfill: hinários existentes (`O Cruzeiro`, `O Justiceiro`) marcados como publicados automaticamente.

**Manager**: `HymnBook.objects.published()` retorna só publicados. `HymnBook.objects.visible_to(user)` retorna publicados + os que `user` pode editar (dono, editor, superuser).

**Aplicar filtro** em:
- `HymnBookListView.get_queryset` (`apps/hymns/views.py`).
- `home_view` (recent_hymnbooks).
- `search_view` — adicionar JOIN/filter para excluir hinos cujo `hymn_book` não está publicado para o usuário.

**Ações**:
- `publish_hymnbook_view` e `unpublish_hymnbook_view` (POST, login required, checa `can_publish_hymnbook`).
- Pré-condição para publicar: hinário deve estar **totalmente revisado** (Marco 1.4). Se não estiver, retorna 400 com mensagem.

**Testes**:
- `test_hymnbook_default_is_not_published`.
- `test_published_manager_excludes_unpublished`.
- `test_anonymous_user_does_not_see_unpublished_in_list`.
- `test_owner_sees_own_unpublished_in_list`.
- `test_search_excludes_hymns_from_unpublished_books_for_anon`.
- `test_publish_requires_full_review`.
- `test_publish_sets_timestamp_and_user`.
- `test_only_owner_or_editor_can_publish`.

**Arquivos**: `apps/hymns/models.py`, migration `0009_hymnbook_publication_state.py` (schema + backfill em `RunPython`), `apps/hymns/managers.py` (novo), `apps/hymns/views.py`, `apps/hymns/urls.py`.

#### Marco 1.3 — Estado de revisão por `Hymn` + trilha de auditoria

**Por quê**: revisão é granular. OCR é falível; cada hino precisa ser visto, possivelmente corrigido, e marcado como revisado. Precisamos saber quem fez o quê e quando.

**Modelo `Hymn`** (extensão):
- `review_status: CharField(choices=[NOT_REVIEWED, IN_REVIEW, REVIEWED], default=NOT_REVIEWED)`.
- `last_reviewed_at: DateTimeField(null=True)`.
- `last_reviewed_by: FK(User, null=True)`.
- `source: CharField(choices=[MANUAL, OCR, YAML], default=MANUAL)` — registra origem do cadastro para informar o estado inicial.

**Novo modelo `HymnRevision`** (`apps/hymns/models.py`):
- `id: UUID`, `hymn: FK(Hymn, on_delete=CASCADE, related_name="revisions")`.
- `revised_by: FK(User, null=True, on_delete=SET_NULL)`.
- `revised_at: DateTimeField(auto_now_add=True)`.
- `previous_status, new_status: CharField`.
- `change_summary: TextField(blank=True)` — texto livre opcional do revisor.
- `field_diff: JSONField(default=dict)` — snapshot dos campos alterados (`{"title": {"old": ..., "new": ...}, "text": {...}}`).
- Meta: `ordering = ["-revised_at"]`, index em `[hymn, -revised_at]`.

**Sinais**: `pre_save` em `Hymn` captura snapshot dos campos `title/text/repetitions/extra_instructions/style/received_at/offered_to`; `post_save` cria `HymnRevision` se algum campo mudou OU se `review_status` mudou. Cuidar para `loaddata`/migrações não dispararem (usar `kwargs.get('raw')` no `pre_save`).

**Estado inicial pelo `source`**:
- Hino criado via OCR (`apps/users/views.py:upload_preview_view` → `upload_confirm_view`) → `source=OCR, review_status=NOT_REVIEWED`.
- Hino criado via formulário web (`hymn_create_view`) → `source=MANUAL, review_status=NOT_REVIEWED` por padrão, com checkbox opcional "marcar como revisado já" (a UI de checkbox existente pode ser provisória).
- Hino criado via `manage.py import_yaml` → `source=YAML, review_status=NOT_REVIEWED` (opção `--mark-reviewed` no comando).

**Ação de revisão**: novo endpoint `POST /hinos/<uuid:pk>/revisar/` que: valida permissão (`can_edit_hymnbook` OU dono OU editor), aceita campos editáveis + `review_status` final, executa em transação, retorna 200 (ou redirect para próximo hino não revisado — ver Marco 1.5).

**Testes**:
- `test_hymn_default_review_status_is_not_reviewed`.
- `test_ocr_imported_hymn_starts_not_reviewed`.
- `test_yaml_imported_hymn_respects_mark_reviewed_flag`.
- `test_save_creates_revision_on_text_change`.
- `test_save_creates_revision_on_status_change`.
- `test_save_does_not_create_revision_when_nothing_changes`.
- `test_revision_records_user_and_diff`.
- `test_revise_endpoint_updates_status_and_creates_revision`.
- `test_revise_endpoint_requires_edit_permission`.
- `test_loaddata_does_not_create_revisions` (regression).

**Arquivos**: `apps/hymns/models.py`, migration `0010_hymn_review_state.py`, migration `0011_hymnrevision.py`, `apps/hymns/signals.py` (novo), `apps/hymns/apps.py` (conectar sinais em `ready()`), `apps/hymns/views.py` (novo `revise_hymn_view`), `apps/hymns/urls.py`, `apps/users/views.py` (passar `source=OCR` ao criar hinos no `upload_confirm_view`), `apps/hymns/management/commands/import_yaml.py` (flag `--mark-reviewed`).

#### Marco 1.4 — Progresso de revisão derivado em `HymnBook`

**Por quê**: precisamos ordenar/filtrar hinários por progresso e bloquear publicação até estar 100% revisado.

**API** (no model ou em `apps/hymns/services/review.py`):
- `HymnBook.review_progress` (property cacheada por instância): `{"total": int, "reviewed": int, "in_review": int, "pct": float}` derivado de `self.hymns.values("review_status")`. Uma única query agregada.
- `HymnBook.is_fully_reviewed` (property): `review_progress["reviewed"] == review_progress["total"] > 0`.
- Manager: `HymnBook.objects.with_review_progress()` faz `annotate` com `Count` condicional por status para listar/ordenar sem N+1.

**Pre-check no publish** (Marco 1.2): `publish_hymnbook_view` chama `is_fully_reviewed` antes de aprovar.

**Testes**:
- `test_review_progress_zero_when_no_hymns`.
- `test_review_progress_counts_reviewed_correctly`.
- `test_is_fully_reviewed_false_when_partial`.
- `test_with_review_progress_annotation_no_n_plus_1` (usar `assertNumQueries`).
- `test_publish_blocked_when_not_fully_reviewed` (já no Marco 1.2, mas amarrado aqui).

**Arquivos**: `apps/hymns/models.py`, `apps/hymns/managers.py`, `apps/hymns/services/review.py` (se a lógica crescer).

#### Marco 1.5 — Backend da fila de revisão do editor

**Por quê**: Fase 2 vai construir a tela do editor. A Fase 1 entrega os endpoints/querysets que essa tela vai consumir, validados por testes — assim o redesign foca só em UI.

**Endpoints/queries** (todos exigem `can_review_any_hymnbook` OU dono):
- `GET /editor/hinarios/` — lista hinários ordenáveis por: `?sort=least_reviewed` (default), `?sort=most_reviewed`, `?sort=recent`. Usa `with_review_progress` annotation. Renderiza com template **mínimo provisório** (lista bruta) — Fase 2 substitui.
- `GET /editor/hinarios/<slug>/` — lista hinos do hinário com `review_status`, ordenados por `number`.
- `GET /editor/hinarios/<slug>/proximo/` — retorna o próximo hino com `review_status != REVIEWED` (menor `number`). Redireciona para `/editor/hinos/<uuid>/revisar/`. Se não houver, redireciona para `/editor/hinarios/<slug>/?done=1`.
- `GET/POST /editor/hinos/<uuid>/revisar/` — formulário de edição completo com botões "Salvar e próximo", "Salvar e voltar", "Marcar como revisado". (Template provisório — Fase 2 reformula com pílulas e atalhos.)

**Testes**:
- `test_editor_queue_requires_permission`.
- `test_editor_queue_orders_by_least_reviewed_default`.
- `test_editor_queue_supports_most_reviewed_sort`.
- `test_next_unreviewed_returns_lowest_numbered`.
- `test_next_unreviewed_redirects_when_done`.
- `test_revise_endpoint_save_and_next_redirects_correctly`.

**Arquivos**: `apps/hymns/views.py` (views novas namespaceadas como `editor_*`), `apps/hymns/urls.py` (novo include `editor_urlpatterns`), `templates/hymns/editor/*.html` (templates **mínimos** apenas para serem chamados pelos testes e funcionar manualmente — Fase 2 reescreve).

#### Marco 1.6 — Provedor de OCR marca origem corretamente + suaviza erros

**Por quê**: garantir que o `source=OCR` se propaga e que a tela de preview deixa explícito que tudo entrará como `NOT_REVIEWED`.

**Mudanças**:
- `apps/users/views.py:upload_confirm_view` e `upload_preview_view`: ao criar `Hymn`, passar `source=Hymn.Source.OCR`.
- `apps/users/views.py:upload_view` quando criar hinário via OCR: `is_published=False` (já é default, mas explicitar).
- Adicionar mensagem informativa no template de preview (1 linha de copy, sem novo CSS).

**Testes**:
- `test_ocr_flow_creates_hymns_with_source_ocr` (integration test exercitando `upload_confirm_view`).
- `test_ocr_flow_creates_unpublished_hymnbook`.

**Arquivos**: `apps/users/views.py`, `templates/users/upload_preview.html` (mudança mínima de copy).

### Sequência de execução TDD da Fase 1

Ordem rígida (cada marco fecha verde antes do próximo):

1. Marco 1.1 — papel `editor` e refactor de permissões.
2. Marco 1.2 — estado de publicação.
3. Marco 1.3 — estado de revisão por hino + `HymnRevision`.
4. Marco 1.4 — progresso de revisão em `HymnBook` + amarração com Marco 1.2.
5. Marco 1.5 — endpoints da fila do editor.
6. Marco 1.6 — propagação do `source=OCR`.

Cada marco vira um commit (ou poucos commits) com testes verdes em `pytest`. Sem PRs intermediários a menos que solicitado.

### Verificação end-to-end da Fase 1

Manual, antes de declarar a fase concluída:

1. `poetry run pytest` — toda a suíte verde, incluindo os ~50 testes novos. Cobertura nos modelos/managers/serviços novos.
2. `poetry run python manage.py migrate` em DB limpo + DB com dados existentes (verificar backfill que marca `O Cruzeiro` e `O Justiceiro` como publicados e seus hinos com `source=YAML`).
3. Subir o servidor (`docker-compose up`), entrar como usuário comum e confirmar que vê apenas hinários publicados em `/hinarios/` e na busca.
4. Promover um usuário ao grupo `editor` via `manage.py shell` (`Group.objects.get(name="editor").user_set.add(u)`); confirmar acesso a `/editor/hinarios/`.
5. Subir um PDF novo via `/contribuir/`; confirmar que o hinário criado fica `is_published=False`, com todos os hinos `NOT_REVIEWED` e `source=OCR`.
6. Como editor, abrir `/editor/hinarios/<slug>/proximo/`, revisar 2-3 hinos (texto + status REVIEWED); confirmar que `HymnRevision` é criada com diff correto via Django Admin.
7. Tentar publicar com revisão parcial → erro. Completar revisão → publicação ok, hinário aparece para usuários comuns.

### Arquivos críticos da Fase 1 (consolidado)

- `apps/hymns/models.py` — `HymnBook.is_published/published_at/published_by`; `Hymn.review_status/last_reviewed_at/last_reviewed_by/source`; novo `HymnRevision`; `Meta.permissions` em `HymnBook`.
- `apps/hymns/managers.py` (novo) — `HymnBookQuerySet.published/visible_to/with_review_progress`.
- `apps/hymns/permissions.py` (novo) — `can_edit_hymnbook`, `can_publish_hymnbook`.
- `apps/hymns/signals.py` (novo) + `apps/hymns/apps.py` — auditoria via `pre_save`/`post_save` em `Hymn`.
- `apps/hymns/services/review.py` (se necessário) — funções auxiliares de progresso/fila.
- `apps/hymns/views.py` — refactor de permissões; novas views `publish_hymnbook_view`, `unpublish_hymnbook_view`, `revise_hymn_view`, e o conjunto `editor_*`.
- `apps/hymns/urls.py` — novas rotas e namespace `editor`.
- `apps/users/views.py` — propagação do `source=OCR` no fluxo de import.
- `apps/hymns/management/commands/import_yaml.py` — flag `--mark-reviewed`.
- Migrations novas: `0008_editor_group_and_perms.py`, `0009_hymnbook_publication_state.py`, `0010_hymn_review_state.py`, `0011_hymnrevision.py`.
- Templates **mínimos** em `templates/hymns/editor/*.html` (Fase 2 substitui).

---

## Fase 2 — Redesign de UI (Claude Design)

> Esta fase será executada pelo Claude Design com este plano + o repositório como contexto. Liberdade total para reescrever templates/CSS/JS. **Nada da UI atual precisa ser preservado.** Os contratos de URL, modelos, managers e endpoints definidos na Fase 1 são estáveis.

### Identidade visual

- Inspiração primária: PDF gerado por `/Users/nitai/dev/hyms-platform/hymn_pdf_generator/` (ReportLab + DejaVuSans). Layout 4×6", título em 14pt com filete horizontal, corpo 14pt com `leading` 16pt, barras de repetição como linhas verticais à esquerda (0.7pt), símbolos centralizados no fim do hino: ✡ (Estrela de Davi) na maioria, ☀ ☾ ★ a cada 3 hinos. Datas e estilo em 10pt.
- Definir paleta, tipografia (DejaVuSans ou alternativa web-friendly equivalente — Source Serif/Inter como fallbacks são ok desde que se mantenha o ar litúrgico/tipográfico).
- Logotipo/ícone, favicon, OG image.
- Decidir framework: Tailwind CSS é a recomendação (zero dependência de build atual, fácil acoplar via CDN ou django-tailwind). Opcional: HTMX + Alpine para interações sem SPA.

### Telas a redesenhar

1. **Layout base** (`base.html`) — header, nav, busca persistente, footer, modo escuro opcional.
2. **Home** — hero, busca grande, hinários em destaque, contadores.
3. **Lista de hinários** (`/hinarios/`) — cards visuais, cover image, contador de hinos, badge de status.
4. **Detalhe de hinário** (`/hinarios/<slug>/`) — manter como visão "índice" + adicionar **toggle de modo de leitura**:
   - **Modo Índice** (atual, redesenhado).
   - **Modo Leitura Contínua (PDF-like)** — todos os hinos um abaixo do outro, scroll vertical, separador igual ao do PDF, símbolo de fim de hino, usuário rola para o próximo. Snap-scroll opcional.
   - **Modo Carrossel** — um hino por vez, ocupando tela cheia em mobile. Tap/clique na metade direita avança, na esquerda volta. Setas em desktop. Indicador de posição (ex.: `12/45`) e gesture support (swipe).
   - O modo escolhido persiste em `localStorage` por hinário.
5. **Detalhe de hino** (`/hinos/<uuid>/`) — replicar a estética do PDF: tipografia, barras de repetição estilizadas, símbolos de fim, metadados (data, ofertado a, estilo, instruções) discretos. Áudio integrado ao layout, não em caixa destacada. Boa legibilidade em celular para usar durante trabalho.
6. **Busca** — resultados em cards melhores, com highlight do termo, filtro por hinário.
7. **Contribuir / Wizard de OCR** — passos visualmente claros (upload → processando → desambiguar → preview → confirmar), aproveitar o polling JSON do `OCRTask` já existente.
8. **Workspace do editor** (consome endpoints da Fase 1):
   - `/editor/hinarios/` — fila de hinários com barra de progresso de revisão, ordenação, filtros (publicados/não publicados, com OCR pendente, etc.).
   - `/editor/hinarios/<slug>/` — lista de hinos do hinário com estado, com botão "Revisar todos não revisados" (vai para `/editor/.../proximo/`).
   - `/editor/hinos/<uuid>/revisar/` — **tela otimizada para revisão rápida**: campos editáveis grandes, comparação com OCR original (se aplicável), pílulas/atalhos de teclado para "Marcar como revisado e avançar" (Enter), "Pular" (→), "Voltar" (←), "Salvar rascunho". Diff visual com a versão anterior consultando `HymnRevision`.
9. **Publicar/Despublicar hinário** — confirmação clara, mostra progresso de revisão como pré-condição.
10. **Perfil, login, signup, notificações** — visual coerente.

### Princípios para a Fase 2

- **Mobile-first**: a maioria dos usuários vai ler hinos no celular durante trabalhos.
- **Modo escuro acessível** — cores quentes baixas, evitar branco puro.
- **Acessibilidade**: contraste AA, navegação por teclado total no workspace do editor, ARIA nos toggles de modo de leitura e no carrossel.
- **Sem SPA**: continuar com Django templates + HTMX/Alpine onde precisar de interatividade leve. Carrossel pode ser Alpine + swipe lib mínima.
- **Performance**: minimizar JS, pré-renderizar conteúdo no servidor, lazy-load áudio e imagens grandes.
- **Imprimível**: `@media print` no detalhe de hino que reproduza fielmente o PDF.

### Contratos estáveis fornecidos pela Fase 1

- URLs do editor: `/editor/hinarios/`, `/editor/hinarios/<slug>/`, `/editor/hinarios/<slug>/proximo/`, `/editor/hinos/<uuid>/revisar/`.
- URLs de publicação: `POST /hinarios/<slug>/publicar/`, `POST /hinarios/<slug>/despublicar/`.
- Manager `HymnBook.objects.with_review_progress()` retornando annotations `total_hymns`, `reviewed_hymns`, `review_pct`.
- `Hymn.review_status` com choices `NOT_REVIEWED`, `IN_REVIEW`, `REVIEWED`.
- `HymnRevision` com `revised_by`, `revised_at`, `field_diff`, `change_summary`.
- Permissões `hymns.can_review_any_hymnbook`, `hymns.can_publish_hymnbook` no grupo `editor`.

---

## Notas finais

- O `Phase 4 (Deploy)` que estava deferred no projeto não é abordado aqui; segue deferred.
- Não introduzir Celery/TypeSense — orientação fixa do projeto (TypeSense foi removido em PR #5; OCR usa thread daemon por escolha).
- Antes de iniciar a Fase 1, criar um branch novo (sugestão: `feat/editorial-workflow`) — confirmar com usuário se isso encaixa no fluxo dele.

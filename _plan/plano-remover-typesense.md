# Plano: Remover TypeSense e usar apenas PostgreSQL FTS

**Data:** 2026-04-20
**Abordagem:** Test-Driven Development (Red → Green → Refactor)
**Prioridade:** Pós-Fase 4 (simplificação de infra)

---

## Contexto

O projeto usa **TypeSense** como índice de busca secundário, com PostgreSQL como source of truth. O TypeSense foi escolhido esperando escala grande, mas o volume real é minúsculo:

- **127 hinos** hoje, ~68 KB de texto total
- média 543 bytes/hino, máximo ~2 KB
- crescimento esperado: centenas, talvez milhares de hinos — jamais milhões

O preço pago pelo TypeSense:
- serviço Docker extra (~200 MB RAM, wait-for no CI)
- dual-write via signals → complexidade para manter em sync
- ~42 statements em `typesense_client.py` + 32 testes + management command
- risco de desincronização (gap que já tivemos que fechar com signals na Fase CRUD-web)

**PostgreSQL 16 oferece tudo que usamos** via FTS nativo + duas extensions (`pg_trgm`, `unaccent`):

| Feature TypeSense em uso | Equivalente Postgres |
|--------------------------|----------------------|
| Full-text + stemming | `to_tsvector` com config `portuguese` |
| Ranking de relevância | `ts_rank` |
| Typo tolerance | `pg_trgm` + `similarity()` |
| Busca sem acento | extension `unaccent` |
| Índice rápido | `GIN` index |

Django já expõe tudo via `django.contrib.postgres.search` — zero dependências extras.

**Resultado esperado:** single source of truth no Postgres, fim dos dual-writes, stack mais simples, CI mais rápido, funcionalidade equivalente.

---

## Escopo

**Incluído:**
- Habilitar extensions `pg_trgm` e `unaccent` via migration Django
- Campo `search_vector` denormalizado no `Hymn` + GIN index
- Signal que mantém o vector atualizado
- Reescrever `search_view` usando FTS + trigram
- Reescrever `suggest_similar_via_typesense` → `suggest_similar_via_trigram`
- Remover código, infra, settings, deps e testes do TypeSense
- Atualizar docker-compose, CI, docs, `.env.example`

**Fora do escopo:**
- Migração de facets (não estavam em uso)
- Autocomplete AJAX (podemos adicionar depois com `pg_trgm` se quisermos)
- Mudanças na UI/UX da busca (resultados renderizados no mesmo template)

---

## Tradeoffs assumidos

- **Typo tolerance mais fraca** que TypeSense (trigram < BK-tree). Aceitável para vocabulário limitado dos hinos.
- **Facets** exigiriam `GROUP BY` no Postgres (mais verboso, mas nunca foi usado na UI).

---

## Fases TDD

### Fase 1: Infra Postgres (Extensions + search_vector field)

**🔴 Red — `tests/unit/test_search_vector.py` (novo):**
- `test_pg_trgm_extension_enabled` (executa `SELECT 1 FROM pg_extension WHERE extname='pg_trgm'`)
- `test_unaccent_extension_enabled`
- `test_hymn_has_search_vector_field`
- `test_gin_index_exists_on_search_vector`

**🟢 Green:**
- Nova migration em `apps/hymns/migrations/`:
  ```python
  from django.contrib.postgres.operations import TrigramExtension, UnaccentExtension
  operations = [TrigramExtension(), UnaccentExtension(), ...]
  ```
- Adicionar ao modelo `Hymn`:
  ```python
  search_vector = SearchVectorField(null=True, blank=True)

  class Meta:
      indexes = [..., GinIndex(fields=["search_vector"])]
  ```
- Rodar `makemigrations` e `migrate`.

**Nota:** SQLite (test settings) não suporta essas extensions. Opções:
  a) Forçar Postgres nos tests de search → fixture `@pytest.mark.django_db(databases=["default"])` + override settings para Postgres de teste
  b) Skipar esses 4 testes com `pytest.mark.skipif` em SQLite
  c) Trocar test DB para Postgres (requer docker-compose rodando em CI)

Decisão recomendada: **opção c** — trocar test DB para Postgres. CI já tem Postgres service. Local: docker compose. Mais fiel à produção e permite testar FTS de verdade.

---

### Fase 2: Signal que popula search_vector

**🔴 Red — `tests/unit/test_search_vector_signal.py` (novo):**
- `test_creating_hymn_populates_search_vector`
- `test_updating_hymn_title_updates_vector`
- `test_updating_hymnbook_name_repopulates_all_children_vectors`
- `test_vector_uses_portuguese_config_for_stemming` (buscar "cantando" encontra "cantar")
- `test_vector_weights_title_higher_than_text` (match no título ranqueia mais que no texto)

**🟢 Green:**
Adicionar em `apps/hymns/signals.py` (substituindo os receivers de TypeSense):
```python
from django.contrib.postgres.search import SearchVector

def _compute_vector(hymn):
    return (
        SearchVector("title", weight="A", config="portuguese")
        + SearchVector("text", weight="B", config="portuguese")
        + SearchVector("hymn_book__name", weight="C", config="portuguese")
        + SearchVector("hymn_book__owner_name", weight="D", config="portuguese")
    )

@receiver(post_save, sender=Hymn)
def update_search_vector(sender, instance, **kwargs):
    Hymn.objects.filter(pk=instance.pk).update(search_vector=_compute_vector(instance))

@receiver(post_save, sender=HymnBook)
def repopulate_children_vectors(sender, instance, created, **kwargs):
    if created:
        return
    # Re-computar vector de todos os hinos deste hinário
    for hymn in instance.hymns.all():
        Hymn.objects.filter(pk=hymn.pk).update(search_vector=_compute_vector(hymn))
```

**Remover** os receivers antigos (`index_hymn`, `delete_hymn`) e imports do TypeSense.

**Backfill** dos hinos existentes: criar data migration que popula `search_vector` de todos os Hymns atuais.

---

### Fase 3: search_view reescrita

**🔴 Red — estender `tests/unit/test_hymn_views.py` (TestSearchView):**

Reescrever os 16 testes existentes de `TestSearchView` para validar o novo backend:
- `test_search_matches_title`
- `test_search_matches_text`
- `test_search_matches_hymnbook_name`
- `test_search_matches_owner_name`
- `test_search_ranks_title_match_higher`
- `test_search_handles_typo_via_trigram` (busca "luna" encontra "lua" com similarity)
- `test_search_empty_query_returns_no_results`
- `test_search_stemming_portuguese` (busca "cantar" encontra "cantando")
- `test_search_case_insensitive`
- `test_search_unicode_normalization` (busca "coracao" encontra "coração")
- `test_search_with_multiple_terms` (AND implícito)
- `test_search_with_phrase` (aspas)
- `test_search_pagination_limit_50`
- `test_search_whitespace_trimmed`
- `test_search_special_chars_escaped` (não quebra com `%`, `"`, etc.)
- `test_search_preserves_rank_order`

**🟢 Green — nova `search_view` em `apps/hymns/views.py`:**

```python
from django.contrib.postgres.search import SearchQuery, SearchRank, TrigramSimilarity
from django.db.models import F, Q

def search_view(request):
    query = request.GET.get("q", "").strip()
    if not query:
        return render(request, "hymns/search.html", {"query": "", "results": [], "total": 0})

    tsquery = SearchQuery(query, config="portuguese", search_type="websearch")
    results = (
        Hymn.objects
        .annotate(
            rank=SearchRank(F("search_vector"), tsquery),
            title_sim=TrigramSimilarity("title", query),
        )
        .filter(Q(search_vector=tsquery) | Q(title_sim__gt=0.2))
        .select_related("hymn_book")
        .order_by("-rank", "-title_sim")[:50]
    )
    results_list = list(results)
    return render(request, "hymns/search.html", {
        "query": query, "results": results_list, "total": len(results_list),
    })
```

**Remover** o import `from apps.search.typesense_client import search_hymns` e todo o try/except com fallback.

---

### Fase 4: Desambiguação

**🔴 Red — `tests/unit/test_disambiguation.py` (estender):**
- `test_suggest_similar_via_trigram_returns_close_matches`
- `test_suggest_similar_respects_threshold`
- `test_suggest_similar_ignores_accents` (busca "o cruzeiro" encontra "O Cruzeiro")
- `test_suggest_similar_empty_query_returns_empty_list`
- `test_suggest_similar_limit_respected`

**🟢 Green — reescrever em `apps/hymns/disambiguation.py`:**
```python
from django.contrib.postgres.search import TrigramSimilarity
from django.db.models.functions import Unaccent

def suggest_similar_via_trigram(query: str, limit: int = 5, threshold: float = 0.3):
    if not query.strip():
        return []
    return list(
        HymnBook.objects
        .annotate(sim=TrigramSimilarity(Unaccent("name"), Unaccent(Value(query))))
        .filter(sim__gt=threshold)
        .order_by("-sim")[:limit]
    )
```

**Renomear função** (deprecar a antiga): manter `suggest_similar_via_typesense` como alias que chama a nova até o próximo deploy, ou já renomear em todas as chamadas.

**Atualizar** `find_duplicates_with_content` se ela chamar a função antiga.

---

### Fase 5: Remoção do TypeSense

**🔴 Red — nenhum teste novo** (é pura remoção; a suite existente vai provar que nada quebrou).

**🟢 Green — remover:**

Arquivos deletados:
- `apps/search/typesense_client.py`
- `apps/search/management/commands/reindex_typesense.py`
- `tests/unit/test_typesense_client.py` (32 testes)
- `tests/unit/test_typesense_signals.py` → **renomear** para `test_search_vector_signal.py` e rescrever (Fase 2 já cobre)

Arquivos modificados:
- `docker-compose.yml` — remover service `typesense` e volume `typesense_data`
- `.github/workflows/ci.yml` — remover service `typesense` no E2E job
- `config/settings/base.py` — remover `TYPESENSE_HOST`, `TYPESENSE_PORT`, `TYPESENSE_PROTOCOL`, `TYPESENSE_API_KEY`
- `pyproject.toml` — remover dep `typesense = "^0.21"`
- `.env.example` — remover bloco TypeSense
- `apps/search/__init__.py` — pode manter (app pode ficar vazia ou ser removida)
- `tests/conftest.py` — remover fixture `mock_typesense_calls` (ou renomear/substituir)

**Decisão:** manter a app `apps.search` vazia por enquanto (caso queiramos voltar a isolar search logic), ou remover. Recomendo **remover** se nada sobrar nela.

Atualizar `tests/conftest.py`:
```python
# Remover o autouse mock de TypeSense
# A nova lógica usa Postgres nativo — não precisa mock
```

---

### Fase 6: Atualizar docs e plano

Arquivos a atualizar:
- `docs/developer-guide/architecture/overview.md` — remover menção ao TypeSense
- `docs/developer-guide/architecture/search-architecture.md` — reescrever para descrever Postgres FTS
- `docs/developer-guide/setup/docker-services.md` — remover seção TypeSense
- `docs/developer-guide/setup/environment-variables.md` — remover vars TYPESENSE_*
- `docs/developer-guide/api-reference/typesense-client.md` — deletar
- `docs/changelog.md` — entrada "Removido TypeSense, substituído por PostgreSQL FTS"
- `README.md` — se mencionar TypeSense
- `_plan/status-execucao.md` — nota histórica

---

## Arquivos a Criar/Modificar/Remover

### Novos
- `apps/hymns/migrations/00XX_enable_postgres_search.py` (extensions + search_vector field + GIN index)
- `apps/hymns/migrations/00XY_backfill_search_vectors.py` (data migration)
- `tests/unit/test_search_vector.py`
- `tests/unit/test_search_vector_signal.py`
- `docs/developer-guide/architecture/search-architecture.md` (reescrito)

### Modificados
- `apps/hymns/models.py` (+ search_vector field + GIN index)
- `apps/hymns/signals.py` (substituir receivers de TypeSense por search_vector update)
- `apps/hymns/views.py` (search_view reescrita)
- `apps/hymns/disambiguation.py` (suggest_similar_via_trigram)
- `apps/hymns/apps.py` (permanece igual — continua registrando signals)
- `config/settings/base.py` (remover TYPESENSE_*)
- `config/settings/test.py` (provavelmente mudar DB para Postgres)
- `pytest.ini` ou `conftest.py` (DB de teste em Postgres)
- `tests/conftest.py` (remover mock_typesense fixture)
- `tests/unit/test_hymn_views.py` (TestSearchView — atualizar 16 testes)
- `tests/unit/test_disambiguation.py` (atualizar testes afetados)
- `docker-compose.yml` (remover typesense service)
- `.github/workflows/ci.yml` (remover typesense service)
- `pyproject.toml` (remover dep typesense)
- `.env.example` (remover vars TYPESENSE_*)
- Docs listados na Fase 6

### Removidos
- `apps/search/typesense_client.py`
- `apps/search/management/commands/reindex_typesense.py`
- `tests/unit/test_typesense_client.py`
- `tests/unit/test_typesense_signals.py` (substituído por test_search_vector_signal.py)
- `docs/developer-guide/api-reference/typesense-client.md`
- (avaliar) app `apps.search` se ficar vazia

---

## Padrões Reusados

- `django.contrib.postgres.search.{SearchVector,SearchQuery,SearchRank,TrigramSimilarity}` — Django nativo
- `django.contrib.postgres.operations.{TrigramExtension,UnaccentExtension}` — Django nativo
- `django.contrib.postgres.indexes.GinIndex` — Django nativo
- Padrão de signals existente em `apps/hymns/signals.py` (substituir receivers, manter estrutura)
- Fixtures `hymn_factory`, `hymn_book_factory` em `tests/conftest.py`

---

## Verificação End-to-End

### 1. Testes unitários
```bash
cd /Users/nitai/dev/hyms-platform/hymns-plat
poetry run pytest tests/unit/ -v
poetry run pytest tests/unit/ --cov=apps --cov-report=term-missing
```
Esperado: toda a suite passando, coverage não regride.

### 2. Teste manual da busca
Com docker compose rodando e servidor em `:8001`:
- `/busca/?q=lua branca` → resultado "Lua Branca" ranking 1
- `/busca/?q=luna branca` → mesmo resultado via trigram
- `/busca/?q=cantando` → encontra hinos com "cantar", "canta" (stemming PT)
- `/busca/?q=coracao` → encontra hinos com "coração" (unaccent)
- `/busca/?q=virgem maria` → encontra hinos com ambas palavras
- Busca por nome do hinário, dono, texto completo

### 3. Teste de edição propaga para busca
- Editar título de um hino → buscar pelo novo título imediatamente → aparece (signal funcionou)
- Deletar hino → buscar → não aparece mais (sem órfãos, não precisa mais de `delete_hymn` stub)
- Editar nome do hinário → busca pelos hinos filhos usando o novo nome → aparece (signal repopula)

### 4. Desambiguação
- Upload de "O Cruzero" (typo proposital) → deve sugerir "O Cruzeiro" como duplicata

### 5. Confirmar que TypeSense sumiu
```bash
docker compose ps  # sem container hymnplat-typesense
grep -r "typesense" apps/ config/ docker-compose.yml  # sem matches
poetry show typesense  # "No package named 'typesense'"
```

### 6. CI verde
Commits → PR → lint + unit + e2e verdes sem service TypeSense no workflow.

---

## Critérios de Conclusão

- [ ] Migration aplicada localmente e em CI
- [ ] Signal popula/atualiza search_vector corretamente
- [ ] `search_view` retorna resultados equivalentes ou melhores que o TypeSense para os 127 hinos atuais
- [ ] Desambiguação funciona com typo e sem acento
- [ ] Todos os 341 testes atuais continuam passando (ajustados)
- [ ] `docker-compose ps` não lista mais typesense
- [ ] `pyproject.toml` não tem mais dep `typesense`
- [ ] Docs atualizadas
- [ ] CI verde sem service TypeSense

---

## Estimativa

- **Esforço:** 1 dia de trabalho focado
- **Risco:** baixo (PostgreSQL FTS é maduro; fallback já existia e funcionava)
- **Reversibilidade:** alta (podemos restaurar via `git revert` se precisarmos)

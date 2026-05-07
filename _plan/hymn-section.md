# Plano: campo `section` em `Hymn` — suporte a hinários multi-seção

## Contexto

Hinários do Nossa Irmandade como **Firmado na Luz** (`/hinario/47/FirmadoNaLuz`) são divididos em seções nomeadas (`<div class="hinario-section-name">{nome}</div>`), cada uma com seu próprio bloco de hinos. Ex.:

```
[Offered to Sônia Palhares] ← seção da patrona (4 hinos)
[Firmado na Luz]            ← corpo principal (70 hinos)
```

Hoje o scraper já produz numeração sequencial global 1..N (correção de 2026-05-06, commit `257c13e`) — mas **descarta o nome da seção**. A plataforma `hymns-plat` também não tem onde armazenar essa informação. Resultado: usuários perdem a estrutura semântica do hinário ("hino 3 da Sônia Palhares").

Esta PR introduz o campo `Hymn.section` na plataforma, propaga `section:` no YAML do scraper, e mostra agrupamento por seção no índice do hinário. Decisões confirmadas:

- **UI**: só no `?mode=indice` (cabeçalho da seção entre blocos) + meta-row no detalhe individual quando `section` preenchida. Carrossel/corrido permanecem flat (número global).
- **Reimport**: re-roda `import_yaml --update` em prod pra preencher `section` retroativamente em Firmado na Luz (custo: re-upload de 134 MB pro R2; áudios voltam pra `is_approved=False` e a gente bulk-aprova de novo).
- **Constraint**: mantém `unique_together = [["hymn_book", "number"]]`. `section` é metadata texto livre, não compõe chave.

## Repos afetados

### Repo 1: `hymns-scraper` (lança primeiro)

#### Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `src/hymns_scraper/models.py` | `HymnRef.section: str \| None = None`; `Hymn.section: str \| None = None` |
| `src/hymns_scraper/portals/nossairmandade.py` | `parse_index` itera filhos do container, mantém estado `current_section` que muda quando encontra `<div class="hinario-section-name">`. Cada `<div class="hymn-list-name">` carrega o `current_section` no `HymnRef.section`. `parse_hymn` recebe e propaga via `Hymn.section`. |
| `src/hymns_scraper/yaml_writer.py` | Emite `section: ...` (após `number`) só quando preenchido. Não emite `section:` para hinários single-section (continua compatível). |
| `src/hymns_scraper/cli.py` | Passa `section=ref.section` ao chamar `parse_hymn(...)` ou similar (ponto de cola). |
| `tests/fixtures/firmado-na-luz-index.html` | **Nova fixture** — snapshot do índice de Firmado na Luz com 2 seções. |
| `tests/test_nossairmandade_parser.py` | Caso `test_parse_index_groups_hymns_by_section` validando `refs[0..3].section == "Offered to Sônia Palhares"` e `refs[4..73].section == "Firmado na Luz"`. Caso `test_parse_index_returns_no_section_for_single_section_hinario` (Cruzeiro) garante `refs[i].section is None`. |
| `tests/test_yaml_writer.py` | Caso `test_dump_emits_section_when_present`; caso `test_dump_omits_section_when_none` (compat backward). |

#### Lógica do parser

O DOM tem (por amostra do `curl`):

```html
<div class="col-sm-5 col-md-5 col-lg-5">
  <div class="hinario-section-name">Offered to Sônia Palhares</div>
  <div class="hymn-list-name"><a>1. Firmado Na Luz</a></div>
  <div class="hymn-list-name"><a>2. Canto De União</a></div>
  ...
  <div class="hinario-section-name">Firmado na Luz</div>
  <div class="hymn-list-name"><a>1. Agradecimento</a></div>
  ...
</div>
```

Algoritmo: `for child in tree.css("div.hinario-section-name, div.hymn-list-name")` em ordem do documento. Se class é `hinario-section-name`, atualiza `current_section`. Se `hymn-list-name`, cria `HymnRef(section=current_section, ...)`.

### Repo 2: `hymns-plat` (após merge do scraper)

#### Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `apps/hymns/models.py` (linha ~175) | Adiciona `section = models.CharField("Seção", max_length=200, blank=True, default="", help_text="Subgrupo dentro do hinário (ex.: 'Offered to Sônia Palhares')")` após `repetitions`. |
| `apps/hymns/migrations/0015_hymn_section.py` | **Nova migration** — `AddField` simples, sem `RunPython` (segue padrão das migrations 0011-0014). |
| `apps/hymns/management/commands/import_yaml.py` (linha ~191) | Adiciona `section=hymn_data.get("section", "").strip()` aos kwargs de `Hymn.objects.create(...)` em `_create_hymn`. |
| `apps/hymns/forms.py` (linha ~45) | Adiciona `"section"` aos `HymnForm.Meta.fields` (após `"offered_to"`); label "Seção"; widget `TextInput` com placeholder. |
| `templates/hymns/hymnbook_detail.html` (modo indice, linhas 83-111) | Loop muda de `{% for h in hymns %}` flat pra `{% regroup hymns by section as section_groups %}{% for group in section_groups %}` — emite `<h3 class="section-header">{{ group.grouper }}</h3>` quando `group.grouper` é truthy. Carrossel/corrido permanecem como hoje. |
| `templates/hymns/hymn_detail.html` (linhas 38-40 ou 77-80) | Em `<dl>` da sidebar de Details, adiciona `{% if h.section %}<dt>Seção</dt><dd>{{ h.section }}</dd>{% endif %}`. |
| `tests/unit/test_hymn_models.py` | `test_hymn_section_default_blank`; `test_hymn_section_does_not_affect_unique_together`. |
| `tests/unit/test_import_yaml_command.py` (ou novo `test_import_yaml_section.py`) | YAML com `section:` por hino → `Hymn.section` preenchido; YAML sem campo → `section == ""`. |
| `tests/unit/test_hymnbook_modes.py` | `test_indice_groups_by_section_when_present` (Firmado na Luz YAML fixture com 2 seções → template tem 2 `<h3 class="section-header">`); `test_indice_does_not_render_section_header_when_all_blank` (compat, single-section continua sem header). |
| `tests/unit/test_hymn_forms.py` | `"section"` em `HymnForm.Meta.fields`. |

#### Considerações de modelo

- **default=""** (não `null=True`): Django convenção pra `CharField`. Evita `None` no template.
- Sem `db_index`: filtros/ordering por `section` não são caso de uso atual. Pode adicionar depois sem migração custosa.
- `unique_together` permanece `[["hymn_book", "number"]]` — `section` não compõe chave.
- `Meta.ordering = ["hymn_book", "number"]` permanece. O `regroup` do template já cuida de manter seções juntas (porque hinos da mesma seção têm números consecutivos no YAML do scraper).

## Ordem de execução (TDD)

1. **Scraper RED → GREEN**:
   - Salvar fixture `firmado-na-luz-index.html` (`curl -sSL 'https://nossairmandade.com/hinario/47/FirmadoNaLuz'`).
   - Escrever testes RED do parser (multi-section + single-section compat).
   - Escrever testes RED do yaml_writer.
   - Implementar GREEN: dataclass + parser + yaml_writer + cli.
   - Lint, push, PR, auto-merge.
2. **Plataforma RED → GREEN** (worktree `feat-hymn-section`):
   - Migration `0015_hymn_section.py` + model field.
   - Tests RED: model + import_yaml + form + indice template.
   - Implementar GREEN: import_yaml param, HymnForm field, hymnbook_detail.html `regroup`, hymn_detail.html meta.
   - Lint, push, PR, auto-merge.
3. **Reimport produção** (após deploy automático):
   - Re-scrape Firmado na Luz com novo scraper (gera YAML com `section:`).
   - `import_yaml --update` apontando pro novo YAML — cascade deleta os 74 hinos antigos + 74 áudios; recria + reimporta MP3s do disco local.
   - `backfill_audio_waveforms` regenera waveforms.
   - Bulk-approve dos 74 áudios + republicar (se `is_published` voltar a False — verificar comportamento de `--update`).

## Verificação ponta-a-ponta

```bash
# 1. Scraper local
cd /Users/nitai/dev/hyms-platform/hymns-scraper
uv run pytest -q
uv run hymns-scraper scrape --portal nossairmandade \
  --url https://nossairmandade.com/hinario/47/FirmadoNaLuz \
  --out ./out/firmado-na-luz --skip-audio
grep -E '^      section:' out/firmado-na-luz/hymnbook.yaml | sort -u
# espera: "Firmado na Luz" e "Offered to Sônia Palhares"

# 2. Plataforma local
cd /Users/nitai/dev/hyms-platform/feat-hymn-section
DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest tests/unit/ -q
DJANGO_SETTINGS_MODULE=config.settings.local uv run python manage.py migrate
DJANGO_SETTINGS_MODULE=config.settings.local uv run python manage.py import_yaml \
  /Users/nitai/dev/hyms-platform/hymns-scraper/out/firmado-na-luz/hymnbook.yaml --update
DJANGO_SETTINGS_MODULE=config.settings.local uv run python manage.py runserver 8000
# abrir http://localhost:8000/hinarios/firmado-na-luz/?mode=indice
# espera: 2 cabeçalhos "Offered to Sônia Palhares" e "Firmado na Luz" agrupando blocos de hinos.

# 3. Round-trip prod
cd /Users/nitai/dev/hyms-platform/hymns-plat
set -a && source .env && set +a
DB_URL=$(railway variables -s Postgres --kv | grep '^DATABASE_PUBLIC_URL=' | sed 's/^DATABASE_PUBLIC_URL=//')
DATABASE_URL="$DB_URL" DJANGO_DEBUG=False DJANGO_ALLOWED_HOSTS='*' \
  SECURE_SSL_REDIRECT=False DJANGO_SETTINGS_MODULE=config.settings.production \
  uv run python manage.py import_yaml \
  /Users/nitai/dev/hyms-platform/hymns-scraper/out/firmado-na-luz/hymnbook.yaml --update --dry-run
# verifica: 74 hinos com section preenchida.
# Depois roda sem --dry-run, backfill_audio_waveforms, publish + bulk approve audios.
curl -sSf https://hinaria.com.br/hinarios/firmado-na-luz/?mode=indice | grep -c 'section-header'
# espera: 2
```

## Riscos e mitigações

- **`--update` cascade**: derruba HymnRevision e revisões. Os 74 áudios já aprovados em prod voltam a `is_approved=False` (porque são `HymnAudio` recriados). Mitigação: rodar bulk-approve novamente após o reimport (mesmo padrão usado em PR #36 conforme memória).
- **Republicação**: `--update` preserva `is_published`/`published_at`/`published_by` do `HymnBook` (só os hinos são re-criados). Confirmar comportamento exato antes; se necessário, republicar via shell.
- **Layout do índice**: agrupamento adiciona `<h3>` entre blocos. Single-section hinários (Cruzeiro etc.) **não** mostram cabeçalho (o `regroup` produz 1 grupo com `grouper == ""`, e o template só renderiza `<h3>` quando `grouper` é truthy). Sem regressão visual nos hinários antigos.
- **Migration em produção**: `AddField` com `default=""` é não-bloqueante em Postgres. Sem downtime.
- **Carrossel/corrido**: permanecem flat. Pode-se evoluir em PR futura adicionando "breadcrumb da seção" no slide do carrossel.

## Arquivos novos (resumo)

| Repo | Path | Propósito |
|---|---|---|
| scraper | `tests/fixtures/firmado-na-luz-index.html` | Snapshot multi-seção pra testes |
| platform | `apps/hymns/migrations/0015_hymn_section.py` | AddField nullable/blank |
| platform (talvez) | `tests/unit/test_import_yaml_section.py` | Cobertura específica do campo (ou agregar em test_import_yaml_command.py) |

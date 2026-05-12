# Plano: hinários multi-seção (campo `section_name` no `Hymn`)

## Contexto

O Nossa Irmandade organiza alguns hinários em seções nomeadas — `<div class="hinario-section-name">`. Exemplo encontrado: **Firmado na Luz** (id 47) tem 2 seções:

```
[Offered to Sônia Palhares]    ← 4 hinos numerados 1..4
  1. Firmado Na Luz
  2. Canto De União
  3. As Três Faces Do Poder
  4. Divina Concepção

[Firmado na Luz]                ← 70 hinos numerados 1..70
  1. Agradecimento
  2. Horizonte
  ...
```

**Hoje** o scraper achata as seções e renumera 1..N (fix temporário em `nitaibezerra/hymns-scraper@257c13e`). Resultado: a estrutura semântica do hinário (a dedicatória da patrona vs. corpo principal) é **perdida** no momento da raspagem. Compilações futuras com mais subdivisões (hinários "de Concentração" + "de Festa", missas, terçaços, etc.) sofreriam o mesmo achatamento.

**Queremos** preservar a seção como metadado do hino, ainda mantendo o `Hymn.number` global (1..N) pra compatibilidade com a numeração já em prod e pra simplificar consultas/permalinks. Ganhamos:

- Listagem do hinário renderiza headers de seção como na fonte;
- Editor pode reorganizar/renomear seções pelo painel;
- Modelo aceita YAMLs de qualquer portal/origem que tenha agrupamento — futuro-proof.

## Decisões

- **Campo simples no `Hymn`** (não modelo `HymnSection` separado). `Hymn.section_name: CharField(max_length=255, blank=True, db_index=True)`. A normalização em modelo separado é tentadora mas adiciona complexidade (joins, ordering, migrações de seção), e a UI atual não precisa de seção como entidade de primeiro grau.
- **`Hymn.number` permanece único por `(hymn_book, number)`** — sem mudança de constraint. Mantém URLs/ordering/queries existentes intactos.
- **Ordem das seções vem da ordem de `number`**: a primeira ocorrência de cada `section_name` define a posição da seção. Sem campo `section_order` extra; `min(number)` por seção é suficiente.
- **Backward-compat**: hinos antigos ficam com `section_name=""` (fora de seção). Templates só renderizam header quando `section_name` muda; sem section, comportamento atual preservado.
- **YAML schema**: campo opcional `section: <str>` por hino. Ausência = sem seção. Compatível com YAMLs antigos (campo desconhecido = `""`).
- **Scraper**: parser captura `<div class="hinario-section-name">` e atribui ao último visto a cada hino subsequente. Hinos antes do primeiro `hinario-section-name` ficam com `section=""`.

## Mudanças

### A. `hymns-plat`

#### A.1. Migration + modelo (`apps/hymns/models.py`)

Adicionar a `Hymn`:

```python
section_name = models.CharField(
    "Seção",
    max_length=255,
    blank=True,
    db_index=True,
    help_text="Agrupamento dentro do hinário (ex.: 'Oferecido a X'). Vazio = fora de seção.",
)
```

Migration: `0XXX_hymn_section_name.py` — `AddField`, default vazio. Sem backfill (todos os hinos atuais ficam sem seção, comportamento idêntico ao de hoje).

`Meta.indexes` ganha `models.Index(fields=["hymn_book", "section_name", "number"])` — útil para a query agrupada do template.

#### A.2. `import_yaml.py`

```python
hymn = Hymn.objects.create(
    ...,
    section_name=hymn_data.get("section", "").strip(),
)
```

Preview do `--dry-run` sumariza seções:

```
First 5 hymns:
  [Oferecido a Sônia Palhares]
    1. Firmado Na Luz (valsa)
    2. Canto De União (...)
  [Firmado na Luz]
    5. Agradecimento
```

#### A.3. `views.py` + `templates/hymns/hymnbook_detail.html`

`HymnBookDetailView.get_context_data`:

```python
from itertools import groupby
hymns = list(self.object.hymns.order_by("number"))
context["hymn_groups"] = [
    (section, list(items))
    for section, items in groupby(hymns, key=lambda h: h.section_name)
]
```

Template index/corrido renderiza `{% if section %}<h3>{{ section }}</h3>{% endif %}` antes de cada grupo. Template carrossel ignora `section_name` (não cabe no fluxo de slide-único).

#### A.4. Editor (`apps/hymns/editor_views.py` + form)

`HymnForm` ganha campo `section_name` (text input livre, com datalist sugerindo seções já existentes no hinário). Não-disruptivo — opcional.

#### A.5. Testes (TDD)

- `tests/unit/test_hymn_sections.py`:
  - `test_hymn_can_have_section_name`
  - `test_hymn_without_section_name_defaults_to_empty`
  - `test_hymnbook_detail_groups_hymns_by_section`
  - `test_hymnbook_detail_renders_section_headers_only_when_present`
  - `test_hymnbook_detail_no_section_renders_flat_list` (regressão zero pra hinários atuais)
- `tests/unit/test_import_yaml_audios.py` (novo cycle):
  - `test_yaml_with_section_field_populates_hymn_section_name`
  - `test_yaml_without_section_field_leaves_section_name_empty`

### B. `hymns-scraper`

#### B.1. `models.py`

```python
@dataclass
class HymnRef:
    number: int
    title: str
    url: str
    section: str = ""

@dataclass
class Hymn:
    ...
    section: str = ""
```

#### B.2. `portals/nossairmandade.py::parse_index`

Iterar nodes filhos da coluna principal em ordem e manter um `current_section`:

```python
container = tree.css_first("div.col-sm-5.col-md-5.col-lg-5") or tree
current_section = ""
for node in container.iter():
    cls = (node.attributes.get("class") or "")
    if "hinario-section-name" in cls:
        current_section = node.text().strip()
    elif "hymn-list-name" in cls:
        a = node.css_first("a")
        if a is None:
            continue
        ...
        refs.append(HymnRef(number=position, title=title, url=href, section=current_section))
```

Observação: `selectolax`'s `Node.iter()` percorre filhos diretos. Verificar API — pode ser que precise de busca recursiva via `css()` mantendo ordem do documento. Solução robusta: `tree.css(".hinario-section-name, .hymn-list-name")` retorna em ordem do documento; iterar e classificar por classe.

#### B.3. `yaml_writer.py::dump_hymnbook`

Quando `hymn.section` não-vazio, emitir `section: <valor>` no YAML do hino.

#### B.4. Testes (TDD)

- `test_nossairmandade_parser.py`:
  - `test_parse_index_assigns_section_name_to_hymns_in_section` (fixture multi-seção do Firmado na Luz)
  - `test_parse_index_leaves_section_empty_for_single_section_hinarios` (regressão zero)
- `test_yaml_writer.py`:
  - `test_dump_includes_section_when_hymn_has_one`
  - `test_dump_omits_section_when_empty`

Salvar fixture `tests/fixtures/firmado-na-luz-index.html` (já temos a página crua via `curl`).

## Re-import do Firmado na Luz

Após PR mergeada e deploy:

```bash
cd /Users/nitai/dev/hyms-platform/hymns-scraper
uv run hymns-scraper scrape --portal nossairmandade \
  --url 'https://nossairmandade.com/hinario/47/FirmadoNaLuz' \
  --out ./out/firmado-na-luz-v2 --rate-limit-ms 200
sed -i.bak "s/^  owner: ''$/  owner: Sônia Palhares/" ./out/firmado-na-luz-v2/hymnbook.yaml

cd /Users/nitai/dev/hyms-platform/hymns-plat
# wrapper de prod (DATABASE_URL + AWS_*)
... uv run python manage.py import_yaml \
  /Users/nitai/dev/hyms-platform/hymns-scraper/out/firmado-na-luz-v2/hymnbook.yaml --update
... uv run python manage.py backfill_audio_waveforms
```

`--update` deleta os hinos antigos do "Firmado na Luz" (cascade derruba HymnAudios e arquivos do R2 — verificar se cascade R2 funciona; senão, limpar manualmente os MP3s antigos antes ou aceitar o lixo no bucket).

## Verificação ponta-a-ponta

```bash
# hymns-plat
uv run black --check . && uv run isort --check-only . && uv run ruff check .
DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest tests/unit/ -q
# Visual local
uv run python manage.py runserver
# /hinarios/firmado-na-luz/ deve mostrar 2 grupos com headers de seção

# hymns-scraper
uv run pytest && uv run ruff check .
```

## Riscos e considerações

- **Cascade no R2**: `Hymn` deletado dispara cascade no `HymnAudio`, mas `S3Boto3Storage` não deleta o arquivo automaticamente (Django só apaga a referência). Lixo no R2 é tolerável a curto prazo; longo prazo, escrever um signal `pre_delete` que chama `audio_file.delete(save=False)`.
- **Numeração global vs. exibida**: o número 1 da seção "Oferecido a Sônia Palhares" agora será o `Hymn.number=1` global (não há colisão com a próxima seção, pois os de "Firmado na Luz" começam em 5). Se um daimista cita "hino 3 da seção da patrona", a equivalência fica preservada por número global. Bom o suficiente.
- **Sem PR de "section_order"**: confiamos na ordem dos `number` — primeira aparição de cada seção define posição. Se editor renumera, ordem das seções pode mudar. Se virar problema, adicionar campo dedicado depois.

## Arquivos a modificar (resumo)

### hymns-plat (`/Users/nitai/dev/hyms-platform/feat-hymn-sections`)

| Arquivo | Mudança |
|---|---|
| `apps/hymns/models.py` | `Hymn.section_name = CharField(...)` + index composto |
| `apps/hymns/migrations/0XXX_hymn_section_name.py` | AddField |
| `apps/hymns/management/commands/import_yaml.py` | Lê `section:` do YAML |
| `apps/hymns/views.py` | `HymnBookDetailView` agrupa por seção |
| `templates/hymns/hymnbook_detail.html` | Renderiza headers de seção (índice + corrido) |
| `apps/hymns/forms.py` (se existir) | Campo opcional no editor |
| `tests/unit/test_hymn_sections.py` | Suíte nova |
| `tests/unit/test_import_yaml_audios.py` | 2 novos cycles |
| `_plan/hymn-sections.md` | Este plano |

### hymns-scraper (`/Users/nitai/dev/hyms-platform/hymns-scraper`)

| Arquivo | Mudança |
|---|---|
| `src/hymns_scraper/models.py` | `HymnRef.section`, `Hymn.section` |
| `src/hymns_scraper/portals/nossairmandade.py` | `parse_index` captura `hinario-section-name` |
| `src/hymns_scraper/yaml_writer.py` | Emite `section:` quando não-vazio |
| `tests/test_nossairmandade_parser.py` | 2 novos casos |
| `tests/test_yaml_writer.py` | 2 novos casos |
| `tests/fixtures/firmado-na-luz-index.html` | Fixture multi-seção |

## PR + deploy

- `hymns-plat`: branch `feat/hymn-sections` → PR → CI verde → squash merge → auto-deploy
- `hymns-scraper`: branch `feat/sections` → push direto (repo solo, sem CI strict)
- Re-import Firmado na Luz após ambos no ar

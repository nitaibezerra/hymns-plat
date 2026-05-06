# Plano: `import_yaml` importa também os áudios

## Contexto

O comando `apps/hymns/management/commands/import_yaml.py` cria `HymnBook` + `Hymn` a partir de um YAML, mas **ignora o campo `audios:`** (extensão fora-do-schema gerada hoje pelo `hymns-scraper`). Pra importar áudios o playbook atual recorre a comandos one-off (ex.: `import_justiceiro_audios`) por hinário.

Acabamos de produzir um YAML do `hymns-scraper` (`out/cruzeiro-full/hymnbook.yaml`) que traz, por hino com gravação:

```yaml
audios:
  - path: audios/001.mp3
    source: Montreal 2008 with Padrinho Alfredo & Mapia Comitiva
```

Queremos que o `import_yaml` consuma esse campo e crie um `HymnAudio` por entrada — sem precisar de comando separado.

## Decisões

- **Auto-detect**: se um hino tem `audios:` não-vazio E o arquivo existe, importa. Ausência de `audios:` ou lista vazia = comportamento atual (no-op). Backward-compatible.
- **Opt-out**: `--skip-audios` pula áudios mesmo se presentes (caso o usuário queira só letra).
- **Idempotência**: se o hino já tem **qualquer** `HymnAudio`, pula. Mesmo critério do `import_justiceiro_audios`. Re-imports puros (`--update`) deletam hinos antigos junto com áudios via cascade (`on_delete=CASCADE`), então a idempotência só se aplica em re-runs sem `--update`.
- **Path relativo**: `path:` é resolvido relativo ao **diretório do YAML**, não ao CWD. Path absoluto também aceito.
- **Owner**: `--owner-username USER` (default `nitai`, mesmo padrão do `import_justiceiro_audios`).
- **Aprovação**: `is_approved=False` (editor revisa em `/editor/audios/`). `--mark-audios-approved` marca como aprovado direto (análogo a `--mark-reviewed`).
- **Arquivo faltando**: warning + continua (não aborta o import inteiro). Hino fica sem áudio nesse caso.
- **Storage**: usa o backend default do Django (`STORAGES["default"]`) — em prod = R2 via `S3Boto3Storage`, em dev = filesystem. `audio_file.save(filename, ContentFile(data), save=False)` com nome `f"{hymn.number:03d}.mp3"`.

## Mudanças

### 1. `apps/hymns/management/commands/import_yaml.py`

- Novo argumento `--skip-audios` (default `False` — importa quando presente).
- Novo argumento `--owner-username USER` (default `"nitai"`).
- Novo argumento `--mark-audios-approved`.
- `_create_hymn` retorna o `Hymn` criado (já retorna).
- Novo método `_create_audios(hymn, hymn_data, yaml_dir, owner_user, mark_approved)`:
  - Se `audios` ausente/vazio → skip.
  - Se `hymn.audios.exists()` → skip + warning ("já tem áudio").
  - Pra cada entry: resolve path, abre arquivo, cria `HymnAudio` com `source=label`, `format="MP3"`, `is_approved=mark_approved`, `uploaded_by=owner_user`, `file_size=len(data)`. Falha silenciosa em arquivo missing.
- `handle()`: resolve `yaml_dir = Path(yaml_file).parent`; carrega `owner_user` do username; chama `_create_audios` no loop principal.
- `_preview_import`: mostra contagem de áudios que serão importados (info pro usuário).

### 2. Testes (`tests/unit/test_import_yaml_audios.py` — arquivo novo)

TDD-first, fixtures sintéticas (sem rede, sem dependência do scraper):

1. `test_yaml_without_audios_field_is_noop` — comportamento legado intocado.
2. `test_yaml_with_audios_creates_hymn_audio_records` — 1 hino, 1 audio entry, arquivo MP3 fake → `HymnAudio` criado, `source` = label, `format="MP3"`, `is_approved=False`.
3. `test_audio_path_resolved_relative_to_yaml_file` — YAML em subdir; path `audios/001.mp3` aponta pro arquivo na mesma estrutura.
4. `test_skip_audios_flag_omits_audio_creation` — `--skip-audios` ignora o campo.
5. `test_idempotent_skips_hymns_with_existing_audio` — pré-cria HymnAudio; re-import não duplica.
6. `test_missing_audio_file_warns_and_continues` — path inválido → warning, hino continua sem áudio, outros hinos continuam.
7. `test_mark_audios_approved_sets_is_approved_true` — flag funciona.
8. `test_owner_username_assigns_uploaded_by` — `uploaded_by` populado.
9. `test_dry_run_does_not_create_audios` — `--dry-run` continua só preview.

Arquivos de teste usam `tmp_path`+`pytest.fixture` pra construir YAML+MP3 fake numa pasta temporária. Sem mocks.

## Verificação ponta-a-ponta

```bash
cd /Users/nitai/dev/hyms-platform/feat-import-yaml-audios

uv run black --check . && uv run isort --check-only . && uv run ruff check .
DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest tests/unit/test_import_yaml_audios.py -v

# Smoke local com o YAML do scraper
DJANGO_SETTINGS_MODULE=config.settings.local uv run python manage.py import_yaml \
  /Users/nitai/dev/hyms-platform/hymns-scraper/out/cruzeiro-full/hymnbook.yaml --dry-run
# (preview deve mostrar quantos áudios)

# Sem --dry-run: cria 130 hinos + 129 HymnAudio em dev DB
DJANGO_SETTINGS_MODULE=config.settings.local uv run python manage.py import_yaml \
  /Users/nitai/dev/hyms-platform/hymns-scraper/out/cruzeiro-full/hymnbook.yaml
```

## PR + deploy

- Branch: `feat/import-yaml-audios`
- PR title: `feat(import_yaml): importa também os áudios do YAML`
- `gh pr merge --auto --squash` imediatamente após criar
- CI roda Lint + Unit + E2E; ao verde, merge automático em `main`
- Deploy é automático via `deploy.yml` (workflow_run após CI verde em main)

## Riscos

- `audio_file.save()` em prod usa R2 — uploads de 130 × ~3 MB em sequência podem demorar. Aceitável (~5-10 min) e a única alternativa seria bulk upload externo. O comando já é bloqueante por design.
- `file_size` da YAML não é validado contra o limite de 25MB do `audio_file.help_text` — esse limite é informacional, não enforced. Não muda nessa PR.
- Pessoa rodando `import_yaml` na produção precisa existir como `User` (default `nitai`); se rodar com `--owner-username outro` que não existe → `User.DoesNotExist` aborta. Aceitável; mensagem clara basta.

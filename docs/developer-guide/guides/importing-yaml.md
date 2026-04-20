# Importar YAML

Guia para importar hinários via arquivo YAML.

## Formato do YAML

### Estrutura Básica

```yaml
name: "Nome do Hinário"
owner_name: "Nome do Dono"
intro_name: "Nome Curto"  # opcional
description: "Descrição do hinário"  # opcional

hymns:
  - number: 1
    title: "Primeiro Hino"
    text: |
      Letra do primeiro hino
      Com quebras de linha
  - number: 2
    title: "Segundo Hino"
    text: "Letra do segundo hino"
```

### Campos Obrigatórios

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `name` | string | Nome único do hinário |
| `owner_name` | string | Nome de quem recebeu |
| `hymns` | list | Lista de hinos |
| `hymns[].number` | int | Número no hinário |
| `hymns[].title` | string | Título do hino |
| `hymns[].text` | string | Letra completa |

### Campos Opcionais

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `intro_name` | string | Nome curto |
| `description` | string | Descrição do hinário |
| `hymns[].received_at` | date | Data (YYYY-MM-DD) |
| `hymns[].offered_to` | string | Dedicatória |
| `hymns[].style` | string | Valsa, Marcha, etc |
| `hymns[].extra_instructions` | string | Instruções |
| `hymns[].repetitions` | string | Ex: "1-4, 5-8" |

## Exemplo Completo

```yaml
name: "O Cruzeiro"
owner_name: "Mestre Irineu"
intro_name: "Cruzeiro"
description: |
  O Cruzeiro é o primeiro hinário do Santo Daime,
  recebido pelo Mestre Irineu Serra.

hymns:
  - number: 1
    title: "Lua Branca"
    text: |
      Lua branca da luz serena
      Que ilumina a natureza
      Vem da floresta encantada
      Esta celestial princesa
    style: "Valsa"
    received_at: "1930-07-15"
    offered_to: "Nossa Senhora"
    repetitions: "1-4"

  - number: 2
    title: "Tuperci"
    text: |
      Tuperci é um anjo
      Que Deus mandou
      Para me ensinar
      O que eu não sei
    style: "Marcha"
```

## Importando via Command

### Comando Básico

```bash
poetry run python manage.py import_yaml arquivo.yaml
```

### Opções

```bash
# Simula sem salvar
poetry run python manage.py import_yaml arquivo.yaml --dry-run

# Sobrescreve se existir
poetry run python manage.py import_yaml arquivo.yaml --force

# Verbose
poetry run python manage.py import_yaml arquivo.yaml -v 2
```

### Output Esperado

```
Parsing YAML file: arquivo.yaml
Found hymnbook: O Cruzeiro
Found 10 hymns
Creating HymnBook...
Creating Hymns...
Indexing in TypeSense...
Successfully imported: O Cruzeiro (10 hymns)
```

## Importando via Código

```python
from apps.hymns.services import import_hymnbook_from_yaml

# Via path
hymnbook = import_hymnbook_from_yaml('/path/to/file.yaml')

# Via dict
data = {
    'name': 'Meu Hinário',
    'owner_name': 'João',
    'hymns': [
        {'number': 1, 'title': 'Hino 1', 'text': 'Letra...'}
    ]
}
hymnbook = import_hymnbook_from_yaml(data)
```

## Validação

### Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| `name is required` | Falta campo name | Adicione `name:` |
| `Duplicate hymn number` | Dois hinos com mesmo número | Corrija numeração |
| `HymnBook already exists` | Nome já existe | Use `--force` ou renomeie |

### Validar Antes de Importar

```bash
# Valida YAML online
# https://www.yamllint.com/

# Ou via Python
import yaml
with open('arquivo.yaml') as f:
    data = yaml.safe_load(f)
    print(data)
```

## Após Importação

O hinário importado:

1. É salvo no PostgreSQL
2. É indexado no TypeSense
3. Aparece na lista de hinários
4. Pode ser buscado imediatamente

## Formatos Alternativos

### Sem `hymn_book:` como raiz

O sistema também aceita:

```yaml
# Também válido (sem hymn_book: wrapper)
name: "Hinário"
owner_name: "Dono"
hymns:
  - number: 1
    title: "Hino"
    text: "Letra"
```

### Com `hymn_book:` wrapper

```yaml
hymn_book:
  name: "Hinário"
  owner_name: "Dono"
  hymns:
    - number: 1
      title: "Hino"
      text: "Letra"
```

Ambos funcionam.

## Troubleshooting

### Encoding

Use UTF-8:

```bash
file -I arquivo.yaml
# deve retornar: text/plain; charset=utf-8
```

### Caracteres Especiais

Escape caracteres especiais:

```yaml
title: "Hino: Uma Nova Era"  # OK
title: 'Hino: Uma Nova Era'  # OK
title: Hino: Uma Nova Era    # ERRO
```

### Quebras de Linha

Use `|` para preservar quebras:

```yaml
text: |
  Primeira linha
  Segunda linha

  Nova estrofe
```

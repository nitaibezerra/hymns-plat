# Management Commands

Comandos personalizados do Django.

## Visão Geral

```bash
poetry run python manage.py <command>
```

## apps.hymns

### import_yaml

Importa hinário de arquivo YAML.

```bash
poetry run python manage.py import_yaml <arquivo.yaml>
```

**Argumentos:**

| Argumento | Tipo | Descrição |
|-----------|------|-----------|
| `yaml_file` | path | Caminho do arquivo YAML |

**Opções:**

| Opção | Descrição |
|-------|-----------|
| `--dry-run` | Simula sem salvar |
| `--force` | Sobrescreve se existir |

**Exemplo:**

```bash
# Import normal
poetry run python manage.py import_yaml hinarios/cruzeiro.yaml

# Dry run
poetry run python manage.py import_yaml hinarios/cruzeiro.yaml --dry-run

# Forçar sobrescrita
poetry run python manage.py import_yaml hinarios/cruzeiro.yaml --force
```

**Formato YAML:**

```yaml
name: "O Cruzeiro"
owner_name: "Mestre Irineu"
hymns:
  - number: 1
    title: "Lua Branca"
    text: "Lua branca..."
```

## apps.search

### reindex_typesense

Recria índice do TypeSense.

```bash
poetry run python manage.py reindex_typesense
```

**Opções:**

| Opção | Descrição |
|-------|-----------|
| `--batch-size` | Tamanho do batch (default: 100) |
| `--no-delete` | Não deleta collection antes |

**Exemplo:**

```bash
# Reindex completo
poetry run python manage.py reindex_typesense

# Com batch maior
poetry run python manage.py reindex_typesense --batch-size=500
```

**Output:**

```
Deleting existing collection...
Creating collection with schema...
Indexing hymns...
Indexed 1234 hymns in 5.2 seconds
```

### check_typesense

Verifica conexão com TypeSense.

```bash
poetry run python manage.py check_typesense
```

**Output:**

```
TypeSense connection: OK
Host: localhost:8108
Collections: hymns (1234 documents)
```

## Comandos Django Úteis

### migrate

```bash
# Rodar migrations
poetry run python manage.py migrate

# Ver migrations pendentes
poetry run python manage.py showmigrations
```

### createsuperuser

```bash
poetry run python manage.py createsuperuser
```

### shell

```bash
# Shell Python
poetry run python manage.py shell

# Shell com IPython
poetry run python manage.py shell -i ipython
```

### dbshell

```bash
poetry run python manage.py dbshell
```

### collectstatic

```bash
poetry run python manage.py collectstatic
```

### check

```bash
# Verificar problemas
poetry run python manage.py check

# Com deploy checks
poetry run python manage.py check --deploy
```

## Criando Novos Comandos

```python
# apps/hymns/management/commands/my_command.py
from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = 'Descrição do comando'

    def add_arguments(self, parser):
        parser.add_argument('arg1', type=str)
        parser.add_argument('--option', action='store_true')

    def handle(self, *args, **options):
        self.stdout.write('Executando...')

        if options['option']:
            pass

        self.stdout.write(
            self.style.SUCCESS('Concluído!')
        )
```

**Uso:**

```bash
poetry run python manage.py my_command arg1 --option
```

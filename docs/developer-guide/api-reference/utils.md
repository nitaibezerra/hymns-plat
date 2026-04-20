# Utilities

Funções utilitárias do projeto.

## apps.hymns.disambiguation

Funções para detecção de duplicatas.

### normalize_hymnbook_name

```python
def normalize_hymnbook_name(name: str) -> str:
    """Normaliza nome de hinário para comparação.

    Args:
        name: Nome original

    Returns:
        Nome normalizado (lowercase, sem espaços extras)
    """
    if not name:
        return ""
    return " ".join(name.lower().split())
```

**Exemplo:**

```python
normalize_hymnbook_name("O  Cruzeiro")  # "o cruzeiro"
normalize_hymnbook_name(None)  # ""
```

### calculate_string_similarity

```python
def calculate_string_similarity(str1: str, str2: str) -> float:
    """Calcula similaridade entre strings.

    Args:
        str1: Primeira string
        str2: Segunda string

    Returns:
        Valor entre 0.0 e 1.0
    """
    if not str1 or not str2:
        return 0.0
    return SequenceMatcher(None, str1.lower(), str2.lower()).ratio()
```

**Exemplo:**

```python
calculate_string_similarity("O Cruzeiro", "O Cruzeiro")  # 1.0
calculate_string_similarity("O Cruzeiro", "Cruzeiro")  # 0.85
calculate_string_similarity("abc", None)  # 0.0
```

### find_similar_hymnbooks

```python
def find_similar_hymnbooks(
    name: str,
    threshold: float = 0.8
) -> List[Tuple[HymnBook, float]]:
    """Encontra hinários similares.

    Args:
        name: Nome para comparar
        threshold: Similaridade mínima (0.0 a 1.0)

    Returns:
        Lista de tuplas (HymnBook, score)
    """
```

**Exemplo:**

```python
similar = find_similar_hymnbooks("O Cruzeiro", threshold=0.7)
for hymnbook, score in similar:
    print(f"{hymnbook.name}: {score:.2f}")
```

### find_duplicates

```python
def find_duplicates(
    name: str,
    owner_name: str,
    hymn_count: int
) -> Optional[HymnBook]:
    """Encontra possível duplicata.

    Args:
        name: Nome do hinário
        owner_name: Nome do dono
        hymn_count: Número de hinos

    Returns:
        HymnBook se encontrar duplicata, None caso contrário
    """
```

## apps.hymns.validators

### validate_yaml_structure

```python
def validate_yaml_structure(data: dict) -> Tuple[bool, List[str]]:
    """Valida estrutura do YAML de hinário.

    Args:
        data: Dict parseado do YAML

    Returns:
        Tupla (is_valid, list_of_errors)
    """
```

**Exemplo:**

```python
import yaml

with open('hinario.yaml') as f:
    data = yaml.safe_load(f)

is_valid, errors = validate_yaml_structure(data)
if not is_valid:
    for error in errors:
        print(f"Erro: {error}")
```

### validate_hymn_numbers

```python
def validate_hymn_numbers(hymns: List[dict]) -> Tuple[bool, List[str]]:
    """Verifica se números de hinos são únicos e sequenciais.

    Args:
        hymns: Lista de dicts de hinos

    Returns:
        Tupla (is_valid, list_of_errors)
    """
```

## apps.core.utils

### generate_slug

```python
def generate_slug(text: str, max_length: int = 255) -> str:
    """Gera slug a partir de texto.

    Args:
        text: Texto original
        max_length: Tamanho máximo

    Returns:
        Slug gerado
    """
```

**Exemplo:**

```python
generate_slug("O Cruzeiro")  # "o-cruzeiro"
generate_slug("Hinário do João")  # "hinario-do-joao"
```

### truncate_text

```python
def truncate_text(text: str, max_words: int = 40) -> str:
    """Trunca texto em número de palavras.

    Args:
        text: Texto original
        max_words: Número máximo de palavras

    Returns:
        Texto truncado com "..." se necessário
    """
```

**Exemplo:**

```python
text = "Esta é uma frase muito longa..."
truncate_text(text, max_words=5)  # "Esta é uma frase muito..."
```

## apps.users.utils

### create_notification

```python
def create_notification(
    user: User,
    notification_type: str,
    data: dict
) -> Notification:
    """Cria notificação para usuário.

    Args:
        user: Usuário destino
        notification_type: Tipo (favorite, comment, follow, upload)
        data: Dados adicionais

    Returns:
        Notificação criada
    """
```

**Exemplo:**

```python
create_notification(
    user=some_user,
    notification_type='comment',
    data={
        'hymn_id': str(hymn.id),
        'hymn_title': hymn.title,
        'commenter': request.user.username,
    }
)
```

### get_user_stats

```python
def get_user_stats(user: User) -> dict:
    """Retorna estatísticas do usuário.

    Args:
        user: Usuário

    Returns:
        Dict com contagens
    """
```

**Retorno:**

```python
{
    'favorites_count': 42,
    'comments_count': 15,
    'uploads_count': 3,
    'followers_count': 28,
    'following_count': 12,
}
```

# Architecture Decision Records (ADRs)

Decisões arquiteturais importantes do projeto.

## ADR-001: UUID como Primary Key

### Status
Aceito

### Contexto
Precisamos escolher entre auto-increment integer e UUID para primary keys.

### Decisão
Usar UUID v4 como primary key em todos os models.

### Consequências

**Positivas:**

- URLs não expõem contagem de registros
- Merge de bancos mais simples
- IDs podem ser gerados no cliente
- Melhor para sistemas distribuídos

**Negativas:**

- Índices maiores (16 bytes vs 4 bytes)
- Queries de range menos eficientes
- Debug mais difícil (IDs não sequenciais)

### Implementação

```python
import uuid
from django.db import models

class BaseModel(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    class Meta:
        abstract = True
```

---

## ADR-002: TypeSense para Busca

### Status
Aceito

### Contexto
Precisamos de busca full-text com:

- Tolerância a erros de digitação
- Busca instantânea
- Facilidade de setup

Alternativas consideradas:

- PostgreSQL full-text search
- ElasticSearch
- Meilisearch
- TypeSense

### Decisão
Usar TypeSense 27.1.

### Consequências

**Positivas:**

- Setup simples (Docker)
- Typo-tolerance nativo
- Latência < 10ms
- Baixo consumo de memória (~500MB)

**Negativas:**

- Comunidade menor que ElasticSearch
- Menos integrações prontas
- Features avançadas limitadas

---

## ADR-003: Wagtail para CMS

### Status
Aceito

### Contexto
Precisamos de CMS para páginas editáveis (Home, About, etc).

Alternativas:

- Django Admin puro
- Wagtail
- django-cms
- Headless CMS externo

### Decisão
Usar Wagtail 6.4.

### Consequências

**Positivas:**

- Integração nativa com Django
- Interface de edição amigável
- StreamFields flexíveis
- Boa documentação

**Negativas:**

- Overhead para uso simples
- Curva de aprendizado
- Migrations adicionais

---

## ADR-004: Celery para Background Tasks

### Status
Aceito

### Contexto
Operações como:

- Reindexação em batch
- Processamento de uploads
- Envio de emails

São lentas demais para request/response.

### Decisão
Usar Celery 5.4 com Redis como broker.

### Consequências

**Positivas:**

- Tasks assíncronas
- Retry automático
- Scheduling
- Monitoramento (Flower)

**Negativas:**

- Complexidade operacional
- Mais um serviço para manter
- Debug mais difícil

---

## ADR-005: Versionamento de Hinários

### Status
Aceito

### Contexto
Usuários podem fazer upload de hinários que já existem. Precisamos:

- Detectar duplicatas
- Permitir atualizações
- Manter histórico

### Decisão
Criar model `HymnBookVersion` para tracking.

```python
class HymnBookVersion(models.Model):
    original = models.ForeignKey(HymnBook)
    uploaded_by = models.ForeignKey(User)
    version_number = models.PositiveIntegerField()
    changes = models.JSONField()
    status = models.CharField(choices=STATUS_CHOICES)
```

### Consequências

**Positivas:**

- Histórico completo de mudanças
- Possibilidade de rollback
- Atribuição de contribuidores

**Negativas:**

- Complexidade adicional
- Mais espaço em disco
- Lógica de merge complexa

---

## ADR-006: Desambiguação Fuzzy

### Status
Aceito

### Contexto
Detectar se um hinário novo é duplicata de um existente usando fuzzy matching.

### Decisão
Usar `difflib.SequenceMatcher` para calcular similaridade.

```python
def calculate_string_similarity(str1: str, str2: str) -> float:
    if not str1 or not str2:
        return 0.0
    return SequenceMatcher(None, str1.lower(), str2.lower()).ratio()
```

### Consequências

**Positivas:**

- Sem dependências externas
- Rápido para poucos registros
- Simples de entender

**Negativas:**

- Não escala para milhões de registros
- Pode ter falsos positivos/negativos
- Threshold precisa de tuning

---

## ADR-007: Playwright para E2E Tests

### Status
Aceito

### Contexto
Precisamos de testes E2E para validar fluxos completos.

Alternativas:

- Selenium
- Cypress
- Playwright

### Decisão
Usar Playwright via pytest.

### Consequências

**Positivas:**

- API moderna e simples
- Suporte nativo a pytest
- Cross-browser
- Auto-wait

**Negativas:**

- Mais lento que testes unitários
- Requer servidor rodando
- Flaky tests possíveis

---

## Template para Novas ADRs

```markdown
## ADR-XXX: [Título]

### Status
[Proposto | Aceito | Deprecated | Substituído]

### Contexto
[Descreva o problema e as forças em jogo]

### Decisão
[Descreva a decisão tomada]

### Consequências
[Descreva o que acontece após a decisão]

**Positivas:**
- ...

**Negativas:**
- ...
```

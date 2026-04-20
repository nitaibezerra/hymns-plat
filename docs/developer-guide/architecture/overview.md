# Arquitetura do Sistema

## Visão Geral

O hyms-plat usa arquitetura monolítica Django com separação de apps por domínio.

## Diagrama de Arquitetura

```mermaid
graph TB
    subgraph "Frontend"
        Browser[Browser/Client]
    end

    subgraph "Application Layer"
        Django[Django 5.1]
        Wagtail[Wagtail CMS]
    end

    subgraph "Apps"
        Hymns[apps.hymns]
        Search[apps.search]
        Users[apps.users]
        CMS[apps.cms]
    end

    subgraph "Data Layer"
        PostgreSQL[(PostgreSQL 16)]
        TypeSense[(TypeSense 27.1)]
        Redis[(Redis 7)]
    end

    subgraph "Background"
        Celery[Celery Workers]
    end

    Browser --> Django
    Django --> Wagtail
    Django --> Hymns
    Django --> Search
    Django --> Users
    Django --> CMS

    Hymns --> PostgreSQL
    Users --> PostgreSQL
    CMS --> PostgreSQL
    Search --> TypeSense

    Celery --> Redis
    Celery --> PostgreSQL
    Celery --> TypeSense
```

## Apps Django

### `apps/hymns/` (Core)

**Responsabilidades:**

- Models: HymnBook, Hymn, HymnBookVersion
- Views: Home, List, Detail
- Admin: Interface de gerenciamento
- Commands: import_yaml

**Dependências:**

- `apps.search` - TypeSense integration
- `apps.users` - FK owner_user

### `apps/search/`

**Responsabilidades:**

- TypeSense client wrapper
- Index/reindex functions
- Search queries
- Commands: reindex_typesense

**Dependências:**

- `apps.hymns` - Hymn model

### `apps/users/`

**Responsabilidades:**

- Custom User model (bio, avatar)
- Upload e desambiguação
- Features sociais (favoritos, comentários, follows)
- Notificações

**Dependências:**

- django-allauth
- `apps.hymns`

### `apps/cms/`

**Responsabilidades:**

- Wagtail HomePage model
- CMS pages editáveis

**Dependências:**

- Wagtail

### `apps/core/`

**Responsabilidades:**

- Base mixins
- Common utilities
- Shared models

## Fluxo de Dados

### 1. Importação YAML → DB

```mermaid
sequenceDiagram
    participant Admin
    participant Command
    participant Validator
    participant DB
    participant TypeSense

    Admin->>Command: import_yaml hinario.yaml
    Command->>Validator: Valida YAML
    Validator-->>Command: OK
    Command->>DB: Cria HymnBook + Hymns
    DB-->>Command: Sucesso
    Command->>TypeSense: Indexa hinos
    TypeSense-->>Command: Indexado
    Command-->>Admin: Concluído
```

### 2. Busca de Usuário

```mermaid
sequenceDiagram
    participant User
    participant View
    participant TypeSense
    participant DB

    User->>View: GET /busca/?q=lua
    View->>TypeSense: search_hymns("lua")
    TypeSense-->>View: [uuid1, uuid2, ...]
    View->>DB: Hymn.objects.filter(id__in=uuids)
    DB-->>View: Hymn objects
    View-->>User: Render results
```

### 3. Upload de Hinário

```mermaid
sequenceDiagram
    participant User
    participant View
    participant Validator
    participant Disambiguator
    participant DB
    participant TypeSense

    User->>View: POST /contribuir/ (YAML file)
    View->>Validator: Valida YAML
    Validator-->>View: Data dict
    View->>Disambiguator: find_duplicates(name)
    alt Duplicata encontrada
        Disambiguator-->>View: Similar hymnbooks
        View-->>User: Página de desambiguação
    else Novo hinário
        View->>DB: Cria HymnBookVersion
        DB-->>View: Sucesso
        View->>TypeSense: Indexa
        View-->>User: Sucesso
    end
```

## Padrões e Decisões

### UUID como Primary Key

**Por quê:** Melhor para sistemas distribuídos, não expõe contagem

**Trade-off:** Índices maiores que auto-increment

### TypeSense vs ElasticSearch

**Por quê:** TypeSense é mais simples, menor overhead, typo-tolerance nativo

**Trade-off:** Menos features avançadas que ElasticSearch

### Celery para Background Tasks

**Por quê:** Upload, reindexação são operações lentas

**Trade-off:** Mais complexidade operacional

### Wagtail CMS

**Por quê:** CMS Django-native para páginas editáveis

**Trade-off:** Overhead para features simples

Veja [Architecture Decisions](decisions.md) para detalhes.

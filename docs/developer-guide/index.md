# Guia do Desenvolvedor

Bem-vindo à documentação técnica do **hyms-plat**!

## Visão Geral

O hyms-plat é um portal Django/Wagtail para hinários do Santo Daime com:

- :material-magnify: Busca avançada via TypeSense
- :material-book: CMS Wagtail para páginas
- :material-music: Upload de áudio (em desenvolvimento)
- :material-account-group: Features sociais
- :material-docker: Docker para serviços externos

## Stack Tecnológico

| Componente | Tecnologia |
|------------|------------|
| **Backend** | Django 5.1 + Python 3.11+ |
| **CMS** | Wagtail 6.4 |
| **Banco de Dados** | PostgreSQL 16 |
| **Busca** | TypeSense 27.1 |
| **Task Queue** | Celery + Redis |
| **Testes** | pytest (290+ testes, 83%+ coverage) |

Veja detalhes em [Technology Stack](architecture/technology-stack.md).

## Começando

<div class="grid cards" markdown>

-   :material-rocket-launch:{ .lg .middle } **[Setup Local](setup/local-development.md)**

    ---

    Configure seu ambiente de desenvolvimento

-   :material-chart-box:{ .lg .middle } **[Arquitetura](architecture/overview.md)**

    ---

    Entenda a estrutura do sistema

-   :material-account-group:{ .lg .middle } **[Contribuindo](contributing/getting-started.md)**

    ---

    Como contribuir com o projeto

-   :material-test-tube:{ .lg .middle } **[Testes](testing/overview.md)**

    ---

    Estratégia de testes do projeto

</div>

## Links Rápidos

### Referência

- [Models Reference](api-reference/models.md)
- [Views Reference](api-reference/views.md)
- [Management Commands](api-reference/management-commands.md)
- [TypeSense Client](api-reference/typesense-client.md)

### Guias

- [Importar YAML](guides/importing-yaml.md)
- [Reindexar Busca](guides/indexing-search.md)
- [Adicionar Features](guides/adding-features.md)

### Deploy

- [Visão Geral](deployment/overview.md)
- [CI/CD](deployment/ci-cd.md)

## Status do Projeto

| Fase | Status | Cobertura |
|------|--------|-----------|
| Fase 0: Setup | :material-check-circle:{ .green } Completa | N/A |
| Fase 1: MVP Read-Only | :material-check-circle:{ .green } Completa | 98% |
| Fase 2: Upload & Users | :material-check-circle:{ .green } Completa | 85% |
| Fase 3: Áudio & Social | :material-check-circle:{ .green } Completa | 83% |
| Fase 4: Deploy & Prod | :material-clock:{ .yellow } Em andamento | - |

Veja o [Roadmap](../roadmap.md) completo.

## Estrutura do Projeto

```
hyms-plat/
├── apps/                    # Django apps
│   ├── core/               # Base e utilidades
│   ├── hymns/              # Hinários e hinos
│   ├── search/             # TypeSense integration
│   ├── users/              # Autenticação e perfis
│   └── cms/                # Wagtail CMS
├── config/                  # Configurações Django
│   └── settings/           # Settings por ambiente
├── templates/              # Templates HTML
├── static/                 # Arquivos estáticos
├── tests/                  # Testes
│   ├── unit/              # Testes unitários
│   └── e2e/               # Testes E2E (Playwright)
└── docs/                   # Esta documentação
```

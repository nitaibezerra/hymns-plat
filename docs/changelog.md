# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [Unreleased]

### Adicionado
- Documentação completa com MkDocs
- Guia do usuário em português
- Guia do desenvolvedor
- **Edição web de hinos/hinários** (PR #2): CRUD completo via navegador para donos/superusers, com Django signals que mantêm o índice de busca sincronizado automaticamente

### Modificado
- **Projeto renomeado** de `hyms-plat` para `hymns-plat` (PR #4)
- **Busca migrada de TypeSense para PostgreSQL FTS**: removida dependência do serviço externo TypeSense; busca agora usa `to_tsvector` + `pg_trgm` + `unaccent`, tudo no Postgres. Single source of truth, fim dos dual-writes, CI/setup mais simples. Ver `developer-guide/architecture/search-architecture.md`.

### Removido
- Serviço `typesense` do `docker-compose.yml` e do CI
- Módulo `apps.search` (TypeSense client e management command)
- Dependência Python `typesense`
- Variáveis de ambiente `TYPESENSE_*`

## [0.3.0] - 2026-01-11

### Adicionado
- **Testes E2E com Playwright**
  - 15 testes de navegação, autenticação, upload e features sociais
  - CI/CD atualizado para rodar testes E2E
- **Features Sociais (Fase 3)**
  - Sistema de favoritos para hinos
  - Comentários em hinos
  - Seguir outros usuários
  - Feed de notificações
  - Perfil de usuário público

### Corrigido
- Bug no upload de YAML sem `hymn_book:` como raiz
- Validação defensiva em funções de desambiguação

## [0.2.0] - 2026-01-10

### Adicionado
- **Upload de Hinários (Fase 2)**
  - Upload de arquivos YAML
  - Validação e preview antes de salvar
  - Sistema de desambiguação de duplicatas
  - Versionamento de hinários (HymnBookVersion)
- **Autenticação Completa**
  - Login com email/senha
  - Login social com Google
  - Recuperação de senha
  - Perfil de usuário editável

### Melhorado
- Cobertura de testes para 83%+
- Documentação inline do código

## [0.1.0] - 2026-01-08

### Adicionado
- **MVP Read-Only (Fase 1)**
  - Models HymnBook e Hymn
  - Importação de hinários via YAML (`import_yaml`)
  - Indexação no TypeSense
  - Página inicial com estatísticas
  - Lista de hinários com paginação
  - Detalhes do hinário com lista de hinos
  - Página do hino com letra completa
  - Busca full-text com TypeSense
- **Infraestrutura (Fase 0)**
  - Projeto Django 5.1 com Poetry
  - Wagtail CMS 6.4
  - PostgreSQL 16 via Docker
  - Redis 7 via Docker
  - TypeSense 27.1 via Docker
  - django-allauth configurado
  - CI/CD com GitHub Actions
  - 98%+ de cobertura de testes

## Links

- [Repositório GitHub](https://github.com/nitai-bezerra/hymns-plat)
- [Issues](https://github.com/nitai-bezerra/hymns-plat/issues)

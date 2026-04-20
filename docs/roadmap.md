# Roadmap

Este documento descreve as fases de desenvolvimento do Portal de Hinários.

## Fases Concluídas

### Fase 0: Setup Inicial :material-check-circle:{ .green }

**Objetivo:** Configurar infraestrutura base do projeto.

- [x] Estrutura Django com Poetry
- [x] Configuração PostgreSQL e Redis via Docker
- [x] Configuração TypeSense
- [x] Wagtail CMS
- [x] django-allauth para autenticação
- [x] CI/CD com GitHub Actions

### Fase 1: MVP Read-Only :material-check-circle:{ .green }

**Objetivo:** Versão inicial apenas leitura.

- [x] Models HymnBook e Hymn
- [x] Import de hinários via YAML
- [x] Indexação no TypeSense
- [x] Página inicial com estatísticas
- [x] Lista de hinários com paginação
- [x] Detalhes do hinário com lista de hinos
- [x] Página do hino com letra completa
- [x] Busca full-text
- [x] Testes unitários (95%+ coverage)

### Fase 2: Upload & Users :material-check-circle:{ .green }

**Objetivo:** Permitir contribuição de usuários.

- [x] Autenticação com email/senha e OAuth (Google)
- [x] Upload de hinários via YAML
- [x] Validação e preview antes de salvar
- [x] Sistema de desambiguação de duplicatas
- [x] Versionamento de hinários
- [x] Perfil de usuário com histórico

### Fase 3: Áudio & Social :material-check-circle:{ .green }

**Objetivo:** Features sociais e multimídia.

- [x] Favoritar hinos
- [x] Comentários em hinos
- [x] Seguir outros usuários
- [x] Feed de notificações
- [x] Placeholders para player de áudio
- [x] Testes E2E com Playwright

## Fase Atual

### Fase 4: Deploy & Produção :material-clock:{ .yellow }

**Objetivo:** Preparar para produção.

- [ ] Documentação completa (MkDocs)
- [ ] Configuração de produção otimizada
- [ ] Deploy em servidor de produção
- [ ] Monitoramento e logging
- [ ] Backups automatizados
- [ ] CDN para assets estáticos

## Futuro

### Fase 5: Áudio Completo

**Objetivo:** Player de áudio funcional.

- [ ] Upload de áudios
- [ ] Player integrado
- [ ] Playlists
- [ ] Download de áudios

### Fase 6: Mobile App

**Objetivo:** Aplicativo mobile nativo.

- [ ] App React Native ou Flutter
- [ ] Modo offline
- [ ] Sincronização de favoritos

### Fase 7: Features Avançadas

**Objetivo:** Melhorias contínuas.

- [ ] Transcrição automática de áudio
- [ ] Tradução de hinos
- [ ] Comparação de versões
- [ ] API pública REST

## Contribuição

Quer ajudar a acelerar o roadmap? Veja nosso [guia de contribuição](developer-guide/contributing/getting-started.md).

## Changelog

Para ver as mudanças já implementadas, consulte o [Changelog](changelog.md).

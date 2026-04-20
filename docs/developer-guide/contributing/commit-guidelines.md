# Commit Guidelines

Padrões para mensagens de commit.

## Conventional Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

## Tipos

| Tipo | Descrição |
|------|-----------|
| `feat` | Nova feature |
| `fix` | Bug fix |
| `docs` | Documentação |
| `style` | Formatação (não afeta lógica) |
| `refactor` | Refatoração |
| `test` | Testes |
| `chore` | Manutenção, deps, config |
| `perf` | Performance |
| `ci` | CI/CD |

## Exemplos

### Feature

```
feat(hymns): adiciona filtro por estilo musical

Permite filtrar hinos por estilo (Valsa, Marcha, etc)
na página de busca.
```

### Bug Fix

```
fix(search): corrige erro de encoding na busca

O TypeSense não estava recebendo caracteres acentuados
corretamente. Agora normaliza para UTF-8 antes de enviar.

Fixes #123
```

### Documentação

```
docs: adiciona guia de contribuição

- Como fazer fork
- Workflow de PR
- Code style
```

### Refatoração

```
refactor(views): extrai lógica de validação para form

Move validação de YAML do view para o form,
seguindo padrão Django.
```

### Testes

```
test(e2e): adiciona testes de navegação

- test_home_page_loads
- test_hymnbook_list
- test_hymn_detail
```

### Chore

```
chore(deps): atualiza Django para 5.1.1

Inclui security patches.
```

## Boas Práticas

### Descrição

- Use imperativo: "adiciona" não "adicionado"
- Primeira letra minúscula
- Sem ponto final
- Máximo 72 caracteres

### Body

- Explique O QUE e POR QUE
- Pule uma linha após o título
- Quebre em 72 caracteres

### Footer

- `Fixes #123` - Fecha issue
- `Closes #123` - Fecha issue
- `BREAKING CHANGE:` - Mudança incompatível

## Co-Authored-By

Quando usando Claude Code ou pair programming:

```
feat: adiciona sistema de favoritos

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

## Commits Atômicos

### Bom

```
feat(hymns): adiciona model Favorite
feat(hymns): adiciona view de favoritos
feat(hymns): adiciona template de favoritos
test(hymns): adiciona testes de favoritos
```

### Ruim

```
feat: adiciona favoritos, corrige bug, atualiza docs, refatora views
```

## Squash

Ao fazer merge, commits são combinados (squash). O título do PR vira a mensagem do commit.

## Dicas

### Amend

```bash
# Corrigir último commit
git commit --amend -m "nova mensagem"
```

### Interactive Rebase

```bash
# Reorganizar commits antes de PR
git rebase -i HEAD~3
```

### Hooks

Pre-commit pode validar mensagens:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/compilerla/conventional-pre-commit
    rev: v3.0.0
    hooks:
      - id: conventional-pre-commit
```

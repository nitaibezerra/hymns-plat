# Pull Requests

Guia para criar e revisar Pull Requests.

## Antes de Criar

- [ ] Código formatado (`black`, `isort`)
- [ ] Lint passa (`ruff check`)
- [ ] Testes passam (`pytest`)
- [ ] Testes adicionados para código novo
- [ ] Documentação atualizada se necessário

## Criando um PR

### 1. Push da Branch

```bash
git push origin feat/minha-feature
```

### 2. Abra o PR no GitHub

- Vá para o repositório
- Clique em "Compare & pull request"

### 3. Preencha o Template

```markdown
## Descrição

Breve descrição das mudanças.

## Tipo de Mudança

- [ ] Bug fix
- [ ] Nova feature
- [ ] Breaking change
- [ ] Documentação

## Como Testar

1. Passo 1
2. Passo 2
3. Passo 3

## Checklist

- [ ] Meu código segue o style guide
- [ ] Adicionei testes
- [ ] Documentação atualizada
- [ ] CI passa

## Issues Relacionadas

Closes #123
```

### 4. Aguarde Review

Um maintainer irá revisar seu PR.

## Boas Práticas

### Tamanho

- PRs pequenos são mais fáceis de revisar
- Uma feature/fix por PR
- Se for grande, divida em PRs menores

### Título

Use Conventional Commits:

```
feat: adiciona sistema de favoritos
fix: corrige bug na busca
docs: atualiza README
refactor: reorganiza views
test: adiciona testes E2E
```

### Descrição

- Explique O QUE mudou
- Explique POR QUE mudou
- Screenshots se houver mudanças visuais
- Como testar manualmente

### Commits

- Commits pequenos e focados
- Mensagens claras
- Veja [Commit Guidelines](commit-guidelines.md)

## Code Review

### Como Reviewer

- Seja construtivo
- Sugira melhorias específicas
- Aprove quando estiver pronto
- Use aprovação com sugestões quando houver pequenos ajustes

### Como Autor

- Responda a todos os comentários
- Não leve para o lado pessoal
- Faça as mudanças solicitadas
- Peça esclarecimento se não entender

## Merge

### Requisitos

- [ ] CI passou
- [ ] Aprovado por reviewer
- [ ] Sem conflitos
- [ ] Branch atualizada com main

### Tipo de Merge

Usamos **Squash and merge** para:

- Histórico limpo
- Um commit por PR
- Mensagem de commit clara

## Após o Merge

- Branch é deletada automaticamente
- Issue é fechada automaticamente (se linked)
- Deploy automático para staging (se configurado)

## Troubleshooting

### CI Falhou

```bash
# Ver logs no GitHub Actions
# Corrigir localmente
poetry run black .
poetry run isort .
poetry run ruff check --fix .
poetry run pytest

# Push novamente
git add .
git commit --amend
git push -f origin feat/minha-feature
```

### Conflitos

```bash
# Atualizar branch
git fetch upstream
git rebase upstream/main

# Resolver conflitos
# Editar arquivos conflitantes
git add .
git rebase --continue

# Push
git push -f origin feat/minha-feature
```

### Mudanças Solicitadas

```bash
# Fazer mudanças
git add .
git commit -m "fix: aplica sugestões do review"
git push origin feat/minha-feature
```

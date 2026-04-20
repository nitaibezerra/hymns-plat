# Como Contribuir

Obrigado pelo interesse em contribuir com o projeto!

## Primeiros Passos

### 1. Fork o Repositório

No GitHub, clique em **Fork** para criar sua cópia.

### 2. Clone seu Fork

```bash
git clone https://github.com/seu-usuario/hyms-plat.git
cd hyms-plat
```

### 3. Configure Upstream

```bash
git remote add upstream https://github.com/nitai-bezerra/hyms-plat.git
```

### 4. Setup Local

Siga o [guia de setup local](../setup/local-development.md).

## Workflow

### 1. Sincronize com Upstream

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

### 2. Crie uma Branch

```bash
git checkout -b feat/minha-feature
```

Convenção de nomes:

- `feat/` - Nova feature
- `fix/` - Bug fix
- `docs/` - Documentação
- `refactor/` - Refatoração
- `test/` - Testes

### 3. Faça suas Mudanças

- Escreva código
- Adicione testes
- Documente se necessário

### 4. Formate o Código

```bash
poetry run black .
poetry run isort .
poetry run ruff check --fix .
```

### 5. Rode os Testes

```bash
poetry run pytest
```

### 6. Commit

```bash
git add .
git commit -m "feat: adiciona funcionalidade X"
```

Veja [Commit Guidelines](commit-guidelines.md).

### 7. Push

```bash
git push origin feat/minha-feature
```

### 8. Abra Pull Request

No GitHub, abra um PR do seu fork para o repositório original.

## Tipos de Contribuição

### Código

- Novas features
- Bug fixes
- Refatorações
- Performance

### Documentação

- Corrigir erros
- Melhorar clareza
- Adicionar exemplos
- Traduzir

### Testes

- Aumentar coverage
- Testes E2E
- Testes de edge cases

### Issues

- Reportar bugs
- Sugerir features
- Tirar dúvidas

## Boas Práticas

### Código

- Siga o [code style](code-style.md) do projeto
- Escreva testes para código novo
- Documente funções públicas
- Mantenha commits pequenos e focados

### Pull Requests

- Um PR = uma feature/fix
- Descreva claramente as mudanças
- Referencie issues relacionadas
- Responda aos code reviews

### Issues

- Verifique se já existe antes de criar
- Use templates quando disponíveis
- Forneça informações detalhadas

## Processo de Review

1. Abra PR
2. CI roda automaticamente
3. Maintainer faz code review
4. Ajustes se necessário
5. Aprovação e merge

## Dúvidas?

Abra uma [issue de discussão](https://github.com/nitai-bezerra/hyms-plat/issues).

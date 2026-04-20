# Upload de Hinários

Contribua com o portal enviando novos hinários.

## Pré-requisitos

Para fazer upload, você precisa:

- :material-check: Ter uma [conta criada](user-accounts.md)
- :material-check: Estar logado
- :material-check: Ter o hinário em formato YAML

## Formato YAML

O portal aceita hinários em formato YAML. Veja a estrutura:

```yaml
name: "Nome do Hinário"
owner_name: "Nome do Dono"
intro_name: "Nome Curto"  # opcional
description: "Descrição completa do hinário"

hymns:
  - number: 1
    title: "Título do Primeiro Hino"
    text: |
      Primeira estrofe do hino
      Com quebras de linha

      Segunda estrofe
      Também com quebras
    style: "Valsa"  # opcional
    received_at: "1930-07-15"  # opcional
    offered_to: "Nome"  # opcional

  - number: 2
    title: "Segundo Hino"
    text: |
      Letra do segundo hino...
```

### Campos Obrigatórios

| Campo | Descrição |
|-------|-----------|
| `name` | Nome completo do hinário |
| `owner_name` | Pessoa que recebeu o hinário |
| `hymns` | Lista de hinos |
| `hymns[].number` | Número sequencial |
| `hymns[].title` | Título do hino |
| `hymns[].text` | Letra completa |

### Campos Opcionais

| Campo | Descrição |
|-------|-----------|
| `intro_name` | Nome curto para exibição |
| `description` | Descrição do hinário |
| `hymns[].style` | Valsa, Marcha, Mazurca, etc. |
| `hymns[].received_at` | Data no formato YYYY-MM-DD |
| `hymns[].offered_to` | Pessoa dedicatária |
| `hymns[].repetitions` | Ex: "1-4, 5-8" |
| `hymns[].extra_instructions` | Instruções de canto |

## Fazendo Upload

### Passo 1: Acessar a Página

1. Faça login
2. Clique em **Contribuir** no menu

### Passo 2: Selecionar Arquivo

1. Clique em **Escolher arquivo** ou arraste o YAML
2. O sistema valida o formato automaticamente

### Passo 3: Preview

Após o upload, você verá um preview com:

- Nome do hinário
- Quantidade de hinos
- Lista de hinos detectados

!!! tip "Revisar"
    Verifique se todos os hinos foram detectados corretamente antes de confirmar.

### Passo 4: Verificação de Duplicatas

O sistema detecta automaticamente se o hinário já existe:

- Se for **novo**, vai direto para confirmação
- Se for **similar** a um existente, mostra opções

### Passo 5: Confirmar

1. Revise as informações
2. Clique em **Confirmar Upload**
3. O hinário é salvo e indexado

## Desambiguação

Se o sistema detectar um hinário similar:

### Opções Disponíveis

1. **Criar novo** - Trata como hinário diferente
2. **Atualizar existente** - Substitui o hinário atual
3. **Criar nova versão** - Mantém ambos como versões

### Critérios de Similaridade

O sistema compara:

- Nome do hinário
- Nome do dono
- Quantidade de hinos

!!! info "Threshold"
    Similaridade > 80% dispara a verificação de duplicata.

## Versionamento

Hinários podem ter múltiplas versões:

- **Versão atual** - A mais recente
- **Versões anteriores** - Histórico completo
- **Comparação** - Ver diferenças entre versões

## Diretrizes de Qualidade

### Fazer :material-check:

- Use ortografia correta
- Preserve formatação original
- Inclua metadados quando disponíveis
- Verifique números duplicados

### Evitar :material-close:

- Copiar de fontes protegidas sem permissão
- Informações falsas ou incorretas
- Conteúdo incompleto

## Após o Upload

Seu hinário:

1. É salvo no banco de dados
2. É indexado para busca
3. Aparece na lista de hinários
4. Você é creditado como contribuidor

## Problemas no Upload?

Se o upload falhar:

- Verifique o formato do YAML
- Use um [validador de YAML](https://www.yamllint.com/) online
- Veja [Solução de Problemas](troubleshooting.md)

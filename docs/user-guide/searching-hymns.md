# Como Buscar Hinos

O Portal de Hinários usa o [TypeSense](https://typesense.org/), um motor de busca moderno e rápido.

## Busca Simples

Para buscar hinos:

1. Digite o termo na barra de busca
2. Pressione ++enter++ ou clique no ícone de lupa
3. Veja os resultados ordenados por relevância

## O que Você Pode Buscar

A busca encontra correspondências em:

| Campo | Exemplo |
|-------|---------|
| **Título do hino** | "Lua Branca" |
| **Letra do hino** | "da luz serena" |
| **Nome do hinário** | "Cruzeiro" |
| **Nome do dono** | "Mestre Irineu" |

## Dicas de Busca

### Busca com Erro de Digitação

O sistema tolera pequenos erros:

```
"Irineu" → encontra "Mestre Irineu"
"lua bramca" → encontra "Lua Branca"
```

### Busca Parcial

Digite pelo menos 3 caracteres:

```
"luz" → encontra "Lua Branca da luz serena"
```

### Acentos

A busca ignora diferenças de acentuação:

```
"jose" → encontra "José"
"irmandade" → encontra "Irmandade"
```

### Múltiplas Palavras

Buscar por várias palavras retorna resultados que contenham todas:

```
"lua branca irineu" → hinos com "lua", "branca" E "irineu"
```

## Resultados da Busca

Cada resultado mostra:

- **Número e Título** do hino
- **Hinário** (nome e dono)
- **Preview da letra** (primeiras 40 palavras)
- **Estilo musical** (se disponível)

Os resultados são ordenados por relevância - os mais relevantes aparecem primeiro.

## Quando Não Encontrar

Se a busca retornar vazio:

1. :material-check: Verifique a ortografia
2. :material-check: Use palavras mais curtas
3. :material-check: Tente sinônimos ou variações
4. :material-check: Navegue manualmente pelos [Hinários](browsing-hymnbooks.md)

!!! info "O hino não existe?"
    Se você tem o hino em formato digital, considere [contribuir](uploading-hymnbooks.md) com o portal!

## Busca Avançada

Na página de busca (`/busca/`), você pode:

- Filtrar por hinário
- Filtrar por estilo musical
- Ordenar resultados

!!! note "Em desenvolvimento"
    Filtros avançados serão adicionados em versões futuras.

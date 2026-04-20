# Sobre o Projeto

## O que é o Portal de Hinários?

O **Portal de Hinários do Santo Daime** é uma plataforma web dedicada à preservação e compartilhamento dos hinários do Santo Daime, uma tradição religiosa brasileira.

## Missão

Preservar e tornar acessível o rico patrimônio musical e espiritual do Santo Daime, facilitando o acesso às letras dos hinos para praticantes e pesquisadores.

## Características Principais

### Busca Inteligente

O portal utiliza [TypeSense](https://typesense.org/), um motor de busca moderno que oferece:

- **Tolerância a erros de digitação** - Encontra resultados mesmo com pequenos erros
- **Busca instantânea** - Resultados em milissegundos
- **Relevância** - Resultados ordenados por relevância

### Navegação Intuitiva

- Interface limpa e organizada
- Navegação por hinários completos
- Visualização formatada das letras

### Contribuição Comunitária

- Upload de hinários em formato YAML
- Validação automática de duplicatas
- Sistema de moderação

## Stack Tecnológico

O projeto é desenvolvido com tecnologias modernas e robustas:

| Componente | Tecnologia |
|------------|------------|
| Backend | Django 5.1 + Python 3.11+ |
| CMS | Wagtail 6.4 |
| Banco de Dados | PostgreSQL 16 |
| Busca | TypeSense 27.1 |
| Task Queue | Celery + Redis |
| Testes | pytest (290+ testes) |

## Código Aberto

Este projeto é código aberto e aceita contribuições da comunidade. Veja nosso [guia de contribuição](developer-guide/contributing/getting-started.md).

## Contato

- **GitHub:** [hymns-plat](https://github.com/nitai-bezerra/hymns-plat)
- **Issues:** [Reportar problema](https://github.com/nitai-bezerra/hymns-plat/issues)

## Licença

Este projeto está licenciado sob os termos da licença MIT.

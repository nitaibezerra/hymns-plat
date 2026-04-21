# Solução de Problemas

Encontrou um problema? Veja as soluções abaixo.

## Problemas Comuns

### Busca não retorna resultados

**Sintoma:** Busca vazia ou "Nenhum resultado encontrado"

**Soluções:**

1. :material-check: Verifique a ortografia
2. :material-check: Use 3+ caracteres
3. :material-check: Tente palavras diferentes
4. :material-check: Limpe o cache do navegador
5. :material-check: Recarregue a página

!!! info "Problema temporário?"
    Se o problema persistir, pode ser uma questão temporária de indexação. Aguarde alguns minutos.

---

### Página não carrega

**Sintoma:** Tela branca ou erro 500

**Soluções:**

1. :material-check: Recarregue a página (++ctrl+r++ ou ++cmd+r++)
2. :material-check: Limpe o cache: ++ctrl+shift+del++
3. :material-check: Tente outro navegador
4. :material-check: Desative extensões (modo anônimo)
5. :material-check: Verifique sua conexão de internet

---

### Imagens não aparecem

**Sintoma:** Capas de hinários não carregam

**Soluções:**

1. :material-check: Aguarde carregamento completo
2. :material-check: Recarregue a página
3. :material-check: Verifique se extensões bloqueiam imagens (AdBlock)
4. :material-check: Limpe o cache

---

### Login não funciona

**Sintoma:** "Email ou senha incorretos"

**Soluções:**

1. :material-check: Verifique o Caps Lock
2. :material-check: Tente recuperar senha
3. :material-check: Use login social (Google)
4. :material-check: Limpe cookies do site

---

### Upload falha

**Sintoma:** Erro ao fazer upload de YAML

**Soluções:**

1. :material-check: Verifique tamanho do arquivo (máximo 10MB)
2. :material-check: Valide a estrutura do YAML em [yamllint.com](https://www.yamllint.com/)
3. :material-check: Verifique campos obrigatórios
4. :material-check: Tente navegador diferente

**Erros comuns no YAML:**

```yaml
# ERRADO - falta campo name
owner_name: "João"
hymns: []

# CORRETO
name: "Hinário do João"
owner_name: "João"
hymns: []
```

---

### Áudio não toca

**Sintoma:** Player não reproduz

**Soluções:**

1. :material-check: Verifique volume do sistema e do player
2. :material-check: Tente outro navegador
3. :material-check: Verifique se há bloqueador de áudio
4. :material-check: Recarregue a página
5. :material-check: Limpe o cache

---

### Favoritos não salvam

**Sintoma:** Clico em favoritar mas não funciona

**Soluções:**

1. :material-check: Verifique se está logado
2. :material-check: Recarregue a página e tente novamente
3. :material-check: Verifique console do navegador (F12)

---

### Notificações não aparecem

**Sintoma:** Não recebo notificações

**Soluções:**

1. :material-check: Verifique configurações de notificação no perfil
2. :material-check: Verifique se o navegador permite notificações
3. :material-check: Limpe o cache

---

## Reportar Problema

Se nenhuma solução funcionou:

### 1. Verifique Issues Existentes

Acesse [GitHub Issues](https://github.com/nitai-bezerra/hymns-plat/issues) e busque pelo problema.

### 2. Crie Novo Issue

Se não encontrou, crie um novo issue com:

**Informações necessárias:**

- [ ] Descrição clara do problema
- [ ] Passos para reproduzir
- [ ] Comportamento esperado vs. atual
- [ ] Screenshots (se aplicável)
- [ ] Navegador e versão
- [ ] Sistema operacional

**Template:**

```markdown
## Descrição
[Descreva o problema]

## Passos para Reproduzir
1. Vá para '...'
2. Clique em '...'
3. Veja o erro

## Comportamento Esperado
[O que deveria acontecer]

## Comportamento Atual
[O que está acontecendo]

## Screenshots
[Anexe imagens se relevante]

## Ambiente
- Navegador: Chrome 120
- Sistema: macOS 14.0
```

---

## Contato Direto

Para problemas urgentes:

- :material-github: [GitHub Issues](https://github.com/nitai-bezerra/hymns-plat/issues) (preferencial)

---

## Dicas Gerais

### Limpar Cache

=== "Chrome"
    ++ctrl+shift+del++ → Selecione "Imagens e arquivos em cache" → Limpar

=== "Firefox"
    ++ctrl+shift+del++ → Selecione "Cache" → Limpar

=== "Safari"
    Develop → Empty Caches

### Modo Anônimo

Testar em modo anônimo ajuda a identificar se o problema é causado por extensões:

=== "Chrome"
    ++ctrl+shift+n++

=== "Firefox"
    ++ctrl+shift+p++

=== "Safari"
    ++cmd+shift+n++

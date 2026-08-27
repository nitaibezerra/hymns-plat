# Deploy da SPA — `beta.hinaria.com.br`

A SPA SvelteKit é publicada num **Cloudflare Worker com static assets**
(`hinaria-beta`), e fala com o Django que já está em produção em
`https://hinaria.com.br/graphql/`.

```
push em development
   → .github/workflows/deploy-web.yml
   → pnpm build:deploy   (guard de env + vite build → .svelte-kit/cloudflare/)
   → wrangler deploy     (lê web/wrangler.jsonc)
   → https://beta.hinaria.com.br
```

## Workers, não Pages

O plano original dizia Pages. O token da Cloudflare desta conta gerencia zona
(DNS) e Workers, mas responde `Authentication error` em `/pages/projects`, e
não consegue emitir tokens novos. Workers com static assets entrega a mesma
coisa (SSR + assets no edge) com a permissão que existe.

Foi isso que obrigou o upgrade do `@sveltejs/adapter-cloudflare` **4.9.0 →
7.2.9**: a linha 4.x só emite o formato de Pages Functions. Da 5.0.0 em diante
o adapter lê `wrangler.jsonc` e decide o formato por ele — `main` + `assets`
presentes significa Worker.

Como reconhecer o formato certo em `.svelte-kit/cloudflare/`:

| Arquivo | Pages (antigo) | Worker (atual) |
|---|---|---|
| `_worker.js` | sim | sim |
| `_routes.json` | **sim** | não |
| `.assetsignore` | não | **sim** |

Se `_routes.json` reaparecer, o build voltou a mirar Pages — quase sempre
porque `wrangler.jsonc` deixou de ser encontrado.

## Por que dispara em `development`

O beta existe pra **ver antes de promover**. Espelhando `main` ele só mostraria
o que já está em produção, e `hinaria.com.br` já faz isso. Apontado pra
`development`, cada PR mergeada aparece no beta em minutos e o degrau
`development → main` vira decisão tomada olhando pra coisa rodando.

O workflow **não** roda a suíte: `ci-web.yml` já é required em `development`.

## `VITE_GRAPHQL_URL` é build-time

`src/lib/config.ts` resolve a URL do GraphQL no **import**, então ela fica
embutida no bundle e não dá pra corrigir sem rebuildar. Com a URL errada o
visitante recebe erro de **CORS** — o sintoma errado, que já custou tempo a
este projeto.

Por isso o deploy usa `pnpm build:deploy` (nunca `pnpm build`), que aborta
antes do Vite se a variável estiver vazia ou apontando pra `localhost` /
`127.0.0.1` / `0.0.0.0`. O workflow ainda confere a **saída**, procurando a URL
no bundle gerado — o guard cobre a entrada, o grep cobre o artefato.

Pra reproduzir na máquina exatamente o que o CI builda:

```bash
cd web
VITE_GRAPHQL_URL=https://hinaria.com.br/graphql/ pnpm build:deploy
pnpm exec wrangler deploy --dry-run --outdir /tmp/dryrun   # valida sem credencial
```

## Repasse de cookie no SSR

`src/hooks.server.ts` põe o cookie do visitante nas chamadas de servidor
**apenas** quando o destino tem a mesma origem de `GRAPHQL_URL`. Com
`https://hinaria.com.br/graphql/`, isso é `https://hinaria.com.br` e mais nada:
nem `beta.hinaria.com.br`, nem `api.hinaria.com.br`, nem outra porta ou
esquema. Verificado contra o artefato buildado, não só contra o fonte.

Duas coisas que **não** dependem deste repo e precisam existir no Django pro
beta funcionar logado:

- CORS e `CSRF_TRUSTED_ORIGINS` aceitando `https://beta.hinaria.com.br`;
- cookie de sessão com domínio `.hinaria.com.br` (se ficar host-only em
  `hinaria.com.br`, o browser nunca manda cookie no request pro beta e o SSR
  não tem o que repassar).

## Secrets e config

| Onde | O quê |
|---|---|
| Secret `CLOUDFLARE_API_TOKEN` | Workers Scripts:Edit + Zone DNS:Edit |
| Secret `CLOUDFLARE_ACCOUNT_ID` | `30e42ee3dd44243e67f0824fb1477351` |
| `web/wrangler.jsonc` | nome, `main`, `assets`, compat date/flags, custom domain |

`beta.hinaria.com.br` é declarado como **custom domain** — é ele que cria o
registro DNS *e* a rota. Se alguém criar um A/CNAME `beta` à mão antes, o
deploy falha com conflito de registro; o conserto é apagar o registro e deixar
o custom domain criá-lo.

`workers_dev` fica ligado de propósito: `hinaria-beta.<subdomínio>.workers.dev`
é como se distingue "deploy quebrou" de "deploy foi, DNS ainda não".

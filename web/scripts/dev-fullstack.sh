#!/usr/bin/env bash
# Marco 4.I — orquestra Django + SvelteKit dev pra suíte de paridade visual
# rodar contra ambos.
#
# Uso:
#   ./scripts/dev-fullstack.sh           # sobe ambos e volta
#   ./scripts/dev-fullstack.sh down      # mata os dois
#   ./scripts/dev-fullstack.sh env       # só imprime a config resolvida
#
# Pré-requisitos:
#   - docker compose up -d  (Postgres + Redis no main worktree)
#   - .env preenchido em DJANGO_REPO_ROOT
#   - uv sync no DJANGO_REPO_ROOT
#   - pnpm install no web/
#
# Decisões fixadas:
#   - Repo Django como referência: /Users/nitai/dev/hyms-platform/hymns-plat
#     (NÃO modifique; só lê código + serve HTTP). Configurável via
#     DJANGO_REPO_ROOT.
#   - **Portas configuráveis** (DJANGO_PORT / SVELTE_PORT). Com várias frentes
#     em worktrees paralelos, :9000 e :5173 vivem ocupadas; a versão anterior
#     encontrava o servidor de outra pessoa na porta e reportava "OK",
#     produzindo medição de paridade contra o app errado. Agora o script
#     ABORTA se a porta já está em uso.
#   - **VITE_GRAPHQL_URL aponta pro Django que este script sobe.**
#     `src/lib/config.ts` cai em `http://localhost:8000/graphql/` quando a env
#     não está setada — ou seja, sem isso o shell conversa com o que estiver na
#     :8000, não com o Django da comparação. Env externa tem precedência.
#   - Logs e pidfiles são por porta (`/tmp/hinaria-django-<porta>.log` etc.),
#     pra dois worktrees não se atropelarem.
#   - Espera as duas portas responderem (até 60s) e aborta se o processo que
#     subimos morrer no meio.

set -euo pipefail

DJANGO_REPO_ROOT="${DJANGO_REPO_ROOT:-/Users/nitai/dev/hyms-platform/hymns-plat}"
WEB_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DJANGO_PORT="${DJANGO_PORT:-9000}"
SVELTE_PORT="${SVELTE_PORT:-5173}"
VITE_GRAPHQL_URL="${VITE_GRAPHQL_URL:-http://localhost:${DJANGO_PORT}/graphql/}"
DJANGO_LOG="/tmp/hinaria-django-${DJANGO_PORT}.log"
SVELTE_LOG="/tmp/hinaria-svelte-${SVELTE_PORT}.log"
DJANGO_PID="/tmp/hinaria-django-${DJANGO_PORT}.pid"
SVELTE_PID="/tmp/hinaria-svelte-${SVELTE_PORT}.pid"

print_env() {
  cat <<EOF
DJANGO_REPO_ROOT=$DJANGO_REPO_ROOT
WEB_ROOT=$WEB_ROOT
DJANGO_PORT=$DJANGO_PORT
SVELTE_PORT=$SVELTE_PORT
VITE_GRAPHQL_URL=$VITE_GRAPHQL_URL
DJANGO_LOG=$DJANGO_LOG
SVELTE_LOG=$SVELTE_LOG
DJANGO_PID=$DJANGO_PID
SVELTE_PID=$SVELTE_PID
HINARIA_DJANGO_BASE_URL=http://localhost:$DJANGO_PORT
HINARIA_SVELTE_BASE_URL=http://localhost:$SVELTE_PORT
EOF
}

stop_all() {
  echo "[dev-fullstack] parando processos..."
  for pidfile in "$DJANGO_PID" "$SVELTE_PID"; do
    if [[ -f "$pidfile" ]]; then
      pid="$(cat "$pidfile" 2>/dev/null || true)"
      if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
      fi
      rm -f "$pidfile"
    fi
  done
}

port_in_use() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

require_free_port() {
  local port="$1"
  local label="$2"
  if port_in_use "$port"; then
    echo "[dev-fullstack] ERRO: :$port já está em uso — não vou sequestrar o" >&2
    echo "  servidor de outra pessoa. Rode com ${label}_PORT=<outra porta>," >&2
    echo "  e passe a mesma porta pra suíte via HINARIA_*_BASE_URL." >&2
    exit 1
  fi
}

wait_port() {
  local port="$1"
  local label="$2"
  local pidfile="$3"
  local tries=60
  while (( tries-- > 0 )); do
    local pid
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && ! kill -0 "$pid" 2>/dev/null; then
      echo "[dev-fullstack] ERRO: $label morreu ao subir. Veja o log." >&2
      return 1
    fi
    if port_in_use "$port"; then
      echo "[dev-fullstack] $label OK em :$port"
      return 0
    fi
    sleep 1
  done
  echo "[dev-fullstack] ERRO: $label não respondeu em :$port (60s)" >&2
  return 1
}

case "${1:-up}" in
  env)
    print_env
    exit 0
    ;;
  down)
    stop_all
    exit 0
    ;;
esac

# limpa qualquer corrida anterior NOSSA (mesmas portas)
stop_all
require_free_port "$DJANGO_PORT" "DJANGO"
require_free_port "$SVELTE_PORT" "SVELTE"

echo "[dev-fullstack] subindo Django em :$DJANGO_PORT ..."
(
  cd "$DJANGO_REPO_ROOT"
  DJANGO_SETTINGS_MODULE=config.settings.local \
    uv run python manage.py runserver "$DJANGO_PORT" --noreload \
    > "$DJANGO_LOG" 2>&1 &
  echo $! > "$DJANGO_PID"
)

echo "[dev-fullstack] subindo SvelteKit em :$SVELTE_PORT ..."
echo "[dev-fullstack]   VITE_GRAPHQL_URL=$VITE_GRAPHQL_URL"
(
  cd "$WEB_ROOT"
  VITE_GRAPHQL_URL="$VITE_GRAPHQL_URL" \
    pnpm dev --port "$SVELTE_PORT" --strictPort > "$SVELTE_LOG" 2>&1 &
  echo $! > "$SVELTE_PID"
)

wait_port "$DJANGO_PORT" "Django" "$DJANGO_PID"
wait_port "$SVELTE_PORT" "SvelteKit" "$SVELTE_PID"

echo "[dev-fullstack] tudo no ar."
echo "  Django  → http://localhost:$DJANGO_PORT/ (log: $DJANGO_LOG)"
echo "  Svelte  → http://localhost:$SVELTE_PORT/ (log: $SVELTE_LOG)"
echo "  Suíte   → HINARIA_DJANGO_BASE_URL=http://localhost:$DJANGO_PORT \\"
echo "            HINARIA_SVELTE_BASE_URL=http://localhost:$SVELTE_PORT \\"
echo "            pnpm test:e2e:parity"
echo "  Pra parar: $0 down"

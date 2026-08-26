#!/usr/bin/env bash
# Marco 4.I — orquestra Django + SvelteKit dev pra suíte de paridade visual
# rodar contra ambos.
#
# Uso:
#   ./scripts/dev-fullstack.sh           # semeia, sobe ambos e volta
#   ./scripts/dev-fullstack.sh down      # mata os dois
#   ./scripts/dev-fullstack.sh env       # só imprime a config resolvida
#   ./scripts/dev-fullstack.sh seed      # só (re)semeia o banco
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
#   - **Semeia o banco antes de subir** (`manage.py seed_e2e`, Frente C).
#     "Subir o ambiente" e "ter dados previsíveis" viram um passo só: sem
#     isso, quem roda a suíte mede o banco que estiver por perto, que é
#     justamente o que reprovou as duas tentativas anteriores de job de
#     Playwright no CI. `SEED_E2E=0` desliga; `--reset` limpa o que corridas
#     anteriores da suíte deixaram (`SEED_E2E_ARGS=--reset`).
#   - A senha da fixture NÃO é impressa. `env` mostra só a origem dela
#     (`ambiente` ou `default-de-dev`) — o suficiente pra diagnosticar
#     "por que meu login falhou" sem despejar credencial em log de CI.

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

# --- fixture E2E (ver apps/hymns/management/commands/seed_e2e.py) -----------
# Os defaults abaixo TÊM que bater com os do comando Django e com os de
# `tests/e2e/_helpers/seed-fixture.ts`: são as três pontas do mesmo contrato.
DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings.local}"
SEED_E2E="${SEED_E2E:-1}"
SEED_E2E_ARGS="${SEED_E2E_ARGS:-}"
SEED_COMMAND="uv run python manage.py seed_e2e ${SEED_E2E_ARGS}"
HINARIA_E2E_EDITOR_USERNAME="${HINARIA_E2E_EDITOR_USERNAME:-e2e-editor}"
HINARIA_E2E_VIEWER_USERNAME="${HINARIA_E2E_VIEWER_USERNAME:-e2e-viewer}"
if [[ -n "${HINARIA_E2E_PASSWORD:-}" ]]; then
  HINARIA_E2E_PASSWORD_ORIGEM="ambiente"
else
  HINARIA_E2E_PASSWORD_ORIGEM="default-de-dev"
fi

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
DJANGO_SETTINGS_MODULE=$DJANGO_SETTINGS_MODULE
SEED_E2E=$SEED_E2E
SEED_COMMAND=$SEED_COMMAND
HINARIA_E2E_EDITOR_USERNAME=$HINARIA_E2E_EDITOR_USERNAME
HINARIA_E2E_VIEWER_USERNAME=$HINARIA_E2E_VIEWER_USERNAME
HINARIA_E2E_PASSWORD_ORIGEM=$HINARIA_E2E_PASSWORD_ORIGEM
HINARIA_DJANGO_BASE_URL=http://localhost:$DJANGO_PORT
HINARIA_SVELTE_BASE_URL=http://localhost:$SVELTE_PORT
EOF
}

run_seed() {
  if [[ "$SEED_E2E" != "1" ]]; then
    echo "[dev-fullstack] SEED_E2E=$SEED_E2E — pulando o seed."
    return 0
  fi
  echo "[dev-fullstack] semeando o banco ($SEED_COMMAND)..."
  (
    cd "$DJANGO_REPO_ROOT"
    DJANGO_SETTINGS_MODULE="$DJANGO_SETTINGS_MODULE" $SEED_COMMAND
  )
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
  seed)
    SEED_E2E=1
    run_seed
    exit 0
    ;;
esac

# limpa qualquer corrida anterior NOSSA (mesmas portas)
stop_all
require_free_port "$DJANGO_PORT" "DJANGO"
require_free_port "$SVELTE_PORT" "SVELTE"

# Antes de subir: com o servidor no ar o seed continuaria funcionando, mas um
# `runserver` que já respondeu request contra banco vazio confunde quem lê o
# log. Semear primeiro deixa a ordem dos fatos legível.
run_seed

echo "[dev-fullstack] subindo Django em :$DJANGO_PORT ..."
(
  cd "$DJANGO_REPO_ROOT"
  DJANGO_SETTINGS_MODULE="$DJANGO_SETTINGS_MODULE" \
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
echo "  Fixture → editor=$HINARIA_E2E_EDITOR_USERNAME comum=$HINARIA_E2E_VIEWER_USERNAME"
echo "            senha: $HINARIA_E2E_PASSWORD_ORIGEM"
echo "  Paridade → HINARIA_DJANGO_BASE_URL=http://localhost:$DJANGO_PORT \\"
echo "             HINARIA_SVELTE_BASE_URL=http://localhost:$SVELTE_PORT \\"
echo "             pnpm test:e2e:parity"
echo "  Workspace → HINARIA_E2E_PLAYWRIGHT_READY=1 \\"
echo "              HINARIA_SVELTE_BASE_URL=http://localhost:$SVELTE_PORT \\"
echo "              HINARIA_DJANGO_BASE_URL=http://localhost:$DJANGO_PORT \\"
echo "              pnpm exec playwright test --project=chromium \\"
echo "                tests/e2e/editor-dashboard.spec.ts \\"
echo "                tests/e2e/editor-crud.spec.ts \\"
echo "                tests/e2e/revise-hymn.spec.ts"
echo "  Pra parar: $0 down"

#!/usr/bin/env bash
# Marco 4.I — orquestra Django (port 9000) + SvelteKit dev (port 5173)
# pra suíte de paridade visual rodar contra ambos.
#
# Uso:
#   ./scripts/dev-fullstack.sh           # sobe ambos e fica em foreground
#   ./scripts/dev-fullstack.sh down      # mata os dois
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
#   - Logs em /tmp/hinaria-django.log e /tmp/hinaria-svelte.log pra
#     debug; PIDs em /tmp/hinaria-django.pid e /tmp/hinaria-svelte.pid.
#   - Espera ambas as portas responderem antes de retornar (até 60s).

set -euo pipefail

DJANGO_REPO_ROOT="${DJANGO_REPO_ROOT:-/Users/nitai/dev/hyms-platform/hymns-plat}"
WEB_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DJANGO_PORT=9000
SVELTE_PORT=5173
DJANGO_LOG=/tmp/hinaria-django.log
SVELTE_LOG=/tmp/hinaria-svelte.log
DJANGO_PID=/tmp/hinaria-django.pid
SVELTE_PID=/tmp/hinaria-svelte.pid

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

wait_port() {
  local port="$1"
  local label="$2"
  local tries=60
  while (( tries-- > 0 )); do
    if curl -fsS "http://localhost:${port}/" -o /dev/null --max-time 1 \
       || curl -sS "http://localhost:${port}/" -o /dev/null --max-time 1 -w "%{http_code}" \
          | grep -qE "^[2345]"; then
      echo "[dev-fullstack] $label OK em :$port"
      return 0
    fi
    sleep 1
  done
  echo "[dev-fullstack] ERRO: $label não respondeu em :$port (60s)" >&2
  return 1
}

if [[ "${1:-up}" == "down" ]]; then
  stop_all
  exit 0
fi

# limpa qualquer corrida anterior
stop_all

echo "[dev-fullstack] subindo Django em :$DJANGO_PORT ..."
(
  cd "$DJANGO_REPO_ROOT"
  DJANGO_SETTINGS_MODULE=config.settings.local \
    uv run python manage.py runserver "$DJANGO_PORT" --noreload \
    > "$DJANGO_LOG" 2>&1 &
  echo $! > "$DJANGO_PID"
)

echo "[dev-fullstack] subindo SvelteKit em :$SVELTE_PORT ..."
(
  cd "$WEB_ROOT"
  pnpm dev --port "$SVELTE_PORT" > "$SVELTE_LOG" 2>&1 &
  echo $! > "$SVELTE_PID"
)

wait_port "$DJANGO_PORT" "Django"
wait_port "$SVELTE_PORT" "SvelteKit"

echo "[dev-fullstack] tudo no ar."
echo "  Django  → http://localhost:$DJANGO_PORT/ (log: $DJANGO_LOG)"
echo "  Svelte  → http://localhost:$SVELTE_PORT/ (log: $SVELTE_LOG)"
echo "  Pra parar: $0 down"

#!/usr/bin/env bash
# Ralph-Loop verification helper.
#   scripts/ralph-verify.sh check   -> install deps if needed, run tsc + tests
#   scripts/ralph-verify.sh serve   -> start the dev server in the background for Playwright
#   scripts/ralph-verify.sh stop    -> stop a dev server started by this script
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

PORT="${PORT:-3000}"
PIDFILE=".ralph-dev.pid"
LOGFILE=".ralph-dev.log"

ensure_deps() {
  if [ ! -d node_modules ]; then
    echo "==> Installing dependencies (pnpm install)…"
    pnpm install --frozen-lockfile || pnpm install || { echo "!! pnpm install failed"; return 1; }
  fi
}

case "${1:-check}" in
  check)
    ensure_deps || exit 1
    echo "==> Type-check (pnpm check)…"
    pnpm check; CHECK=$?
    echo "==> Tests (pnpm test)…"
    pnpm test; TEST=$?
    echo "----"
    echo "tsc exit=$CHECK   test exit=$TEST"
    [ $CHECK -eq 0 ] && [ $TEST -eq 0 ] && echo "GATES: GREEN" || echo "GATES: RED — fix before marking task done"
    exit $(( CHECK != 0 || TEST != 0 ))
    ;;
  serve)
    ensure_deps || exit 1
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "==> Dev server already running (pid $(cat "$PIDFILE")) on port $PORT"; exit 0
    fi
    echo "==> Starting dev server (pnpm dev) on port $PORT …"
    if [ -f .env ]; then
      # The app does not import dotenv — load .env into the server's environment here.
      set -a; . ./.env; set +a
      echo "==> .env geladen (DATABASE_URL ${DATABASE_URL:+gesetzt})"
    elif [ -f .env.example ]; then
      echo "!! No .env found — dev server may fail without DATABASE_URL etc. (see .env.example)"
    fi
    nohup pnpm dev > "$LOGFILE" 2>&1 &
    echo $! > "$PIDFILE"
    # Wait up to 60s for the port to answer
    for i in $(seq 1 60); do
      if curl -sf "http://localhost:$PORT" >/dev/null 2>&1; then
        echo "==> Dev server is up: http://localhost:$PORT"; exit 0
      fi
      sleep 1
    done
    echo "!! Dev server did not become ready in 60s. Last log lines:"; tail -n 30 "$LOGFILE"; exit 1
    ;;
  stop)
    if [ -f "$PIDFILE" ]; then
      kill "$(cat "$PIDFILE")" 2>/dev/null && echo "==> Stopped dev server" || echo "==> No running server"
      rm -f "$PIDFILE"
    else
      echo "==> No pidfile; nothing to stop"
    fi
    ;;
  *)
    echo "usage: $0 {check|serve|stop}"; exit 2;;
esac

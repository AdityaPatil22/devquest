#!/usr/bin/env bash

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$PLUGIN_ROOT/.." && pwd)"

SERVER_HOST="${DEVQUEST_HOST:-127.0.0.1}"
SERVER_PORT="${DEVQUEST_PORT:-8000}"
GAME_PORT="${DEVQUEST_GAME_PORT:-5173}"

SERVER_URL="http://${SERVER_HOST}:${SERVER_PORT}"
GAME_URL="http://127.0.0.1:${GAME_PORT}"

cleanup() {
    echo
    echo "Stopping DevQuest..."

    if [[ -n "${SERVER_PID:-}" ]]; then
        kill "$SERVER_PID" 2>/dev/null || true
    fi

    if [[ -n "${GAME_PID:-}" ]]; then
        kill "$GAME_PID" 2>/dev/null || true
    fi
}

trap cleanup EXIT INT TERM

echo "Starting DevQuest..."

if curl -fsS "${SERVER_URL}/api/health" >/dev/null 2>&1; then
    echo "Using existing server at ${SERVER_URL}"
else
    echo "Starting FastAPI server..."

    cd "${REPO_ROOT}/apps/server"

    uv run uvicorn \
        app.main:app \
        --host "${SERVER_HOST}" \
        --port "${SERVER_PORT}" \
        >"${TMPDIR:-/tmp}/devquest-server.log" 2>&1 &

    SERVER_PID=$!

    for _ in {1..30}; do
        if curl -fsS "${SERVER_URL}/api/health" >/dev/null 2>&1; then
            break
        fi

        if ! kill -0 "$SERVER_PID" 2>/dev/null; then
            echo "Error: DevQuest server failed to start."
            cat "${TMPDIR:-/tmp}/devquest-server.log"
            exit 1
        fi

        sleep 1
    done

    if ! curl -fsS "${SERVER_URL}/api/health" >/dev/null 2>&1; then
        echo "Error: DevQuest server did not become ready."
        cat "${TMPDIR:-/tmp}/devquest-server.log"
        exit 1
    fi
fi

echo "Starting Phaser game..."

cd "${REPO_ROOT}/apps/game"

VITE_SHOW_DEV_TOOLBAR=false npm run dev -- \
    --host 127.0.0.1 \
    --port "$GAME_PORT" \
    >"${TMPDIR:-/tmp}/devquest-game.log" 2>&1 &

GAME_PID=$!

for _ in {1..30}; do
    if curl -fsS "${GAME_URL}" >/dev/null 2>&1; then
        break
    fi

    if ! kill -0 "$GAME_PID" 2>/dev/null; then
        echo "Error: DevQuest game failed to start."
        cat "${TMPDIR:-/tmp}/devquest-game.log"
        exit 1
    fi

    sleep 1
done

if ! curl -fsS "${GAME_URL}" >/dev/null 2>&1; then
    echo "Error: DevQuest game did not become ready."
    cat "${TMPDIR:-/tmp}/devquest-game.log"
    exit 1
fi

echo
echo "DevQuest is running:"
echo "${GAME_URL}"
echo
echo "Press Ctrl+C to stop."

wait "$GAME_PID"
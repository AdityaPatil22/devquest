#!/usr/bin/env bash

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$PLUGIN_ROOT/.." && pwd)"

echo "Installing DevQuest runtime..."

command -v node >/dev/null 2>&1 || {
    echo "Error: Node.js is required."
    exit 1
}

command -v npm >/dev/null 2>&1 || {
    echo "Error: npm is required."
    exit 1
}

command -v uv >/dev/null 2>&1 || {
    echo "Error: uv is required."
    exit 1
}

command -v python3 >/dev/null 2>&1 || {
    echo "Error: Python 3 is required."
    exit 1
}

python_version="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"

case "$python_version" in
    3.12|3.13|3.14)
        ;;
    *)
        echo "Error: Python 3.12+ is required. Found Python $python_version."
        exit 1
        ;;
esac

echo "Installing game dependencies..."
cd "$REPO_ROOT/apps/game"
npm install

echo "Installing server dependencies..."
cd "$REPO_ROOT/apps/server"
uv sync

echo "Building game..."
cd "$REPO_ROOT"
make build

echo
echo "DevQuest installation complete."
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  echo "Copy .env.production.example to .env.production and fill in secrets first."
  exit 1
fi

docker compose \
  --env-file "$ENV_FILE" \
  -f "$ROOT_DIR/compose.prod.yml" \
  up -d --build

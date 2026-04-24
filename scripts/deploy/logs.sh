#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
SERVICES=("$@")

if [[ ${#SERVICES[@]} -eq 0 ]]; then
  SERVICES=(app caddy db)
fi

docker compose \
  --env-file "$ENV_FILE" \
  -f "$ROOT_DIR/compose.prod.yml" \
  logs -f "${SERVICES[@]}"

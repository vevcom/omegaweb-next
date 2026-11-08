#!/bin/bash
set -e
compose=(docker compose --env-file .env --env-file deploy/base/postgres.env -f docker-compose.dev.yml)
trap '"${compose[@]}" down' EXIT
"${compose[@]}" up --build -d
"${compose[@]}" logs omegaweb-next --follow

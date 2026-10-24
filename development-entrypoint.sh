#!/bin/bash
set -e
trap "docker compose -f docker-compose.dev.yml down" EXIT
docker compose -f docker-compose.dev.yml up --build -d
docker compose -f docker-compose.dev.yml logs omegaweb-next --follow

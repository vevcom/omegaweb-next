#!/bin/bash
# Starts the development stack and follows the app's log. With --mail, the mail server from the
# mail-infrastructure submodule comes up too, and with --chat the chat from the chat-infrastructure
# submodule, see README.md.
set -e
compose=(docker compose --env-file .env --env-file deploy/base/postgres.env -f docker-compose.dev.yml)
for arg in "$@"; do
    case $arg in
        --mail)
            git submodule update --init mail-infrastructure
            compose+=(-f docker-compose.mail.yml)
            ;;
        --chat)
            git submodule update --init chat-infrastructure
            compose+=(-f docker-compose.chat.yml)
            ;;
        *)
            echo "Usage: $0 [--mail] [--chat]" >&2
            exit 2
            ;;
    esac
done
trap '"${compose[@]}" down' EXIT
"${compose[@]}" up --build -d
"${compose[@]}" logs omegaweb-next --follow

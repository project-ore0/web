#!/usr/bin/env sh

SCRIPT_DIR=$(dirname "$(readlink -f "$0")")

echo "Creating .env file with environment variables..."

if [ ! -f .env ]; then
    cat <<EOL > "${SCRIPT_DIR}/.env"
USERNAME=$(id -un)
USER_UID=$(id -u)
USER_GID=$(id -g)
EOL
    echo ".env file created."
fi

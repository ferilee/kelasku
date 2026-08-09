#!/usr/bin/env bash
set -Eeuo pipefail

# Run this from the cloned WebKelas repository on the Proxmox VM.
# It creates only the persistent directories required by the production Compose.

APP_DIR=/srv/apps/webkelas
DATA_DIR=/srv/data/webkelas/sqlite
BACKUP_DIR=/srv/backups/webkelas
OWNER="${SUDO_USER:-$USER}"

sudo install -d -m 0750 -o "$OWNER" -g "$OWNER" "$APP_DIR" "$DATA_DIR" "$BACKUP_DIR"

if ! sudo docker network inspect ferileenet >/dev/null 2>&1; then
  sudo docker network create ferileenet
fi

printf 'Folder deployment siap:\n- %s\n- %s\n- %s\n' "$APP_DIR" "$DATA_DIR" "$BACKUP_DIR"
printf 'Network Docker ferileenet siap.\n'

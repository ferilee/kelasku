#!/usr/bin/env bash
set -Eeuo pipefail

# Creates a consistent SQLite backup by briefly stopping only WebKelas.
# Run with sudo from the Proxmox VM, for example through cron.

APP_DIR=/srv/apps/webkelas
COMPOSE_FILE="$APP_DIR/docker-compose.production.yml"
DATA_FILE=/srv/data/webkelas/sqlite/sqlite.db
BACKUP_DIR=/srv/backups/webkelas
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/sqlite-$STAMP.db"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Compose tidak ditemukan: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$DATA_FILE" ]]; then
  echo "Database tidak ditemukan: $DATA_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
umask 077

WAS_RUNNING=false
if docker compose -f "$COMPOSE_FILE" ps --status running --services | grep -qx app; then
  WAS_RUNNING=true
fi

restart_app() {
  if [[ "$WAS_RUNNING" == true ]]; then
    docker compose -f "$COMPOSE_FILE" start app >/dev/null 2>&1 || true
  fi
}
trap restart_app EXIT

if [[ "$WAS_RUNNING" == true ]]; then
  docker compose -f "$COMPOSE_FILE" stop -t 30 app
fi
cp --preserve=mode,timestamps "$DATA_FILE" "$BACKUP_FILE"
echo "Backup selesai: $BACKUP_FILE"

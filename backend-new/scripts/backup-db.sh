#!/bin/bash
# Backup diário do banco MySQL de produção — Gestão de Envios
# Lê credenciais direto do .env do Laravel (não hardcoded).
# Mantém os últimos KEEP_DAYS dias, apaga o resto.
#
# Instalação (rodar uma vez no servidor):
#   chmod +x /var/www/gestaodeenvios/backend-new/scripts/backup-db.sh
#   crontab -e
#   # adicionar a linha:
#   0 3 * * * /var/www/gestaodeenvios/backend-new/scripts/backup-db.sh >> /var/log/gestaodeenvios-backup.log 2>&1

set -euo pipefail

APP_DIR="/var/www/gestaodeenvios/backend-new"
BACKUP_DIR="/var/backups/gestaodeenvios"
KEEP_DAYS=14
DATE=$(date +%Y-%m-%d_%H-%M-%S)
ENV_FILE="$APP_DIR/.env"

# Copia off-site (Google Drive via rclone). Caminho do config explicito
# porque o cron roda com ambiente minimo.
RCLONE_REMOTE="gdrive:backups-gestaodeenvios"
RCLONE_CONFIG="/root/.config/rclone/rclone.conf"

if [ ! -f "$ENV_FILE" ]; then
  echo "[$(date)] ERRO: .env não encontrado em $ENV_FILE" >&2
  exit 1
fi

DB_DATABASE=$(grep -E "^DB_DATABASE="  "$ENV_FILE" | cut -d '=' -f2- | tr -d '"')
DB_USERNAME=$(grep -E "^DB_USERNAME="  "$ENV_FILE" | cut -d '=' -f2- | tr -d '"')
DB_PASSWORD=$(grep -E "^DB_PASSWORD="  "$ENV_FILE" | cut -d '=' -f2- | tr -d '"')
DB_HOST=$(grep -E "^DB_HOST="         "$ENV_FILE" | cut -d '=' -f2- | tr -d '"')

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

FILENAME="$BACKUP_DIR/gestaodeenvios_${DATE}.sql.gz"
TMP_FILE="${FILENAME}.tmp"

# --no-tablespaces: o usuário da app não tem PROCESS privilege (nem precisa).
# Sem essa flag o mysqldump emite erro ao tentar ler metadados de tablespace.
mysqldump \
  -h "$DB_HOST" \
  -u "$DB_USERNAME" \
  -p"$DB_PASSWORD" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --no-tablespaces \
  "$DB_DATABASE" | gzip > "$TMP_FILE"

mv "$TMP_FILE" "$FILENAME"
chmod 600 "$FILENAME"

SIZE=$(du -h "$FILENAME" | cut -f1)
echo "[$(date)] Backup concluído: $FILENAME ($SIZE)"

# Sanidade: dump menor que 1 KB indica falha silenciosa.
# Checado ANTES de enviar, para não subir arquivo corrompido.
MIN_BYTES=1024
ACTUAL_BYTES=$(stat -c%s "$FILENAME")
if [ "$ACTUAL_BYTES" -lt "$MIN_BYTES" ]; then
  echo "[$(date)] ALERTA: backup com apenas ${ACTUAL_BYTES} bytes — verifique manualmente!" >&2
  exit 1
fi

# Rotação local — remove backups com mais de KEEP_DAYS dias
DELETED=$(find "$BACKUP_DIR" -name "gestaodeenvios_*.sql.gz" -mtime +$KEEP_DAYS -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "[$(date)] Removidos $DELETED backup(s) local(is) com mais de $KEEP_DAYS dias"
fi

# Copia off-site — o backup local sozinho nao protege contra perda do droplet
if rclone --config "$RCLONE_CONFIG" copy "$FILENAME" "$RCLONE_REMOTE/" --no-traverse; then
  echo "[$(date)] Enviado para $RCLONE_REMOTE"
  # Rotação remota (falha aqui nao invalida o backup, so avisa)
  if ! rclone --config "$RCLONE_CONFIG" delete "$RCLONE_REMOTE" --min-age "${KEEP_DAYS}d"; then
    echo "[$(date)] AVISO: rotacao remota falhou — arquivos antigos podem estar acumulando" >&2
  fi
else
  echo "[$(date)] ALERTA: backup local OK, mas o envio para $RCLONE_REMOTE FALHOU" >&2
  exit 1
fi

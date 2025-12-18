#!/bin/bash

# =========================
# Configuración
# =========================

# Base de datos
DB_NAME="smileworks"
DB_USER="root"
DB_PASS="12345"

# Carpetas de uploads
PROJECT_ROOT="/opt/sistema-web-dentista"
UPLOADS_PATIENTS="$PROJECT_ROOT/services/patients-service/uploads"
UPLOADS_VISUALIZADOR="$PROJECT_ROOT/services/visualizador-service/uploads"

# Directorio de respaldos
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_backup_$DATE.sql.gz"
UPLOADS_BACKUP_FILE="$BACKUP_DIR/uploads_backup_$DATE.tar.gz"
FULL_BACKUP_FILE="$BACKUP_DIR/full_backup_$DATE.tar.gz"

# =========================
# Funciones de utilidad
# =========================

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

error() {
  log "❌ ERROR: $1"
  exit 1
}

# =========================
# Validaciones iniciales
# =========================

mkdir -p "$BACKUP_DIR"

if [ ! -d "$UPLOADS_PATIENTS" ]; then
  error "Carpeta no encontrada: $UPLOADS_PATIENTS"
fi

if [ ! -d "$UPLOADS_VISUALIZADOR" ]; then
  error "Carpeta no encontrada: $UPLOADS_VISUALIZADOR"
fi

# =========================
# 1. Respaldo de la base de datos
# =========================

log "Iniciando respaldo de la base de datos '$DB_NAME'..."
if mysqldump --user="$DB_USER" --password="$DB_PASS" "$DB_NAME" | gzip > "$DB_BACKUP_FILE"; then
  log "✅ Respaldo de BD guardado: $DB_BACKUP_FILE"
else
  error "Falló el respaldo de la base de datos"
fi

# =========================
# 2. Respaldo de las carpetas uploads
# =========================

log "Iniciando respaldo de las carpetas 'uploads'..."
if tar -czf "$UPLOADS_BACKUP_FILE" \
    -C "$(dirname "$UPLOADS_PATIENTS")" "$(basename "$UPLOADS_PATIENTS")" \
    -C "$(dirname "$UPLOADS_VISUALIZADOR")" "$(basename "$UPLOADS_VISUALIZADOR")"; then
  log "✅ Respaldo de uploads guardado: $UPLOADS_BACKUP_FILE"
else
  error "Falló el respaldo de las carpetas uploads"
fi

# =========================
# 3. (Opcional) Combinar en un solo archivo
# =========================

log "Combinando respaldos en un archivo único..."
if tar -czf "$FULL_BACKUP_FILE" -C "$BACKUP_DIR" \
    "$(basename "$DB_BACKUP_FILE")" \
    "$(basename "$UPLOADS_BACKUP_FILE")"; then
  log "✅ Respaldo completo listo: $FULL_BACKUP_FILE"
else
  error "Falló al combinar los respaldos"
fi

# =========================
# 4. Limpieza (opcional): eliminar archivos intermedios
# =========================

rm -f "$DB_BACKUP_FILE" "$UPLOADS_BACKUP_FILE"
log "🧹 Archivos intermedios eliminados."

# =========================
# 5. Rotación: eliminar respaldos antiguos (>7 días)
# =========================

log "Eliminando respaldos antiguos (>1825 días)..."
find "$BACKUP_DIR" -name "full_backup_*.tar.gz" -mtime +1825 -delete

log "✅ Proceso de respaldo completo finalizado."
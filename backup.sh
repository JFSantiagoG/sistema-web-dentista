#!/bin/bash

# Configuración
DB_NAME="smileworks"
DB_USER="root"
DB_PASS="12345" 
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_backup_$DATE.sql.gz"

# Crear directorio si no existe
mkdir -p "$BACKUP_DIR"

# Crear respaldo comprimido
if mysqldump --user="$DB_USER" --password="$DB_PASS" "$DB_NAME" | gzip > "$BACKUP_FILE"; then
    echo "✅ Respaldo exitoso: $BACKUP_FILE"
else
    echo "❌ Error al crear el respaldo."
    exit 1
fi

# Opcional: Eliminar respaldos antiguos (más de 7 días)
find "$BACKUP_DIR" -name "${DB_Name}_backup_*.sql.gz" -mtime +7 -delete
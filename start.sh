#!/bin/bash

# Obtener la ruta del directorio donde está este script (¡funciona desde cualquier lugar!)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Iniciando servicios del Sistema Web Dentista..."

# Iniciar gateway
cd "$SCRIPT_DIR/gateway" && echo "▶ Iniciando Gateway en puerto 3000..." && node server.js &

# Iniciar forms-service
cd "$SCRIPT_DIR/services/forms-service" && echo "▶ Iniciando Forms Service en puerto 3001..." && node server.js &

echo "✅ Ambos servicios iniciados en segundo plano."

# Opcional: mantener el script vivo hasta que se presione Ctrl+C
trap "echo '🛑 Deteniendo servicios...'; pkill -f 'node server.js'; exit" SIGINT SIGTERM
wait

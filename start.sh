#!/bin/bash
BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔄 Iniciando servicios clínicos..."

# Gateway
echo "🚪 Iniciando Gateway..."
cd "$BASE/gateway" && npm install && node server.js &

# Forms Service
echo "📋 Iniciando Forms Service..."
cd "$BASE/services/forms-service" && npm install && node server.js &

# PDF Service
echo "📄 Iniciando PDF Service..."
cd "$BASE/services/pdf-service" && npm install && node server.js &

# Visualizador Service (Python Flask)
echo "🖼️ Iniciando Visualizador Service..."
cd "$BASE/services/visualizador-service"

# Activar entorno virtual si existe
if [ -d "venv" ]; then
  source venv/bin/activate
else
  echo "⚠️ Entorno virtual no encontrado. Creando uno..."
  python3 -m venv venv
  source venv/bin/activate
  pip install flask werkzeug
fi

python app.py &

# Manejo de cierre limpio
trap "echo '⛔ Deteniendo servicios...'; pkill -P $$; exit" SIGINT SIGTERM
wait

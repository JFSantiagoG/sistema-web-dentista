#!/bin/bash
BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔄 Iniciando servicios clínicos..."

# 🚪 Gateway
echo "🚪 Iniciando Gateway..."
cd "$BASE/gateway" && npm install && node server.js &

# 🔐 Auth Service
echo "🔐 Iniciando Auth Service..."
cd "$BASE/services/auth-service" && npm install && node server.js &

# 📋 Forms Service
echo "📋 Iniciando Forms Service..."
cd "$BASE/services/forms-service" && npm install && node server.js &

# 📄 PDF Service
echo "📄 Iniciando PDF Service..."
cd "$BASE/services/pdf-service" && npm install && node server.js &

# 📅 Appointments Service
echo "📅 Iniciando Appointments Service..."
cd "$BASE/services/appointments-service" && npm install && node server.js &

# 👤 Patients Service
echo "👤 Iniciando Patients Service..."
cd "$BASE/services/patients-service" && npm install && node server.js &

# 🖼️ Visualizador Service (Python Flask)
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

# 🧹 Manejo de cierre limpio
trap "echo '⛔ Deteniendo servicios...'; pkill -P $$; exit" SIGINT SIGTERM
wait











---------------------

#!/bin/bash
BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔄 Iniciando servicios clínicos..."
mkdir -p "$BASE/logs"

# 🚪 Gateway
echo "🚪 Iniciando Gateway..."
cd "$BASE/gateway"
nohup node server.js >> "$BASE/logs/gateway.log" 2>&1 &

# 🔐 Auth Service
echo "🔐 Iniciando Auth Service..."
cd "$BASE/services/auth-service"
nohup node server.js >> "$BASE/logs/auth-service.log" 2>&1 &

# 📋 Forms Service
echo "📋 Iniciando Forms Service..."
cd "$BASE/services/forms-service"
nohup node server.js >> "$BASE/logs/forms-service.log" 2>&1 &

# 📄 PDF Service
echo "📄 Iniciando PDF Service..."
cd "$BASE/services/pdf-service"
nohup node server.js >> "$BASE/logs/pdf-service.log" 2>&1 &

# 📅 Appointments Service
echo "📅 Iniciando Appointments Service..."
cd "$BASE/services/appointments-service"
nohup node server.js >> "$BASE/logs/appointments-service.log" 2>&1 &

# 👤 Patients Service
echo "👤 Iniciando Patients Service..."
cd "$BASE/services/patients-service"
nohup node server.js >> "$BASE/logs/patients-service.log" 2>&1 &

# 🖼️ Visualizador Service (Python Flask)
echo "🖼️ Iniciando Visualizador Service..."
cd "$BASE/services/visualizador-service"

# ✅ Solo activar entorno virtual, sin reinstalar nada
source venv/bin/activate
export FLASK_ENV=production
export FLASK_DEBUG=0
nohup python3 app.py >> "$BASE/logs/visualizador.log" 2>&1 &

echo "✅ Todos los servicios iniciados correctamente."
echo "📂 Logs disponibles en: $BASE/logs"
echo "👉 Usa: tail -f logs/gateway.log (o el que necesites)"

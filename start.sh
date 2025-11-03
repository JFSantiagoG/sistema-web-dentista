#!/bin/bash
BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$BASE/logs"
mkdir -p "$LOG_DIR"

start_service() {
  local name="$1"
  local dir="$2"
  local cmd="$3"

  echo "▶️ Iniciando $name..."
  cd "$dir" || { echo "❌ Directorio no encontrado: $dir"; exit 1; }

  if [[ -f "package.json" ]]; then
    npm install --omit=dev >/dev/null 2>&1
  fi

  if [[ "$name" == "visualizador" ]]; then
    if [ ! -d "venv" ]; then
      python3 -m venv venv
      source venv/bin/activate
      pip install flask werkzeug
    else
      source venv/bin/activate
    fi
    export FLASK_ENV=production
    export FLASK_DEBUG=0
  fi

  # Usamos printf %q para escapar comandos de forma segura
  local full_cmd
  printf -v full_cmd "%s >> %s 2>&1" "$cmd" "$LOG_DIR/$name.log"

  screen -dmS "clinica_$name" bash -c "$full_cmd"
}

# Iniciar servicios
start_service "gateway"      "$BASE/gateway"                     "node server.js"
start_service "auth"         "$BASE/services/auth-service"        "node server.js"
start_service "forms"        "$BASE/services/forms-service"       "node server.js"
start_service "pdf"          "$BASE/services/pdf-service"         "node server.js"
start_service "appointments" "$BASE/services/appointments-service" "node server.js"
start_service "patients"     "$BASE/services/patients-service"    "node server.js"
start_service "visualizador" "$BASE/services/visualizador-service" "python3 app.py"

echo "✅ Todos los servicios iniciados en sesiones screen."
echo "👉 Usa './stop.sh' desde cualquier terminal para detenerlos."

#!/bin/bash
SERVICES=("gateway" "auth" "forms" "pdf" "appointments" "patients" "visualizador")

echo "⛔ Deteniendo servicios clínicos..."

for svc in "${SERVICES[@]}"; do
  # Verificar si la sesión screen existe
  if screen -list | grep -q "clinica_$svc"; then
    echo "  - Deteniendo clinica_$svc..."
    screen -S "clinica_$svc" -X quit
  else
    echo "  - clinica_$svc no está activa."
  fi
done

echo "✅ Todos los servicios han sido detenidos."

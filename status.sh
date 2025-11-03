#!/bin/bash

# Lista de servicios (debe coincidir con los nombres usados en start.sh)
SERVICES=("gateway" "auth" "forms" "pdf" "appointments" "patients" "visualizador")

echo "🔍 Estado de los servicios clínicos:"
echo "----------------------------------"

any_running=false

for svc in "${SERVICES[@]}"; do
  session_name="clinica_$svc"
  if screen -list | grep -q "$session_name"; then
    echo "✅ $svc: ACTIVO"
    any_running=true
  else
    echo "❌ $svc: DETENIDO"
  fi
done

echo "----------------------------------"
if [ "$any_running" = true ]; then
  echo "💡 Consejo: Usa 'screen -r clinica_NOMBRE' para ver logs en vivo."
else
  echo "⚠️ Ningún servicio está activo. Ejecuta './start.sh' para iniciarlos."
fi

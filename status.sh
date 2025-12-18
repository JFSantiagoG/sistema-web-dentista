#!/bin/bash

check_port() {
  local port=$1
  if ss -tuln | grep -q ":$port\b"; then
    echo "✅ ACTIVO"
  else
    echo "❌ INACTIVO"
  fi
}

echo "🔍 Verificando estado de los servicios..."
echo "----------------------------------------"
echo "appointments (puerto 3005) → $(check_port 3005)"
echo "patients (puerto 3006) → $(check_port 3006)"
echo "visualizador (puerto 3007) → $(check_port 3007)"
echo "auth (puerto 3001) → $(check_port 3001)"
echo "forms (puerto 3002) → $(check_port 3002)"
echo "pdf (puerto 3003) → $(check_port 3003)"
echo "whatsapp (puerto 3010) → $(check_port 3010)"
echo "gateway (proxy) (puerto 8080) → $(check_port 8080)"
echo "----------------------------------------"

echo "----------------------------------------"
echo "💡 Usa './start.sh' para iniciar los servicios."
echo "💡 Usa './stop.sh' para detenerlos."
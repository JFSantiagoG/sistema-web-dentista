#!/bin/bash

# Rutas y configuración
BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Definir mapeo de puertos → nombres de servicio
declare -A SERVICES
SERVICES[8080]="gateway (proxy)"
SERVICES[3001]="auth"
SERVICES[3002]="forms"
SERVICES[3003]="pdf"
SERVICES[3005]="appointments"
SERVICES[3006]="patients"
SERVICES[3007]="visualizador"
SERVICES[3010]="whatsapp"

# Obtener puertos en uso (solo los que están escuchando en IPv4/IPv6)
ACTIVE_PORTS=$(sudo ss -tulpn 2>/dev/null | awk -F '[: ]+' '/:([0-9]+).*LISTEN/ {print $5}' | sort -u)

echo "🔍 Verificando estado de los servicios..."
echo "----------------------------------------"

for port in "${!SERVICES[@]}"; do
    if printf '%s\n' "$ACTIVE_PORTS" | grep -q "^${port}$"; then
        echo "✅ ${SERVICES[$port]} (puerto $port) → ACTIVO"
    else
        echo "❌ ${SERVICES[$port]} (puerto $port) → INACTIVO"
    fi
done

echo "----------------------------------------"
echo "💡 Usa './start.sh' para iniciar los servicios."
echo "💡 Usa './stop.sh' para detenerlos."
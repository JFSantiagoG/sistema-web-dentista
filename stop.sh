#!/bin/bash

# Puertos utilizados por tus servicios
PORTS=(8080 3001 3002 3003 3005 3006 3007 3010)

echo "🛑 Deteniendo servicios en los puertos: ${PORTS[*]}..."

for port in "${PORTS[@]}"; do
    echo "   Intentando matar proceso en puerto $port..."
    sudo fuser -k "$port"/tcp >/dev/null 2>&1
done

echo "✅ Todos los servicios han sido detenidos (si existían)."
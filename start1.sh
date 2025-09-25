#!/bin/bash
BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Gateway
cd "$BASE/gateway" && npm install && node server.js &

# Forms Service
cd "$BASE/services/forms-service" && npm install && node server.js &

# PDF Service
cd "$BASE/services/pdf-service" && npm install && node server.js &

trap "pkill -P $$; exit" SIGINT SIGTERM
wait

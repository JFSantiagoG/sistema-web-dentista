Instalar desde PoweShell WSL o instalar Ubuntu como SO 24.04
    wsl --install -d 'Ubuntu-24.04'

En WSL, ejecuta:
    # Actualiza los paquetes
    sudo apt update && sudo apt upgrade -y

    # Instala Node.js y npm
    sudo apt install nodejs npm -y

    # Verifica las versiones
    nodejs --version
        v18.19.1
    npm --version
        9.2.0

Inicia en carpeta sistema-web-dentista
    ./start.sh

Accede
<<<<<<< HEAD
    http://localhost:8080/
=======
    http://localhost:8080/



# Node
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Python
venv/
__pycache__/
*.pyc

# Sistema
.DS_Store
Thumbs.db
*.swp

# Archivos de uploads
uploads/
>>>>>>> Hector

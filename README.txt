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
    http://localhost:8080/
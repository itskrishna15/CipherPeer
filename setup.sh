#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Header
echo "=================================================================="
echo "    CipherPeer - P2P Secure Chat Installation Setup"
echo "=================================================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[-] Error: Node.js is not installed. Please install Node.js v18+ and try again."
    exit 1
else
    echo "[+] Node.js version: $(node -v) - OK"
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo "[-] Error: npm is not installed. Please install npm and try again."
    exit 1
else
    echo "[+] npm version: $(npm -v) - OK"
fi

# Path to the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$DIR"

echo ""
echo "Installing Signaling Server dependencies in /server..."
cd "$DIR/server"
npm install

echo ""
echo "Installing Client Application dependencies in /client..."
cd "$DIR/client"
npm install

echo ""
echo "=================================================================="
echo "    Setup Complete!"
echo "=================================================================="
echo ""
echo "You can start both systems concurrently by running:"
echo "    ./run.sh"
echo ""
echo "Or start them manually in separate windows:"
echo "    Backend: cd server && npm run dev"
echo "    Frontend: cd client && npm run dev"
echo "=================================================================="

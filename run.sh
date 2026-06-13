#!/bin/bash

# Navigate to script directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$DIR"

# Clean up all background child processes when script exits
trap "echo -e '\nStopping all CipherPeer background processes...'; kill 0" EXIT

echo "=================================================================="
echo "    CipherPeer - Booting Dev Stack"
echo "=================================================================="
echo ""

# Start backend
echo "[+] Starting Signaling Server on port 5000..."
cd "$DIR/server"
node index.js &
SERVER_PID=$!

# Start frontend
echo "[+] Starting Client Application on port 3000..."
cd "$DIR/client"
npm run dev &
CLIENT_PID=$!

echo ""
echo "Press Ctrl+C to shut down all processes."
echo "=================================================================="

# Wait for background processes
wait

#!/usr/bin/env bash
# PokéroleDex 3.0 Startup Script for Linux and macOS

set -e

echo "========================================================"
echo "              POKEROLEDEX 3.0 TTRPG COMPANION"
echo "========================================================"

if command -v python3 &>/dev/null; then
    PY_CMD="python3"
elif command -v python &>/dev/null; then
    PY_CMD="python"
else
    echo "[!] Python 3 non trovato. Per favore installa Python 3 dal gestore pacchetti o da python.org."
    exit 1
fi

echo "[*] Interprete Python: $PY_CMD"
echo "[*] Verifica e installazione librerie necessarie..."
$PY_CMD -m pip install -r requirements.txt --quiet

echo "[*] Avvio di PokéroleDex su http://127.0.0.1:5000/ ..."
$PY_CMD Back-End/app.py

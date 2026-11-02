#!/bin/sh
echo "================================================================="
echo "       POKEROLEDEX 3.0 - AVVIO SU ANDROID (TERMUX / LINUX)       "
echo "================================================================="
echo ""

# Check for python
if command -v python3 >/dev/null 2>&1; then
    PY_BIN="python3"
elif command -v python >/dev/null 2>&1; then
    PY_BIN="python"
else
    echo "[!] Python non trovato. Installazione automatica con pkg..."
    pkg update -y && pkg install python -y
    PY_BIN="python"
fi

echo "[*] Controllo dipendenze (Flask)..."
$PY_BIN -m pip install -r requirements.txt --quiet

export BIND_HOST="0.0.0.0"
export PORT="5000"
export OPEN_BROWSER="0"

echo ""
echo "[*] PokéroleDex avviato con successo su Android!"
echo "[*] Apri il tuo browser (Chrome/Firefox) all'indirizzo:"
echo "    👉  http://127.0.0.1:5000/"
echo ""
echo "Premi CTRL+C per arrestare il server."
echo ""

$PY_BIN Back-End/app.py

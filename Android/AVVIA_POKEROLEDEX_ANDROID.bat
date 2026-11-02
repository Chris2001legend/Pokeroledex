@echo off
setlocal enabledelayedexpansion
title PokéroleDex 3.0 - Server Android / Smartphone

echo =================================================================
echo         POKEROLEDEX 3.0 - EDIZIONE SMARTPHONE & ANDROID          
echo =================================================================
echo.

:: 1. Check for Python in PATH
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "PY_CMD=python"
    goto :PYTHON_FOUND
)

:: 2. Check for py launcher
where py >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "PY_CMD=py"
    goto :PYTHON_FOUND
)

:: 3. Check common AppData Python locations
for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python*") do (
    if exist "%%D\python.exe" (
        set "PY_CMD=%%D\python.exe"
        goto :PYTHON_FOUND
    )
)

:: If not found, attempt auto-install with winget or prompt user
echo [!] Python non e stato trovato sul tuo computer.
echo.
echo Tentativo di installazione automatica di Python tramite Windows Package Manager (winget)...
where winget >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Avvio installazione automatica di Python 3.12 in corso... Attendi qualche minuto...
    winget install --id Python.Python.3.12 -e --accept-package-agreements --accept-source-agreements
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Python installato con successo!
        echo Riavvio controllo Python...
        where python >nul 2>&1
        if %ERRORLEVEL% EQU 0 (
            set "PY_CMD=python"
            goto :PYTHON_FOUND
        )
    )
)

echo.
echo [ATTENZIONE] Non e stato possibile installare Python automaticamente.
echo Per favore scarica e installa Python da: https://www.python.org/downloads/
echo Ricordati di spuntare la casella "Add Python to PATH" durante l'installazione!
echo.
pause
exit /b 1

:PYTHON_FOUND
echo [*] Rilevato interprete Python: !PY_CMD!
echo [*] Verifica e installazione automatica librerie (Flask)...
!PY_CMD! -m pip install -r requirements.txt --quiet --no-warn-script-location

set "BIND_HOST=0.0.0.0"
set "PORT=5000"

echo.
echo =================================================================
echo  [OK] SERVER PRONTO PER IL TUO SMARTPHONE ANDROID!
echo =================================================================
echo.
echo 1. Assicurati che il telefono sia connesso allo STESSO Wi-Fi.
echo 2. Apri Google Chrome sul tuo telefono e digita l'indirizzo mostrato.
echo 3. Tocca i tre puntini ⋮ in alto su Chrome e seleziona:
echo    "Aggiungi a schermata Home" / "Installa app".
echo.
echo =================================================================
echo.

!PY_CMD! Back-End\app.py

pause

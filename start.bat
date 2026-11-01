@echo off
setlocal enabledelayedexpansion
title PokéroleDex 3.0 Web App

echo ========================================================
echo               POKEROLEDEX 3.0 TTRPG COMPANION
echo ========================================================
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
    echo Avvio installazione di Python 3.12 in corso... Attendi qualche minuto...
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
echo [*] Verifica e installazione automatica librerie necessarie (requirements.txt)...
!PY_CMD! -m pip install -r requirements.txt --quiet --no-warn-script-location

echo [*] Avvio dell'applicazione Web PokéroleDex...
echo [*] L'applicazione si aprira automaticamente nel tuo browser su http://127.0.0.1:5000/
echo.
echo Premi CTRL+C in questa finestra per arrestare il server.
echo.

!PY_CMD! Back-End\app.py

pause

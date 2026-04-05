@echo off
echo ===================================================
echo   Starting QR Code and Barcode Detection System
echo ===================================================

if not exist venv (
    echo [INFO] Creating Python virtual environment...
    python -m venv venv
)

echo [INFO] Activating virtual environment...
call venv\Scripts\activate.bat

echo [INFO] Installing/Updating dependencies...
pip install -r requirements.txt

echo [INFO] Opening Browser...
start http://localhost:8000

echo [INFO] Starting FastAPI Server (Press CTRL+C to stop)...
uvicorn main:app --reload

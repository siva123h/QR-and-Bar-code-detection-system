#!/bin/bash
echo "==================================================="
echo "  Starting QR Code and Barcode Detection System"
echo "==================================================="

if [ ! -d "venv" ]; then
    echo "[INFO] Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "[INFO] Activating virtual environment..."
source venv/bin/activate

echo "[INFO] Installing/Updating dependencies..."
pip install -r requirements.txt

# Depending on OS, open browser automatically
if which xdg-open > /dev/null
then
  xdg-open http://localhost:8000 &
elif which open > /dev/null
then
  open http://localhost:8000 &
fi

echo "[INFO] Starting FastAPI Server (Press CTRL+C to stop)..."
uvicorn main:app --reload

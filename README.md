# QR Code and Barcode Detection System

A lightweight, minimal full-stack web application to scan QR codes and barcodes in real-time. Built with a FastAPI Python backend and a Vanilla HTML/CSS/JS frontend.

## Features
- Real-time webcam scanning with visual bounding box overlays.
- Image upload support for static scanning.
- Detection of both QR Codes and Barcodes using OpenCV and pyzbar.
- SQLite database to persistently store scan history and timestamps.
- Modern Analytics Dashboard using Chart.js.
- Single command execution: both frontend and backend are served via the same FastAPI server.

## Prerequisites
- Python 3.8+ installed
- A webcam (for real-time scanning)

## How to Run

1. **Open a terminal in the project directory.**

2. **(Optional but recommended) Create and activate a Virtual Environment:**
   ```bash
   python -m venv venv
   
   # Windows:
   venv\Scripts\activate
   # Mac/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Start the application:**
   ```bash
   uvicorn main:app --reload
   ```

5. **Open the App:**
   Open your browser and navigate to: [http://localhost:8000](http://localhost:8000)

## System Architecture

- `main.py`: The FastAPI server. Handles `/api/scan` requests and returns JSON. It also statically serves the `frontend/` directory on `/`.
- `scanner.py`: Core logic for decoding image bytes into QR/Barcode texts with pyzbar.
- `database.py`: Handles connection and auto-initialization of our `scans.db` SQLite database.
- `frontend/`: Contains the single-page application consisting of `index.html`, `style.css`, and `app.js`.

Happy scanning!

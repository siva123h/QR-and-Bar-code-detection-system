import os
from fastapi import FastAPI, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from database import init_db, save_scan, get_all_scans, get_analytics
from scanner import decode_image

app = FastAPI(title="QR and Barcode Detection App")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

@app.post("/api/scan")
async def scan_endpoint(file: UploadFile = File(...)):
    contents = await file.read()
    results = decode_image(contents)
    
    # Save results to DB
    for r in results:
        save_scan(r["type"], r["data"])
        
    return JSONResponse(content={"status": "success", "results": results})

@app.get("/api/scans")
async def get_scans_endpoint():
    scans = get_all_scans()
    return JSONResponse(content=scans)

@app.get("/api/analytics")
async def get_analytics_endpoint():
    data = get_analytics()
    return JSONResponse(content=data)

# Mount frontend directory for static assets (js, css)
frontend_path = os.path.join(os.path.dirname(__file__), "frontend")
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")

# Serve index.html on root
@app.get("/")
async def serve_index():
    index_file = os.path.join(frontend_path, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return HTMLResponse("Frontend not found. Please create the frontend directory and index.html.")


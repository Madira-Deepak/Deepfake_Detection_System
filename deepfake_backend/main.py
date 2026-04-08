from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from model import predict_image
from PIL import Image
import shutil
import os
import uuid
import time

app = FastAPI(title="Veridect — Deepfake Detection API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_FOLDER = "uploads"
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"}
MAX_FILE_SIZE_MB = 10

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@app.get("/")
def home():
    return {
        "service": "Veridect Deepfake Detection API",
        "version": "1.0.0",
        "status": "online",
        "model": "shunda012/vit-deepfake-detector"
    }


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": time.time()}


@app.post("/detect")
async def detect(file: UploadFile = File(...)):

    # Validate content type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {file.content_type}. Allowed: JPEG, PNG, WEBP, AVIF."
        )

    # Read file and check size
    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)

    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f} MB). Maximum allowed: {MAX_FILE_SIZE_MB} MB."
        )

    # Save with unique filename to avoid collisions
    ext = os.path.splitext(file.filename)[-1] or ".jpg"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_FOLDER, unique_name)

    try:
        with open(file_path, "wb") as f:
            f.write(contents)

        image = Image.open(file_path).convert("RGB")
        start = time.time()
        result = predict_image(image)
        elapsed_ms = round((time.time() - start) * 1000)

        return {
            "filename": file.filename,
            "result": result,
            "processing_time_ms": elapsed_ms
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    finally:
        # Clean up uploaded file
        if os.path.exists(file_path):
            os.remove(file_path)


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "status_code": exc.status_code}
    )
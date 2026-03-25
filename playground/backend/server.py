import asyncio
import os
import sys
import uuid
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torchaudio
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

# Add the repo root to sys.path so sam_audio can be imported
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT))

# Add FFmpeg DLL directory to search path (Windows needs this for torchcodec)
ffmpeg_bin = Path(r"C:\ffmpeg\bin")
if ffmpeg_bin.exists():
    os.add_dll_directory(str(ffmpeg_bin))

from sam_audio import SAMAudio, SAMAudioProcessor

app = FastAPI(title="SAM Audio Playground")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Globals ──────────────────────────────────────────────────────────────────
TEMP_DIR = Path(__file__).parent / "temp"
TEMP_DIR.mkdir(exist_ok=True)

SAMPLES_DIR = REPO_ROOT / "examples" / "assets"

model: Optional[SAMAudio] = None
processor: Optional[SAMAudioProcessor] = None
inference_lock = asyncio.Lock()

SAMPLE_RATE = 48_000
MAX_WAVEFORM_POINTS = 1000


# ── Startup ──────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def load_model():
    global model, processor
    device = "cuda" if torch.cuda.is_available() else "cpu"
    checkpoint_path = str(REPO_ROOT / "sam-audio-base")
    print(f"Loading SAM Audio model from {checkpoint_path} on {device}...")
    model = SAMAudio.from_pretrained(checkpoint_path).to(dtype=torch.float16, device=device).eval()
    processor = SAMAudioProcessor.from_pretrained(checkpoint_path)
    print("Model loaded successfully.")


# ── Helpers ──────────────────────────────────────────────────────────────────
def generate_waveform_envelope(wav: torch.Tensor, num_points: int = MAX_WAVEFORM_POINTS) -> list[float]:
    """Downsample audio to an amplitude envelope for canvas rendering."""
    audio = wav.squeeze()
    if audio.dim() > 1:
        audio = audio.mean(0)
    audio = audio.float().cpu().numpy()
    n = len(audio)
    if n == 0:
        return []
    chunk_size = max(1, n // num_points)
    points = []
    for i in range(0, n, chunk_size):
        chunk = audio[i : i + chunk_size]
        points.append(float(np.max(np.abs(chunk))))
    return points[:num_points]


def get_audio_path(file_id: str) -> Path:
    return TEMP_DIR / file_id / "audio.wav"


def get_original_path(file_id: str) -> Path:
    """Return the first file matching original.* in the file_id directory."""
    d = TEMP_DIR / file_id
    for f in d.iterdir():
        if f.stem == "original":
            return f
    raise FileNotFoundError(f"No original file for {file_id}")


VIDEO_EXTENSIONS = {".mp4", ".webm", ".mkv", ".avi", ".mov"}
AUDIO_EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".wma"}


# ── Endpoints ────────────────────────────────────────────────────────────────
@app.post("/api/upload")
async def upload_file(file: UploadFile):
    file_id = str(uuid.uuid4())
    file_dir = TEMP_DIR / file_id
    file_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename or "upload.wav").suffix.lower()
    original_path = file_dir / f"original{ext}"

    content = await file.read()
    original_path.write_bytes(content)

    has_video = ext in VIDEO_EXTENSIONS

    # Load audio (torchaudio handles both audio and video files)
    try:
        wav, sr = torchaudio.load(str(original_path))
    except Exception:
        # Fallback for video formats torchaudio can't handle
        try:
            from pydub import AudioSegment
            audio_seg = AudioSegment.from_file(str(original_path))
            audio_seg = audio_seg.set_frame_rate(SAMPLE_RATE).set_channels(1)
            fallback_path = file_dir / "audio.wav"
            audio_seg.export(str(fallback_path), format="wav")
            wav, sr = torchaudio.load(str(fallback_path))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not load audio: {e}")

    if sr != SAMPLE_RATE:
        wav = torchaudio.functional.resample(wav, sr, SAMPLE_RATE)

    # Save as canonical WAV for later use
    audio_path = file_dir / "audio.wav"
    torchaudio.save(str(audio_path), wav, SAMPLE_RATE)

    duration = wav.shape[-1] / SAMPLE_RATE
    waveform = generate_waveform_envelope(wav)

    return {
        "file_id": file_id,
        "duration": round(duration, 2),
        "sample_rate": SAMPLE_RATE,
        "waveform": waveform,
        "has_video": has_video,
        "filename": file.filename,
    }


class SeparateRequest(BaseModel):
    file_id: str
    description: str


@app.post("/api/separate")
async def separate_audio(req: SeparateRequest):
    audio_path = get_audio_path(req.file_id)
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found. Please upload again.")

    async with inference_lock:
        try:
            result = await asyncio.get_event_loop().run_in_executor(
                None, _run_separation, str(audio_path), req.description
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Separation failed: {e}")

    return result


def _run_separation(audio_path: str, description: str) -> dict:
    device = next(model.parameters()).device

    batch = processor(
        descriptions=[description],
        audios=[audio_path],
    ).to(device)
    batch.audios = batch.audios.half()

    with torch.inference_mode():
        result = model.separate(batch, predict_spans=False, reranking_candidates=1)

    file_id = Path(audio_path).parent.name
    file_dir = TEMP_DIR / file_id

    target = result.target[0].unsqueeze(0).cpu()
    residual = result.residual[0].unsqueeze(0).cpu()

    torchaudio.save(str(file_dir / "target.wav"), target, SAMPLE_RATE)
    torchaudio.save(str(file_dir / "residual.wav"), residual, SAMPLE_RATE)

    torch.cuda.empty_cache()

    return {
        "target_waveform": generate_waveform_envelope(target),
        "residual_waveform": generate_waveform_envelope(residual),
    }


@app.get("/api/audio/{file_id}/{track}")
async def serve_audio(file_id: str, track: str):
    if track not in ("audio", "target", "residual", "original", "source"):
        raise HTTPException(status_code=400, detail="Invalid track name")

    if track == "original":
        # Serve the extracted audio WAV, not the raw upload (which may be video)
        path = TEMP_DIR / file_id / "audio.wav"
    elif track == "source":
        # Serve the raw uploaded file (video or audio)
        try:
            path = get_original_path(file_id)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Original file not found")
    else:
        path = TEMP_DIR / file_id / f"{track}.wav"

    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    media_type = "audio/wav"
    ext = path.suffix.lower()
    if ext == ".mp4":
        media_type = "video/mp4"
    elif ext == ".webm":
        media_type = "video/webm"
    elif ext in (".mkv", ".avi", ".mov"):
        media_type = f"video/{ext.lstrip('.')}"

    return FileResponse(path, media_type=media_type)


@app.get("/api/samples")
async def list_samples():
    samples = []
    if SAMPLES_DIR.exists():
        for f in sorted(SAMPLES_DIR.iterdir()):
            if f.suffix.lower() in VIDEO_EXTENSIONS | AUDIO_EXTENSIONS:
                samples.append({
                    "filename": f.name,
                    "has_video": f.suffix.lower() in VIDEO_EXTENSIONS,
                })
    return {"samples": samples}


@app.post("/api/samples/{filename}/load")
async def load_sample(filename: str):
    path = SAMPLES_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Sample not found")

    file_id = str(uuid.uuid4())
    file_dir = TEMP_DIR / file_id
    file_dir.mkdir(parents=True, exist_ok=True)

    ext = path.suffix.lower()
    import shutil
    shutil.copy2(str(path), str(file_dir / f"original{ext}"))

    has_video = ext in VIDEO_EXTENSIONS

    try:
        wav, sr = torchaudio.load(str(path))
    except Exception:
        try:
            from pydub import AudioSegment
            audio_seg = AudioSegment.from_file(str(path))
            audio_seg = audio_seg.set_frame_rate(SAMPLE_RATE).set_channels(1)
            fallback = file_dir / "audio.wav"
            audio_seg.export(str(fallback), format="wav")
            wav, sr = torchaudio.load(str(fallback))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not load audio: {e}")

    if sr != SAMPLE_RATE:
        wav = torchaudio.functional.resample(wav, sr, SAMPLE_RATE)

    audio_path = file_dir / "audio.wav"
    torchaudio.save(str(audio_path), wav, SAMPLE_RATE)

    duration = wav.shape[-1] / SAMPLE_RATE
    waveform = generate_waveform_envelope(wav)

    return {
        "file_id": file_id,
        "duration": round(duration, 2),
        "sample_rate": SAMPLE_RATE,
        "waveform": waveform,
        "has_video": has_video,
        "filename": filename,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

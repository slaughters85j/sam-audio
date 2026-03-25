# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SAM-Audio (Segment Anything Audio) is Meta's foundation model for isolating sounds in audio using text prompts, visual prompts (video frames with masks), or span prompts (time ranges). It uses a Diffusion Transformer (DiT) architecture with Perception-Encoder Audio-Visual (PE-AV) models.

## Common Commands

### Linting & Formatting
```bash
ruff format --check .    # Check formatting
ruff format .            # Auto-format
ruff check .             # Lint
ruff check --fix .       # Lint with auto-fix
```

### Install
```bash
pip install -e .
```

### Evaluation
```bash
python eval/main.py --setting sfx
torchrun --nproc_per_node=8 eval/main.py   # Distributed
```

### Playground Demo
```bash
# Dev mode — launches backend + frontend dev server in separate windows
playground\dev.bat

# Production mode — builds frontend first, then launches both servers
playground\start.bat
```

Or manually:
```bash
# Backend (FastAPI)
python playground/backend/server.py
# Frontend (Next.js)
cd playground/frontend && npm install && npm run dev
```

There is no test suite — CI only runs `ruff format --check .` and `ruff check .`.

## Architecture

The main package is `sam_audio/` with two subpackages:

**`sam_audio/model/`** — Core separation model:
- `model.py`: `SAMAudio` class — main entry point. `separate()` runs diffusion-based source separation, returns `SeparationResult` (target, residual, noise)
- `transformer.py`: DiT (Diffusion Transformer) with modulated attention blocks, SwiGLU, and rotary embeddings
- `config.py`: Dataclass configs for all model components (`ModelConfig`, `DiTConfig`, `CodecConfig`, etc.)
- `base.py`: `BaseModel` with HuggingFace Hub integration — loads `config.json` + `checkpoint.pt`
- `text_encoder.py`: T5-based text encoding
- `vision_encoder.py`: Perception Encoder wrapper for visual prompts
- `codec.py`: DACVAE audio codec (encode audio → latent, decode latent → audio)
- `judge.py`: Quality assessment model for separation results

**`sam_audio/ranking/`** — Re-ranking separated audio candidates:
- Factory pattern via `create_ranker()` in `__init__.py`
- `clap.py`: CLAP text-audio similarity ranking
- `judge.py`: Judge quality ranking
- `imagebind.py`: ImageBind audio-video alignment ranking
- Supports ensemble ranking with weighted combinations

**`sam_audio/processor.py`** — `SAMAudioProcessor` handles audio/video preprocessing, resampling to 48kHz, batching, and padding.

### Inference Flow
1. Load model/processor: `SAMAudio.from_pretrained()` / `SAMAudioProcessor.from_pretrained()`
2. Preprocess: `processor(audios=[...], descriptions=[...])` → `Batch`
3. Separate: `model.separate(batch)` → `SeparationResult`

Model variants: small, base, large (with optional `-tv` suffix for visual prompting).

## Code Standards

- Python 3.11+
- Ruff for formatting and linting (target: py311)
- Pre-commit hooks configured (trailing whitespace, ruff format/check)
- Lint rules: B, C, E, W, F, I (ignoring E501, E731, C901, B006)

"""BloomIDE backend - FastAPI application."""
from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# Ensure workspace exists
WORKSPACE_DIR = Path(os.environ.get("WORKSPACE_DIR", "/app/workspace"))
WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)

from routes.fs import router as fs_router  # noqa: E402
from routes.ai import router as ai_router  # noqa: E402
from routes.terminal import router as terminal_router  # noqa: E402
from routes.git import router as git_router  # noqa: E402

app = FastAPI(title="BloomIDE Backend")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(fs_router)
app.include_router(ai_router)
app.include_router(terminal_router)
app.include_router(git_router)


@app.get("/api/")
async def root():
    return {"message": "BloomIDE backend running", "workspace": str(WORKSPACE_DIR)}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

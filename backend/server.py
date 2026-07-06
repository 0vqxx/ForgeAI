"""BloomIDE backend - FastAPI application."""
from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from starlette.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# Ensure workspace exists
WORKSPACE_DIR = Path(os.environ.get("WORKSPACE_DIR", "/app/workspace"))
WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)

from routes.fs import router as fs_router  # noqa: E402
from routes.ai import router as ai_router  # noqa: E402
from routes.terminal import router as terminal_router  # noqa: E402
from routes.git import router as git_router  # noqa: E402
from clerk_middleware import clerk_auth_middleware, get_user_id  # noqa: E402

app = FastAPI(title="BloomIDE Backend")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(clerk_auth_middleware)

app.include_router(fs_router)
app.include_router(ai_router)
app.include_router(terminal_router)
app.include_router(git_router)

# Mount public/downloads statically for direct zip serving
if ROOT_DIR.name == "backend":
    downloads_path = ROOT_DIR.parent / "public/downloads"
else:
    downloads_path = ROOT_DIR / "public/downloads"

downloads_path.mkdir(parents=True, exist_ok=True)
app.mount("/api/downloads", StaticFiles(directory=str(downloads_path)), name="downloads")


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
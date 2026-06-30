"""Filesystem routes for BloomIDE workspace."""
from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

WORKSPACE_DIR = Path(os.environ.get("WORKSPACE_DIR", "/app/workspace")).resolve()

router = APIRouter(prefix="/api/fs", tags=["fs"])

# Patterns to ignore in tree listings
IGNORE_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", ".next", "dist", "build", ".cache"}


def _safe_path(rel: str) -> Path:
    """Resolve a relative path safely inside the workspace."""
    rel = (rel or "").lstrip("/")
    p = (WORKSPACE_DIR / rel).resolve()
    try:
        p.relative_to(WORKSPACE_DIR)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Path escapes workspace") from exc
    return p


def _rel(p: Path) -> str:
    return str(p.relative_to(WORKSPACE_DIR)).replace(os.sep, "/")


class FileWrite(BaseModel):
    path: str
    content: str


class FileRename(BaseModel):
    path: str
    new_path: str


class CreateNode(BaseModel):
    path: str
    is_dir: bool = False


class SearchRequest(BaseModel):
    query: str
    case_sensitive: bool = False
    max_results: int = 200


@router.post("/upload")
async def upload(file: UploadFile = File(...), dest: str = Form("")):
    """Upload a file (drag-and-drop import). `dest` is the target directory relative to workspace root."""
    target_dir = _safe_path(dest) if dest else WORKSPACE_DIR
    if not target_dir.exists():
        target_dir.mkdir(parents=True, exist_ok=True)
    if not target_dir.is_dir():
        raise HTTPException(400, "dest is not a directory")
    target = target_dir / file.filename
    # ensure within workspace
    try:
        target.resolve().relative_to(WORKSPACE_DIR)
    except ValueError:
        raise HTTPException(400, "Invalid path")
    data = await file.read()
    target.write_bytes(data)
    return {"ok": True, "path": _rel(target), "size": len(data)}


@router.get("/tree")
async def tree(path: str = ""):
    """Return directory tree (one level)."""
    p = _safe_path(path)
    if not p.exists():
        raise HTTPException(404, "Not found")
    if not p.is_dir():
        raise HTTPException(400, "Not a directory")
    entries = []
    for child in sorted(p.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
        if child.name in IGNORE_DIRS:
            continue
        try:
            entries.append({
                "name": child.name,
                "path": _rel(child),
                "is_dir": child.is_dir(),
                "size": child.stat().st_size if child.is_file() else 0,
            })
        except OSError:
            continue
    return {"path": _rel(p) if p != WORKSPACE_DIR else "", "entries": entries}


@router.get("/read")
async def read_file(path: str):
    p = _safe_path(path)
    if not p.exists() or not p.is_file():
        raise HTTPException(404, "File not found")
    if p.stat().st_size > 5 * 1024 * 1024:
        raise HTTPException(413, "File too large")
    try:
        content = p.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise HTTPException(415, "Binary file")
    return {"path": _rel(p), "content": content}


@router.post("/write")
async def write_file(req: FileWrite):
    p = _safe_path(req.path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(req.content, encoding="utf-8")
    return {"ok": True, "path": _rel(p), "size": p.stat().st_size}


@router.post("/create")
async def create_node(req: CreateNode):
    p = _safe_path(req.path)
    if p.exists():
        raise HTTPException(409, "Already exists")
    if req.is_dir:
        p.mkdir(parents=True, exist_ok=False)
    else:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.touch()
    return {"ok": True, "path": _rel(p), "is_dir": req.is_dir}


@router.post("/rename")
async def rename(req: FileRename):
    p = _safe_path(req.path)
    new_p = _safe_path(req.new_path)
    if not p.exists():
        raise HTTPException(404, "Source not found")
    if new_p.exists():
        raise HTTPException(409, "Target exists")
    new_p.parent.mkdir(parents=True, exist_ok=True)
    p.rename(new_p)
    return {"ok": True, "path": _rel(new_p)}


@router.delete("/delete")
async def delete(path: str):
    p = _safe_path(path)
    if not p.exists():
        raise HTTPException(404, "Not found")
    if p == WORKSPACE_DIR:
        raise HTTPException(400, "Cannot delete workspace root")
    if p.is_dir():
        shutil.rmtree(p)
    else:
        p.unlink()
    return {"ok": True}


@router.post("/search")
async def search(req: SearchRequest):
    """Full text search across workspace files."""
    results = []
    query = req.query if req.case_sensitive else req.query.lower()
    if not query:
        return {"results": []}
    for root, dirs, files in os.walk(WORKSPACE_DIR):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for fname in files:
            fp = Path(root) / fname
            try:
                if fp.stat().st_size > 2 * 1024 * 1024:
                    continue
                text = fp.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            haystack = text if req.case_sensitive else text.lower()
            if query in haystack:
                # find line numbers
                matches = []
                for i, line in enumerate(text.splitlines(), 1):
                    hay = line if req.case_sensitive else line.lower()
                    if query in hay:
                        matches.append({"line": i, "text": line[:240]})
                        if len(matches) >= 5:
                            break
                results.append({"path": _rel(fp), "matches": matches})
                if len(results) >= req.max_results:
                    return {"results": results}
    return {"results": results}

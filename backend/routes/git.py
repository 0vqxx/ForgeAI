"""Lightweight Git integration via subprocess."""
from __future__ import annotations

import asyncio
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

WORKSPACE_DIR = Path(os.environ.get("WORKSPACE_DIR", "/app/workspace")).resolve()

router = APIRouter(prefix="/api/git", tags=["git"])


async def _git(*args: str) -> tuple[int, str, str]:
    proc = await asyncio.create_subprocess_exec(
        "git", *args,
        cwd=str(WORKSPACE_DIR),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out, err = await proc.communicate()
    return proc.returncode or 0, out.decode(errors="replace"), err.decode(errors="replace")


@router.get("/status")
async def status():
    if not (WORKSPACE_DIR / ".git").exists():
        return {"repo": False, "files": [], "branch": None}
    rc, out, _ = await _git("status", "--porcelain=v1", "-b")
    if rc != 0:
        return {"repo": False, "files": [], "branch": None}
    lines = out.splitlines()
    branch = None
    files = []
    for line in lines:
        if line.startswith("##"):
            branch = line[3:].split("...")[0].strip()
        elif line:
            code = line[:2]
            path = line[3:]
            files.append({"code": code.strip() or code, "path": path})
    return {"repo": True, "branch": branch, "files": files}


@router.get("/diff")
async def diff(path: str = ""):
    args = ["diff", "--no-color"]
    if path:
        args.append(path)
    rc, out, err = await _git(*args)
    if rc != 0:
        raise HTTPException(400, err)
    return {"diff": out}


class InitRequest(BaseModel):
    pass


@router.post("/init")
async def init():
    rc, out, err = await _git("init")
    if rc != 0:
        raise HTTPException(400, err)
    return {"ok": True, "output": out}


class CommitRequest(BaseModel):
    message: str
    add_all: bool = True


@router.post("/commit")
async def commit(req: CommitRequest):
    if req.add_all:
        await _git("add", "-A")
    # Configure identity if missing (idempotent)
    await _git("config", "user.email", "bloom@ide.local")
    await _git("config", "user.name", "BloomIDE")
    rc, out, err = await _git("commit", "-m", req.message)
    if rc != 0:
        raise HTTPException(400, err or out)
    return {"ok": True, "output": out}

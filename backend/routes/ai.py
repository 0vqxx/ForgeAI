"""AI routes - NVIDIA NIM integration with streaming."""
from __future__ import annotations

import json
import os
from typing import Any, AsyncIterator, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/ai", tags=["ai"])

NVIDIA_BASE = "https://integrate.api.nvidia.com/v1"
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")

# Supported models (user-facing)
MODELS = [
    {
        "id": "z-ai/glm-5.1",
        "label": "GLM 5.1",
        "description": "Z.AI · flagship general model",
    },
    {
        "id": "moonshotai/kimi-k2.6",
        "label": "Kimi K2.6",
        "description": "Moonshot · long context, strong agent",
    },
    {
        "id": "minimaxai/minimax-m3",
        "label": "MiniMax M3",
        "description": "MiniMax · fast, instruction-following",
    },
    {
        "id": "mistralai/mistral-medium-3.5-128b",
        "label": "Mistral Medium 3.5 128B",
        "description": "Mistral · balanced & precise",
    },
    {
        "id": "meta/llama-3.3-70b-instruct",
        "label": "Llama 3.3 70B",
        "description": "Meta · reliable fallback",
    },
]


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str
    messages: List[ChatMessage]
    temperature: float = 0.4
    max_tokens: int = 2048
    system: Optional[str] = None


class CompletionRequest(BaseModel):
    model: str
    prefix: str
    suffix: str = ""
    language: str = "plaintext"


class EditRequest(BaseModel):
    model: str
    code: str
    instruction: str
    language: str = "plaintext"


class TaskRequest(BaseModel):
    model: str
    code: str
    language: str = "plaintext"


@router.get("/models")
async def list_models():
    return {"models": MODELS, "has_key": bool(NVIDIA_API_KEY)}


async def _stream_nvidia(payload: Dict[str, Any]) -> AsyncIterator[bytes]:
    """Stream Server-Sent Events from NVIDIA NIM and forward as text chunks."""
    if not NVIDIA_API_KEY:
        yield b"data: " + json.dumps({"error": "NVIDIA_API_KEY missing"}).encode() + b"\n\n"
        yield b"data: [DONE]\n\n"
        return
    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Accept": "text/event-stream",
        "Content-Type": "application/json",
    }
    payload = {**payload, "stream": True}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=15.0)) as client:
            async with client.stream(
                "POST", f"{NVIDIA_BASE}/chat/completions", json=payload, headers=headers
            ) as resp:
                if resp.status_code != 200:
                    err = await resp.aread()
                    yield b"data: " + json.dumps(
                        {"error": f"NVIDIA {resp.status_code}: {err.decode(errors='ignore')[:400]}"}
                    ).encode() + b"\n\n"
                    yield b"data: [DONE]\n\n"
                    return
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data = line[6:]
                        if data.strip() == "[DONE]":
                            yield b"data: [DONE]\n\n"
                            return
                        try:
                            obj = json.loads(data)
                            choices = obj.get("choices") or []
                            if choices:
                                delta = choices[0].get("delta", {}) or {}
                                content = delta.get("content") or ""
                                if content:
                                    yield b"data: " + json.dumps({"delta": content}).encode() + b"\n\n"
                        except json.JSONDecodeError:
                            continue
        yield b"data: [DONE]\n\n"
    except Exception as exc:  # noqa: BLE001
        yield b"data: " + json.dumps({"error": str(exc)}).encode() + b"\n\n"
        yield b"data: [DONE]\n\n"


def _build_messages(req: ChatRequest) -> List[Dict[str, str]]:
    msgs: List[Dict[str, str]] = []
    if req.system:
        msgs.append({"role": "system", "content": req.system})
    for m in req.messages:
        msgs.append({"role": m.role, "content": m.content})
    return msgs


@router.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    payload = {
        "model": req.model,
        "messages": _build_messages(req),
        "temperature": req.temperature,
        "max_tokens": req.max_tokens,
    }
    return StreamingResponse(_stream_nvidia(payload), media_type="text/event-stream")


async def _complete_text(model: str, system: str, user: str, temperature: float = 0.2, max_tokens: int = 1024) -> str:
    """Non-streaming chat completion."""
    if not NVIDIA_API_KEY:
        raise HTTPException(503, "NVIDIA_API_KEY not configured")
    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=15.0)) as client:
        r = await client.post(f"{NVIDIA_BASE}/chat/completions", json=payload, headers=headers)
        if r.status_code != 200:
            raise HTTPException(r.status_code, f"NVIDIA error: {r.text[:300]}")
        data = r.json()
        return (data.get("choices") or [{}])[0].get("message", {}).get("content", "")


def _strip_fences(text: str, language: str = "") -> str:
    """Strip triple-backtick fences from model output to get pure code."""
    t = text.strip()
    if t.startswith("```"):
        # remove opening fence with optional language
        nl = t.find("\n")
        if nl != -1:
            t = t[nl + 1 :]
        if t.endswith("```"):
            t = t[:-3]
    return t.rstrip("\n")


@router.post("/complete")
async def autocomplete(req: CompletionRequest):
    """Ghost-text completion for inline editor suggestions."""
    sys_prompt = (
        f"You are a {req.language} autocomplete engine. "
        "Continue the user's code from <CURSOR>. "
        "Respond ONLY with the raw code to insert at the cursor. "
        "Do not include explanations, do not repeat the existing code, do not use markdown fences. "
        "Keep the completion short (max ~6 lines) unless clearly needed."
    )
    user = f"{req.prefix}<CURSOR>{req.suffix}"
    text = await _complete_text(req.model, sys_prompt, user, temperature=0.1, max_tokens=180)
    completion = _strip_fences(text)
    # never return empty leading whitespace duplication
    return {"completion": completion}


@router.post("/edit")
async def inline_edit(req: EditRequest):
    sys_prompt = (
        f"You are an expert {req.language} engineer. Rewrite the user's code per their instruction. "
        "Respond ONLY with the final code, no explanations, no markdown fences."
    )
    user = f"Instruction: {req.instruction}\n\nCode:\n{req.code}"
    text = await _complete_text(req.model, sys_prompt, user, temperature=0.3, max_tokens=2048)
    return {"code": _strip_fences(text, req.language)}


@router.post("/explain")
async def explain(req: TaskRequest):
    sys_prompt = "You are a senior engineer. Explain code clearly and concisely using markdown."
    user = f"Explain this {req.language} code:\n\n```{req.language}\n{req.code}\n```"
    text = await _complete_text(req.model, sys_prompt, user, temperature=0.3, max_tokens=1200)
    return {"explanation": text}


@router.post("/refactor")
async def refactor(req: TaskRequest):
    sys_prompt = (
        f"You are an expert {req.language} engineer. Refactor the code to improve clarity, "
        "performance, and idiomatic style while preserving behavior. "
        "Respond ONLY with the final code, no explanations, no markdown fences."
    )
    text = await _complete_text(req.model, sys_prompt, req.code, temperature=0.2, max_tokens=2048)
    return {"code": _strip_fences(text, req.language)}


@router.post("/docs")
async def generate_docs(req: TaskRequest):
    sys_prompt = (
        f"You are an expert {req.language} engineer. Add high-quality documentation comments "
        "(docstrings / JSDoc as appropriate) to the code. Respond ONLY with the documented code."
    )
    text = await _complete_text(req.model, sys_prompt, req.code, temperature=0.2, max_tokens=2048)
    return {"code": _strip_fences(text, req.language)}


@router.post("/tests")
async def generate_tests(req: TaskRequest):
    sys_prompt = (
        f"Generate unit tests for the {req.language} code below using the most idiomatic test "
        "framework (pytest for Python, vitest/jest for JS/TS, JUnit for Java, etc.). "
        "Respond ONLY with the test code, no explanations, no markdown fences."
    )
    text = await _complete_text(req.model, sys_prompt, req.code, temperature=0.2, max_tokens=2048)
    return {"code": _strip_fences(text, req.language)}


@router.post("/fix")
async def fix_code(req: TaskRequest):
    sys_prompt = (
        f"You are an expert {req.language} engineer. The user's code has bugs or errors. "
        "Fix the bugs and respond ONLY with the corrected code (no markdown, no commentary)."
    )
    text = await _complete_text(req.model, sys_prompt, req.code, temperature=0.2, max_tokens=2048)
    return {"code": _strip_fences(text, req.language)}


class CommitMsgRequest(BaseModel):
    model: str
    diff: str


@router.post("/commit-message")
async def commit_message(req: CommitMsgRequest):
    sys_prompt = (
        "Write a concise, conventional-commits style git commit message for this diff. "
        "Respond ONLY with the commit message (subject line, then optional body)."
    )
    text = await _complete_text(req.model, sys_prompt, req.diff[:8000], temperature=0.3, max_tokens=200)
    return {"message": text.strip()}


class GenerateRequest(BaseModel):
    model: str
    prompt: str
    language: str = "plaintext"


@router.post("/generate")
async def generate(req: GenerateRequest):
    sys_prompt = (
        f"You are an expert {req.language} engineer. Generate the requested code. "
        "Respond ONLY with the code, no markdown fences, no commentary."
    )
    text = await _complete_text(req.model, sys_prompt, req.prompt, temperature=0.4, max_tokens=2048)
    return {"code": _strip_fences(text, req.language)}

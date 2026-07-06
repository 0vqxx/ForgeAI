"""
AI Routes for FastAPI backend
Provides REST API endpoints for AI chat operations with multiple providers
"""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from ai_service import ai_service

router = APIRouter(prefix="/api/ai", tags=["ai"])


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant" | "system"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    provider: str = "openai"
    model: Optional[str] = None
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    stream: bool = False
    reasoning_effort: Optional[str] = None


class ModelInfo(BaseModel):
    provider: str
    models: List[str]


@router.post("/chat")
async def chat(request: ChatRequest, http_request: Request):
    try:
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]

        from ai_service import ai_service as _ai_svc
        from ai_sdk_adapter import AIProvider
        provider_client = _ai_svc.adapter.get_client(AIProvider(request.provider))
        supports_agent = (
            hasattr(provider_client, "client") and
            hasattr(provider_client.client, "chat") and
            hasattr(provider_client.client.chat, "completions")
        )

        if supports_agent:
            system_msg_idx = next((i for i, m in enumerate(messages) if m["role"] == "system"), None)
            tool_instructions = (
                "\n\n[AGENT SYSTEM INSTRUCTIONS]\n"
                "You have access to the following workspace tools. Use them autonomously to fulfill requests:\n"
                "- read_workspace_file: Read files inside the workspace (restricted from the 'backend' directory).\n"
                "- write_workspace_file: Write or modify files (restricted from the 'backend' directory).\n"
                "- execute_command: Run terminal commands like builds or tests (restricted from targeting 'backend').\n"
                "- web_search: Perform web search for documentation and facts.\n"
                "- create_zip_archive: Bundle multiple files/folders into a downloadable zip file (places it under /api/downloads/). Use this to give the user zip files of code deliverables.\n"
                "Always use these tools to research, write, build, verify, and package your code."
            )
            if system_msg_idx is not None:
                messages[system_msg_idx]["content"] += tool_instructions
            else:
                messages.insert(0, {"role": "system", "content": f"You are a helpful assistant.{tool_instructions}"})

            user_id = getattr(http_request.state, "user_id", "default")

            from agents.runner import run_agent_loop
            if request.stream:
                async def generate():
                    try:
                        async for chunk in run_agent_loop(messages, request.model, request.provider, user_id):
                            yield chunk
                    except Exception as e:
                        import traceback
                        traceback.print_exc()
                        yield f"Error: {str(e)}"
                return StreamingResponse(generate(), media_type="text/event-stream")
            else:
                full_text = []
                async for chunk in run_agent_loop(messages, request.model, request.provider, user_id):
                    if chunk.startswith("\n[TOOL_START:") or chunk.startswith("\n[TOOL_END:"):
                        continue
                    full_text.append(chunk)
                return {
                    "text": "".join(full_text),
                    "model": request.model,
                    "provider": request.provider,
                    "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                    "finish_reason": "stop",
                }

        response = ai_service.chat(
            messages=messages,
            provider=request.provider,
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            stream=request.stream,
        )

        if request.stream:
            async def generate():
                try:
                    for chunk in response:
                        yield chunk
                except Exception as e:
                    yield f"Error: {str(e)}"
            return StreamingResponse(generate(), media_type="text/event-stream")

        return {
            "text": response.text,
            "model": response.model,
            "provider": response.provider.value,
            "usage": response.usage,
            "finish_reason": response.finish_reason,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI API error: {str(e)}")


@router.get("/models")
async def get_models():
    try:
        models = ai_service.get_available_models()
        return {"providers": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models/{provider}")
async def get_provider_models(provider: str):
    try:
        models = ai_service.get_provider_models(provider)
        return {
            "provider": provider,
            "models": models,
            "default": ai_service.get_default_model(provider),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ConfirmRequest(BaseModel):
    approved: bool


@router.post("/confirm/{command_id}")
async def confirm_command(command_id: str, request: ConfirmRequest):
    from agents.confirmations import confirmation_manager
    if command_id not in confirmation_manager.pending:
        raise HTTPException(status_code=404, detail="Command confirmation request not found")
    confirmation_manager.resolve(command_id, request.approved)
    return {"status": "resolved", "approved": request.approved}


@router.post("/completions")
async def completions(request: ChatRequest, http_request: Request):
    return await chat(request, http_request)
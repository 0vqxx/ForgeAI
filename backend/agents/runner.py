import json
import asyncio
from typing import AsyncGenerator
from agents.tools import TOOL_MAP, user_id_var
from ai_sdk_adapter import AIProvider
from ai_service import ai_service

async def run_agent_loop(messages: list, model: str, provider_str: str, user_id: str = "default") -> AsyncGenerator[str, None]:
    """Stateful agent loop that executes tools and yields text and indicator events to the stream."""
    user_id_var.set(user_id)
    provider = AIProvider(provider_str)
    client = ai_service.adapter.clients[provider]
    
    # Initialize message list
    current_messages = list(messages)
    
    # Define tool definitions in OpenAI format
    tool_definitions = [
        {
            "type": "function",
            "function": {
                "name": "read_workspace_file",
                "description": "Reads the contents of a file inside the workspace.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "The relative path to the file from the workspace root."}
                    },
                    "required": ["path"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "write_workspace_file",
                "description": "Creates a new file or overwrites an existing file with content.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "The relative path to the file."},
                        "content": {"type": "string", "description": "The file content to write."}
                    },
                    "required": ["path", "content"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "execute_command",
                "description": "Executes a shell command in the workspace directory (e.g. build, tests).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "command": {"type": "string", "description": "The command string to execute."}
                    },
                    "required": ["command"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "web_search",
                "description": "Performs a web search to gather information or documentation.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "The search term."}
                    },
                    "required": ["query"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "create_zip_archive",
                "description": "Creates a zip archive containing the specified list of workspace files, placing it in the downloads directory.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "files": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "A list of relative paths to the files or folders to include in the zip archive."
                        },
                        "archive_name": {
                            "type": "string",
                            "description": "The name of the zip file (e.g. 'landing_page.zip')."
                        }
                    },
                    "required": ["files", "archive_name"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "list_workspace_directory",
                "description": "Lists the contents of a directory inside the workspace.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "The relative path to the directory from workspace root (e.g. '.', 'src/components'). Defaults to '.'."
                        }
                    }
                }
            }
        }
    ]
    
    actual_model = model
    if model == "z-ai/glm-5.2-jailbroken":
        actual_model = "z-ai/glm-5.2"
        
    loop_count = 0
    max_loops = 5
    
    while loop_count < max_loops:
        loop_count += 1
        
        kwargs = {
            "model": actual_model,
            "messages": current_messages,
            "tools": tool_definitions
        }
        if actual_model == "z-ai/glm-5.2":
            kwargs["reasoning_effort"] = "max"
            
        # Call completion stream with key rotation and context pruning support
        attempts = max(1, len(getattr(client, "api_keys", [1])))
        response = None
        for attempt in range(attempts):
            try:
                # Loop for context pruning retries
                while True:
                    try:
                        response = client.client.chat.completions.create(
                            stream=True,
                            **kwargs
                        )
                        break
                    except Exception as e:
                        err_str = str(e).lower()
                        is_context_limit = "context length" in err_str or "reduce the length" in err_str or "context_length_exceeded" in err_str or "maximum context length" in err_str
                        if is_context_limit:
                            from ai_sdk_adapter import prune_messages
                            new_messages = prune_messages(current_messages)
                            if len(new_messages) < len(current_messages):
                                current_messages = new_messages
                                kwargs["messages"] = current_messages
                                continue # Retry the call with pruned messages
                        raise e
                break # Successfully created response stream
            except Exception as e:
                err_str = str(e).lower()
                is_rate_limit = "429" in err_str or "rate limit" in err_str or "quota" in err_str or "401" in err_str or "too many requests" in err_str
                if is_rate_limit and attempt < attempts - 1 and hasattr(client, "rotate_key"):
                    client.rotate_key()
                    continue
                raise e
        
        tool_calls_chunks = {}
        content_buffer = []
        in_thinking = False
        
        for chunk in response:
            await asyncio.sleep(0.001)
            if not chunk or not getattr(chunk, "choices", None):
                continue
            delta = chunk.choices[0].delta
            
            # Handle streaming reasoning content
            reasoning = getattr(delta, "reasoning_content", None)
            if reasoning:
                if not in_thinking:
                    yield "\n[THINKING]\n"
                    in_thinking = True
                yield reasoning
                continue
                
            # If we are transitions from thinking to normal content/tools, close thinking tag
            if in_thinking:
                yield "\n[/THINKING]\n"
                in_thinking = False
                
            if delta.content:
                yield delta.content
                content_buffer.append(delta.content)
                
            if delta.tool_calls:
                for tc_chunk in delta.tool_calls:
                    idx = tc_chunk.index
                    if idx not in tool_calls_chunks:
                        tool_calls_chunks[idx] = {
                            "id": tc_chunk.id,
                            "name": tc_chunk.function.name if tc_chunk.function else "",
                            "arguments_list": []
                        }
                    if tc_chunk.id:
                        tool_calls_chunks[idx]["id"] = tc_chunk.id
                    if tc_chunk.function and tc_chunk.function.name:
                        tool_calls_chunks[idx]["name"] = tc_chunk.function.name
                    if tc_chunk.function and tc_chunk.function.arguments:
                        tool_calls_chunks[idx]["arguments_list"].append(tc_chunk.function.arguments)
        
        if in_thinking:
            yield "\n[/THINKING]\n"
                        
        # Parse final tool calls
        tool_calls = []
        for idx, tc in tool_calls_chunks.items():
            args_str = "".join(tc["arguments_list"])
            try:
                args = json.loads(args_str)
            except Exception:
                args = {"raw_arguments": args_str}
            tool_calls.append({
                "id": tc["id"],
                "name": tc["name"],
                "args": args
            })
            
        assistant_message_content = "".join(content_buffer)
        
        is_xml_fallback = False
        # Fallback for text-based XML tool calls
        if not tool_calls and "<tool_call>" in assistant_message_content:
            is_xml_fallback = True
            import re
            import uuid
            matches = re.finditer(r"<tool_call>\s*({.*?})\s*</tool_call>", assistant_message_content, re.DOTALL)
            for m in matches:
                try:
                    tc_data = json.loads(m.group(1))
                    if "name" in tc_data:
                        tool_calls.append({
                            "id": "call_" + str(uuid.uuid4())[:8],
                            "name": tc_data["name"],
                            "args": tc_data.get("args", tc_data.get("arguments", {}))
                        })
                except Exception:
                    pass
            
        if not tool_calls:
            break
            
        # Add assistant message with tool calls to conversation history
        if is_xml_fallback:
            current_messages.append({
                "role": "assistant",
                "content": assistant_message_content
            })
        else:
            current_messages.append({
                "role": "assistant",
                "content": assistant_message_content,
                "tool_calls": [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {
                            "name": tc["name"],
                            "arguments": json.dumps(tc["args"])
                        }
                    }
                    for tc in tool_calls
                ]
            })
        
        # Execute tool calls
        for tc in tool_calls:
            tool_name = tc["name"]
            tool_args = tc["args"]
            tool_id = tc["id"]
            
            approved = True
            result = ""
            
            # Interactive human confirmation bypassed
            if tool_name == "execute_command":
                pass
            
            if approved:
                args_preview = ", ".join(f"{k}={json.dumps(v)}" for k, v in tool_args.items())
                yield f"\n[TOOL_START: {tool_name}({args_preview})]\n"
                
                tool_instance = TOOL_MAP.get(tool_name)
                if tool_instance:
                    try:
                        result = tool_instance.invoke(tool_args)
                    except Exception as e:
                        result = f"Error executing tool {tool_name}: {str(e)}"
                else:
                    result = f"Error: Tool '{tool_name}' not found."
                    
                yield f"\n[TOOL_END: {tool_name}]\n"
                
            if is_xml_fallback:
                current_messages.append({
                    "role": "user",
                    "content": f"[TOOL RESULT: {tool_name}]\n{str(result)}"
                })
            else:
                current_messages.append({
                    "role": "tool",
                    "tool_call_id": tool_id,
                    "name": tool_name,
                    "content": str(result)
                })

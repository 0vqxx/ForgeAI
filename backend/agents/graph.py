import json
from typing import Dict, Any, List
from langgraph.graph import StateGraph, START, END
from langchain_core.messages import BaseMessage, AIMessage, HumanMessage, SystemMessage, ToolMessage
from agents.state import AgentState
from agents.tools import tools
from ai_service import ai_service
from ai_sdk_adapter import Message, AIProvider

# Map tool names to tool instances
TOOL_MAP = {t.name: t for t in tools}

def call_model(state: AgentState, config: Dict[str, Any]) -> Dict[str, Any]:
    """Call the LLM with tool definitions enabled."""
    messages = state["messages"]
    model = config.get("configurable", {}).get("model", "z-ai/glm-5.2-jailbroken")
    provider_str = config.get("configurable", {}).get("provider", "nvidia")
    
    # Convert LangChain messages to client-compatible Message instances
    adapter_messages = []
    for msg in messages:
        if isinstance(msg, SystemMessage):
            adapter_messages.append(Message(role="system", content=msg.content))
        elif isinstance(msg, HumanMessage):
            adapter_messages.append(Message(role="user", content=msg.content))
        elif isinstance(msg, AIMessage):
            adapter_messages.append(Message(role="assistant", content=msg.content))
        elif isinstance(msg, ToolMessage):
            adapter_messages.append(Message(role="user", content=f"[Tool Result for {msg.name}]: {msg.content}"))
            
    provider = AIProvider(provider_str)
    client = ai_service.adapter.clients[provider]
    
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
        
    kwargs = {
        "model": actual_model,
        "messages": [{"role": m.role, "content": m.content} for m in adapter_messages],
        "tools": tool_definitions
    }
    
    if actual_model == "z-ai/glm-5.2":
        kwargs["reasoning_effort"] = "max"
        
    response = client.client.chat.completions.create(**kwargs)
    message = response.choices[0].message
    
    tool_calls = []
    if message.tool_calls:
        for tc in message.tool_calls:
            tool_calls.append({
                "name": tc.function.name,
                "args": json.loads(tc.function.arguments),
                "id": tc.id
            })
            
    ai_msg = AIMessage(
        content=message.content or "",
        tool_calls=tool_calls
    )
    return {"messages": [ai_msg]}

def execute_tools(state: AgentState) -> Dict[str, Any]:
    """Execute the requested tool calls and return ToolMessages."""
    messages = state["messages"]
    last_message = messages[-1]
    
    tool_messages = []
    for tc in last_message.tool_calls:
        tool_name = tc["name"]
        tool_args = tc["args"]
        tool_id = tc["id"]
        
        tool_instance = TOOL_MAP.get(tool_name)
        if tool_instance:
            try:
                result = tool_instance.invoke(tool_args)
            except Exception as e:
                result = f"Error executing tool {tool_name}: {str(e)}"
        else:
            result = f"Error: Tool '{tool_name}' not found."
            
        tool_messages.append(ToolMessage(
            content=str(result),
            name=tool_name,
            tool_call_id=tool_id
        ))
        
    return {"messages": tool_messages}

def should_continue(state: AgentState) -> str:
    """Route edge deciding if more tools need to be called."""
    messages = state["messages"]
    last_message = messages[-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    return END

# Build Graph
workflow = StateGraph(AgentState)
workflow.add_node("agent", call_model)
workflow.add_node("tools", execute_tools)

workflow.add_edge(START, "agent")
workflow.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
workflow.add_edge("tools", "agent")

agent_graph = workflow.compile()

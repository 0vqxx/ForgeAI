from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    """The state of the agent graph, containing conversation messages."""
    messages: Annotated[Sequence[BaseMessage], add_messages]

import os
from typing import Optional
from ai_sdk_adapter import (
    AISDKAdapter,
    AIProvider,
    OpenAIModel,
    ClaudeModel,
    ZaiModel,
    Message,
)


class AIService:
    """Service layer for AI operations in BloomIDE backend"""

    def __init__(self):
        self.adapter = AISDKAdapter()

    def chat(
        self,
        messages: list[dict],
        provider: str = "openai",
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        stream: bool = False,
    ):
        """
        Send a chat message to the specified AI provider.

        Args:
            messages: List of message dicts with 'role' and 'content'
            provider: AI provider ('openai', 'claude', 'zai')
            model: Model name (uses default if not specified)
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum response tokens
            stream: Whether to stream the response

        Returns:
            AIResponse or Generator[str] if streaming
        """
        # Convert dict messages to Message objects
        message_objects = [
            Message(role=msg["role"], content=msg["content"]) for msg in messages
        ]

        # Get provider enum
        provider_enum = AIProvider(provider)

        # Use default model if not specified
        if not model:
            model = self.adapter.get_default_model(provider_enum)

        # Get response
        return self.adapter.chat_completion(
            messages=message_objects,
            provider=provider_enum,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream,
        )

    def get_available_models(self) -> dict:
        """Get all available models across providers"""
        return self.adapter.list_available_providers()

    def get_provider_models(self, provider: str) -> list[str]:
        """Get available models for a specific provider"""
        provider_enum = AIProvider(provider)
        return self.adapter.get_client(provider_enum).list_models()

    def get_default_model(self, provider: str) -> str:
        """Get the default model for a provider"""
        provider_enum = AIProvider(provider)
        return self.adapter.get_default_model(provider_enum)


# Initialize global AI service
ai_service = AIService()

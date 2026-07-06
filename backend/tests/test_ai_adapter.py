"""
Test examples for AI SDK Adapter
Demonstrates usage of all providers and features
"""

import pytest
from backend.ai_sdk_adapter import (
    AISDKAdapter,
    AIProvider,
    OpenAIModel,
    ClaudeModel,
    ZaiModel,
    Message,
    OpenAIClient,
    ClaudeClient,
    ZaiClient,
)
from backend.ai_service import AIService


class TestOpenAIClient:
    """Test OpenAI client functionality"""

    def test_openai_initialization(self):
        """Test OpenAI client can be initialized"""
        try:
            client = OpenAIClient()
            assert client.api_key is not None
        except ValueError as e:
            pytest.skip(f"OpenAI API key not configured: {e}")

    def test_openai_list_models(self):
        """Test listing OpenAI models"""
        try:
            client = OpenAIClient()
            models = client.list_models()
            assert len(models) > 0
            assert OpenAIModel.GPT_4O.value in models
        except ValueError:
            pytest.skip("OpenAI API key not configured")

    def test_openai_chat_completion(self):
        """Test OpenAI chat completion"""
        try:
            client = OpenAIClient()
            messages = [Message(role="user", content="Say 'Hello, World!'")]
            response = client.chat_completion(
                messages=messages,
                model=OpenAIModel.GPT_4O_MINI.value,
                max_tokens=10,
            )
            assert response.text is not None
            assert len(response.text) > 0
            assert response.provider == AIProvider.OPENAI
        except ValueError:
            pytest.skip("OpenAI API key not configured")


class TestClaudeClient:
    """Test Claude client functionality"""

    def test_claude_initialization(self):
        """Test Claude client can be initialized"""
        try:
            client = ClaudeClient()
            assert client.api_key is not None
        except ValueError as e:
            pytest.skip(f"Claude API key not configured: {e}")

    def test_claude_list_models(self):
        """Test listing Claude models"""
        try:
            client = ClaudeClient()
            models = client.list_models()
            assert len(models) == 5  # We have 5 Claude models
            assert ClaudeModel.OPUS_4_1.value in models
            assert ClaudeModel.SONNET_4.value in models
            assert ClaudeModel.HAIKU_3.value in models
        except ValueError:
            pytest.skip("Claude API key not configured")

    def test_claude_chat_completion(self):
        """Test Claude chat completion"""
        try:
            client = ClaudeClient()
            messages = [Message(role="user", content="Say 'Hello, World!'")]
            response = client.chat_completion(
                messages=messages,
                model=ClaudeModel.OPUS_4_1.value,
                max_tokens=10,
            )
            assert response.text is not None
            assert len(response.text) > 0
            assert response.provider == AIProvider.CLAUDE
        except ValueError:
            pytest.skip("Claude API key not configured")


class TestZaiClient:
    """Test Z.ai (Zhipu AI) client functionality"""

    def test_zai_initialization(self):
        """Test Z.ai client can be initialized"""
        try:
            client = ZaiClient()
            assert client.api_key is not None
        except ValueError as e:
            pytest.skip(f"Z.ai API key not configured: {e}")

    def test_zai_list_models(self):
        """Test listing Z.ai models"""
        try:
            client = ZaiClient()
            models = client.list_models()
            assert len(models) == 2  # GLM 5.1 and 5.2
            assert ZaiModel.GLM_5_2.value in models
            assert ZaiModel.GLM_5_1.value in models
        except ValueError:
            pytest.skip("Z.ai API key not configured")

    def test_zai_chat_completion(self):
        """Test Z.ai chat completion"""
        try:
            client = ZaiClient()
            messages = [Message(role="user", content="Say 'Hello, World!'")]
            response = client.chat_completion(
                messages=messages,
                model=ZaiModel.GLM_5_2.value,
                max_tokens=10,
            )
            assert response.text is not None
            assert len(response.text) > 0
            assert response.provider == AIProvider.ZAI
        except ValueError:
            pytest.skip("Z.ai API key not configured")


class TestAISDKAdapter:
    """Test AI SDK Adapter unified interface"""

    def test_adapter_initialization(self):
        """Test adapter can initialize"""
        adapter = AISDKAdapter()
        assert adapter.clients is not None

    def test_adapter_list_providers(self):
        """Test listing all available providers and models"""
        adapter = AISDKAdapter()
        providers = adapter.list_available_providers()
        assert isinstance(providers, dict)

    def test_adapter_get_default_model(self):
        """Test getting default models for each provider"""
        adapter = AISDKAdapter()
        if AIProvider.OPENAI in adapter.clients:
            default = adapter.get_default_model(AIProvider.OPENAI)
            assert default == OpenAIModel.GPT_4O.value

        if AIProvider.CLAUDE in adapter.clients:
            default = adapter.get_default_model(AIProvider.CLAUDE)
            assert default == ClaudeModel.OPUS_4_1.value

        if AIProvider.ZAI in adapter.clients:
            default = adapter.get_default_model(AIProvider.ZAI)
            assert default == ZaiModel.GLM_5_2.value

    def test_adapter_openai_chat(self):
        """Test OpenAI chat through adapter"""
        try:
            adapter = AISDKAdapter()
            messages = [Message(role="user", content="Say 'test'")]
            response = adapter.chat_completion(
                messages=messages,
                provider=AIProvider.OPENAI,
                model=OpenAIModel.GPT_4O_MINI.value,
                max_tokens=5,
            )
            assert response.text is not None
        except ValueError:
            pytest.skip("OpenAI API key not configured")

    def test_adapter_claude_chat(self):
        """Test Claude chat through adapter"""
        try:
            adapter = AISDKAdapter()
            messages = [Message(role="user", content="Say 'test'")]
            response = adapter.chat_completion(
                messages=messages,
                provider=AIProvider.CLAUDE,
                model=ClaudeModel.HAIKU_3.value,
                max_tokens=5,
            )
            assert response.text is not None
        except ValueError:
            pytest.skip("Claude API key not configured")

    def test_adapter_zai_chat(self):
        """Test Z.ai chat through adapter"""
        try:
            adapter = AISDKAdapter()
            messages = [Message(role="user", content="Say 'test'")]
            response = adapter.chat_completion(
                messages=messages,
                provider=AIProvider.ZAI,
                model=ZaiModel.GLM_5_2.value,
                max_tokens=5,
            )
            assert response.text is not None
        except ValueError:
            pytest.skip("Z.ai API key not configured")


class TestAIService:
    """Test AI Service layer"""

    def test_service_initialization(self):
        """Test service can initialize"""
        service = AIService()
        assert service.adapter is not None

    def test_service_get_available_models(self):
        """Test service returns available models"""
        service = AIService()
        models = service.get_available_models()
        assert isinstance(models, dict)

    def test_service_chat_openai(self):
        """Test service chat with OpenAI"""
        try:
            service = AIService()
            response = service.chat(
                messages=[{"role": "user", "content": "Say 'hi'"}],
                provider="openai",
                model="gpt-4o-mini",
                max_tokens=5,
            )
            assert response.text is not None
        except ValueError:
            pytest.skip("OpenAI API key not configured")

    def test_service_chat_claude(self):
        """Test service chat with Claude"""
        try:
            service = AIService()
            response = service.chat(
                messages=[{"role": "user", "content": "Say 'hi'"}],
                provider="claude",
                model="claude-3-5-haiku-20241022",
                max_tokens=5,
            )
            assert response.text is not None
        except ValueError:
            pytest.skip("Claude API key not configured")

    def test_service_chat_zai(self):
        """Test service chat with Z.ai"""
        try:
            service = AIService()
            response = service.chat(
                messages=[{"role": "user", "content": "Say 'hi'"}],
                provider="zai",
                model="glm-5-2",
                max_tokens=5,
            )
            assert response.text is not None
        except ValueError:
            pytest.skip("Z.ai API key not configured")

    def test_service_default_model(self):
        """Test service uses default model when not specified"""
        service = AIService()
        default_openai = service.get_default_model("openai")
        assert default_openai == OpenAIModel.GPT_4O.value

        default_claude = service.get_default_model("claude")
        assert default_claude == ClaudeModel.OPUS_4_1.value

        default_zai = service.get_default_model("zai")
        assert default_zai == ZaiModel.GLM_5_2.value


class TestErrorHandling:
    """Test error handling and edge cases"""

    def test_invalid_provider(self):
        """Test handling of invalid provider"""
        adapter = AISDKAdapter()
        with pytest.raises(ValueError):
            adapter.get_client(AIProvider("invalid"))

    def test_missing_api_key(self):
        """Test handling of missing API keys"""
        import os

        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key:
            with pytest.raises(ValueError):
                OpenAIClient()

    def test_service_invalid_provider(self):
        """Test service with invalid provider"""
        service = AIService()
        with pytest.raises(ValueError):
            service.chat(
                messages=[{"role": "user", "content": "test"}],
                provider="invalid_provider",
            )


class TestModelEnums:
    """Test model enum definitions"""

    def test_openai_models(self):
        """Test OpenAI model enum"""
        assert OpenAIModel.GPT_4O.value == "gpt-4o"
        assert OpenAIModel.GPT_4_TURBO.value == "gpt-4-turbo"
        assert OpenAIModel.GPT_4_VISION.value == "gpt-4-vision"
        assert OpenAIModel.GPT_4O_MINI.value == "gpt-4o-mini"

    def test_claude_models(self):
        """Test Claude model enum"""
        assert (
            ClaudeModel.OPUS_4_1.value == "claude-3-5-opus-20241022"
        )
        assert (
            ClaudeModel.SONNET_4.value == "claude-3-5-sonnet-20241022"
        )
        assert (
            ClaudeModel.HAIKU_3.value == "claude-3-5-haiku-20241022"
        )
        assert ClaudeModel.FABLE.value == "claude-3-haiku-20240307"
        assert (
            ClaudeModel.CODER.value == "claude-3-5-sonnet-20241022"
        )

    def test_zai_models(self):
        """Test Z.ai model enum"""
        assert ZaiModel.GLM_5_1.value == "glm-5-1"
        assert ZaiModel.GLM_5_2.value == "glm-5-2"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

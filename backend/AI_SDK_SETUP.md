# AI SDK Integration Setup Guide

This guide walks through setting up the multi-provider AI SDK adapter for OpenAI, Claude, and Z.ai.

## Installation

### 1. Install Python Dependencies

```bash
cd backend
pip install -r requirements-ai.txt
```

This installs:
- `openai` - OpenAI API client
- `anthropic` - Anthropic Claude API client
- `zhipuai` - Zhipu AI (Z.ai) API client
- `python-dotenv` - Environment variable management
- `requests` - HTTP library

### 2. Set Up Environment Variables

Create a `.env` file in the `backend/` directory with your API keys:

```bash
# OpenAI API Key
OPENAI_API_KEY=sk-your-openai-key-here

# Anthropic (Claude) API Key
ANTHROPIC_API_KEY=sk-ant-your-claude-key-here

# Zhipu AI (Z.ai) API Key
ZAI_API_KEY=your-zai-api-key-here
```

**Important:** Never commit `.env` files to version control. They're already in `.gitignore`.

## Available Models

### OpenAI (Latest 4 Models)
- `gpt-4o` - Latest GPT-4 Omni model (recommended)
- `gpt-4-turbo` - GPT-4 Turbo with 128K context
- `gpt-4-vision` - GPT-4 with vision capabilities
- `gpt-4o-mini` - Lightweight GPT-4 Omni

### Claude (Latest 5 Models)
- `claude-3-5-opus-20241022` - Claude 3.5 Opus (most capable)
- `claude-3-5-sonnet-20241022` - Claude 3.5 Sonnet (balanced)
- `claude-3-5-haiku-20241022` - Claude 3.5 Haiku (fastest)
- `claude-3-haiku-20240307` - Fable (alias for Haiku)
- `claude-3-5-sonnet-20241022` - Coder (alias for Sonnet, optimized for code)

### Z.ai / Zhipu AI (Latest 2 Models)
- `glm-5-2` - GLM 5.2 (latest, recommended)
- `glm-5-1` - GLM 5.1

## Usage Examples

### Basic Python Usage

```python
from backend.ai_service import ai_service
from backend.ai_sdk_adapter import Message, AIProvider

# Simple chat with default model
messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What is Python?"}
]

# Using OpenAI (default)
response = ai_service.chat(
    messages=messages,
    provider="openai",
    model="gpt-4o"
)
print(response.text)

# Using Claude
response = ai_service.chat(
    messages=messages,
    provider="claude",
    model="claude-3-5-opus-20241022",
    temperature=0.7,
    max_tokens=1024
)
print(response.text)

# Using Z.ai
response = ai_service.chat(
    messages=messages,
    provider="zai",
    model="glm-5-2"
)
print(response.text)
```

### Streaming Responses

```python
# Stream response from OpenAI
response_stream = ai_service.chat(
    messages=messages,
    provider="openai",
    stream=True
)

for chunk in response_stream:
    print(chunk, end="", flush=True)
```

### API Endpoints

The backend exposes REST API endpoints for AI operations:

#### POST `/api/ai/chat`
Send a chat message to an AI provider.

**Request:**
```json
{
  "messages": [
    {"role": "user", "content": "Hello, how are you?"}
  ],
  "provider": "openai",
  "model": "gpt-4o",
  "temperature": 0.7,
  "max_tokens": 1024,
  "stream": false
}
```

**Response:**
```json
{
  "text": "I'm doing well, thank you for asking!",
  "model": "gpt-4o",
  "provider": "openai",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 8,
    "total_tokens": 18
  },
  "finish_reason": "stop"
}
```

#### GET `/api/ai/models`
Get all available models across all providers.

**Response:**
```json
{
  "providers": {
    "openai": ["gpt-4o", "gpt-4-turbo", "gpt-4-vision", "gpt-4o-mini"],
    "claude": ["claude-3-5-opus-20241022", "claude-3-5-sonnet-20241022", ...],
    "zai": ["glm-5-2", "glm-5-1"]
  }
}
```

#### GET `/api/ai/models/{provider}`
Get available models for a specific provider.

**Response:**
```json
{
  "provider": "openai",
  "models": ["gpt-4o", "gpt-4-turbo", "gpt-4-vision", "gpt-4o-mini"],
  "default": "gpt-4o"
}
```

#### POST `/api/ai/completions`
Legacy completions endpoint (alias for `/api/ai/chat`).

## Architecture

### Components

1. **ai_sdk_adapter.py** - Core adapter with provider clients
   - `OpenAIClient` - Handles OpenAI API calls
   - `ClaudeClient` - Handles Anthropic Claude API calls
   - `ZaiClient` - Handles Zhipu AI API calls
   - `AISDKAdapter` - Unified interface for all providers

2. **ai_service.py** - Service layer for business logic
   - `AIService` - High-level API for chat operations
   - Message conversion and provider routing

3. **routes/ai.py** - FastAPI endpoints
   - Chat completion endpoints
   - Model listing endpoints
   - Streaming support

### Provider Selection Flow

```
User Request
    ↓
AIService.chat()
    ↓
AISDKAdapter.chat_completion()
    ↓
Provider Router (openai/claude/zai)
    ↓
Provider Client (OpenAIClient/ClaudeClient/ZaiClient)
    ↓
API Call to Provider
    ↓
Response Processing
    ↓
AIResponse Object
    ↓
Return to User
```

## Error Handling

The adapter handles common errors gracefully:

- **Missing API Keys**: Raises `ValueError` if required API key is not set
- **Invalid Provider**: Raises `ValueError` if provider is not supported
- **API Errors**: Wraps provider-specific errors with context
- **Network Errors**: Propagates connection errors for retry logic

## Configuration

### Temperature (Sampling)
- **Range**: 0.0 - 2.0
- **0.0**: Deterministic, repeatable responses
- **0.7**: Default, balanced creativity
- **1.0+**: More creative, varied responses

### Max Tokens
- Controls maximum response length
- Different providers have different limits
- Omit for provider defaults

### Streaming
- Set `stream=True` for real-time responses
- Useful for long-form content generation
- Each provider handles streaming natively

## Getting API Keys

### OpenAI
1. Visit https://platform.openai.com/api-keys
2. Create new API key
3. Copy and store securely

### Anthropic (Claude)
1. Visit https://console.anthropic.com/
2. Create API key
3. Copy and store securely

### Zhipu AI (Z.ai)
1. Visit https://open.bigmodel.cn/
2. Create API key
3. Copy and store securely

## Integration with BloomIDE

The AI SDK is integrated with BloomIDE's backend:

1. **Backend Server** uses `ai_service` for AI operations
2. **Frontend** calls `/api/ai/chat` endpoint
3. **Chat Panel** displays responses with streaming support
4. **Model Selector** populates from `/api/ai/models`

## Testing

Run tests to verify the SDK:

```bash
cd backend
pytest tests/test_ai_adapter.py -v
```

## Troubleshooting

### "API Key not found" Error
- Verify `.env` file exists in `backend/` directory
- Check API key names match exactly
- Use `echo $OPENAI_API_KEY` to verify environment variable is set

### "Invalid model" Error
- Verify model name is spelled correctly
- Check model is available for the provider
- Call `/api/ai/models/{provider}` to list available models

### Connection Errors
- Check internet connection
- Verify API endpoints are accessible
- Check firewall/proxy settings

### Rate Limiting
- OpenAI: Implement exponential backoff
- Claude: Check rate limit headers
- Z.ai: Monitor quota usage

## Performance Tips

1. **Use appropriate models**:
   - Use `gpt-4o-mini` for simple tasks to save costs
   - Use `gpt-4o` for complex reasoning
   - Use Claude Haiku for speed

2. **Enable streaming** for better UX with long responses

3. **Batch requests** when possible to maximize throughput

4. **Cache responses** for frequently asked questions

## Future Enhancements

- [ ] Caching layer for repeated queries
- [ ] Rate limiting per provider
- [ ] Usage analytics and cost tracking
- [ ] Fine-tuning support
- [ ] Embeddings support
- [ ] Vision capabilities standardization
- [ ] Function calling/Tool use standardization

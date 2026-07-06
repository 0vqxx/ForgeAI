# AI SDK Quick Start Guide

Get up and running with the multi-provider AI SDK in 5 minutes.

## Step 1: Install Dependencies (1 min)

```bash
cd backend
pip install -r requirements-ai.txt
```

## Step 2: Configure API Keys (2 min)

Copy the template and add your keys:

```bash
cp .env.template .env
```

Then edit `.env` and add:
```
OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here
ZAI_API_KEY=your-key-here
```

## Step 3: Verify Installation (1 min)

```bash
python -c "from backend.ai_service import ai_service; print(ai_service.get_available_models())"
```

Expected output:
```
{'openai': ['gpt-4o', 'gpt-4-turbo', 'gpt-4-vision', 'gpt-4o-mini'], 
 'claude': ['claude-3-5-opus-20241022', ...], 
 'zai': ['glm-5-2', 'glm-5-1']}
```

## Step 4: Make Your First Request (1 min)

Create `test_ai.py`:

```python
from backend.ai_service import ai_service

# Simple chat with OpenAI
response = ai_service.chat(
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What is the capital of France?"}
    ],
    provider="openai",
    model="gpt-4o"
)

print(f"Response: {response.text}")
print(f"Model: {response.model}")
print(f"Usage: {response.usage}")
```

Run it:
```bash
python test_ai.py
```

## Common Tasks

### Switch Provider

```python
# Use Claude instead
response = ai_service.chat(
    messages=[{"role": "user", "content": "Hello!"}],
    provider="claude",
    model="claude-3-5-opus-20241022"
)
```

### Stream Responses

```python
response_stream = ai_service.chat(
    messages=[{"role": "user", "content": "Write a poem"}],
    provider="openai",
    stream=True
)

for chunk in response_stream:
    print(chunk, end="", flush=True)
```

### Use Z.ai

```python
response = ai_service.chat(
    messages=[{"role": "user", "content": "Explain quantum computing"}],
    provider="zai",
    model="glm-5-2"
)
```

### Adjust Temperature

```python
response = ai_service.chat(
    messages=[{"role": "user", "content": "Generate a creative story"}],
    provider="openai",
    temperature=0.9,  # More creative
    max_tokens=500
)
```

## API Endpoint Examples

### Start the backend server

```bash
cd backend
python server.py
```

Server runs on `http://localhost:8001`

### Chat Endpoint

```bash
curl -X POST http://localhost:8001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0.7
  }'
```

### List Models

```bash
curl http://localhost:8001/api/ai/models
```

### Get Provider Models

```bash
curl http://localhost:8001/api/ai/models/openai
```

## Integration with Frontend

The frontend calls the AI API endpoints:

```javascript
// In React component
const response = await fetch('/api/ai/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: userInput }],
    provider: 'openai',
    model: 'gpt-4o',
    stream: false
  })
});

const data = await response.json();
console.log(data.text);
```

## Troubleshooting

### "API Key not found" Error

Check your `.env` file exists in `backend/` directory:
```bash
ls -la backend/.env
cat backend/.env
```

### "ModuleNotFoundError"

Install all dependencies:
```bash
pip install -r requirements-ai.txt
```

### "Connection refused"

Make sure backend server is running:
```bash
cd backend
python server.py
```

### Rate Limit Errors

- **OpenAI**: Wait a moment before retrying
- **Claude**: Check your rate limits at console.anthropic.com
- **Z.ai**: Monitor quota at open.bigmodel.cn

## Next Steps

1. Read [AI_SDK_SETUP.md](./AI_SDK_SETUP.md) for detailed documentation
2. Check [backend/tests/test_ai_adapter.py](./tests/test_ai_adapter.py) for examples
3. Explore model-specific features in each provider's documentation

## Pro Tips

- 💰 Use `gpt-4o-mini` for cost efficiency
- ⚡ Use Claude Haiku for speed
- 🎨 Use higher temperature (0.8-1.0) for creative tasks
- 🤖 Use lower temperature (0.0-0.3) for accurate, deterministic tasks
- 📊 Enable streaming for real-time feedback to users
- 🔄 Implement retry logic for production

## Support

- OpenAI Docs: https://platform.openai.com/docs
- Claude Docs: https://docs.anthropic.com
- Z.ai Docs: https://open.bigmodel.cn/dev/howuse/introduction

---

**Ready to use AI in your app!** 🚀

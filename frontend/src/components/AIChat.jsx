/**
 * AIChat Component
 * React component for AI chat interface with multi-provider support
 * Supports OpenAI, Claude, and Z.ai
 */

import React, { useState, useEffect, useRef } from 'react';
import './AIChat.css';

const AIChat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o');
  const [models, setModels] = useState({});
  const [loading, setLoading] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch available models on component mount
  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/ai/models');
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      setModels(data.providers || {});
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const allMessages = [...messages, userMessage].map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages,
          provider: provider,
          model: model,
          temperature: temperature,
          max_tokens: maxTokens,
          stream: streaming,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      if (streaming && response.body) {
        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = '';

        // Add empty assistant message to update
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '', streaming: true },
        ]);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            assistantContent += chunk;

            // Update the last message with streaming content
            setMessages((prev) => {
              const updated = [...prev];
              if (updated[updated.length - 1].role === 'assistant') {
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: assistantContent,
                  streaming: true,
                };
              }
              return updated;
            });
          }
        } finally {
          reader.releaseLock();
          // Mark streaming as complete
          setMessages((prev) => {
            const updated = [...prev];
            if (updated[updated.length - 1].role === 'assistant') {
              updated[updated.length - 1].streaming = false;
            }
            return updated;
          });
        }
      } else {
        // Handle non-streaming response
        const data = await response.json();
        const assistantMessage = { role: 'assistant', content: data.text };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${error.message}`,
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (newProvider) => {
    setProvider(newProvider);
    // Set default model for provider
    const defaultModels = {
      openai: 'gpt-4o',
      claude: 'claude-3-5-opus-20241022',
      zai: 'glm-5-2',
    };
    setModel(defaultModels[newProvider] || '');
  };

  const clearChat = () => {
    setMessages([]);
  };

  const getProviderLabel = (prov) => {
    const labels = {
      openai: 'OpenAI',
      claude: 'Claude',
      zai: 'Z.ai (Zhipu)',
    };
    return labels[prov] || prov;
  };

  return (
    <div className="ai-chat-container">
      {/* Header */}
      <div className="chat-header">
        <h2>🤖 AI Assistant</h2>
        <div className="header-controls">
          <div className="control-group">
            <label htmlFor="provider">Provider:</label>
            <select
              id="provider"
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="control-select"
            >
              <option value="openai">OpenAI</option>
              <option value="claude">Claude</option>
              <option value="zai">Z.ai</option>
            </select>
          </div>

          <div className="control-group">
            <label htmlFor="model">Model:</label>
            <select
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="control-select"
            >
              {models[provider]?.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <button onClick={clearChat} className="btn-clear" title="Clear chat">
            🗑️
          </button>
        </div>
      </div>

      {/* Settings */}
      <div className="chat-settings">
        <div className="setting-item">
          <label htmlFor="temperature">
            Temperature: <span>{temperature.toFixed(1)}</span>
          </label>
          <input
            id="temperature"
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="slider"
          />
        </div>

        <div className="setting-item">
          <label htmlFor="maxTokens">
            Max Tokens: <span>{maxTokens}</span>
          </label>
          <input
            id="maxTokens"
            type="range"
            min="100"
            max="4000"
            step="100"
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value))}
            className="slider"
          />
        </div>

        <div className="setting-item">
          <label htmlFor="streaming">
            <input
              id="streaming"
              type="checkbox"
              checked={streaming}
              onChange={(e) => setStreaming(e.target.checked)}
            />
            Stream Response
          </label>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="welcome-message">
            <p>Welcome to BloomIDE AI Assistant</p>
            <p>Start chatting with {getProviderLabel(provider)} using {model}</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`message message-${msg.role} ${msg.isError ? 'message-error' : ''}`}
          >
            <div className="message-role">
              {msg.role === 'user' ? '👤' : '🤖'}
              <strong>{msg.role}</strong>
            </div>
            <div className="message-content">
              {msg.content}
              {msg.streaming && <span className="streaming-indicator">▌</span>}
            </div>
          </div>
        ))}

        {loading && !streaming && (
          <div className="message message-assistant loading">
            <div className="message-role">🤖 <strong>assistant</strong></div>
            <div className="message-content">
              <span className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <div className="chat-input">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type your message (Shift+Enter for newline)..."
            disabled={loading}
            className="input-field"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="btn-send"
            title="Send message"
          >
            {loading ? '⏳' : '📤'}
          </button>
        </div>
        <div className="input-hint">
          Press Enter to send, Shift+Enter for newline
        </div>
      </div>
    </div>
  );
};

export default AIChat;

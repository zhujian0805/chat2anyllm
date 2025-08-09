import React, { useState, useEffect, useRef } from 'react';
import { Message, ModelInfo } from '../types';
import { ChatMessage } from './ChatMessage';
import { ModelSelector } from './ModelSelector';
import { createChatAPI } from '../utils/chatAPI';
import { useTheme } from '../contexts/ThemeContext';
import './Chat.css';

export const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(
    process.env.REACT_APP_LITELLM_MODEL || 'gpt-3.5-turbo'
  );
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();

  const chatAPI = createChatAPI();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load models on component mount
  useEffect(() => {
    const loadModels = async () => {
      setModelsLoading(true);
      setModelsError(null);
      
      try {
        const modelList = await chatAPI.getModels();
        setModels(modelList);
        
        // Set default model if not already selected or if current selection is not in the list
        if (modelList.length > 0) {
          const currentModelExists = modelList.some(m => m.id === selectedModel);
          if (!currentModelExists) {
            const defaultModel = process.env.REACT_APP_LITELLM_MODEL || modelList[0].id;
            const modelExists = modelList.some(m => m.id === defaultModel);
            setSelectedModel(modelExists ? defaultModel : modelList[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load models:', error);
        setModelsError('Using fallback models - LiteLLM server not available');
        // Keep the current selected model as fallback
      } finally {
        setModelsLoading(false);
      }
    };

    loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // We want this to run only once on mount

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    
    // Use selected model or fallback
    const modelToUse = selectedModel || process.env.REACT_APP_LITELLM_MODEL || 'gpt-3.5-turbo';

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setConnectionError(null);

    // Create a streaming assistant message
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      await chatAPI.sendMessageStream(
        [...messages, userMessage],
        modelToUse,
        // On chunk received
        (chunk: string) => {
          setMessages(prev => 
            prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: msg.content + chunk }
                : msg
            )
          );
        },
        // On completion
        () => {
          setMessages(prev => 
            prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, isStreaming: false }
                : msg
            )
          );
          setIsLoading(false);
        },
        // On error
        (error: Error) => {
          setConnectionError('Failed to connect to LiteLLM. Please check your configuration.');
          // Remove the empty streaming message
          setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
          setIsLoading(false);
          console.error('Streaming error:', error);
        }
      );
    } catch (error) {
      setConnectionError('Failed to connect to LiteLLM. Please check your configuration.');
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
      setIsLoading(false);
      console.error('Error:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setConnectionError(null);
  };

  const refreshModels = async () => {
    setModelsLoading(true);
    setModelsError(null);
    
    try {
      const modelList = await chatAPI.getModels();
      setModels(modelList);
    } catch (error) {
      setModelsError('Failed to load models');
    } finally {
      setModelsLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>Chat Assistant</h1>
        <div className="header-controls">
          <ModelSelector
            models={models}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            isLoading={modelsLoading}
            error={modelsError}
          />
          <button 
            onClick={refreshModels}
            className="refresh-models-button"
            disabled={modelsLoading}
            title="Refresh models"
          >
            🔄
          </button>
          <button 
            onClick={clearChat}
            className="clear-button"
            disabled={messages.length === 0}
          >
            Clear Chat
          </button>
          <button 
            onClick={toggleTheme}
            className="theme-toggle"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </div>

      <div className="messages-container">
        {messages.length === 0 && (
          <div className="welcome-message">
            <h2>Welcome to Chat Assistant</h2>
            <p>Start a conversation by typing a message below.</p>
            {selectedModel && (
              <p className="current-model">Using model: <strong>{selectedModel}</strong></p>
            )}
          </div>
        )}
        
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        
        {connectionError && (
          <div className="error-message">
            {connectionError}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <textarea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          className="message-input"
          rows={1}
          disabled={isLoading}
        />
        <button 
          onClick={handleSendMessage}
          className="send-button"
          disabled={!inputMessage.trim() || isLoading || (!selectedModel && models.length > 0)}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
};

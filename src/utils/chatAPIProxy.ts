import axios from 'axios';
import { ChatConfig, Message, ModelInfo } from '../types';

export class ChatAPI {
  private config: ChatConfig;

  constructor(config: ChatConfig) {
    this.config = config;
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      console.log('Fetching models from backend proxy:', `${this.config.endpoint}/api/models`);
      const response = await axios.get(`${this.config.endpoint}/api/models`, {
        headers: {
          'accept': 'application/json'
        },
        timeout: 5000 // 5 second timeout
      });

      console.log('Models response:', response.data);

      // Handle the response format
      const data = response.data;
      
      // Check if it's the LiteLLM format with a 'data' array
      if (data && data.data && Array.isArray(data.data)) {
        const models: ModelInfo[] = data.data.map((model: any) => {
          // Try to get provider from various possible fields
          let provider = 'openai'; // default fallback
          
          if (model.litellm_params?.custom_llm_provider) {
            provider = model.litellm_params.custom_llm_provider;
          } else if (model.model_info?.litellm_provider) {
            provider = model.model_info.litellm_provider;
          } else if (model.litellm_params?.litellm_provider) {
            provider = model.litellm_params.litellm_provider;
          } else if (model.litellm_provider) {
            provider = model.litellm_provider;
          }

          return {
            id: model.model_name || model.id,
            object: 'model',
            litellm_provider: provider
          };
        });
        console.log('Parsed models:', models);
        return models;
      }
      
      // If response is directly an array of models
      if (Array.isArray(data)) {
        console.log('Found models (direct array):', data);
        return data.map((model: any) => {
          // Try to get provider from various possible fields
          let provider = 'openai'; // default fallback
          
          if (model.litellm_params?.custom_llm_provider) {
            provider = model.litellm_params.custom_llm_provider;
          } else if (model.model_info?.litellm_provider) {
            provider = model.model_info.litellm_provider;
          } else if (model.litellm_params?.litellm_provider) {
            provider = model.litellm_params.litellm_provider;
          } else if (model.litellm_provider) {
            provider = model.litellm_provider;
          }

          return {
            id: model.id || model.model_name || model.name,
            object: 'model',
            litellm_provider: provider
          };
        });
      } 
      
      // If it's a single model object, wrap it in an array
      if (data && (data.id || data.model_name)) {
        // Try to get provider from various possible fields
        let provider = 'openai'; // default fallback
        
        if (data.litellm_params?.custom_llm_provider) {
          provider = data.litellm_params.custom_llm_provider;
        } else if (data.model_info?.litellm_provider) {
          provider = data.model_info.litellm_provider;
        } else if (data.litellm_params?.litellm_provider) {
          provider = data.litellm_params.litellm_provider;
        } else if (data.litellm_provider) {
          provider = data.litellm_provider;
        }

        const model = {
          id: data.id || data.model_name,
          object: 'model',
          litellm_provider: provider
        };
        console.log('Found single model, wrapping in array:', [model]);
        return [model];
      }
      
      console.warn('Unexpected model info response format:', data);
      return this.getFallbackModels();
    } catch (error) {
      console.error('Error fetching models:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response status:', error.response?.status);
        console.error('Response data:', error.response?.data);
        
        // Treat any network/HTTP failure as a signal to return fallback models instead of throwing.
        // This avoids surfacing an error banner in the UI when LiteLLM is simply unavailable.
        console.log('Model fetch failed (network/HTTP). Using fallback models.');
        return this.getFallbackModels();
      }
      // Non-axios error (very rare) – still return fallback models.
      console.log('Unknown error type while fetching models. Using fallback models.');
      return this.getFallbackModels();
    }
  }

  private getFallbackModels(): ModelInfo[] {
    return [
      { id: 'gpt-3.5-turbo', object: 'model', litellm_provider: 'openai' },
      { id: 'gpt-4', object: 'model', litellm_provider: 'openai' },
      { id: 'claude-3-haiku-20240307', object: 'model', litellm_provider: 'anthropic' },
      { id: 'claude-3-sonnet-20240229', object: 'model', litellm_provider: 'anthropic' },
      { id: 'gemini-pro', object: 'model', litellm_provider: 'vertex_ai' }
    ];
  }

  async sendMessageStream(
    messages: Message[], 
    model: string, 
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${this.config.endpoint}/api/chat/completions/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          onComplete();
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6);
            
            if (data === '[DONE]') {
              onComplete();
              return;
            }

            try {
              const parsedData = JSON.parse(data);
              const content = parsedData.choices?.[0]?.delta?.content;
              if (content) {
                onChunk(content);
              }
            } catch (parseError) {
              // Skip invalid JSON chunks
              continue;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error streaming message:', error);
      
      // If connection fails, provide a mock response for testing
      if (error instanceof Error && (error.message.includes('Failed to fetch') || error.message.includes('ECONNREFUSED'))) {
        console.log('Connection failed, providing mock response');
        this.provideMockStreamResponse(messages, onChunk, onComplete);
        return;
      }
      
      onError(error instanceof Error ? error : new Error('Unknown streaming error'));
    }
  }

  private async provideMockStreamResponse(
    messages: Message[],
    onChunk: (chunk: string) => void,
    onComplete: () => void
  ): Promise<void> {
    const lastMessage = messages[messages.length - 1];
    let mockResponse = `I'm a mock response since the backend proxy is not available. You asked: "${lastMessage.content}"`;
    
    // Add some mock code if the user asks for code
    if (lastMessage.content.toLowerCase().includes('code') || lastMessage.content.toLowerCase().includes('function') || lastMessage.content.toLowerCase().includes('python')) {
      mockResponse += `\n\nHere's a sample Python function:\n\n\`\`\`python\ndef hello_world():\n    print("Hello, World!")\n    return "Success"\n\n# Call the function\nhello_world()\n\`\`\`\n\nThis is just a mock response for testing purposes.`;
    }

    // Simulate streaming by sending chunks
    const words = mockResponse.split(' ');
    for (let i = 0; i < words.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
      onChunk(i === 0 ? words[i] : ' ' + words[i]);
    }
    
    onComplete();
  }

  // Fallback non-streaming method
  async sendMessage(messages: Message[], model: string): Promise<string> {
    try {
      const response = await axios.post(`${this.config.endpoint}/api/chat/completions`, {
        model: model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })
      )}, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Error sending message:', error);
      throw new Error('Failed to send message to backend proxy');
    }
  }
}

// Import environment variable utilities
import { getBackendEndpoint, getLiteLLMModel, getApiKey } from './env';

export const createChatAPI = (): ChatAPI => {
  const config: ChatConfig = {
    // Changed from REACT_APP_LITELLM_ENDPOINT to point to our backend proxy
    endpoint: getBackendEndpoint(),
    model: getLiteLLMModel(),
    apiKey: getApiKey()
  };

  return new ChatAPI(config);
};
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ModelInfo {
  id: string;
  object: string;
  created?: number;
  owned_by?: string;
  litellm_provider?: string;
  mode?: string;
}

export interface ChatConfig {
  endpoint: string;
  model: string;
  apiKey: string;
}

export type Theme = 'light' | 'dark';

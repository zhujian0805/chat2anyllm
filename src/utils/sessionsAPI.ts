import axios from 'axios';
import { Message, SessionSummary } from '../types';
import { getBackendEndpoint } from './env';
import { getAuthHeaders, handleAuthError } from './authAPI';

const backend = getBackendEndpoint();

export async function listSessions(): Promise<SessionSummary[]> {
  try {
    const { data } = await axios.get(`${backend}/api/sessions`, {
      headers: getAuthHeaders()
    });
    return data;
  } catch (error) {
    handleAuthError(error);
    throw error;
  }
}

export async function createSession(title?: string): Promise<SessionSummary> {
  try {
    const { data } = await axios.post(`${backend}/api/sessions`, { title }, {
      headers: getAuthHeaders()
    });
    return data;
  } catch (error) {
    handleAuthError(error);
    throw error;
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  try {
    await axios.delete(`${backend}/api/sessions/${sessionId}`, {
      headers: getAuthHeaders()
    });
  } catch (error) {
    handleAuthError(error);
    throw error;
  }
}

export async function getSessionMessages(sessionId: string): Promise<Message[]> {
  try {
    const { data } = await axios.get(`${backend}/api/sessions/${sessionId}/messages`, {
      headers: getAuthHeaders()
    });
    // Map timestamps into Date
    return data.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp || m.created_at) })) as Message[];
  } catch (error) {
    handleAuthError(error);
    throw error;
  }
}

export async function streamSessionChat(
  sessionId: string,
  model: string,
  userMessage: string,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void
) {
  try {
    const response = await fetch(`${backend}/api/sessions/${sessionId}/chat/stream`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ model, message: userMessage })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader');
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        const t = line.trim();
        if (t.startsWith('data: ')) {
          const data = t.slice(6);
          if (data === '[DONE]') {
            onComplete();
            return;
          }
          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;
            if (content) onChunk(content);
          } catch (_) {
            // ignore
          }
        }
      }
    }
    onComplete();
  } catch (e: any) {
    onError(e instanceof Error ? e : new Error('stream error'));
  }
}

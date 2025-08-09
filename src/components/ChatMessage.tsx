import React from 'react';
import { Message } from '../types';
import { parseMessageContent } from './CodeBlock';
import { useTheme } from '../contexts/ThemeContext';
import './ChatMessage.css';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const { theme } = useTheme();
  const isUser = message.role === 'user';
  const isDarkMode = theme === 'dark';

  return (
    <div className={`message ${isUser ? 'user-message' : 'assistant-message'}`}>
      <div className={`message-content ${isUser ? 'user-content' : 'assistant-content'}`}>
        <div className="message-text">
          {parseMessageContent(message.content, isDarkMode)}
          {message.isStreaming && (
            <span className="streaming-cursor">|</span>
          )}
        </div>
        <div className="message-timestamp">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Message } from '../types';
import { parseMessageContent } from './CodeBlock';
import { useTheme } from '../contexts/ThemeContext';
import './ChatMessage.css';
import { copyTextToClipboard, isModernClipboardAPIPossible } from '../utils/clipboard';

interface ChatMessageProps {
  message: Message;
  onEdit?: (message: Message, newContent: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onEdit }) => {
  const { theme } = useTheme();
  const isUser = message.role === 'user';
  const isDarkMode = theme === 'dark';
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const modernPossible = isModernClipboardAPIPossible();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const copyToClipboard = async () => {
    // Optimistic UI update
    setCopyStatus('copied');
    const ok = await copyTextToClipboard(message.content);
    if (!ok) {
      setCopyStatus('error');
      console.error('Failed to copy message');
      setTimeout(() => setCopyStatus('idle'), 2500);
    } else {
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setEditContent(message.content);
  };

  const handleSaveEdit = () => {
    if (onEdit) {
      onEdit(message, editContent);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleEditKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // Format timestamp to be more readable
  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className={`message ${isUser ? 'user-message' : 'assistant-message'}`}>
      <div className={`message-content ${isUser ? 'user-content' : 'assistant-content'}`}>
        {isEditing ? (
          <div className="message-edit-container">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleEditKeyPress}
              className="message-edit-input"
              autoFocus
            />
            <div className="edit-actions">
              <button 
                className="save-edit-button"
                onClick={handleSaveEdit}
              >
                Save
              </button>
              <button 
                className="cancel-edit-button"
                onClick={handleCancelEdit}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="message-text">
              {parseMessageContent(message.content, isDarkMode)}
              {message.isStreaming && (
                <span className="streaming-cursor">|</span>
              )}
            </div>
            <div className="message-footer">
              <div className="message-timestamp" title={message.timestamp.toLocaleString()}>
                {formatTimestamp(message.timestamp)}
              </div>
              <div className="message-actions">
                {onEdit && isUser && (
                  <button 
                    className="edit-button"
                    onClick={handleEditClick}
                    aria-label="Edit message"
                  >
                    Edit
                  </button>
                )}
                <button
                  className={`copy-button ${copyStatus === 'copied' ? 'copied' : ''}`}
                  onClick={copyToClipboard}
                  aria-label="Copy message"
                  type="button"
                  title={modernPossible ? 'Copy to clipboard' : 'Copy uses legacy fallback (HTTPS recommended)'}
                >
                  {copyStatus === 'copied' ? '✓ Copied' : copyStatus === 'error' ? 'Copy failed' : 'Copy'}
                </button>
                <span
                  style={{ position: 'absolute', left: '-9999px' }}
                  aria-live="polite"
                >
                  {copyStatus === 'copied' ? 'Message copied to clipboard' : copyStatus === 'error' ? 'Copy failed' : ''}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

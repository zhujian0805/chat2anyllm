import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  code: string;
  language: string;
  isDarkMode: boolean;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language, isDarkMode }) => {
  return (
    <SyntaxHighlighter
      language={language}
      style={isDarkMode ? oneDark : oneLight}
      customStyle={{
        borderRadius: '8px',
        fontSize: '14px',
        margin: '16px 0',
      }}
    >
      {code}
    </SyntaxHighlighter>
  );
};

export const parseMessageContent = (content: string, isDarkMode: boolean): React.ReactNode[] => {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index);
      if (textContent.trim()) {
        parts.push(
          <span key={`text-${lastIndex}`} style={{ whiteSpace: 'pre-wrap' }}>
            {textContent}
          </span>
        );
      }
    }

    // Add code block
    const language = match[1] || 'text';
    const code = match[2];
    parts.push(
      <CodeBlock 
        key={`code-${match.index}`}
        code={code}
        language={language}
        isDarkMode={isDarkMode}
      />
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex);
    if (textContent.trim()) {
      parts.push(
        <span key={`text-${lastIndex}`} style={{ whiteSpace: 'pre-wrap' }}>
          {textContent}
        </span>
      );
    }
  }

  return parts.length > 0 ? parts : [
    <span key="content" style={{ whiteSpace: 'pre-wrap' }}>
      {content}
    </span>
  ];
};

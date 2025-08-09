import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { copyTextToClipboard, isModernClipboardAPIPossible } from '../utils/clipboard';

interface CodeBlockProps {
  code: string;
  language: string;
  isDarkMode: boolean;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language, isDarkMode }) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const modernPossible = isModernClipboardAPIPossible();

  const copyToClipboard = async () => {
    setCopyStatus('copied'); // optimistic
    const ok = await copyTextToClipboard(normalizedCode);
    if (!ok) {
      setCopyStatus('error');
      console.error('Failed to copy code');
      setTimeout(() => setCopyStatus('idle'), 2500);
    } else {
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  // Preserve indentation by removing only the shared leading indent across lines
  const dedent = (input: string): string => {
    const lines = input.replace(/\r\n?/g, '\n').split('\n');
    // drop leading and trailing empty lines
    while (lines.length && lines[0].trim() === '') lines.shift();
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    let minIndent: number | null = null;
    for (const line of lines) {
      if (line.trim() === '') continue;
      const match = line.match(/^[ \t]*/);
      const indent = match ? match[0].length : 0;
      if (minIndent === null || indent < minIndent) minIndent = indent;
    }
    if (!minIndent) return lines.join('\n');
    return lines
      .map(l => (l.trim() === '' ? '' : l.slice(minIndent!)))
      .join('\n');
  };

  const normalizedCode = dedent(code);

  return (
    <div style={{ position: 'relative', margin: '16px 0' }}>
      <SyntaxHighlighter
        language={language}
        style={isDarkMode ? oneDark : oneLight}
        customStyle={{
          borderRadius: '8px',
          fontSize: '14px',
          margin: 0,
          overflowX: 'auto',
          border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
          boxShadow: isDarkMode 
            ? '0 4px 12px rgba(0, 0, 0, 0.5)' 
            : '0 4px 12px rgba(0, 0, 0, 0.05)',
        }}
        codeTagProps={{
          style: {
            display: 'block',
            /* add bottom padding so the copy button doesn't obstruct code */
            padding: '16px 16px 40px 16px',
            margin: 0,
            whiteSpace: 'pre', // preserve indentation and spaces
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
          }
        }}
        PreTag="pre"
        lineNumberStyle={{
          opacity: 0.5,
          userSelect: 'none',
        }}
        showLineNumbers={true}
      >
        {normalizedCode}
      </SyntaxHighlighter>
      <button
        className={`code-copy-button ${copyStatus === 'copied' ? 'copied' : ''}`}
        onClick={copyToClipboard}
        aria-label="Copy code"
        type="button"
        title={modernPossible ? 'Copy to clipboard' : 'Copy uses legacy fallback (enable HTTPS for best results)'}
      >
  {copyStatus === 'copied' ? '✓ Copied' : copyStatus === 'error' ? 'Copy failed' : 'Copy'}
      </button>
      <span
        style={{ position: 'absolute', left: '-9999px' }}
        aria-live="polite"
      >
  {copyStatus === 'copied' ? 'Code copied to clipboard' : copyStatus === 'error' ? 'Copy failed' : ''}
      </span>
    </div>
  );
};

export const parseMessageContent = (content: string, isDarkMode: boolean): React.ReactNode[] => {
  // Improved regex to better capture code blocks and handle whitespace
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
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
            {renderMarkdown(textContent)}
          </span>
        );
      }
    }

    // Add code block
    const language = match[1] || 'text';
    // Fix indentation issue by normalizing the code block content
    let code = match[2];
    
    // Split into lines and process
    let lines = code.split('\n');
    
    // Remove first line if it's empty or contains only whitespace
    while (lines.length > 0 && lines[0].trim() === '') {
      lines.shift();
    }
    
    // Remove last line if it's empty or contains only whitespace
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }
    
    // Join the lines back together
    code = lines.join('\n');
    
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
          {renderMarkdown(textContent)}
        </span>
      );
    }
  }

  return parts.length > 0 ? parts : [
    <span key="content" style={{ whiteSpace: 'pre-wrap' }}>
      {renderMarkdown(content)}
    </span>
  ];
};

const renderMarkdown = (text: string): React.ReactNode => {
  // Process inline formatting first
  const processInlineFormatting = (line: string): string => {
    return line
      // Handle bold (**text** or __text__)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      // Handle italic (*text* or _text_)
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      // Handle inline code (`code`)
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // Handle links ([text](url))
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  };

  // Split text by lines to handle different Markdown elements
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  // Handle blockquotes
  const processBlockquotes = (lines: string[]): { processedLines: string[], blockquotes: { start: number, end: number }[] } => {
    const blockquotes: { start: number, end: number }[] = [];
    let inBlockquote = false;
    let blockquoteStart = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('>')) {
        lines[i] = lines[i].trim().substring(1).trim(); // Remove > and trim
        if (!inBlockquote) {
          inBlockquote = true;
          blockquoteStart = i;
        }
      } else {
        if (inBlockquote) {
          blockquotes.push({ start: blockquoteStart, end: i - 1 });
          inBlockquote = false;
        }
      }
    }
    
    // Handle case where blockquote ends at the last line
    if (inBlockquote) {
      blockquotes.push({ start: blockquoteStart, end: lines.length - 1 });
    }
    
    return { processedLines: lines, blockquotes };
  };

  const { processedLines, blockquotes } = processBlockquotes([...lines]);
  let i = 0;
  // Track ordered list numbering across separated blocks (helps when items are split by paragraphs or bullets)
  let continuedOrderedListIndex = 1;

  while (i < processedLines.length) {
    const line = processedLines[i];
    
    // Check if this line is part of a blockquote
    const inBlockquote = blockquotes.some(bq => i >= bq.start && i <= bq.end);
    
    // Handle horizontal rules
    if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
      elements.push(<hr key={key++} />);
      i++;
      continue;
    }
    
    // Handle headers
    if (line.match(/^#{1,6}\s/)) {
      const level = line.match(/^#+/)?.[0].length || 1;
      const content = line.replace(/^#+\s/, '');
      elements.push(
        React.createElement(`h${level}`, { key: key++ }, 
          <span dangerouslySetInnerHTML={{ __html: processInlineFormatting(content) }} />
        )
      );
      continuedOrderedListIndex = 1;
    }
    // Handle unordered lists
    else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const listItems = [];
      let j = i;
      while (j < processedLines.length && (processedLines[j].trim().startsWith('- ') || processedLines[j].trim().startsWith('* '))) {
        const itemContent = processedLines[j].trim().substring(2);
        listItems.push(
          <li key={j} dangerouslySetInnerHTML={{ __html: processInlineFormatting(itemContent) }} />
        );
        j++;
      }
  const listElement = <ul key={key++}>{listItems}</ul>;
      if (inBlockquote) {
        elements.push(<blockquote key={`blockquote-${key}`}><div>{listElement}</div></blockquote>);
      } else {
        elements.push(listElement);
      }
      i = j - 1; // Skip processed lines
  // Do NOT reset continuedOrderedListIndex here; allows OL numbering to continue after a nested bullet list
    }
    // Handle ordered lists
    else if (line.match(/^\d+\.\s/)) {
      const listItems = [] as React.ReactNode[];
      let j = i;
      while (j < processedLines.length && processedLines[j].match(/^\d+\.\s/)) {
        const itemContent = processedLines[j].replace(/^\d+\.\s/, '');
        listItems.push(
          <li key={j} dangerouslySetInnerHTML={{ __html: processInlineFormatting(itemContent) }} />
        );
        j++;
      }
      // Continue numbering across separated ordered-list blocks by using the `start` attribute
      const listStart = continuedOrderedListIndex;
      continuedOrderedListIndex += listItems.length;
      const listElement = <ol key={key++} start={listStart}>{listItems}</ol>;
  if (inBlockquote) {
        elements.push(<blockquote key={`blockquote-${key}`}><div>{listElement}</div></blockquote>);
      } else {
        elements.push(listElement);
      }
      i = j - 1; // Skip processed lines
    }
    // Handle blockquotes
    else if (inBlockquote) {
      // Check if this is the start of a blockquote
      const bq = blockquotes.find(b => b.start === i);
      if (bq) {
        const blockquoteLines = [];
        for (let k = bq.start; k <= bq.end; k++) {
          if (processedLines[k].trim() !== '') {
            blockquoteLines.push(
              <p key={k} dangerouslySetInnerHTML={{ __html: processInlineFormatting(processedLines[k]) }} />
            );
          }
        }
        elements.push(<blockquote key={key++}>{blockquoteLines}</blockquote>);
        i = bq.end; // Skip to end of blockquote
        continuedOrderedListIndex = 1;
      }
    }
    // Handle line breaks (empty lines)
    else if (line === '') {
      elements.push(<br key={key++} />);
    }
    // Handle regular paragraphs
    else {
      elements.push(
        <p key={key++} dangerouslySetInnerHTML={{ __html: processInlineFormatting(line) }} />
      );
      continuedOrderedListIndex = 1;
    }
    
    i++;
  }

  return elements;
};

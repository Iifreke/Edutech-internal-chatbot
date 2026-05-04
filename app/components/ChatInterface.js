'use client';

import { useChat } from '@ai-sdk/react';
import { useRef, useEffect, useState } from 'react';
import MessageBubble from './MessageBubble';

const SUGGESTIONS = [
  'What is Edutech Global?',
  'Tell me about Purple Squirrel',
  'What is Study Buddy?',
  'What is The Hub?',
  'What AI initiatives does Edutech have?',
];

export default function ChatInterface() {
  const [inputValue, setInputValue] = useState('');
  const [chatError, setChatError] = useState('');
  const { messages, isLoading, append } = useChat({
    api: '/api/chat',
    onError: (err) => setChatError(err.message || 'Something went wrong. Please try again.'),
  });

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const onSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    append({ role: 'user', content: inputValue.trim() });
    setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  const handleSuggestion = (text) => {
    append({ role: 'user', content: text });
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">🎓</div>
            <h2>Welcome to Edutech Global</h2>
            <p>
              I&apos;m your AI knowledge assistant. Ask me anything about the organization,
              our products, policies, or processes — I&apos;ll find the answer from our
              official documents.
            </p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="suggestion-chip" onClick={() => handleSuggestion(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}
        {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
          <div className="message-row assistant">
            <div className="message-avatar assistant-avatar">E</div>
            <div className="message-content assistant-msg">
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {chatError && (
        <div className="chat-error">
          <span>⚠️ {chatError}</span>
          <button onClick={() => setChatError('')}>✕</button>
        </div>
      )}

      <div className="chat-input-area">
        <form className="chat-input-wrapper" onSubmit={onSubmit}>
          <textarea
            className="chat-input"
            placeholder="Ask anything about Edutech Global..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={!inputValue.trim() || isLoading}
            title="Send message"
          >
            ➤
          </button>
        </form>
        <div className="chat-disclaimer">
          Responses are generated from uploaded company documents. Always verify critical information.
        </div>
      </div>
    </div>
  );
}

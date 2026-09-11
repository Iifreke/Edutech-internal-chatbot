'use client';

import { useChat } from '@ai-sdk/react';
import { useRef, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import MessageBubble from './MessageBubble';

const SUGGESTIONS = [
  'What is Edutech Global?',
  'Tell me about Purple Squirrel',
  'What is Study Buddy?',
  'What is The Hub?',
  'What AI initiatives does Edutech have?',
];

export default function ChatInterface() {
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState(() => `conv_${Date.now()}`);
  const [conversations, setConversations] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingConv, setLoadingConv] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const fetchConversations = useCallback(async () => {
    if (!user?.email) return;
    try {
      const res = await fetch(`/api/conversations?email=${encodeURIComponent(user.email)}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Failed to load conversation history:', err);
    }
  }, [user?.email]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const { messages, status, error, sendMessage, setMessages, clearError } = useChat({
    api: '/api/chat',
    id: conversationId,
    body: {
      conversationId,
      sessionId: conversationId,
      user: {
        email: user?.email,
        name: user?.user_metadata?.name || user?.email?.split('@')[0],
        department: user?.user_metadata?.department,
      },
    },
    onFinish: () => {
      fetchConversations();
    },
  });

  const isLoading = status === 'submitted' || status === 'streaming';
  const messagesEndRef = useRef(null);
  const pendingMessagesRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (pendingMessagesRef.current !== null) {
      setMessages(pendingMessagesRef.current);
      pendingMessagesRef.current = null;
    }
  }, [conversationId, setMessages]);

  const onSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    sendMessage({ text: inputValue.trim() });
    setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  const handleSuggestion = (text) => {
    sendMessage({ text });
  };

  const handleNewChat = () => {
    const newId = `conv_${Date.now()}`;
    setConversationId(newId);
    setMessages([]);
  };

  const handleSelectConversation = async (conv) => {
    if (conv.id === conversationId) return;
    setLoadingConv(true);
    try {
      const res = await fetch(`/api/conversations/${conv.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.conversation?.messages) {
          const formattedMsgs = data.conversation.messages.map((m, idx) => ({
            id: m.id || `msg_${idx}`,
            role: m.role,
            content: m.content || '',
            parts: [{ type: 'text', text: m.content || '' }],
          }));
          pendingMessagesRef.current = formattedMsgs;
          setConversationId(conv.id);
        }
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    } finally {
      setLoadingConv(false);
    }
  };

  const handleDeleteConversation = async (e, id) => {
    e.stopPropagation();
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) {
        handleNewChat();
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="chat-layout">
      {/* ── Left History Sidebar ── */}
      <aside className={`chat-sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className="chat-sidebar-header">
          <button className="new-chat-btn" onClick={handleNewChat} title="Start new search topic">
            <span>✨</span>
            <span>+ New Search</span>
          </button>
        </div>

        <div className="chat-sidebar-list">
          <div className="chat-sidebar-title">Past Searches & Sessions</div>
          {conversations.length === 0 ? (
            <div style={{ fontSize: 12, color: '#666', padding: '12px 8px' }}>
              No previous searches yet.
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`history-item ${conv.id === conversationId ? 'active' : ''}`}
                onClick={() => handleSelectConversation(conv)}
                title={conv.title}
              >
                <span style={{ fontSize: 14 }}>💬</span>
                <span className="history-item-title">{conv.title}</span>
                <span style={{ fontSize: 10, color: '#666' }}>{formatDate(conv.updatedAt)}</span>
                <button
                  className="history-delete-btn"
                  onClick={(e) => handleDeleteConversation(e, conv.id)}
                  title="Delete session"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── Main Chat Area ── */}
      <div className="chat-container">
        {/* Top Control Bar */}
        <div className="chat-top-bar">
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen((o) => !o)}
            title="Toggle search history sidebar"
          >
            <span>📜</span>
            <span>{sidebarOpen ? 'Hide History' : `History (${conversations.length})`}</span>
          </button>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            🔒 Strict Internal KB • Internet Search Disabled
          </div>
        </div>

        <div className="chat-messages">
          {loadingConv ? (
            <div className="chat-empty">
              <div className="chat-empty-icon">⏳</div>
              <h2>Loading session...</h2>
              <p>Restoring conversation context and previous queries.</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-empty">
              <div className="chat-empty-icon">🎓</div>
              <h2>Welcome to EduAssist</h2>
              <p>
                I&apos;m your internal AI knowledge assistant. Ask me anything about Edutech Global,
                our products, policies, or processes — I&apos;ll find the answer exclusively from our
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

        {error && (
          <div className="chat-error">
            <span>⚠️ {error.message || 'Something went wrong. Please try again.'}</span>
            <button onClick={() => clearError()}>✕</button>
          </div>
        )}

        <div className="chat-input-area">
          <form className="chat-input-wrapper" onSubmit={onSubmit}>
            <textarea
              className="chat-input"
              placeholder="Ask EduAssist anything about Edutech Global..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isLoading || loadingConv}
            />
            <button
              type="submit"
              className="chat-send-btn"
              disabled={!inputValue.trim() || isLoading || loadingConv}
              title="Send message"
            >
              ➤
            </button>
          </form>
          <div className="chat-disclaimer">
            Responses are generated strictly from uploaded company documents. Internet search is disabled.
          </div>
        </div>
      </div>
    </div>
  );
}


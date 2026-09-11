'use client';

import { useState } from 'react';
import Link from 'next/link';

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function PasswordGate({ onAuthenticated }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });

      if (res.ok) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('admin_password', password.trim());
        }
        onAuthenticated(password.trim());
      } else {
        setError('Unauthorized: Incorrect admin password. Please try again or return to chat.');
      }
    } catch {
      setError('Connection error. Please verify your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-card" style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(211, 30, 30, 0.25) 0%, rgba(211, 30, 30, 0.05) 70%)',
          border: '1px solid rgba(211, 30, 30, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          margin: '0 auto 16px',
          boxShadow: '0 0 24px rgba(211, 30, 30, 0.2)'
        }}>
          🛡️
        </div>

        <div style={{ marginBottom: 12 }}>
          <span style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            color: 'var(--primary)',
            background: 'rgba(211, 30, 30, 0.12)',
            border: '1px solid rgba(211, 30, 30, 0.3)',
            padding: '4px 12px',
            borderRadius: 16
          }}>
            Restricted Admin Area
          </span>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          Admin Authorization
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 24 }}>
          Access to knowledge base ingestion, document indexing, and contact search analytics requires an administrator password.
        </p>

        <form onSubmit={handleSubmit} className="auth-form" style={{ textAlign: 'left' }}>
          <div className="auth-field">
            <label className="auth-label">Administrator Password</label>
            <div className="auth-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder="Enter admin password..."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                autoFocus
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
            disabled={!password.trim() || loading}
          >
            {loading ? 'Verifying Authorization...' : 'Unlock Admin Dashboard 🔓'}
          </button>
        </form>

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--glass-border)' }}>
          <Link href="/" className="auth-link" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span>←</span>
            <span>Return to EduAssist Chat</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

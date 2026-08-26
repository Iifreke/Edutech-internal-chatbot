'use client';

import { useState, useEffect } from 'react';
import { getSupabaseClient } from '../../lib/supabase-client';

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase puts the session in the URL hash after redirect
    getSupabaseClient().auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
  }, []);

  const handleReset = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const { error } = await getSupabaseClient().auth.updateUser({ password });
      if (error) throw error;
      setSuccess('Password updated! You can now sign in with your new password.');
      setTimeout(() => { window.location.href = '/'; }, 2500);
    } catch (err) {
      setError(err.message || 'Could not update password.');
    }
    setLoading(false);
  };

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/edutech-logo-white.png" alt="EduTech Global" className="auth-logo" />
          <p className="auth-tagline">Internal Knowledge Assistant</p>
        </div>

        {!ready ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: 13 }}>
            Verifying reset link…
          </p>
        ) : (
          <form className="auth-form" onSubmit={handleReset}>
            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Set a new password for your account.</p>
            </div>
            <div className="auth-field">
              <label className="auth-label">New Password</label>
              <div className="auth-input-wrap">
                <input type={showPassword ? 'text' : 'password'} className="auth-input"
                  placeholder="Min. 8 characters" value={password}
                  onChange={(e) => setPassword(e.target.value)} autoFocus />
                <button type="button" className="auth-eye" onClick={() => setShowPassword(v => !v)}>
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>
            <div className="auth-field">
              <label className="auth-label">Confirm Password</label>
              <div className="auth-input-wrap">
                <input type={showConfirm ? 'text' : 'password'} className="auth-input"
                  placeholder="••••••••" value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} />
                <button type="button" className="auth-eye" onClick={() => setShowConfirm(v => !v)}>
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
            </div>
            {error && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading || !password || !confirm}>
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';

export default function PasswordGate({ onAuthenticated }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        sessionStorage.setItem('admin_password', password);
        onAuthenticated(password);
      } else {
        setError('Invalid password. Please try again.');
      }
    } catch {
      setError('Connection error. Please try again.');
    }

    setLoading(false);
  };

  return (
    <div className="gate-overlay">
      <form className="gate-card" onSubmit={handleSubmit}>
        <div className="gate-icon">🔐</div>
        <h2>Admin Access</h2>
        <p>Enter the admin password to manage the knowledge base</p>
        {error && <div className="gate-error">{error}</div>}
        <input
          type="password"
          className="gate-input"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <button type="submit" className="btn btn-primary" disabled={!password || loading}>
          {loading ? 'Verifying...' : 'Access Dashboard'}
        </button>
      </form>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isAllowedEmail, ALLOWED_DOMAINS } from '../../lib/supabase-client';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [tab, setTab] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setError('');
    setSuccess('');
  };

  const switchTab = (t) => {
    setTab(t);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    reset();
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    reset();
    if (!email || !password) return setError('Please fill in all fields.');
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    }
    setLoading(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    reset();
    if (!email || !password || !confirmPassword) return setError('Please fill in all fields.');
    if (!isAllowedEmail(email)) {
      return setError(`Sign-up is restricted to ${ALLOWED_DOMAINS.map(d => '@' + d).join(' and ')} addresses.`);
    }
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    setLoading(true);
    try {
      await signUp(email, password);
      setSuccess('Account created! Check your email to confirm your address, then sign in.');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Could not create account. Please try again.');
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

        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'signin' ? 'active' : ''}`}
            onClick={() => switchTab('signin')}
            type="button"
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => switchTab('signup')}
            type="button"
          >
            Sign Up
          </button>
        </div>

        {tab === 'signin' ? (
          <form className="auth-form" onSubmit={handleSignIn}>
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input
                type="email"
                className="auth-input"
                placeholder="you@edutechbusiness.net"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                autoComplete="email"
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input
                type="password"
                className="auth-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}

            <button type="submit" className="btn btn-primary" disabled={loading || !email || !password}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>

            <p className="auth-footer">
              No account?{' '}
              <button type="button" className="auth-link" onClick={() => switchTab('signup')}>
                Sign up
              </button>
            </p>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleSignUp}>
            <div className="auth-field">
              <label className="auth-label">Work Email</label>
              <input
                type="email"
                className="auth-input"
                placeholder="you@edutechbusiness.net"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                autoComplete="email"
              />
              <span className="auth-hint">Must be an @edutechbusiness.net or @vigilearn.com address</span>
            </div>
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input
                type="password"
                className="auth-input"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Confirm Password</label>
              <input
                type="password"
                className="auth-input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {error && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}

            <button type="submit" className="btn btn-primary" disabled={loading || !email || !password || !confirmPassword}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>

            <p className="auth-footer">
              Already have an account?{' '}
              <button type="button" className="auth-link" onClick={() => switchTab('signin')}>
                Sign in
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

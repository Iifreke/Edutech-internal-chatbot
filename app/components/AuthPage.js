'use client';

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isAllowedEmail, ALLOWED_DOMAINS } from '../../lib/supabase-client';

const DEPARTMENTS = [
  'Technology',
  'Product',
  'Sales & Marketing',
  'Operations',
  'Finance',
  'Human Resources',
  'Academic / Curriculum',
  'Customer Success',
  'Leadership',
  'Other',
];

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

export default function AuthPage() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [tab, setTab] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [department, setDepartment] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  const reset = () => { setError(''); setSuccess(''); };

  const switchTab = (t) => {
    setTab(t);
    setEmail(''); setPassword(''); setConfirmPassword('');
    setDepartment(''); setForgotMode(false);
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
    if (!email || !password || !confirmPassword || !department)
      return setError('Please fill in all fields including department.');
    if (!isAllowedEmail(email))
      return setError(`Sign-up is restricted to ${ALLOWED_DOMAINS.map(d => '@' + d).join(' and ')} addresses.`);
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    setLoading(true);
    try {
      await signUp(email, password, { department });
      setSuccess('Account created! You can now sign in.');
      setEmail(''); setPassword(''); setConfirmPassword(''); setDepartment('');
    } catch (err) {
      setError(err.message || 'Could not create account. Please try again.');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    reset();
    if (!email) return setError('Enter your email address.');
    setLoading(true);
    try {
      await resetPassword(email);
      setSuccess('Password reset link sent — check your inbox.');
    } catch (err) {
      setError(err.message || 'Could not send reset email.');
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

        {!forgotMode && (
          <div className="auth-tabs">
            <button className={`auth-tab ${tab === 'signin' ? 'active' : ''}`} onClick={() => switchTab('signin')} type="button">Sign In</button>
            <button className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => switchTab('signup')} type="button">Sign Up</button>
          </div>
        )}

        {/* ── Forgot Password ── */}
        {forgotMode && (
          <form className="auth-form" onSubmit={handleForgotPassword}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                Enter your work email and we'll send a reset link.
              </p>
            </div>
            <div className="auth-field">
              <label className="auth-label">Work Email</label>
              <input type="email" className="auth-input" placeholder="you@edutechbusiness.net"
                value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="email" />
            </div>
            {error && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading || !email}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
            <p className="auth-footer">
              <button type="button" className="auth-link" onClick={() => { setForgotMode(false); reset(); }}>
                ← Back to Sign In
              </button>
            </p>
          </form>
        )}

        {/* ── Sign In ── */}
        {!forgotMode && tab === 'signin' && (
          <form className="auth-form" onSubmit={handleSignIn}>
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input type="email" className="auth-input" placeholder="you@edutechbusiness.net"
                value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="email" />
            </div>
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <div className="auth-input-wrap">
                <input type={showPassword ? 'text' : 'password'} className="auth-input" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                <button type="button" className="auth-eye" onClick={() => setShowPassword(v => !v)}>
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>
            {error && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading || !email || !password}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
            <p className="auth-footer">
              <button type="button" className="auth-link" onClick={() => { setForgotMode(true); reset(); setEmail(''); }}>
                Forgot password?
              </button>
            </p>
            <p className="auth-footer">
              No account?{' '}
              <button type="button" className="auth-link" onClick={() => switchTab('signup')}>Sign up</button>
            </p>
          </form>
        )}

        {/* ── Sign Up ── */}
        {!forgotMode && tab === 'signup' && (
          <form className="auth-form" onSubmit={handleSignUp}>
            <div className="auth-field">
              <label className="auth-label">Work Email</label>
              <input type="email" className="auth-input" placeholder="you@edutechbusiness.net"
                value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="email" />
              <span className="auth-hint">Must be an @edutechbusiness.net or @vigilearn.com address</span>
            </div>
            <div className="auth-field">
              <label className="auth-label">Department</label>
              <select className="auth-input auth-select" value={department} onChange={(e) => setDepartment(e.target.value)}>
                <option value="">Select your department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <div className="auth-input-wrap">
                <input type={showPassword ? 'text' : 'password'} className="auth-input" placeholder="Min. 8 characters"
                  value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                <button type="button" className="auth-eye" onClick={() => setShowPassword(v => !v)}>
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>
            <div className="auth-field">
              <label className="auth-label">Confirm Password</label>
              <div className="auth-input-wrap">
                <input type={showConfirm ? 'text' : 'password'} className="auth-input" placeholder="••••••••"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
                <button type="button" className="auth-eye" onClick={() => setShowConfirm(v => !v)}>
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
            </div>
            {error && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading || !email || !password || !confirmPassword || !department}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
            <p className="auth-footer">
              Already have an account?{' '}
              <button type="button" className="auth-link" onClick={() => switchTab('signin')}>Sign in</button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

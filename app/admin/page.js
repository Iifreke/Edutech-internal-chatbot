'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import AuthPage from '../components/AuthPage';
import PasswordGate from '../components/PasswordGate';
import FileUploader from '../components/FileUploader';
import DocumentList from '../components/DocumentList';
import WebSourceManager from '../components/WebSourceManager';
import LeadSearchManager from '../components/LeadSearchManager';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [adminPassword, setAdminPassword] = useState('');
  const [checkingPassword, setCheckingPassword] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Check existing session on mount
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem('admin_password') : null;
    if (saved) {
      fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: saved }),
      })
        .then((res) => {
          if (res.ok) {
            setAdminPassword(saved);
          } else {
            sessionStorage.removeItem('admin_password');
          }
        })
        .catch(() => {
          sessionStorage.removeItem('admin_password');
        })
        .finally(() => {
          setCheckingPassword(false);
        });
    } else {
      setCheckingPassword(false);
    }
  }, []);

  const handleLockAdmin = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('admin_password');
    }
    setAdminPassword('');
  }, []);

  if (loading || checkingPassword) {
    return (
      <div className="auth-overlay">
        <div className="gate-icon" style={{ fontSize: 32 }}>⏳</div>
      </div>
    );
  }

  // Ensure user has basic account access
  if (!user) return <AuthPage />;

  // Enforce Admin Password Gate for restricted administrator access
  if (!adminPassword) {
    return (
      <div className="app-shell">
        <Header />
        <PasswordGate onAuthenticated={(pass) => setAdminPassword(pass)} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header />
      <div className="admin-container">
        <div className="admin-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 8 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h1 className="admin-title" style={{ margin: 0 }}>Knowledge Base Manager</h1>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#4ade80',
                  background: 'rgba(74, 222, 128, 0.12)',
                  border: '1px solid rgba(74, 222, 128, 0.25)',
                  padding: '3px 8px',
                  borderRadius: 12
                }}>
                  ● Authorized
                </span>
              </div>
              <p className="admin-desc" style={{ margin: 0 }}>
                Upload, update, and manage documents and contact searches that power EduAssist.
              </p>
            </div>

            <button
              onClick={handleLockAdmin}
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', fontSize: 12 }}
              title="Lock admin session and require password on next visit"
            >
              <span>🔒</span>
              <span>Lock Admin</span>
            </button>
          </div>

          <div className="admin-section">
            <h2 className="admin-section-title">📤 Upload Document</h2>
            <FileUploader
              password={adminPassword}
              onUploadComplete={() => setRefreshKey((k) => k + 1)}
            />
          </div>

          <div className="admin-section">
            <h2 className="admin-section-title">🌐 Web Sources</h2>
            <p className="admin-desc" style={{ marginBottom: 12 }}>
              Add websites to the knowledge base. The chatbot will search their content when answering questions.
            </p>
            <WebSourceManager
              password={adminPassword}
              refreshTrigger={refreshKey}
              onRefresh={() => setRefreshKey((k) => k + 1)}
            />
          </div>

          <div className="admin-section">
            <h2 className="admin-section-title">📚 Uploaded Documents</h2>
            <DocumentList
              password={adminPassword}
              refreshTrigger={refreshKey}
            />
          </div>

          <div className="admin-section">
            <h2 className="admin-section-title">👥 Contact Searches & Leads</h2>
            <p className="admin-desc" style={{ marginBottom: 12 }}>
              Inspect all contacts who searched or chatted with EduAssist, view their query history, and review transcripts.
            </p>
            <LeadSearchManager
              password={adminPassword}
              refreshTrigger={refreshKey}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

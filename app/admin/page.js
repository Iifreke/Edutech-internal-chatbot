'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';
import PasswordGate from '../components/PasswordGate';
import FileUploader from '../components/FileUploader';
import DocumentList from '../components/DocumentList';

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_password');
    if (saved) {
      setPassword(saved);
      setAuthenticated(true);
    }
  }, []);

  const handleAuthenticated = (pwd) => {
    setPassword(pwd);
    setAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_password');
    setAuthenticated(false);
    setPassword('');
  };

  if (!authenticated) {
    return <PasswordGate onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="app-shell">
      <Header />
      <div className="admin-container">
        <div className="admin-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 className="admin-title">Knowledge Base Manager</h1>
              <p className="admin-desc">
                Upload, update, and manage documents that power the AI assistant.
              </p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
              🚪 Logout
            </button>
          </div>

          <div className="admin-section">
            <h2 className="admin-section-title">📤 Upload Document</h2>
            <FileUploader
              password={password}
              onUploadComplete={() => setRefreshKey((k) => k + 1)}
            />
          </div>

          <div className="admin-section">
            <h2 className="admin-section-title">📚 Documents ({refreshKey >= 0 ? '' : ''})</h2>
            <DocumentList password={password} refreshTrigger={refreshKey} />
          </div>
        </div>
      </div>
    </div>
  );
}

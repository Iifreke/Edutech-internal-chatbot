'use client';

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import AuthPage from '../components/AuthPage';
import FileUploader from '../components/FileUploader';
import DocumentList from '../components/DocumentList';
import WebSourceManager from '../components/WebSourceManager';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  if (loading) return <div className="auth-overlay"><div className="gate-icon" style={{ fontSize: 32 }}>⏳</div></div>;
  if (!user) return <AuthPage />;

  const password = process.env.NEXT_PUBLIC_ADMIN_PASS || '';

  return (
    <div className="app-shell">
      <Header />
      <div className="admin-container">
        <div className="admin-content">
          <div>
            <h1 className="admin-title">Knowledge Base Manager</h1>
            <p className="admin-desc">
              Upload, update, and manage documents that power the AI assistant.
            </p>
          </div>

          <div className="admin-section">
            <h2 className="admin-section-title">📤 Upload Document</h2>
            <FileUploader
              password={password}
              onUploadComplete={() => setRefreshKey((k) => k + 1)}
            />
          </div>

          <div className="admin-section">
            <h2 className="admin-section-title">🌐 Web Sources</h2>
            <p className="admin-desc" style={{ marginBottom: 12 }}>
              Add websites to the knowledge base. The chatbot will search their content when answering questions.
            </p>
            <WebSourceManager
              password={password}
              refreshTrigger={refreshKey}
              onRefresh={() => setRefreshKey((k) => k + 1)}
            />
          </div>

          <div className="admin-section">
            <h2 className="admin-section-title">📚 Uploaded Documents</h2>
            <DocumentList password={password} refreshTrigger={refreshKey} />
          </div>
        </div>
      </div>
    </div>
  );
}

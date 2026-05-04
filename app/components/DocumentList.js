'use client';

import { useState, useEffect, useCallback } from 'react';

export default function DocumentList({ password, refreshTrigger }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [reprocessTarget, setReprocessTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments, refreshTrigger]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents?id=${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': password },
      });
      if (res.ok) {
        showToast(`"${deleteTarget.filename}" deleted successfully`);
        fetchDocuments();
      } else {
        const err = await res.json();
        showToast(err.error || 'Delete failed', 'error');
      }
    } catch {
      showToast('Failed to delete document', 'error');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleReprocess = async (file) => {
    if (!file || !reprocessTarget) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentId', reprocessTarget.id);

      const res = await fetch('/api/reprocess', {
        method: 'POST',
        headers: { 'x-admin-password': password },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        showToast(`"${data.document.filename}" updated — ${data.document.chunkCount} chunks`);
        fetchDocuments();
      } else {
        const err = await res.json();
        showToast(err.error || 'Update failed', 'error');
      }
    } catch {
      showToast('Failed to update document', 'error');
    } finally {
      setReprocessTarget(null);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const getDocIcon = (type) => {
    switch (type) {
      case 'pdf': return '📕';
      case 'docx': return '📘';
      case 'xlsx': return '📗';
      default: return '📄';
    }
  };

  if (loading) {
    return <div className="doc-empty">Loading documents...</div>;
  }

  return (
    <>
      {documents.length === 0 ? (
        <div className="doc-empty">
          No documents uploaded yet. Upload your first document above.
        </div>
      ) : (
        <div className="doc-list">
          {documents.map((doc) => (
            <div key={doc.id} className="doc-card">
              <div className={`doc-icon ${doc.file_type}`}>{getDocIcon(doc.file_type)}</div>
              <div className="doc-info">
                <div className="doc-name">{doc.filename}</div>
                <div className="doc-meta">
                  <span>{formatSize(doc.file_size)}</span>
                  <span>{doc.chunk_count} chunks</span>
                  <span>{formatDate(doc.created_at)}</span>
                </div>
              </div>
              <div className="doc-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setReprocessTarget(doc)}
                  title="Replace with new version"
                >
                  🔄
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => setDeleteTarget(doc)}
                  title="Delete document"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Document?</h3>
            <p>
              This will permanently remove &quot;{deleteTarget.filename}&quot; and all its
              indexed content from the knowledge base.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reprocess File Picker Modal */}
      {reprocessTarget && (
        <div className="modal-overlay" onClick={() => setReprocessTarget(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Update Document</h3>
            <p>
              Select a new file to replace &quot;{reprocessTarget.filename}&quot;.
              The old content will be removed and the new file will be indexed.
            </p>
            <input
              type="file"
              accept=".pdf,.docx,.doc,.xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files[0];
                if (f) handleReprocess(f);
              }}
              style={{ marginBottom: 12 }}
            />
            <div className="modal-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setReprocessTarget(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </>
  );
}

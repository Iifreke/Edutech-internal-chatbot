'use client';

import { useState, useEffect, useCallback } from 'react';

const PRESET_URLS = [
  'https://edutech.global/',
  'https://vigilearn.com/',
  'https://abudlc.edu.ng/',
  'https://edutechbusiness.net/',
  'https://codel.babcock.edu.ng/',
];

export default function WebSourceManager({ password, refreshTrigger, onRefresh }) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [urlInput, setUrlInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [addingUrl, setAddingUrl] = useState('');
  const [refreshingId, setRefreshingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setSources((data.documents || []).filter(d => d.file_type === 'web'));
      }
    } catch (err) {
      console.error('Failed to fetch web sources:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources, refreshTrigger]);

  const scrapeUrl = async (url, documentId) => {
    const res = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ url, documentId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Scrape failed');
    return data;
  };

  const handleAdd = async (urlToAdd) => {
    const url = (urlToAdd || urlInput).trim();
    if (!url || adding) return;
    setAdding(true);
    setAddingUrl(url);
    try {
      const data = await scrapeUrl(url);
      showToast(`✓ Added ${data.document.filename} — ${data.pagesScraped} pages, ${data.document.chunk_count} chunks indexed`);
      setUrlInput('');
      fetchSources();
      onRefresh?.();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setAdding(false);
      setAddingUrl('');
    }
  };

  const handleRefresh = async (source) => {
    setRefreshingId(source.id);
    try {
      const data = await scrapeUrl(source.storage_path, source.id);
      showToast(`✓ Refreshed ${source.filename} — ${data.pagesScraped} pages, ${data.document.chunk_count} chunks`);
      fetchSources();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setRefreshingId(null);
    }
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
        showToast(`Removed ${deleteTarget.filename} from knowledge base`);
        fetchSources();
      } else {
        const err = await res.json();
        showToast(err.error || 'Delete failed', 'error');
      }
    } catch {
      showToast('Failed to remove web source', 'error');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const alreadyAdded = new Set(sources.map(s => s.storage_path));
  const pendingPresets = PRESET_URLS.filter(u => !alreadyAdded.has(u));

  return (
    <>
      {/* URL input row */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="https://example.com"
            disabled={adding}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #333',
              background: '#1a1a1a',
              color: '#fff',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleAdd()}
            disabled={adding || !urlInput.trim()}
          >
            {adding && addingUrl === urlInput.trim() ? 'Scraping...' : 'Add URL'}
          </button>
        </div>
        {adding && (
          <div style={{ fontSize: 13, color: '#aaa' }}>
            Fetching pages from {addingUrl} — this may take up to 60 seconds...
          </div>
        )}
      </div>

      {/* Quick-add preset buttons for URLs not yet added */}
      {pendingPresets.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>
            Suggested sources (click to add):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {pendingPresets.map(u => (
              <button
                key={u}
                className="btn btn-ghost btn-sm"
                onClick={() => handleAdd(u)}
                disabled={adding}
                style={{ fontSize: 12 }}
              >
                + {new URL(u).hostname}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Source list */}
      {loading ? (
        <div className="doc-empty">Loading web sources...</div>
      ) : sources.length === 0 ? (
        <div className="doc-empty">
          No web sources yet. Add a URL above or click one of the suggested sources.
        </div>
      ) : (
        <div className="doc-list">
          {sources.map(src => (
            <div key={src.id} className="doc-card">
              <div className="doc-icon" style={{ fontSize: 20 }}>🌐</div>
              <div className="doc-info">
                <div className="doc-name">{src.filename}</div>
                <div className="doc-meta">
                  <span>{src.chunk_count} chunks</span>
                  <span title={src.storage_path}>
                    {src.storage_path?.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </span>
                  <span>Added {formatDate(src.created_at)}</span>
                </div>
              </div>
              <div className="doc-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleRefresh(src)}
                  disabled={refreshingId === src.id || adding}
                  title="Re-scrape to get latest content"
                >
                  {refreshingId === src.id ? '⏳' : '🔄'}
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => setDeleteTarget(src)}
                  title="Remove from knowledge base"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Remove Web Source?</h3>
            <p>
              This will permanently remove all indexed content from{' '}
              <strong>{deleteTarget.filename}</strong> ({deleteTarget.storage_path}) from the
              knowledge base.
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </>
  );
}

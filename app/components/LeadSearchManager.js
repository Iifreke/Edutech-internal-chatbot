'use client';

import { useState, useEffect, useCallback } from 'react';

export default function LeadSearchManager({ password, refreshTrigger }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [filterQuery, setFilterQuery] = useState('');

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/leads', {
        headers: { 'x-admin-password': password },
      });
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch (err) {
      console.error('Failed to fetch contact leads:', err);
    } finally {
      setLoading(false);
    }
  }, [password]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads, refreshTrigger]);

  const filteredLeads = leads.filter((l) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      (l.name && l.name.toLowerCase().includes(q)) ||
      (l.email && l.email.toLowerCase().includes(q)) ||
      (l.latestSearch && l.latestSearch.toLowerCase().includes(q))
    );
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="lead-manager">
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Filter by name, email, or search query..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          style={{
            flex: 1,
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid #333',
            background: '#1a1a1a',
            color: '#fff',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button className="btn btn-ghost btn-sm" onClick={fetchLeads} title="Refresh leads list">
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div className="doc-empty">Loading contact searches and leads...</div>
      ) : filteredLeads.length === 0 ? (
        <div className="doc-empty">
          {filterQuery ? 'No contacts match your filter.' : 'No contact searches or leads recorded yet.'}
        </div>
      ) : (
        <div className="lead-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredLeads.map((lead) => (
            <div
              key={lead.id}
              className="doc-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(211,30,30,0.3), rgba(211,30,30,0.1))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 15,
                    border: '1px solid rgba(211,30,30,0.3)',
                  }}
                >
                  {(lead.name || lead.email || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#f5f5f5', fontSize: 14 }}>
                    {lead.name || 'Unnamed Contact'}
                  </div>
                  <div style={{ fontSize: 12, color: '#9a9a9a', marginTop: 2 }}>
                    <span>📧 {lead.email || 'No email'}</span>
                    <span style={{ margin: '0 8px' }}>•</span>
                    <span>🔍 {lead.totalSearches || 0} searches ({lead.conversationCount || 0} sessions)</span>
                    <span style={{ margin: '0 8px' }}>•</span>
                    <span>🕒 {formatDate(lead.updated_at)}</span>
                  </div>
                  {lead.latestSearch && (
                    <div
                      style={{
                        fontSize: 12,
                        color: '#bbb',
                        fontStyle: 'italic',
                        marginTop: 4,
                        maxWidth: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Latest Query: &ldquo;{lead.latestSearch}&rdquo;
                    </div>
                  )}
                </div>
              </div>

              <button
                className="btn btn-primary btn-sm"
                onClick={() => setSelectedLead(lead)}
                style={{ fontSize: 12, whiteSpace: 'nowrap' }}
              >
                View History ({lead.conversationCount || 0})
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Contact Search History Modal */}
      {selectedLead && (
        <div className="modal-overlay" onClick={() => setSelectedLead(null)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 750, width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>
                  Search History: {selectedLead.name || selectedLead.email}
                </h3>
                <span style={{ fontSize: 12, color: '#888' }}>
                  {selectedLead.email} • {selectedLead.totalSearches || 0} total queries
                </span>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedLead(null)}
                style={{ fontSize: 16 }}
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, paddingRight: 6, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(!selectedLead.conversations || selectedLead.conversations.length === 0) ? (
                <div style={{ color: '#777', textAlign: 'center', padding: 20 }}>
                  No detailed messages recorded for this contact yet.
                </div>
              ) : (
                selectedLead.conversations.map((conv, cIdx) => (
                  <div
                    key={conv.id || cIdx}
                    style={{
                      background: '#161616',
                      borderRadius: 8,
                      border: '1px solid #282828',
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 11, color: '#d31e1e', fontWeight: 600, marginBottom: 8 }}>
                      SESSION #{cIdx + 1} — {formatDate(conv.updatedAt || conv.createdAt)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(conv.messages || []).map((m, mIdx) => (
                        <div
                          key={m.id || mIdx}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 6,
                            background: m.role === 'user' ? 'rgba(211,30,30,0.1)' : 'rgba(255,255,255,0.04)',
                            borderLeft: m.role === 'user' ? '3px solid #d31e1e' : '3px solid #444',
                            fontSize: 13,
                          }}
                        >
                          <div style={{ fontSize: 10, color: '#888', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>
                            {m.role === 'user' ? '👤 ' + (selectedLead.name || 'Contact') : '🤖 EduAssist'}
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap', color: m.role === 'user' ? '#fff' : '#ccc' }}>
                            {typeof m.content === 'string' ? m.content : m.parts?.map((p) => p.text).join('')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedLead(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useRef } from 'react';

export default function FileUploader({ password, onUploadComplete }) {
  const [dragover, setDragover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const fileInputRef = useRef(null);

  const ALLOWED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];

  const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls'];

  const isValidFile = (file) => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    return ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(ext);
  };

  const uploadFile = async (file) => {
    if (!isValidFile(file)) {
      setStatus('❌ Unsupported file type. Use PDF, DOCX, or XLSX.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setStatus('❌ File too large. Maximum 10MB.');
      return;
    }

    setUploading(true);
    setProgress(10);
    setStatus(`Uploading ${file.name}...`);

    try {
      setProgress(20);
      setStatus('Parsing document...');

      const formData = new FormData();
      formData.append('file', file);

      setProgress(40);
      setStatus('Generating embeddings...');

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'x-admin-password': password },
        body: formData,
      });

      setProgress(80);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }

      const data = await res.json();
      setProgress(100);
      setStatus(`✅ ${file.name} uploaded — ${data.document.chunkCount} chunks indexed`);
      onUploadComplete?.();
    } catch (error) {
      setStatus(`❌ ${error.message}`);
    } finally {
      setUploading(false);
      setTimeout(() => {
        setProgress(0);
        setStatus('');
      }, 4000);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragover(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) uploadFile(file);
    e.target.value = '';
  };

  return (
    <div>
      <div
        className={`uploader-zone ${dragover ? 'dragover' : ''} ${uploading ? 'uploading' : ''}`}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
        onDragLeave={() => setDragover(false)}
        onDrop={handleDrop}
      >
        <div className="uploader-icon">{uploading ? '⏳' : '📄'}</div>
        <div className="uploader-text">
          {uploading ? 'Processing document...' : 'Drop a file here or click to browse'}
        </div>
        <div className="uploader-hint">
          Supports PDF, DOCX, XLSX — Max 10MB
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="uploader-input"
          accept=".pdf,.docx,.doc,.xlsx,.xls"
          onChange={handleFileSelect}
        />
      </div>

      {(progress > 0 || status) && (
        <div className="upload-progress">
          {progress > 0 && (
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
          )}
          {status && <div className="upload-status">{status}</div>}
        </div>
      )}
    </div>
  );
}

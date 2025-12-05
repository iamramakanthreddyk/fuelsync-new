import React, { useState } from 'react';
import { apiClient } from '@/lib/api-client';

const AdminBackup = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDownload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Use centralized apiClient (returns envelope or raw depending on endpoint)
      const res = await apiClient.post('/admin/backup', undefined, { headers: { 'x-backup-password': password } });

      // apiClient handles JSON responses; for file download endpoints it may return a Response-like object
      // If `res` is an object with a `blob` method, treat it as Response; otherwise expect an envelope with base64/etc.
      let blob;
      if (res && typeof (res as unknown as Response).blob === 'function') {
        blob = await (res as unknown as Response).blob();
      } else if (res && (res as unknown as { data?: { blob?: string } }).data && (res as unknown as { data?: { blob?: string } }).data?.blob) {
        // If server returned base64 blob in envelope
        const b64 = (res as unknown as { data: { blob: string } }).data.blob;
        const byteCharacters = atob(b64);
        const byteNumbers = new Array(byteCharacters.length).fill(0).map((_, i) => byteCharacters.charCodeAt(i));
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray]);
      } else {
        throw new Error('Backup failed - invalid response');
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // If we got a Response, try to read filename from headers
      const disposition = (res as unknown as Response)?.headers?.get?.('Content-Disposition');
      let filename = 'fuelsync-backup.sql';
      if (disposition && disposition.includes('filename=')) {
        filename = disposition.split('filename=')[1].replace(/"/g, '');
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '2rem auto', padding: 24, border: '1px solid #ccc', borderRadius: 8 }}>
      <h2>Database Backup (Admin)</h2>
      <form onSubmit={handleDownload}>
        <div style={{ marginBottom: 12 }}>
          <label>Password:<br />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ width: '100%', padding: 8, marginTop: 4 }}
            />
          </label>
        </div>
        <button type="submit" disabled={loading} style={{ padding: '8px 16px' }}>
          {loading ? 'Processing...' : 'Download Backup'}
        </button>
        {error && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}
      </form>
    </div>
  );
};

export default AdminBackup;

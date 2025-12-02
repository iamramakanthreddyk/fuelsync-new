type ColumnDef = {
  key: string;
  label?: string;
  formatter?: (val: unknown) => string | number;
};

export function toCsv(rows: Array<Record<string, unknown>>, columns?: Array<string | ColumnDef>) {
  if (!rows || rows.length === 0) return '';
  const cols: ColumnDef[] = (columns && columns.length > 0)
    ? columns.map(c => (typeof c === 'string' ? { key: c, label: c } : c))
    : Object.keys(rows[0]).map(k => ({ key: k, label: k }));

  const escape = (val: unknown) => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('\n') || s.includes('"')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const header = cols.map(c => escape(c.label ?? c.key)).join(',');
  const lines = rows.map(r => cols.map(c => {
    const raw = c.formatter ? c.formatter(r[c.key]) : r[c.key];
    return escape(raw);
  }).join(','));

  return [header, ...lines].join('\n');
}

export function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const downloadCsv = (filename: string, csvContent: string) => downloadFile(filename, csvContent, 'text/csv;charset=utf-8;');

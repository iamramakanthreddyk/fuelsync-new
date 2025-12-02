export function toCsv(rows: Array<Record<string, any>>, columns?: string[]) {
  if (!rows || rows.length === 0) return '';
  const cols = columns && columns.length > 0 ? columns : Object.keys(rows[0]);
  const escape = (val: any) => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('\n') || s.includes('"')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const header = cols.join(',');
  const lines = rows.map(r => cols.map(c => escape(r[c])).join(','));
  return [header, ...lines].join('\n');
}

export function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

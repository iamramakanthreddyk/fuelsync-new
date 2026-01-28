// Shared number utility for safe conversion
export function toNumber(val: string | number | undefined | null): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val || '0');
  return 0;
}

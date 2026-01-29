export function safeLower(input: unknown): string {
  try {
    if (input === null || input === undefined) return '';
    return String(input).toString().toLowerCase();
  } catch (e) {
    return '';
  }
}

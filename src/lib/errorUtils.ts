export function getErrorMessage(err: unknown): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  try {
    // Try to read common shapes like { message } or ApiError-like
    const anyErr = err as any;
    if (typeof anyErr.message === 'string') return anyErr.message;
    if (typeof anyErr.error === 'string') return anyErr.error;
    if (anyErr?.toString) return anyErr.toString();
  } catch (_) {
    // fallthrough
  }
  return 'Unknown error';
}

export default {
  getErrorMessage,
};

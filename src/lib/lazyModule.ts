/** Keep failed lazy downloads recoverable, including stale pages after an update. */
export async function loadWithFallback<T>(
  load: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await load()
  } catch {
    return fallback
  }
}

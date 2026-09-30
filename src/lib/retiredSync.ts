/**
 * BugsTow 2.0–2.5 could sync Local issues to the user's own Google Drive,
 * Dropbox or WebDAV. That feature was removed in 2.6. Its separate browser
 * database held the sign-in tokens and the encryption key, so it is deleted
 * here instead of being left behind. Issues were never stored in it; they
 * stay in the main database.
 */
export function removeRetiredSyncData(): void {
  try {
    indexedDB.deleteDatabase('bugstow_sync')
  } catch {
    // IndexedDB unavailable (private mode): nothing was stored either.
  }
  try {
    localStorage.removeItem('bugstow_oauth_pending')
  } catch {
    // ignore
  }
}

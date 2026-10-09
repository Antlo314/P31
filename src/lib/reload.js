// After a new deploy, a page that was already open can ask for code files that
// no longer exist. Reload once to pick up the new version instead of going blank.
export const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch|ChunkLoadError|Unable to preload/i;
export const reloadOnceForNewVersion = () => {
  try {
    const last = Number(sessionStorage.getItem('p31_reload_at') || 0);
    if (Date.now() - last < 30000) return false;
    sessionStorage.setItem('p31_reload_at', String(Date.now()));
  } catch { /* storage blocked: still try once */ }
  window.location.reload();
  return true;
};


// Persistent storage for pitcher repertoires across sessions
// PRIMARY source of truth: TeamPitcher entity (DB-persisted, survives all sessions).
// SECONDARY cache: localStorage (scoped by userId, survives page refresh within same browser).
// This store handles the localStorage layer only. DB writes happen at save time in the caller.

// Synchronous user-id cache — set once at login via setCachedUserId()
let _cachedUserId = null;

export function setCachedUserId(uid) {
  _cachedUserId = uid;
}

function scopedKey(suffix) {
  if (_cachedUserId) return `${suffix}_${_cachedUserId}`;
  return suffix; // best-effort fallback before auth resolves
}

export function getSavedRepertoire(pitcherName) {
  if (!pitcherName) return [];
  try {
    const stored = JSON.parse(localStorage.getItem(scopedKey('pitcher-repertoires')) || '{}');
    return stored[pitcherName.toUpperCase()] || [];
  } catch { return []; }
}

export function saveRepertoire(pitcherName, repertoire) {
  if (!pitcherName || !repertoire) return;
  try {
    const key = scopedKey('pitcher-repertoires');
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    stored[pitcherName.toUpperCase()] = repertoire;
    localStorage.setItem(key, JSON.stringify(stored));
  } catch {}
}

export function getAllSavedRepertoires() {
  try {
    return JSON.parse(localStorage.getItem(scopedKey('pitcher-repertoires')) || '{}');
  } catch { return {}; }
}

// Get active pitcher info for the current game
export function getActivePitcherForGame(gameId) {
  if (!gameId) return null;
  try {
    return JSON.parse(localStorage.getItem(`pitcher-${gameId}`) || 'null');
  } catch { return null; }
}
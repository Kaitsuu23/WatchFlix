// ── Watch History & Continue Watching ──
const HISTORY_KEY = 'watchflix_history';
const MAX_HISTORY = 30;

export function saveHistory(item) {
  // item: { _id, title, type, posterImg, episodeSlug, season, episode }
  const list = getHistory().filter(h => h._id !== item._id);
  list.unshift({ ...item, watchedAt: Date.now() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
}

export function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

export function getContinueWatching() {
  return getHistory().filter(h => h.type === 'series' && h.episodeSlug);
}

export function removeHistory(id) {
  const list = getHistory().filter(h => h._id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

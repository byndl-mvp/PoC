const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  // Lokal (ohne ENV) => relative Pfade bleiben /api/...
  return BASE ? `${BASE}${p}` : p;
}

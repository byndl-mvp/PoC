// Netlify-Proxy nutzen: BASE leer lassen, damit /api/... relativ bleibt
const BASE = '';

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  // Wenn BASE leer ist, bleibt der Pfad relativ (/api/...), Netlify leitet per _redirects weiter
  return BASE ? `${BASE}${p}` : p;
}

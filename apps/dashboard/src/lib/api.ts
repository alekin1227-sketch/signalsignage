export function runtimeUrl(configured: string, fallbackPort: number, suffix = '') {
  const fallback = `${location.protocol}//${location.hostname}:${fallbackPort}${suffix}`;
  const raw = configured.trim(); if (!raw) return fallback;
  try {
    const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `${location.protocol}//${raw.replace(/^\/+/, '')}`;
    const url = new URL(withProtocol);
    if (['localhost','127.0.0.1'].includes(url.hostname) && !['localhost','127.0.0.1'].includes(location.hostname)) url.hostname = location.hostname;
    if (suffix && (!url.pathname || url.pathname === '/')) url.pathname = suffix;
    return url.toString().replace(/\/$/, '');
  } catch { return fallback; }
}

export const API_URL = runtimeUrl(import.meta.env.VITE_API_URL ?? '', 3000, '/api');
export const SOCKET_URL = runtimeUrl(import.meta.env.VITE_SOCKET_URL ?? '', 3000);

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const headers = new Headers(options.headers); if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  let response: Response;
  try { response = await fetch(`${API_URL}${path}`, { ...options, headers }); }
  catch { throw new Error(`Não foi possível conectar à API em ${API_URL}`); }
  if (response.status === 401) { localStorage.removeItem('accessToken'); if (location.pathname !== '/login') location.href = '/login'; }
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? `Erro ${response.status}`);
  return response.json();
}

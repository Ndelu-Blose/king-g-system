/**
 * API base URL for fetch calls.
 * In dev, default to same-origin `/api` (Vite proxies to localhost:3001).
 * Set VITE_API_URL when the API is on another host (production / Docker).
 */
export function getApiBase(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (typeof configured === 'string' && configured.trim()) {
    return configured.trim().replace(/\/$/, '');
  }
  return '';
}

/** Vite dev server with same-origin `/api` proxy (works on localhost and LAN IP). */
export function usesLocalApiProxy(): boolean {
  return import.meta.env.DEV && !getApiBase();
}

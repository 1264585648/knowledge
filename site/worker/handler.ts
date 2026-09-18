import { checkAccess, clearCookie, revokeSession } from './auth.ts';
import type { Env } from './types.ts';

// Exact allowlist. Never allow all JS, JSON, HTML, _astro, images or attachments.
const PUBLIC_ASSETS = new Set([
  '/access', '/access/', '/access/index.html',
  '/privacy', '/privacy/', '/privacy/index.html',
  '/public/ui.css', '/public/access.js', '/public/favicon.svg'
]);
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
function secure(response: Response, head = false): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  const vary = headers.get('Vary');
  headers.set('Vary', vary ? `${vary}, Cookie` : 'Cookie');
  // Strip conditional validators: a rejected session must never reuse a private 304 body.
  headers.delete('ETag');
  headers.delete('Last-Modified');
  return new Response(head ? null : response.body, { status: response.status, headers });
}
export function safePath(pathname: string): string | null {
  try {
    const path = decodeURIComponent(pathname);
    if (!path.startsWith('/') || /[\\%\u0000-\u001f\u007f]/.test(path) || path.includes('//') ||
        path.split('/').some(segment => segment === '.' || segment === '..')) return null;
    return path;
  } catch { return null; }
}
export function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return '/';
  try {
    const url = new URL(value, 'https://local.invalid');
    if (url.origin !== 'https://local.invalid' || !safePath(url.pathname) || url.pathname.startsWith('/access')) return '/';
    return url.pathname + url.search;
  } catch { return '/'; }
}
async function assets(request: Request, env: Env) {
  const headers = new Headers(request.headers);
  headers.delete('If-None-Match');
  headers.delete('If-Modified-Since');
  return env.ASSETS.fetch(new Request(request, { headers }));
}
async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = safePath(url.pathname);
  if (!path) return json({ error: 'invalid_path' }, 400);
  if (path === '/healthz' && ['GET', 'HEAD'].includes(request.method)) {
    return json({ status: 'ok', phase: 'foundation' });
  }
  if (path === '/api/auth/status' && ['GET', 'HEAD'].includes(request.method)) {
    return json({ loginAvailable: false, phase: 'foundation', message: '关注渠道尚未接入，暂不开放访问。' });
  }
  if (path === '/api/auth/logout' && request.method === 'POST') {
    if (request.headers.get('Origin') !== url.origin) return json({ error: 'invalid_origin' }, 403);
    await revokeSession(request, env.DB);
    return new Response(null, { status: 303, headers: { Location: '/access/', 'Set-Cookie': clearCookie() } });
  }
  if (path === '/api/auth/start' && request.method === 'POST') {
    if (request.headers.get('Origin') !== url.origin) return json({ error: 'invalid_origin' }, 403);
    // Placeholder by design. Never trust client-submitted followed=true or usernames.
    return json({ error: 'provider_not_implemented' }, 503);
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  if (PUBLIC_ASSETS.has(path)) return assets(request, env);
  const access = await checkAccess(request, env, Math.floor(Date.now() / 1000));
  if (!access.ok) {
    const status = access.reason === 'not_configured' ? 503 : access.reason === 'unauthenticated' ? 401 : 403;
    if (path.startsWith('/api/') || !request.headers.get('Accept')?.includes('text/html')) {
      return json({ error: access.reason }, status);
    }
    const next = safeNext(url.pathname + url.search);
    return new Response(null, { status: 303, headers: { Location: `/access/?next=${encodeURIComponent(next)}` } });
  }
  if (path === '/api/session') return json({ authenticated: true, userId: access.userId });
  if (path.startsWith('/api/')) return json({ error: 'not_found' }, 404);
  return assets(request, env);
}
export async function handleRequest(request: Request, env: Env): Promise<Response> {
  try { return secure(await route(request, env), request.method === 'HEAD'); }
  catch {
    // Do not expose SQL, credentials, OAuth codes, request headers or private content.
    return secure(json({ error: 'service_unavailable' }, 503), request.method === 'HEAD');
  }
}

import type { Env } from '../../types.ts';
import { loginProviders } from './registry.ts';
import { getSession, issueSession, revokeSession, clearCookie } from './sessions.ts';
import { allowLogin } from './rate-limit.ts';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8' }
});
async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2048) { await reader.cancel(); throw new RangeError('body_limit'); }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
// HTTP is the outer adapter. Providers only verify credentials; they never issue cookies.
export async function authRoute(request: Request, env: Env, path: string,
  safeNext: (value: string | null) => string): Promise<Response | null> {
  const read = ['GET', 'HEAD'].includes(request.method);
  const providers = loginProviders(env);
  if (read && (path === '/api/auth/status' || path === '/api/auth/providers')) {
    if (providers.length) await env.DB!.prepare('SELECT id FROM auth_invites LIMIT 1').first();
    return json({ loginAvailable: providers.length > 0,
      providers: providers.map(({ id, label, kind }) => ({ id, label, kind })),
      message: providers.length ? '每个邀请码对应一个账号，可重复登录。' : '登录暂未开放，请稍后再来。' });
  }
  if (read && (path === '/api/auth/session' || path === '/api/session')) {
    const session = await getSession(request, env, Math.floor(Date.now() / 1000));
    if (session.kind === 'unavailable') return json({ error: 'not_configured' }, 503);
    if (session.kind === 'anonymous') return json({ authenticated: false });
    const { userId, provider, expiresAt } = session.principal;
    return json({ authenticated: true, user: { id: userId }, provider, expiresAt });
  }
  if (request.method !== 'POST' || !['/api/auth/invite/login', '/api/auth/logout', '/api/auth/start'].includes(path)) return null;
  if (request.headers.get('Origin') !== new URL(request.url).origin) return json({ error: 'invalid_origin' }, 403);
  if (path === '/api/auth/logout') {
    await revokeSession(request, env.DB);
    return new Response(null, { status: 303, headers: { Location: '/access/', 'Set-Cookie': clearCookie() } });
  }
  if (path === '/api/auth/start') return json({ error: 'provider_not_implemented' }, 503);
  const provider = providers.find(item => item.id === 'invite');
  if (!provider || !env.DB) return json({ error: 'not_configured' }, 503);
  if (request.headers.get('Content-Type')?.split(';')[0]?.trim() !== 'application/json') {
    return json({ error: 'invalid_content_type' }, 415);
  }
  const now = Math.floor(Date.now() / 1000);
  if (!await allowLogin(env.DB, request, now)) {
    const response = json({ error: 'rate_limited', message: '尝试次数较多，请 10 分钟后再试。' }, 429);
    response.headers.set('Retry-After', '600');
    return response;
  }
  let body: unknown;
  try { body = await readBody(request); }
  catch (error) { return json({ error: error instanceof RangeError ? 'body_too_large' : 'invalid_body' }, error instanceof RangeError ? 413 : 400); }
  if (!body || typeof body !== 'object' || !('code' in body) || typeof body.code !== 'string') {
    return json({ error: 'invalid_body' }, 400);
  }
  const identity = await provider.authenticate(env.DB, body.code, now);
  if (!identity) return json({ error: 'invalid_invite', message: '邀请码无效或已停用，请检查后重试。' }, 401);
  const ttl = Number(env.SESSION_TTL_SECONDS ?? '604800');
  // Rotate an existing session instead of accepting a client-selected session identifier.
  await revokeSession(request, env.DB);
  const session = await issueSession(env.DB, identity.identityId, now, ttl);
  const next = 'next' in body && typeof body.next === 'string' ? body.next : null;
  const response = json({ authenticated: true, redirect: safeNext(next) });
  response.headers.set('Set-Cookie', session.cookie);
  return response;
}

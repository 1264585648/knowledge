import type { Database, Env, SessionRow } from './types.ts';

export const COOKIE = '__Host-zhiye_session';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const SESSION_SQL = `
  SELECT i.user_id, u.status AS user_status, i.provider,
         s.expires_at, s.revoked_at, f.status AS follow_status,
         f.verified_at, f.valid_until
  FROM sessions s
  JOIN identities i ON i.id = s.identity_id
  JOIN users u ON u.id = i.user_id
  LEFT JOIN follow_status f ON f.identity_id = i.id AND f.target = ?
  WHERE s.token_hash = ? LIMIT 1`;

export function readToken(request: Request): string | null {
  const matches = (request.headers.get('Cookie') ?? '').split(';')
    .map(part => part.trim()).filter(part => part.startsWith(COOKIE + '='));
  if (matches.length !== 1) return null;
  const value = matches[0]!.slice(COOKIE.length + 1);
  return TOKEN_PATTERN.test(value) ? value : null;
}
export async function hashToken(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function sessionCookie(token: string, maxAge: number): string {
  if (!TOKEN_PATTERN.test(token) || !Number.isSafeInteger(maxAge) || maxAge <= 0) {
    throw new Error('Invalid session cookie');
  }
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export function clearCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
/** Internal helper only. No HTTP endpoint currently calls it.
 * P1 may call it only after verified identity + follow grant have been persisted.
 */
export async function issueSession(db: Database, identityId: string, now: number, ttl = 86400) {
  if (!identityId || !Number.isSafeInteger(now) || !Number.isSafeInteger(ttl) || ttl <= 0 || ttl > 604800) {
    throw new Error('Invalid session input');
  }
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const result = await db.prepare(
    'INSERT INTO sessions(token_hash, identity_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(await hashToken(token), identityId, now, now + ttl).run();
  if (!result.success) throw new Error('Session write failed');
  return { token, cookie: sessionCookie(token, ttl) };
}
export type Access = { ok: true; userId: string } | {
  ok: false; reason: 'not_configured' | 'unauthenticated' | 'verification_required'
};
export async function checkAccess(request: Request, env: Env, now: number): Promise<Access> {
  const provider = env.AUTH_PROVIDER;
  if (!env.DB || !['github', 'wechat'].includes(provider ?? '') || !env.FOLLOW_TARGET?.trim()) {
    return { ok: false, reason: 'not_configured' };
  }
  const token = readToken(request);
  if (!token) return { ok: false, reason: 'unauthenticated' };
  const row = await env.DB.prepare(SESSION_SQL).bind(env.FOLLOW_TARGET, await hashToken(token)).first<SessionRow>();
  if (!row || row.user_status !== 'active' || row.provider !== provider ||
      row.revoked_at !== null || row.expires_at <= now) {
    return { ok: false, reason: 'unauthenticated' };
  }
  if (row.follow_status !== 'verified' || row.verified_at === null || row.valid_until === null ||
      row.verified_at > now || row.valid_until <= now) {
    return { ok: false, reason: 'verification_required' };
  }
  return { ok: true, userId: row.user_id };
}
export async function revokeSession(request: Request, db?: Database): Promise<void> {
  const token = readToken(request);
  if (!token) return;
  if (!db) throw new Error('Database unavailable');
  const result = await db.prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ?')
    .bind(Math.floor(Date.now() / 1000), await hashToken(token)).run();
  if (!result.success) throw new Error('Session revocation failed');
}

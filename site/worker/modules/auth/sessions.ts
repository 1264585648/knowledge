import type { Database, Env } from '../../types.ts';
import type { Principal, SessionResult } from './contracts.ts';
import { enabledProviders } from './registry.ts';

export const COOKIE = '__Host-zhiye_session';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
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
  if (!TOKEN_PATTERN.test(token) || !Number.isSafeInteger(maxAge) || maxAge <= 0) throw new Error('Invalid session cookie');
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export function clearCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
// Internal only: callers must obtain a verified identity from a server-side provider.
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
export async function getSession(request: Request, env: Env, now: number): Promise<SessionResult> {
  const providers = enabledProviders(env);
  if (!env.DB || !providers.length) return { kind: 'unavailable' };
  const token = readToken(request);
  if (!token) return { kind: 'anonymous' };
  const row = await env.DB.prepare(`
    SELECT i.id AS identity_id, i.user_id, i.provider, u.status,
           s.created_at, s.expires_at, s.revoked_at
    FROM sessions s JOIN identities i ON i.id = s.identity_id
    JOIN users u ON u.id = i.user_id WHERE s.token_hash = ? LIMIT 1
  `).bind(await hashToken(token)).first<{
    identity_id: string; user_id: string; provider: string; status: string;
    created_at: number; expires_at: number; revoked_at: number | null;
  }>();
  if (!row || row.status !== 'active' || !providers.includes(row.provider) ||
      row.revoked_at !== null || row.expires_at <= now || row.created_at > now) return { kind: 'anonymous' };
  const principal: Principal = { userId: row.user_id, authIdentityId: row.identity_id,
    provider: row.provider, authenticatedAt: row.created_at, expiresAt: row.expires_at };
  return { kind: 'authenticated', principal };
}
export async function revokeSession(request: Request, db?: Database): Promise<void> {
  const token = readToken(request);
  if (!token) return;
  if (!db) throw new Error('Database unavailable');
  const result = await db.prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ?')
    .bind(Math.floor(Date.now() / 1000), await hashToken(token)).run();
  if (!result.success) throw new Error('Session revocation failed');
}

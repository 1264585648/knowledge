import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleRequest, safeNext, safePath } from '../worker/handler.ts';
import { COOKIE, checkAccess, hashToken, issueSession, readToken, sessionCookie } from '../worker/auth.ts';
import type { Database, Env, Statement } from '../worker/types.ts';

type Register = (name: string, fn: () => Promise<void> | void) => unknown;
async function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../migrations/0001_auth.sql', import.meta.url), 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const token = 'a'.repeat(43);
  sql.prepare('INSERT INTO users VALUES (?, ?, ?)').run('u1', 'active', now - 100);
  sql.prepare('INSERT INTO identities VALUES (?, ?, ?, ?, ?)').run('i1', 'u1', 'github', '100', now - 100);
  sql.prepare('INSERT INTO follow_status VALUES (?, ?, ?, ?, ?)').run('i1', '1264585648', 'verified', now - 60, now + 3600);
  sql.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?)').run(await hashToken(token), 'i1', now - 60, now + 3600, null);
  const DB: Database = {
    prepare(query: string): Statement {
      let values: (string | number | null)[] = [];
      return {
        bind(...args) { values = args; return this; },
        async first<T>() { return (sql.prepare(query).get(...values) as T | undefined) ?? null; },
        async run() { sql.prepare(query).run(...values); return { success: true }; }
      };
    }
  };
  const seen: Request[] = [];
  const env: Env = {
    AUTH_PROVIDER: 'github', FOLLOW_TARGET: '1264585648', DB,
    ASSETS: { async fetch(request) {
      seen.push(request);
      return new Response('ASSET_BODY', { headers: { ETag: 'private-tag', 'Last-Modified': 'Thu, 01 Jan 2026 00:00:00 GMT' } });
    } }
  };
  const req = (path = '/', authenticated = true, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (authenticated) headers.set('Cookie', `${COOKIE}=${token}`);
    return new Request(`https://example.test${path}`, { ...init, headers });
  };
  return { sql, now, token, DB, env, seen, req };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
export function registerCases(test: Register) {
  const withDB = (name: string, run: (f: Fixture) => Promise<void> | void) => test(name, async () => {
    const f = await fixture();
    try { await run(f); } finally { f.sql.close(); }
  });

  withDB('active session with current follow grant can read an asset', async f => {
    const response = await handleRequest(f.req('/articles/welcome/'), f.env);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'ASSET_BODY');
    assert.equal(f.seen.length, 1);
  });
  for (const path of ['/', '/index.html', '/topics/', '/topics/index.html', '/articles/welcome/', '/articles/welcome/index.html', '/search-index.json', '/public/reader.js', '/_astro/private.js', '/files/report.pdf', '/images/private.png']) {
    withDB(`unauthenticated direct request is denied: ${path}`, async f => {
      const response = await handleRequest(f.req(path, false), f.env);
      assert.equal(response.status, 401);
      assert.equal(f.seen.length, 0);
      assert.ok(!(await response.text()).includes('ASSET_BODY'));
    });
  }
  withDB('HTML navigation redirects to the gate and preserves local path', async f => {
    const response = await handleRequest(f.req('/articles/welcome/?a=1', false, { headers: { Accept: 'text/html' } }), f.env);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('Location'), '/access/?next=%2Farticles%2Fwelcome%2F%3Fa%3D1');
    assert.equal(f.seen.length, 0);
  });
  withDB('disabled provider fails closed even with a valid session', async f => {
    const response = await handleRequest(f.req(), { ...f.env, AUTH_PROVIDER: 'disabled' });
    assert.equal(response.status, 503);
    assert.equal(f.seen.length, 0);
  });
  withDB('missing D1 fails closed', async f => {
    const response = await handleRequest(f.req(), { ...f.env, DB: undefined });
    assert.equal(response.status, 503);
    assert.equal(f.seen.length, 0);
  });
  withDB('D1 exceptions do not leak details or fall through to assets', async f => {
    const response = await handleRequest(f.req(), { ...f.env, DB: { prepare() { throw new Error('PRIVATE DATABASE DETAILS'); } } });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'service_unavailable' });
    assert.equal(f.seen.length, 0);
  });
  withDB('expired session is rejected', async f => {
    f.sql.prepare('UPDATE sessions SET expires_at = ?').run(f.now - 1);
    assert.equal((await handleRequest(f.req(), f.env)).status, 401);
  });
  withDB('revoked session is rejected', async f => {
    f.sql.prepare('UPDATE sessions SET revoked_at = ?').run(f.now);
    assert.equal((await handleRequest(f.req(), f.env)).status, 401);
  });
  withDB('disabled user is rejected', async f => {
    f.sql.exec("UPDATE users SET status = 'disabled'");
    assert.equal((await handleRequest(f.req(), f.env)).status, 401);
  });
  withDB('expired follow grant is not treated as an active login entitlement', async f => {
    f.sql.prepare('UPDATE follow_status SET valid_until = ?').run(f.now - 1);
    assert.equal((await handleRequest(f.req(), f.env)).status, 403);
  });
  withDB('revoked follow grant is rejected', async f => {
    f.sql.exec("UPDATE follow_status SET status = 'revoked'");
    assert.equal((await handleRequest(f.req(), f.env)).status, 403);
  });
  withDB('follow verification in the future is invalid', async f => {
    f.sql.prepare('UPDATE follow_status SET verified_at = ?').run(f.now + 600);
    assert.equal((await handleRequest(f.req(), f.env)).status, 403);
  });
  withDB('follow grant for another target cannot be reused', async f => {
    assert.equal((await handleRequest(f.req(), { ...f.env, FOLLOW_TARGET: 'another-owner' })).status, 403);
  });
  withDB('same user cannot borrow another identity follow grant', async f => {
    f.sql.prepare('INSERT INTO identities VALUES (?, ?, ?, ?, ?)').run('i2', 'u1', 'github', '200', f.now);
    f.sql.exec("UPDATE sessions SET identity_id = 'i2'");
    assert.equal((await handleRequest(f.req(), f.env)).status, 403);
  });
  withDB('session from another provider is rejected', async f => {
    assert.equal((await handleRequest(f.req(), { ...f.env, AUTH_PROVIDER: 'wechat' })).status, 401);
  });
  withDB('expiry boundary is exclusive', async f => {
    const access = await checkAccess(f.req(), f.env, f.now + 3600);
    assert.equal(access.ok, false);
  });
  withDB('forged and duplicate cookie tokens are rejected', async f => {
    for (const cookie of [`${COOKIE}=${'b'.repeat(43)}`, `${COOKIE}=${f.token}; ${COOKIE}=${f.token}`, `${COOKIE}=admin`]) {
      const response = await handleRequest(f.req('/', false, { headers: { Cookie: cookie } }), f.env);
      assert.equal(response.status, 401);
    }
    assert.equal(f.seen.length, 0);
  });
  for (const path of ['/access/', '/access/index.html', '/privacy/', '/public/ui.css', '/public/access.js', '/public/favicon.svg']) {
    withDB(`explicit public asset works without authentication: ${path}`, async f => {
      const response = await handleRequest(f.req(path, false), { ...f.env, DB: undefined, AUTH_PROVIDER: 'disabled' });
      assert.equal(response.status, 200);
      assert.equal(f.seen.length, 1);
    });
  }
  withDB('all protected responses prevent shared caching and conditional reuse', async f => {
    const response = await handleRequest(f.req('/', true, { headers: { 'If-None-Match': 'old', 'If-Modified-Since': 'old' } }), f.env);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.get('ETag'), null);
    assert.equal(response.headers.get('Last-Modified'), null);
    assert.equal(f.seen[0]!.headers.get('If-None-Match'), null);
    assert.match(response.headers.get('Content-Security-Policy')!, /frame-ancestors 'none'/);
  });
  withDB('HEAD has no body but still checks authorization', async f => {
    const response = await handleRequest(f.req('/', false, { method: 'HEAD' }), f.env);
    assert.equal(response.status, 401);
    assert.equal(await response.text(), '');
    assert.equal(f.seen.length, 0);
  });
  withDB('health endpoint does not query D1', async f => {
    const response = await handleRequest(f.req('/healthz', false), { ...f.env, DB: undefined });
    assert.equal(response.status, 200);
    assert.equal(f.seen.length, 0);
  });
  withDB('client self-asserted follow status never creates an authorization', async f => {
    const response = await handleRequest(f.req('/api/auth/start', false, {
      method: 'POST', headers: { Origin: 'https://example.test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ followed: true, username: 'admin' })
    }), f.env);
    assert.equal(response.status, 503);
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM sessions').get()!.n, 1);
  });
  withDB('cross-origin or missing-Origin logout is rejected', async f => {
    for (const headers of [{ Origin: 'https://evil.test' }, {}]) {
      const response = await handleRequest(f.req('/api/auth/logout', true, { method: 'POST', headers }), f.env);
      assert.equal(response.status, 403);
      assert.equal(f.sql.prepare('SELECT revoked_at FROM sessions').get()!.revoked_at, null);
    }
  });
  withDB('same-origin logout revokes D1 session and clears Secure cookie', async f => {
    const response = await handleRequest(f.req('/api/auth/logout', true, { method: 'POST', headers: { Origin: 'https://example.test' } }), f.env);
    assert.equal(response.status, 303);
    assert.match(response.headers.get('Set-Cookie')!, /Max-Age=0/);
    assert.equal((await handleRequest(f.req(), f.env)).status, 401);
  });
  withDB('internal session creation stores only a hash and sets hardened cookie', async f => {
    const issued = await issueSession(f.DB, 'i1', f.now);
    assert.match(issued.token, /^[A-Za-z0-9_-]{43}$/);
    const row = f.sql.prepare('SELECT token_hash FROM sessions WHERE token_hash = ?').get(await hashToken(issued.token));
    assert.ok(row);
    assert.notEqual(row.token_hash, issued.token);
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert.ok(issued.cookie.includes(flag));
    assert.throws(() => sessionCookie('invalid', 100));
    await assert.rejects(() => issueSession(f.DB, 'missing-identity', f.now));
  });
  withDB('schema enforces foreign keys, unique provider IDs and positive expiry', f => {
    assert.throws(() => f.sql.exec("INSERT INTO identities VALUES ('bad','missing','github','999',0)"));
    assert.throws(() => f.sql.exec("INSERT INTO identities VALUES ('duplicate','u1','github','100',0)"));
    assert.throws(() => f.sql.exec('UPDATE follow_status SET valid_until = verified_at'));
  });
  test('path canonicalization rejects encoded traversal, double encoding and backslashes', () => {
    for (const path of ['/a/%2e%2e/private', '/public/%252e%252e/a', '/public/%5cprivate', '/a//b', '/a/%00b', '/a/%ZZ']) assert.equal(safePath(path), null);
    assert.equal(safePath('/articles/welcome/'), '/articles/welcome/');
  });
  test('return locations cannot become open redirects', () => {
    for (const next of ['https://evil.test/', '//evil.test/', '/\\evil.test/', '/%2f%2fevil.test/', '/access/?next=/']) assert.equal(safeNext(next), '/');
    assert.equal(safeNext('/topics/agent/?page=2'), '/topics/agent/?page=2');
    assert.equal(readToken(new Request('https://example.test/')), null);
  });
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleRequest } from '../worker/handler.ts';
import { hashToken } from '../worker/auth.ts';
import { allowLogin } from '../worker/modules/auth/rate-limit.ts';
import { generateInvites, seedSQL } from '../scripts/generate-invites.mjs';

async function fixture(run) {
  const sql = new DatabaseSync(':memory:');
  try {
    for (const file of ['0001_auth.sql', '0002_invite_login.sql']) sql.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'));
    const invites = await generateInvites(10);
    sql.exec(seedSQL(invites));
    const DB = { prepare(query) { let values = []; return {
      bind(...args) { values = args; return this; },
      async first() { return sql.prepare(query).get(...values) ?? null; },
      async run() { sql.prepare(query).run(...values); return { success: true }; }
    }; } };
    const env = { DB, AUTH_PROVIDERS: 'invite', ACCESS_POLICY: 'invite',
      ASSETS: { fetch: async () => new Response('protected content') } };
    let ip = 0;
    const request = (path, init = {}) => new Request('https://example.test' + path, init);
    const login = (code = invites[0].code, options = {}, target = env) => handleRequest(request('/api/auth/invite/login', {
      method: 'POST', headers: { Origin: 'https://example.test', 'Content-Type': 'application/json', 'CF-Connecting-IP': `192.0.2.${++ip}` },
      body: JSON.stringify({ code, next: '/articles/welcome/' }), ...options
    }), target);
    const cookie = response => response.headers.get('Set-Cookie')?.split(';')[0];
    const get = (path, session) => handleRequest(request(path, { headers: session ? { Cookie: session } : {} }), env);
    await run({ sql, DB, env, invites, login, cookie, get, request });
  } finally { sql.close(); }
}
const check = (name, fn) => test(name, () => fixture(fn));

check('ten random invitations map to ten distinct users; seed retries do not reactivate codes', async f => {
  assert.equal(new Set(f.invites.map(i => i.code)).size, 10);
  assert.equal(new Set(f.invites.map(i => i.userId)).size, 10);
  const users = new Set();
  for (const invite of f.invites) {
    assert.match(invite.code, /^ZY-(?:[A-HJ-NP-Z2-9]{4}-){7}[A-HJ-NP-Z2-9]{4}$/);
    const response = await f.login(invite.code);
    assert.equal(response.status, 200);
    const session = await (await f.get('/api/auth/session', f.cookie(response))).json();
    users.add(session.user.id);
    assert.equal(session.user.id, invite.userId);
    const stored = JSON.stringify(f.sql.prepare('SELECT * FROM auth_invites').all());
    assert.ok(!stored.includes(invite.code));
  }
  assert.equal(users.size, 10);
  f.sql.exec("UPDATE auth_invites SET status='revoked'");
  f.sql.exec(seedSQL(f.invites));
  assert.equal(f.sql.prepare("SELECT count(*) AS n FROM users").get().n, 10);
  assert.equal(f.sql.prepare("SELECT count(*) AS n FROM auth_invites WHERE status='active'").get().n, 0);
});
check('login, protected reads, logout, and repeated login use the same account with fresh sessions', async f => {
  assert.equal((await f.get('/articles/welcome/')).status, 401);
  const first = await f.login();
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { authenticated: true, redirect: '/articles/welcome/' });
  assert.match(first.headers.get('Set-Cookie'), /HttpOnly; Secure; SameSite=Lax; Max-Age=604800/);
  const cookie = f.cookie(first);
  assert.equal((await f.get('/search-index.json', cookie)).status, 200);
  const logout = await handleRequest(f.request('/api/auth/logout', { method: 'POST', headers: { Origin: 'https://example.test', Cookie: cookie } }), f.env);
  assert.equal(logout.status, 303);
  assert.equal((await f.get('/articles/welcome/', cookie)).status, 401);
  const second = await f.login();
  assert.equal(second.status, 200);
  assert.notEqual(f.cookie(second), cookie);
  const session = await (await f.get('/api/auth/session', f.cookie(second))).json();
  assert.equal(session.user.id, f.invites[0].userId);
});
check('revoking invitation blocks both future logins and existing-session reading', async f => {
  const cookie = f.cookie(await f.login());
  f.sql.exec("UPDATE auth_invites SET status='revoked'");
  assert.equal((await f.login()).status, 401);
  assert.equal((await f.get('/articles/welcome/', cookie)).status, 403);
  assert.equal((await (await f.get('/api/auth/session', cookie)).json()).authenticated, true);
  assert.deepEqual(await (await f.get('/api/access/status', cookie)).json(), { ok: false, reason: 'verification_required' });
});
check('invalid, expired and disabled codes have the same generic failure', async f => {
  const invalid = await f.login('wrong-code');
  const message = await invalid.text();
  assert.equal(invalid.status, 401);
  const now = Math.floor(Date.now() / 1000);
  f.sql.prepare('UPDATE auth_invites SET created_at=?, expires_at=?').run(now - 100, now - 1);
  assert.equal(await (await f.login()).text(), message);
  f.sql.exec("UPDATE auth_invites SET expires_at=NULL; UPDATE users SET status='disabled'");
  assert.equal(await (await f.login()).text(), message);
  assert.equal(f.sql.prepare('SELECT count(*) AS n FROM sessions').get().n, 0);
});
check('lowercase and pasted spaces are normalized without weakening the code alphabet', async f => {
  assert.equal((await f.login('  ' + f.invites[0].code.toLowerCase() + '\n')).status, 200);
  assert.equal((await f.login(f.invites[0].code + 'I')).status, 401);
});
check('expired and future sessions are rejected', async f => {
  const cookie = f.cookie(await f.login());
  const now = Math.floor(Date.now() / 1000);
  f.sql.prepare('UPDATE sessions SET created_at=?, expires_at=?').run(now - 100, now);
  assert.equal((await f.get('/', cookie)).status, 401);
  f.sql.prepare('UPDATE sessions SET created_at=?, expires_at=?').run(now + 1, now + 100);
  assert.equal((await f.get('/', cookie)).status, 401);
});
check('login rotates and revokes the current session', async f => {
  const first = f.cookie(await f.login());
  const second = await f.login(f.invites[0].code, { headers: { Origin: 'https://example.test', 'Content-Type': 'application/json', Cookie: first } });
  assert.equal(second.status, 200);
  assert.equal((await f.get('/', first)).status, 401);
  assert.equal((await f.get('/', f.cookie(second))).status, 200);
  assert.ok(f.sql.prepare('SELECT token_hash FROM sessions WHERE token_hash=?').get(await hashToken(f.cookie(second).split('=')[1])));
});
check('cross-origin login, malformed/oversized JSON and unsafe redirects are handled', async f => {
  for (const origin of ['', 'https://evil.test']) {
    assert.equal((await f.login(undefined, { headers: { Origin: origin, 'Content-Type': 'application/json' } })).status, 403);
  }
  assert.equal((await f.login(undefined, { body: '{' })).status, 400);
  assert.equal((await f.login(undefined, { body: JSON.stringify({ code: 'a'.repeat(3000) }) })).status, 413);
  assert.equal((await f.login(undefined, { headers: { Origin: 'https://example.test', 'Content-Type': 'text/plain' } })).status, 415);
  const response = await f.login(undefined, { body: JSON.stringify({ code: f.invites[0].code, next: '//evil.test/' }) });
  assert.equal((await response.json()).redirect, '/');
});
check('rate limits are atomic, expire by window, and do not persist raw IP addresses', async f => {
  const options = { headers: { Origin: 'https://example.test', 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.51.100.8' } };
  for (let n = 0; n < 10; n++) assert.equal((await f.login('invalid', options)).status, 401);
  const limited = await f.login(undefined, options);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '600');
  const now = Math.floor(Date.now() / 1000);
  assert.equal(await allowLogin(f.DB, f.request('/', options), now + 601), true);
  assert.ok(!JSON.stringify(f.sql.prepare('SELECT * FROM auth_rate_limits').all()).includes('198.51.100.8'));
});
check('missing, disabled, unknown, or broken providers fail closed', async f => {
  for (const env of [{ ...f.env, DB: undefined }, { ...f.env, AUTH_PROVIDERS: 'disabled' }, { ...f.env, AUTH_PROVIDERS: 'invite,unknown' },
    { ...f.env, DB: { prepare() { throw new Error('private database error'); } } }]) {
    const response = await f.login(undefined, {}, env);
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes('private database'));
  }
  assert.equal(f.sql.prepare('SELECT count(*) AS n FROM sessions').get().n, 0);
});

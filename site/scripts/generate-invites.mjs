import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashInvite, normalizeInvite } from '../worker/modules/auth/providers/invite-code.ts';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export async function generateInvites(count = 10, now = Math.floor(Date.now() / 1000)) {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Count must be between 1 and 100');
  const items = [];
  for (let n = 0; n < count; n++) {
    const raw = Array.from(randomBytes(32), byte => alphabet[byte & 31]).join('');
    const code = 'ZY-' + raw.match(/.{4}/g).join('-');
    const userId = randomUUID(), identityId = randomUUID(), id = randomUUID();
    items.push({ label: `邀请码 ${String(n + 1).padStart(2, '0')}`, code, userId, identityId, id,
      hash: await hashInvite(normalizeInvite(code)), createdAt: now });
  }
  return items;
}
export function seedSQL(items) {
  const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
  // Stable IDs and INSERT OR IGNORE make retrying this seed safe; never overwrite revocations.
  return items.map(item => [
    `INSERT OR IGNORE INTO users(id,status,created_at) VALUES (${quote(item.userId)},'active',${item.createdAt});`,
    `INSERT OR IGNORE INTO identities(id,user_id,provider,provider_user_id,created_at) VALUES (${quote(item.identityId)},${quote(item.userId)},'invite',${quote(item.id)},${item.createdAt});`,
    `INSERT OR IGNORE INTO auth_invites(id,code_hash,identity_id,label,status,created_at) VALUES (${quote(item.id)},${quote(item.hash)},${quote(item.identityId)},${quote(item.label)},'active',${item.createdAt});`
  ].join('\n')).join('\n');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const items = await generateInvites(Number(process.argv[2] ?? 10));
  const folder = fileURLToPath(new URL(`../../.local-secrets/invites-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}/`, import.meta.url));
  mkdirSync(folder, { recursive: true });
  const options = { encoding: 'utf8', flag: 'wx', mode: 0o600 };
  writeFileSync(resolve(folder, '邀请码.txt'), '知页 · 邀请码登录\n每码一个独立账号，可重复登录。未设置到期时间；可单独停用。\n请单独发送给受邀者，持有码即拥有该账号。\n\n' + items.map(i => `${i.label}\n${i.code}\n`).join('\n'), options);
  writeFileSync(resolve(folder, 'invites.json'), JSON.stringify(items, null, 2), options);
  writeFileSync(resolve(folder, 'seed.sql'), seedSQL(items), options);
  writeFileSync(resolve(folder, '停用说明.txt'), items.map(i => `${i.label}\nUPDATE auth_invites SET status = 'revoked' WHERE id = '${i.id}';\n`).join('\n'), options);
  console.log(`Generated ${items.length} invitations. Private files: ${folder}`);
}

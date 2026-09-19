import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateInvites, seedSQL } from './generate-invites.mjs';
import { hashInvite } from '../worker/modules/auth/providers/invite-code.ts';
const folder = resolve('.wrangler', 'invite-e2e', randomUUID());
mkdirSync(folder, { recursive: true });
const items = await generateInvites(1);
// Public, local-only test credential. The production seed never uses this value.
items[0].hash = await hashInvite('ZY' + 'A'.repeat(32));
writeFileSync(resolve(folder, 'seed.sql'), seedSQL(items));
function wrangler(args) {
  const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...args,
    '--config', 'tests/wrangler.invite.jsonc', '--persist-to', folder], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
wrangler(['d1', 'migrations', 'apply', 'DB', '--local']);
wrangler(['d1', 'execute', 'DB', '--local', '--file', resolve(folder, 'seed.sql')]);
wrangler(['dev', '--local', '--ip', '127.0.0.1', '--port', '8788']);

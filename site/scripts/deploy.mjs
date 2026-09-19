import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const invite = process.argv.includes('--invite');
if (!invite && !process.argv.includes('--foundation')) {
  console.error('请明确选择 deploy:foundation 或 deploy:invite。私有内容发布需另行配置内容源。');
  process.exit(1);
}
if (process.env.CONTENT_DIR) {
  throw new Error('This deployment only supports public example content; unset CONTENT_DIR.');
}
const configPath = invite ? 'wrangler.invite.jsonc' : 'wrangler.foundation.jsonc';
const config = JSON.parse(readFileSync(configPath, 'utf8'));
if (config.assets?.run_worker_first !== true || config.assets?.not_found_handling !== 'none') {
  throw new Error('Deployment requires Worker-first assets and no fallback.');
}
if (invite ? (config.vars?.AUTH_PROVIDERS !== 'invite' || config.vars?.ACCESS_POLICY !== 'invite' ||
    !config.d1_databases?.find(db => db.binding === 'DB' && db.database_id !== '00000000-0000-0000-0000-000000000000')) :
    (config.vars?.AUTH_PROVIDER !== 'disabled' || config.d1_databases?.length)) {
  throw new Error('Authentication configuration does not match deployment mode.');
}
function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
// Always rebuild from public examples so old private artifacts cannot be uploaded.
run(['scripts/build.mjs']);
if (invite && !process.argv.includes('--dry-run')) {
  run(['node_modules/wrangler/bin/wrangler.js', 'd1', 'migrations', 'apply', 'DB', '--remote', '--config', configPath]);
}
run(['node_modules/wrangler/bin/wrangler.js', 'deploy', '--config', configPath,
  ...(process.argv.includes('--dry-run') ? ['--dry-run'] : [])]);

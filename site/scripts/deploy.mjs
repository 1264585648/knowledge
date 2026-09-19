import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Only the locked foundation may be published before real authentication exists.
if (!process.argv.includes('--foundation')) {
  console.error('正式发布已阻止：请先完成真实关注平台接入、Secrets、D1 迁移、私有内容和权限回归。基础版本托管请运行 npm run deploy:foundation。');
  process.exit(1);
}
if (process.env.CONTENT_DIR) {
  throw new Error('Foundation deployment only supports the public example content; unset CONTENT_DIR.');
}
const configPath = 'wrangler.foundation.jsonc';
const config = JSON.parse(readFileSync(configPath, 'utf8'));
if (config.vars?.AUTH_PROVIDER !== 'disabled' || config.assets?.run_worker_first !== true ||
    config.d1_databases?.length || config.assets?.not_found_handling !== 'none') {
  throw new Error('Foundation deployment requires disabled authentication, Worker-first assets, no D1, and no fallback.');
}
function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
// Always rebuild from public examples so old private artifacts cannot be uploaded.
run(['scripts/build.mjs']);
run(['node_modules/wrangler/bin/wrangler.js', 'deploy', '--config', configPath,
  ...(process.argv.includes('--dry-run') ? ['--dry-run'] : [])]);

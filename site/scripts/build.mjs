import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync, rmSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep } from 'node:path';
const production = process.argv.includes('--production');
const source = process.env.CONTENT_DIR;
if (production) {
  if (!source || !existsSync(source)) throw new Error('Production requires an existing private CONTENT_DIR.');
  const repository = realpathSync(resolve('..'));
  const path = relative(repository, realpathSync(source));
  if (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path)) throw new Error('Private content must live outside this public repository.');
}
// Avoid stale content when switching from a private source back to the public example.
rmSync('.astro', { recursive: true, force: true });
rmSync('dist', { recursive: true, force: true });
const result = spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], {
  stdio: 'inherit', env: { ...process.env, CONTENT_MODE: production ? 'private' : 'example' }
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);

import type { Env } from '../../types.ts';
import { inviteProvider } from './providers/invite.ts';
// Legacy identities stay readable. Only implemented adapters are exposed for login.
const recognized = new Set(['invite', 'github', 'wechat']);
export function enabledProviders(env: Env): string[] {
  const raw = env.AUTH_PROVIDERS ?? env.AUTH_PROVIDER ?? 'disabled';
  if (raw === 'disabled') return [];
  const providers = [...new Set(raw.split(',').map(value => value.trim()).filter(Boolean))];
  return providers.every(id => recognized.has(id)) ? providers : [];
}
export function loginProviders(env: Env) {
  return env.DB ? [inviteProvider].filter(provider => enabledProviders(env).includes(provider.id)) : [];
}

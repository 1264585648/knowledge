import type { Env } from '../../types.ts';
import { enabledProviders, getSession, isInviteActive } from '../auth/index.ts';
import type { Principal } from '../auth/index.ts';
export type Access = { ok: true; userId: string } | {
  ok: false; reason: 'not_configured' | 'unauthenticated' | 'verification_required'
};
async function verifyGrant(principal: Principal, env: Env, now: number): Promise<boolean> {
  if (env.ACCESS_POLICY === 'invite') {
    if (principal.provider !== 'invite') return false;
    return isInviteActive(env.DB!, principal.authIdentityId, now);
  }
  const grant = await env.DB!.prepare(`SELECT status, verified_at, valid_until FROM follow_status
    WHERE identity_id = ? AND target = ? LIMIT 1`).bind(principal.authIdentityId, env.FOLLOW_TARGET!)
    .first<{ status: string; verified_at: number; valid_until: number }>();
  return !!grant && grant.status === 'verified' && grant.verified_at <= now && grant.valid_until > now;
}
export async function checkAccess(request: Request, env: Env, now: number): Promise<Access> {
  const providers = enabledProviders(env);
  const policy = env.ACCESS_POLICY ?? 'follow';
  if (!env.DB || !providers.length || !['invite', 'follow'].includes(policy) ||
      (policy === 'follow' && !env.FOLLOW_TARGET?.trim()) ||
      (policy === 'invite' && !providers.includes('invite'))) return { ok: false, reason: 'not_configured' };
  const session = await getSession(request, env, now);
  if (session.kind === 'unavailable') return { ok: false, reason: 'not_configured' };
  if (session.kind === 'anonymous') return { ok: false, reason: 'unauthenticated' };
  if (!await verifyGrant(session.principal, env, now)) return { ok: false, reason: 'verification_required' };
  return { ok: true, userId: session.principal.userId };
}

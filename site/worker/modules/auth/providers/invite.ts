import type { CredentialProvider } from '../contracts.ts';
import { hashInvite, normalizeInvite } from './invite-code.ts';
import type { Database } from '../../../types.ts';
export async function isInviteActive(db: Database, identityId: string, now: number): Promise<boolean> {
  const row = await db.prepare('SELECT status, created_at, expires_at FROM auth_invites WHERE identity_id = ? LIMIT 1')
    .bind(identityId).first<{ status: string; created_at: number; expires_at: number | null }>();
  return !!row && row.status === 'active' && row.created_at <= now &&
    (row.expires_at === null || row.expires_at > now);
}
export const inviteProvider: CredentialProvider = {
  id: 'invite', label: '邀请码登录', kind: 'credential',
  async authenticate(db, credential, now) {
    const code = normalizeInvite(credential);
    if (!code) return null;
    const row = await db.prepare(`
      SELECT i.id AS identity_id, i.user_id FROM auth_invites c
      JOIN identities i ON i.id = c.identity_id JOIN users u ON u.id = i.user_id
      WHERE c.code_hash = ? AND c.status = 'active' AND i.provider = 'invite'
        AND u.status = 'active' AND c.created_at <= ?
        AND (c.expires_at IS NULL OR c.expires_at > ?) LIMIT 1
    `).bind(await hashInvite(code), now, now).first<{ identity_id: string; user_id: string }>();
    return row ? { identityId: row.identity_id, userId: row.user_id, provider: 'invite' } : null;
  }
};

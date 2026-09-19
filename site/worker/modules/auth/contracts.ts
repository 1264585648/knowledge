import type { Database } from '../../types.ts';
export interface Principal {
  userId: string; authIdentityId: string; provider: string;
  authenticatedAt: number; expiresAt: number;
}
export type SessionResult =
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; principal: Principal }
  | { kind: 'unavailable' };
export interface VerifiedIdentity { identityId: string; userId: string; provider: string }
export interface CredentialProvider {
  id: string; label: string; kind: 'credential';
  authenticate(db: Database, credential: string, now: number): Promise<VerifiedIdentity | null>;
}

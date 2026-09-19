// Compatibility facade: authentication and reading grants have separate modules.
export { COOKIE, readToken, hashToken, sessionCookie, clearCookie, issueSession, revokeSession } from './modules/auth/sessions.ts';
export { checkAccess } from './modules/access/index.ts';
export type { Access } from './modules/access/index.ts';

/** Minimal structural binding types; no Node APIs are used by the Worker. */
export interface Statement {
  bind(...values: (string | number | null)[]): Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
}
export interface Database { prepare(sql: string): Statement }
export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB?: Database;
  AUTH_PROVIDER?: string;
  AUTH_PROVIDERS?: string;
  ACCESS_POLICY?: string;
  SESSION_TTL_SECONDS?: string;
  FOLLOW_TARGET?: string;
}
export interface SessionRow {
  user_id: string; user_status: string; provider: string;
  expires_at: number; revoked_at: number | null;
  follow_status: string | null; verified_at: number | null; valid_until: number | null;
}

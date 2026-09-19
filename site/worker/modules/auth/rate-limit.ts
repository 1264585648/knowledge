import type { Database } from '../../types.ts';
import { hashToken } from './sessions.ts';
const WINDOW = 600;
export async function allowLogin(db: Database, request: Request, now: number): Promise<boolean> {
  // Cloudflare supplies the header at the edge. Persist only a window-scoped hash.
  const client = request.headers.get('CF-Connecting-IP') || 'unknown';
  const windowStart = Math.floor(now / WINDOW) * WINDOW;
  const bucket = await hashToken(`login:${windowStart}:${client}`);
  const row = await db.prepare(`
    INSERT INTO auth_rate_limits(bucket, window_start, attempts) VALUES (?, ?, 1)
    ON CONFLICT(bucket) DO UPDATE SET attempts = MIN(attempts + 1, 11)
    RETURNING attempts
  `).bind(bucket, windowStart).first<{ attempts: number }>();
  if (!row) throw new Error('Rate limiter unavailable');
  if (row.attempts === 1) {
    const result = await db.prepare('DELETE FROM auth_rate_limits WHERE window_start < ?').bind(now - 86400).run();
    if (!result.success) throw new Error('Rate limiter cleanup failed');
  }
  return row.attempts <= 10;
}

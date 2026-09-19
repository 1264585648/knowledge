const FORMAT = /^ZY[A-HJ-NP-Z2-9]{32}$/;
export function normalizeInvite(value: string): string | null {
  if (value.length > 128) return null;
  const normalized = value.replace(/[\s-]/g, '').toUpperCase();
  return FORMAT.test(normalized) ? normalized : null;
}
export async function hashInvite(normalized: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`zhiye:invite:v1:${normalized}`));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

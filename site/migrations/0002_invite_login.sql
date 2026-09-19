CREATE TABLE auth_invites (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE CHECK(length(code_hash) = 64),
  identity_id TEXT NOT NULL UNIQUE REFERENCES identities(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'revoked')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER CHECK(expires_at IS NULL OR expires_at > created_at)
);
CREATE TABLE auth_rate_limits (
  bucket TEXT PRIMARY KEY CHECK(length(bucket) = 64),
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK(attempts > 0)
);
CREATE INDEX auth_rate_limits_expiry_idx ON auth_rate_limits(window_start);

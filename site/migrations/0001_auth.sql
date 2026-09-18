PRAGMA foreign_keys = ON;
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at INTEGER NOT NULL
);
CREATE TABLE identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(provider, provider_user_id)
);
CREATE INDEX identities_user_idx ON identities(user_id);
CREATE TABLE follow_status (
  identity_id TEXT NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  target TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('verified','revoked')),
  verified_at INTEGER NOT NULL,
  valid_until INTEGER NOT NULL CHECK(valid_until > verified_at),
  PRIMARY KEY(identity_id, target)
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY CHECK(length(token_hash) = 64),
  identity_id TEXT NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK(expires_at > created_at),
  revoked_at INTEGER
);
CREATE INDEX sessions_identity_idx ON sessions(identity_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE auth_challenges (
  token_hash TEXT PRIMARY KEY CHECK(length(token_hash) = 64),
  provider TEXT NOT NULL,
  binding_hash TEXT NOT NULL CHECK(length(binding_hash) = 64),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK(expires_at > created_at),
  consumed_at INTEGER
);
CREATE INDEX challenges_expiry_idx ON auth_challenges(expires_at);

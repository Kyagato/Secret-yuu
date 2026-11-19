CREATE TABLE accounts (
  email TEXT PRIMARY KEY,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL
);
CREATE TABLE account_sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES accounts(email) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL
);
CREATE INDEX sessions_by_expiry ON account_sessions(expires_at);
CREATE TABLE account_attempts (
  bucket TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at BIGINT NOT NULL
);
CREATE INDEX attempts_by_expiry ON account_attempts(expires_at);

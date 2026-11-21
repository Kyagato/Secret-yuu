ALTER TABLE accounts ADD COLUMN reset_hash TEXT;
ALTER TABLE accounts ADD COLUMN reset_expires BIGINT;
ALTER TABLE accounts ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE account_sessions ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX accounts_by_reset_hash ON accounts(reset_hash);

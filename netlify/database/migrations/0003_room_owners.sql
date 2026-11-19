ALTER TABLE rooms ADD COLUMN owner_key TEXT;
CREATE INDEX rooms_by_owner ON rooms(owner_key, created DESC);

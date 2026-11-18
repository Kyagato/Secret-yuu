CREATE TABLE rooms (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
  category TEXT NOT NULL, created DOUBLE PRECISION NOT NULL
);
CREATE TABLE messages (
  id TEXT PRIMARY KEY, room TEXT NOT NULL REFERENCES rooms(id),
  body TEXT NOT NULL, created DOUBLE PRECISION NOT NULL,
  parent_id TEXT REFERENCES messages(id),
  rowid BIGINT GENERATED ALWAYS AS IDENTITY
);
CREATE INDEX messages_by_room ON messages(room, created, rowid);
CREATE INDEX rooms_by_date ON rooms(created DESC);

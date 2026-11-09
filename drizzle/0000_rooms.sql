CREATE TABLE rooms (id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, category TEXT NOT NULL, created INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE messages (id TEXT PRIMARY KEY, room TEXT NOT NULL REFERENCES rooms(id), body TEXT NOT NULL, created INTEGER NOT NULL);

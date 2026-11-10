ALTER TABLE messages ADD COLUMN parent_id TEXT REFERENCES messages(id);
--> statement-breakpoint
CREATE INDEX messages_room_created ON messages(room, created);

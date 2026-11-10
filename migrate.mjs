import {readFileSync} from 'node:fs';

// Track local migrations separately from hosted D1 migrations.
export function migrateLocal(sqlite) {
  sqlite.exec('CREATE TABLE IF NOT EXISTS _local_migrations (tag TEXT PRIMARY KEY)');
  const journal=JSON.parse(readFileSync(new URL('./drizzle/meta/_journal.json',import.meta.url),'utf8'));
  for(const {tag} of journal.entries){
    if(sqlite.prepare('SELECT tag FROM _local_migrations WHERE tag=?').get(tag))continue;
    sqlite.exec('BEGIN');
    try{
      // Existing installations already have the initial rooms/messages schema.
      const legacy=tag==='0000_rooms'&&sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='rooms'").get();
      if(!legacy)sqlite.exec(readFileSync(new URL('./drizzle/'+tag+'.sql',import.meta.url),'utf8'));
      sqlite.prepare('INSERT INTO _local_migrations VALUES (?)').run(tag);
      sqlite.exec('COMMIT');
    }catch(error){sqlite.exec('ROLLBACK');throw error;}
  }
}

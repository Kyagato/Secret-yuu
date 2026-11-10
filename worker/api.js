const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export default {async fetch(request,env){
 const u=new URL(request.url);
 if(!u.pathname.startsWith('/api/')) return new Response(HTML,{headers:{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
 try{
 if(request.method==='POST' && request.headers.get('Origin')!==u.origin) return json({error:'Permintaan tidak diizinkan.'},403);
 const db=env.DB;
 if(!db)return json({error:'Penyimpanan belum terhubung. Coba lagi nanti.'},503);
 if(u.pathname==='/api/rooms' && request.method==='GET')return json((await db.prepare('SELECT r.*, (SELECT COUNT(*) FROM messages m WHERE m.room=r.id) replies FROM rooms r ORDER BY created DESC LIMIT 100').all()).results);
 if(u.pathname==='/api/rooms' && request.method==='POST'){
 const b=await request.json();
 const category=b.category??'Random';
 if(typeof b.title!=='string'||typeof b.body!=='string'||b.title.trim().length<5||b.title.length>120||b.body.trim().length<10||b.body.length>2000||!['Cerita sehari-hari','Isi hati','Hubungan','Kampus & karier','Random'].includes(category))return json({error:'Periksa judul dan ceritamu.'},400);
 const id=crypto.randomUUID(); await db.prepare('INSERT INTO rooms VALUES (?,?,?,?,?)').bind(id,b.title.trim(),b.body.trim(),category,Date.now()).run();return json({id},201);
 }
 const match=u.pathname.match(/^\/api\/rooms\/([a-z0-9-]+)\/messages$/);
 if(match){
 const room=await db.prepare('SELECT * FROM rooms WHERE id=?').bind(match[1]).first();if(!room)return json({error:'Percakapan tidak ditemukan.'},404);
 if(request.method==='GET')return json({room,messages:(await db.prepare('SELECT m.id,m.body,m.created,m.parent_id,p.body AS parent_body FROM messages m LEFT JOIN messages p ON p.id=m.parent_id AND p.room=m.room WHERE m.room=? ORDER BY m.created, m.rowid LIMIT 500').bind(match[1]).all()).results});
 if(request.method==='POST'){
 const b=await request.json();
 if(typeof b.body!=='string'||!b.body.trim()||b.body.length>2000)return json({error:'Balasan perlu berisi 1–2.000 karakter.'},400);
 const parentId=b.parent_id??null;
 if(parentId!==null){
 if(typeof parentId!=='string'||!parentId||parentId.length>100)return json({error:'Komentar tujuan tidak valid.'},400);
 const parent=await db.prepare('SELECT id FROM messages WHERE id=? AND room=?').bind(parentId,room.id).first();
 if(!parent)return json({error:'Komentar yang ingin dibalas tidak ditemukan di percakapan ini.'},400);
 }
 const id=crypto.randomUUID();
 await db.prepare('INSERT INTO messages (id,room,body,created,parent_id) VALUES (?,?,?,?,?)').bind(id,room.id,b.body.trim(),Date.now(),parentId).run();
 return json({ok:true,id},201);
 }
 }
 return json({error:'Tidak ditemukan.'},404);
 }catch(e){return json({error:'Belum bisa memuat percakapan. Coba lagi sebentar.'},500);}
}};

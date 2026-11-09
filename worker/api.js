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
 if(typeof b.title!=='string'||typeof b.body!=='string'||b.title.trim().length<5||b.title.length>120||b.body.trim().length<10||b.body.length>2000||!['Cerita sehari-hari','Isi hati','Hubungan','Kampus & karier','Random'].includes(b.category))return json({error:'Periksa judul, cerita, dan topikmu.'},400);
 const id=crypto.randomUUID(); await db.prepare('INSERT INTO rooms VALUES (?,?,?,?,?)').bind(id,b.title.trim(),b.body.trim(),b.category,Date.now()).run();return json({id},201);
 }
 const match=u.pathname.match(/^\/api\/rooms\/([a-z0-9-]+)\/messages$/);
 if(match){
 const room=await db.prepare('SELECT * FROM rooms WHERE id=?').bind(match[1]).first();if(!room)return json({error:'Percakapan tidak ditemukan.'},404);
 if(request.method==='GET')return json({room,messages:(await db.prepare('SELECT id,body,created FROM messages WHERE room=? ORDER BY created LIMIT 500').bind(match[1]).all()).results});
 if(request.method==='POST'){const b=await request.json();if(typeof b.body!=='string'||!b.body.trim()||b.body.length>2000)return json({error:'Balasan perlu berisi 1–2.000 karakter.'},400);await db.prepare('INSERT INTO messages VALUES (?,?,?,?)').bind(crypto.randomUUID(),room.id,b.body.trim(),Date.now()).run();return json({ok:true},201);}
 }
 return json({error:'Tidak ditemukan.'},404);
 }catch(e){return json({error:'Belum bisa memuat percakapan. Coba lagi sebentar.'},500);}
}};

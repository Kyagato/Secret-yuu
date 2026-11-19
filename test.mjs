import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import worker from './dist/server/index.js';
import {migrateLocal} from './migrate.mjs';
const sqlite=new DatabaseSync(':memory:');migrateLocal(sqlite);
const DB={prepare(sql){let args=[];const s=sqlite.prepare(sql);return {bind(...a){args=a;return this},async all(){return {results:s.all(...args)}},async first(){return s.get(...args)},async run(){return s.run(...args)}}}};
const call=(path,body,guest='a'.repeat(64),cookie='')=>worker.fetch(new Request('https://r4hasiakuu.test/api/'+path,{
 method:body?'POST':'GET',headers:{Origin:'https://r4hasiakuu.test','Content-Type':'application/json','X-Guest-Key':guest,cookie},
 body:body?JSON.stringify(body):undefined
}),{DB});
let r=await call('rooms',{title:'Cerita pertama',body:'Hari ini saya ingin bercerita.'});assert.equal(r.status,201);const {id}=await r.json();
r=await call('rooms/'+id+'/messages',{body:'Terima kasih sudah berbagi.'});assert.equal(r.status,201);
const data=await(await call('rooms/'+id+'/messages')).json();assert.equal(data.messages.length,1);assert.equal(data.messages[0].body,'Terima kasih sudah berbagi.');assert.equal(data.messages[0].name,undefined);
assert.equal((await(await call('rooms')).json())[0].replies,1);
assert.equal((await call('rooms',{title:'a',body:'b',category:'x'})).status,400);
assert.equal((await call('rooms/'+id+'/messages',{body:' '})).status,400);
assert.deepEqual(await (await call('rooms',null,'b'.repeat(64))).json(),[]);
assert.equal((await call('rooms/'+id+'/messages',{body:'Dari tautan'},'b'.repeat(64))).status,201);
assert.deepEqual(await (await call('rooms',null,'b'.repeat(64))).json(),[]);
assert.equal('owner_key' in data.room,false);
const parent=data.messages[0];
r=await call('rooms/'+id+'/messages',{body:'Saya setuju dengan komentarmu.',parent_id:parent.id});assert.equal(r.status,201);
const child=await r.json();
let thread=await(await call('rooms/'+id+'/messages')).json();
assert.equal(thread.messages[2].parent_id,parent.id);assert.equal(thread.messages[2].parent_body,parent.body);
assert.equal(thread.messages[0].parent_id,null);
assert.equal((await call('rooms/'+id+'/messages',{body:'Balasan lanjutan',parent_id:child.id})).status,201);
assert.equal((await call('rooms/'+id+'/messages',{body:'Tidak ada',parent_id:'missing'})).status,400);
assert.equal((await call('rooms/'+id+'/messages',{body:'Tidak valid',parent_id:123})).status,400);
const other=await(await call('rooms',{title:'Cerita lainnya',body:'Ini percakapan yang berbeda.',category:'Random'})).json();
assert.equal((await call('rooms/'+other.id+'/messages',{body:'Salah ruang',parent_id:parent.id})).status,400);
assert.equal((await(await call('rooms')).json()).find(r=>r.id===id).replies,4);
// Upgrade a populated database from the previous version without losing comments.
const legacy=new DatabaseSync(':memory:');legacy.exec(readFileSync('drizzle/0000_rooms.sql','utf8'));
legacy.prepare('INSERT INTO rooms VALUES (?,?,?,?,?)').run('old','Judul lama','Cerita lama','Random',1);
legacy.prepare('INSERT INTO messages VALUES (?,?,?,?)').run('old-comment','old','Komentar lama',2);
migrateLocal(legacy);migrateLocal(legacy);
assert.equal(legacy.prepare('SELECT body,parent_id FROM messages').get().body,'Komentar lama');
assert.equal(legacy.prepare('SELECT parent_id FROM messages').get().parent_id,null);
console.log('PASS: anonymous comments, targeted replies, nested replies, invalid targets, cross-room protection, legacy migration.');

const { accountApi } = await import('./account-api.mjs');
const credentials = {email:'Test@Example.test', password:'Testing123'};
const origin = 'https://r4hasiakuu.test';
const accountCall = (path, body, cookie = '', source = origin) => accountApi(
  new Request(origin + '/api/account/' + path, {
    method: body ? 'POST' : 'GET', headers: {origin:source, cookie},
    body: body ? JSON.stringify(body) : undefined
  }), DB, 'test-client'
);
const signup = await accountCall('register', credentials);
assert.equal(signup.status, 201);
const cookie = signup.headers.get('set-cookie').split(';')[0];
const privateRoom=await(await call('rooms',{title:'Milik akun',body:'Hanya pada daftar saya.'},'',cookie)).json();
assert.deepEqual((await(await call('rooms',null,'b'.repeat(64),cookie)).json()).map(r=>r.id),[privateRoom.id]);
assert.deepEqual(await(await call('rooms',null,'')).json(),[]);
assert.equal((await call('rooms/'+privateRoom.id+'/messages',undefined,'')).status,200);
const secondSignup = await accountCall('register', { ...credentials, email:'second@example.test' });
const secondCookie = secondSignup.headers.get('set-cookie').split(';')[0];
const sameBrowser = 'b'.repeat(64);
const secondRoom = await (await call('rooms', {title:'Milik kedua',body:'Cerita dari akun kedua.'}, sameBrowser, secondCookie)).json();
const sharedPath = 'rooms/' + secondRoom.id + '/messages';
assert.equal((await call(sharedPath, {body:'Balasan tanpa login'}, '')).status,201);
assert.equal((await (await call(sharedPath, undefined, '')).json()).messages[0].body,'Balasan tanpa login');
for (const [session, expected] of [[cookie,[privateRoom.id]], [secondCookie,[secondRoom.id]], ['',[]]]) {
  const feed = await (await call('rooms', null, sameBrowser, session)).json();
  assert.deepEqual(feed.map(room => room.id), expected);
}
assert.match(signup.headers.get('set-cookie'), /HttpOnly; SameSite=Lax; Max-Age=\d+; Secure/);
assert.equal((await accountCall('register', credentials)).status, 409);
assert.equal((await accountCall('login', {...credentials,password:'wrong'})).status, 401);
assert.equal((await accountCall('login', credentials)).status, 200);
assert.equal((await (await accountCall('session', null, cookie)).json()).user.email, 'test@example.test');
assert.equal((await accountCall('logout', {}, cookie, 'https://example.test')).status, 403);
assert.equal((await accountCall('logout', {}, cookie)).status, 200);
assert.equal((await (await accountCall('session', null, cookie)).json()).user, null);
console.log('PASS: register, duplicate email, credentials, session cookie, origin check, logout.');

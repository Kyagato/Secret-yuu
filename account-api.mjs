import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const hash = value => createHash('sha256').update(value).digest('hex');
const lifetime = 7 * 24 * 3600;
const dummySalt = randomBytes(16).toString('hex');
const passwordKey = (password, salt) =>
  derive(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });

async function createAccount(db, email, password) {
  const salt = randomBytes(16).toString('hex');
  const key = await passwordKey(password, salt);
  return db.prepare('INSERT INTO accounts(email,salt,password_hash) VALUES(?,?,?) ON CONFLICT(email) DO NOTHING RETURNING email')
    .bind(email, salt, key.toString('hex')).first();
}

export async function seedLocalDemo(db) {
  const email = 'demo@example.test';
  if (!await db.prepare('SELECT email FROM accounts WHERE email=?').bind(email).first()) {
    await createAccount(db, email, 'Cerita123');
  }
}

function reply(data, status = 200, cookie) {
  const headers = { 'Cache-Control': 'no-store' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return Response.json(data, { status, headers });
}

async function allowAttempt(db, key, limit, now) {
  const row = await db.prepare(
    'INSERT INTO account_attempts(bucket,attempts,expires_at) VALUES(?,1,?) ' +
    'ON CONFLICT(bucket) DO UPDATE SET attempts=account_attempts.attempts+1 RETURNING attempts'
  ).bind(hash(key + ':' + Math.floor(now / 900000)), now + 900000).first();
  return row.attempts <= limit;
}

export async function accountApi(request, db, ip) {
  const url = new URL(request.url);
  const action = url.pathname.slice('/api/account/'.length);
  const secure = url.protocol === 'https:';
  const name = secure ? '__Host-r4session' : 'r4session';
  const cookie = (value, age) => name + '=' + value + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + age + (secure ? '; Secure' : '');
  const value = (request.headers.get('cookie') || '').split(/;\s*/).find(part => part.startsWith(name + '='))?.slice(name.length + 1);
  const digest = value && /^[0-9a-f]{64}$/.test(value) ? hash(value) : null;
  const now = Date.now();
  try {
    if (request.method === 'GET' && action === 'session') {
      const user = digest ? await db.prepare('SELECT email FROM account_sessions WHERE token_hash=? AND expires_at>?').bind(digest, now).first() : null;
      return reply({ user: user || null });
    }
    if (request.method !== 'POST' || request.headers.get('origin') !== url.origin) return reply({error:'Permintaan tidak diizinkan.'},403);
    if (action === 'logout') {
      if (digest) await db.prepare('DELETE FROM account_sessions WHERE token_hash=?').bind(digest).run();
      return reply({user:null}, 200, cookie('', 0));
    }
    if (!['login','register'].includes(action)) return reply({error:'Tidak ditemukan.'},404);
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = body?.password;
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || !password.length || Buffer.byteLength(password) > 1024) {
      return reply({error:'Periksa email dan kata sandi.'},400);
    }
    if (action === 'register' && password.length < 8) return reply({error:'Gunakan kata sandi minimal 8 karakter.'},400);
    await db.prepare('DELETE FROM account_attempts WHERE expires_at<=?').bind(now).run();
    if (!await allowAttempt(db, 'ip:' + ip, 60, now) || !await allowAttempt(db, action + ':' + email, 12, now)) {
      return reply({error:'Terlalu banyak percobaan. Coba lagi dalam 15 menit.'},429);
    }
    if (action === 'register') {
      if (!await createAccount(db, email, password)) return reply({error:'Pendaftaran gagal. Jika sudah punya akun, pilih Masuk.'},409);
    } else {
      const account = await db.prepare('SELECT salt,password_hash FROM accounts WHERE email=?').bind(email).first();
      const key = await passwordKey(password, account?.salt || dummySalt);
      if (!account || !timingSafeEqual(key, Buffer.from(account.password_hash,'hex'))) {
        return reply({error:'Email atau kata sandi salah.'},401);
      }
    }
    const token = randomBytes(32).toString('hex');
    await db.prepare('DELETE FROM account_sessions WHERE expires_at<=?').bind(now).run();
    await db.prepare('INSERT INTO account_sessions(token_hash,email,expires_at) VALUES(?,?,?)').bind(hash(token),email,now+lifetime*1000).run();
    return reply({user:{email}}, action === 'register' ? 201 : 200, cookie(token,lifetime));
  } catch {
    return reply({error:'Layanan akun belum tersedia. Coba lagi sebentar.'},503);
  }
}

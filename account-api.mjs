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

export async function accountApi(request, db, ip, background) {
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
      const user = digest ? await db.prepare('SELECT s.email FROM account_sessions s JOIN accounts a ON a.email=s.email AND a.session_version=s.session_version WHERE s.token_hash=? AND s.expires_at>?').bind(digest, now).first() : null;
      return reply({ user: user || null });
    }
    if (request.method !== 'POST' || request.headers.get('origin') !== url.origin) return reply({error:'Permintaan tidak diizinkan.'},403);
    if (action === 'logout') {
      if (digest) await db.prepare('DELETE FROM account_sessions WHERE token_hash=?').bind(digest).run();
      return reply({user:null}, 200, cookie('', 0));
    }
    if (action === 'forgot' || action === 'reset') return await recoverPassword(action, request, db, ip, background);
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
    let sessionVersion = 0;
    if (action === 'register') {
      if (!await createAccount(db, email, password)) return reply({error:'Pendaftaran gagal. Jika sudah punya akun, pilih Masuk.'},409);
    } else {
      const account = await db.prepare('SELECT salt,password_hash,session_version FROM accounts WHERE email=?').bind(email).first();
      const key = await passwordKey(password, account?.salt || dummySalt);
      if (!account || !timingSafeEqual(key, Buffer.from(account.password_hash,'hex'))) {
        return reply({error:'Email atau kata sandi salah.'},401);
      }
      sessionVersion = account.session_version;
    }
    const token = randomBytes(32).toString('hex');
    await db.prepare('DELETE FROM account_sessions WHERE expires_at<=?').bind(now).run();
    await db.prepare('INSERT INTO account_sessions(token_hash,email,expires_at,session_version) VALUES(?,?,?,?)').bind(hash(token),email,now+lifetime*1000,sessionVersion).run();
    return reply({user:{email}}, action === 'register' ? 201 : 200, cookie(token,lifetime));
  } catch {
    return reply({error:'Layanan akun belum tersedia. Coba lagi sebentar.'},503);
  }
}

async function recoverPassword(action, request, db, ip, background) {
  const body = await request.json().catch(() => null);
  const now = Date.now();
  await db.prepare('DELETE FROM account_attempts WHERE expires_at<=?').bind(now).run();
  if (!await allowAttempt(db, action + ':ip:' + ip, 20, now)) {
    return reply({error:'Terlalu banyak permintaan. Coba lagi dalam 15 menit.'}, 429);
  }
  if (action === 'reset') {
    const {token, password} = body || {};
    const invalid = () => reply({error:'Tautan sudah kedaluwarsa atau tidak berlaku. Minta tautan baru.'}, 400);
    if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return invalid();
    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 1024) {
      return reply({error:'Gunakan kata sandi minimal 8 karakter dan maksimal 1024 byte.'}, 400);
    }
    const tokenHash = hash(token);
    if (!await db.prepare('SELECT 1 FROM accounts WHERE reset_hash=? AND reset_expires>?').bind(tokenHash, now).first()) return invalid();
    const salt = randomBytes(16).toString('hex');
    const key = await passwordKey(password, salt);
    const updated = await db.prepare('UPDATE accounts SET salt=?, password_hash=?, reset_hash=NULL, reset_expires=NULL, session_version=session_version+1 WHERE reset_hash=? AND reset_expires>? RETURNING email')
      .bind(salt, key.toString('hex'), tokenHash, Date.now()).first();
    return updated ? reply({ok:true}) : invalid();
  }

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({error:'Masukkan alamat email yang valid.'},400);
  const {RESEND_API_KEY, RESET_EMAIL_FROM, RESET_SITE_URL} = process.env;
  if (!RESEND_API_KEY || !RESET_EMAIL_FROM || !RESET_SITE_URL) return reply({error:'Pengiriman email pemulihan belum diaktifkan.'},503);
  const link = new URL('/', RESET_SITE_URL);
  if (link.protocol !== 'https:' && !(link.protocol === 'http:' && link.hostname === 'localhost')) return reply({error:'Alamat pemulihan belum dikonfigurasi.'},503);
  const token = randomBytes(32).toString('hex');
  link.hash = 'reset=' + token;
  if (await allowAttempt(db, 'forgot:email:' + email, 3, now)) {
    const tokenHash = hash(token);
    const account = await db.prepare('UPDATE accounts SET reset_hash=?, reset_expires=? WHERE email=? RETURNING email')
      .bind(tokenHash, now + 15*60000, email).first();
    if (account) {
      const deliver = async () => {
        try {
          const response = await fetch('https://api.resend.com/emails', {
            method:'POST', headers:{Authorization:'Bearer ' + RESEND_API_KEY, 'Content-Type':'application/json'},
            signal:AbortSignal.timeout(10000),
            body:JSON.stringify({from:RESET_EMAIL_FROM,to:[email],subject:'Atur ulang kata sandi Chat2Anonym',
              text:'Buka tautan ini untuk membuat kata sandi baru dalam 15 menit:\n\n' + link.href + '\n\nJika kamu tidak memintanya, abaikan email ini.'})
          });
          if (!response.ok) throw new Error();
        } catch {
          console.error('Pengiriman email pemulihan gagal. Periksa konfigurasi layanan email.');
          await db.prepare('UPDATE accounts SET reset_hash=NULL, reset_expires=NULL WHERE reset_hash=?').bind(tokenHash).run();
        }
      };
      if (background) background(deliver());
      else await deliver();
    }
  }
  return reply({ok:true});
}

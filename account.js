import { createClient } from '@supabase/supabase-js';

const auth = AUTH_URL && AUTH_PUBLIC_KEY
  ? createClient(AUTH_URL, AUTH_PUBLIC_KEY, { auth: { flowType: 'pkce' } }).auth
  : null;
const byId = id => document.getElementById(id);
const dialog = byId('accountDialog');
const form = byId('accountForm');
const password = byId('loginPassword');
const email = byId('loginEmail');
const emailInput = email.shadowRoot.querySelector('input');
const passwordInput = password.shadowRoot.querySelector('input');
emailInput.required = passwordInput.required = true;
form.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.isComposing && [email, password].includes(event.target)) {
    event.preventDefault();
    if (!byId('authSubmit').disabled) form.requestSubmit();
  }
});
form.addEventListener('reset', () => { email.value = password.value = ''; });
const notice = byId('accountStatus');
const controls = ['authSubmit', 'signOut'];
let user = null;
let registering = false;
let pending = false;
const demo = LOCAL_DEMO && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const demoEmail = 'demo@example.test';
if (demo && sessionStorage.getItem('demo-login') === '1') user = { email: demoEmail };

function accountHint() {
  if (demo) return registering ? 'Pendaftaran memerlukan koneksi Supabase.' : 'Akun tes lokal: demo@example.test · Kata sandi: Cerita123';
  if (!auth) return 'Login belum diaktifkan untuk website ini.';
  return registering ? 'Gunakan kata sandi minimal 8 karakter.' : '';
}

function renderAccount() {
  byId('accountOpen').textContent = user ? 'Akun saya' : 'Masuk';
  byId('registerOpen').hidden = Boolean(user);
  byId('accountTitle').textContent = user ? 'Akun saya' : registering ? 'Daftar akun' : 'Masuk';
  byId('accountGuest').hidden = Boolean(user);
  byId('accountMember').hidden = !user;
  byId('memberEmail').textContent = user?.email || '';
  passwordInput.autocomplete = registering ? 'new-password' : 'current-password';
  passwordInput.minLength = registering ? 8 : 1;
  byId('authSubmit').textContent = registering ? 'Daftar dengan email' : 'Masuk dengan email';
  byId('accountGuest').classList.toggle('is-registering', registering);
  byId('modeLogin').setAttribute('aria-pressed', String(!registering));
  byId('modeRegister').setAttribute('aria-pressed', String(registering));
  byId('modeLogin').disabled = byId('modeRegister').disabled = pending;
  for (const id of controls) byId(id).disabled = pending || !auth;
  if (demo) {
    byId('authSubmit').disabled = registering;
    byId('signOut').disabled = false;
  }
}

async function perform(action) {
  if (pending || !auth) return;
  pending = true;
  notice.textContent = 'Memproses…';
  renderAccount();
  try {
    notice.textContent = await action();
  } catch (error) {
    const reasons = {
      invalid_credentials: 'Email atau kata sandi salah.',
      email_not_confirmed: 'Konfirmasi email melalui tautan di kotak masukmu.',
      weak_password: 'Gunakan kata sandi yang lebih kuat.',
      over_email_send_rate_limit: 'Tunggu sebentar sebelum meminta email lagi.'
    };
    notice.textContent = reasons[error.code] || 'Autentikasi belum berhasil. Periksa koneksi atau coba lagi nanti.';
  } finally {
    pending = false;
    renderAccount();
  }
}

const redirectTo = location.origin + location.pathname;
let openTimer;
function openAccount(isRegistration) {
  registering = isRegistration;
  if (!pending) notice.textContent = user ? '' : accountHint();
  renderAccount();
  clearTimeout(openTimer);
  const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280;
  openTimer = setTimeout(() => { if (!dialog.open) dialog.showModal(); }, delay);
}
byId('accountOpen').onclick = () => openAccount(false);
byId('registerOpen').onclick = () => openAccount(true);
dialog.addEventListener('close', () => { password.value = ''; });
function switchMode(next) {
  if (pending || registering === next) return;
  registering = next;
  password.value = '';
  notice.textContent = accountHint();
  renderAccount();
  const panel = byId('accountPanel');
  for (const animation of panel.getAnimations()) animation.cancel();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    panel.animate([
      { transform: `translateX(${next ? '' : '-'}65%)`, opacity: 0.15 },
      { transform: 'translateX(0)', opacity: 1 }
    ], { duration: 320, easing: 'cubic-bezier(.22,.8,.25,1)' });
  }
}
byId('modeLogin').onclick = () => switchMode(false);
byId('modeRegister').onclick = () => switchMode(true);
form.onsubmit = event => {
  event.preventDefault();
  if (!emailInput.reportValidity() || !passwordInput.reportValidity()) return;
  if (demo) {
    if (registering) return;
    if (byId('loginEmail').value.trim().toLowerCase() !== demoEmail || password.value !== 'Cerita123') {
      notice.textContent = 'Email atau kata sandi salah.';
      return;
    }
    user = { email: demoEmail };
    sessionStorage.setItem('demo-login', '1');
    password.value = '';
    notice.textContent = 'Kamu masuk dengan akun tes lokal.';
    renderAccount();
    return;
  }
  perform(async () => {
    const credentials = { email: byId('loginEmail').value.trim(), password: password.value };
    const result = registering
      ? await auth.signUp({ ...credentials, options: { emailRedirectTo: redirectTo } })
      : await auth.signInWithPassword(credentials);
    if (result.error) throw result.error;
    password.value = '';
    return result.data.session ? 'Kamu sudah masuk.' : 'Periksa kotak masuk atau spam untuk tautan konfirmasi.';
  });
};
byId('signOut').onclick = () => {
  if (demo) {
    sessionStorage.removeItem('demo-login');
    user = null;
    form.reset();
    notice.textContent = 'Kamu sudah keluar.';
    renderAccount();
    return;
  }
  return perform(async () => {
  const { error } = await auth.signOut({ scope: 'local' });
  if (error) throw error;
  form.reset();
  registering = false;
  return 'Kamu sudah keluar.';
  });
};
auth?.onAuthStateChange((_event, session) => {
  user = session?.user ?? null;
  renderAccount();
});
renderAccount();

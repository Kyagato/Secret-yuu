import { createClient } from '@supabase/supabase-js';

const auth = AUTH_URL && AUTH_PUBLIC_KEY
  ? createClient(AUTH_URL, AUTH_PUBLIC_KEY, { auth: { flowType: 'pkce' } }).auth
  : null;
const byId = id => document.getElementById(id);
const dialog = byId('accountDialog');
const form = byId('accountForm');
const password = byId('loginPassword');
const notice = byId('accountStatus');
const controls = ['googleLogin', 'authSubmit', 'accountSwitch', 'signOut'];
let user = null;
let registering = false;
let pending = false;

function renderAccount() {
  byId('accountOpen').textContent = user ? 'Akun saya' : 'Masuk';
  byId('registerOpen').hidden = Boolean(user);
  byId('accountTitle').textContent = user ? 'Akun saya' : registering ? 'Daftar akun' : 'Masuk';
  byId('accountGuest').hidden = Boolean(user);
  byId('accountMember').hidden = !user;
  byId('memberEmail').textContent = user?.email || '';
  password.autocomplete = registering ? 'new-password' : 'current-password';
  password.minLength = registering ? 8 : 1;
  byId('authSubmit').textContent = registering ? 'Daftar dengan email' : 'Masuk dengan email';
  byId('accountSwitch').textContent = registering ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar';
  for (const id of controls) byId(id).disabled = pending || (!auth && id !== 'accountSwitch');
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
function openAccount(isRegistration) {
  registering = isRegistration;
  if (!pending) notice.textContent = !auth ? 'Login belum diaktifkan untuk website ini.'
    : registering ? 'Gunakan kata sandi minimal 8 karakter.' : '';
  renderAccount();
  dialog.showModal();
}
byId('accountOpen').onclick = () => openAccount(false);
byId('registerOpen').onclick = () => openAccount(true);
dialog.addEventListener('close', () => { password.value = ''; });
byId('accountSwitch').onclick = () => {
  registering = !registering;
  password.value = '';
  notice.textContent = !auth ? 'Login belum diaktifkan untuk website ini.'
    : registering ? 'Gunakan kata sandi minimal 8 karakter.' : '';
  renderAccount();
};
form.onsubmit = event => {
  event.preventDefault();
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
byId('googleLogin').onclick = () => perform(async () => {
  const { error } = await auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) throw error;
  return 'Membuka Google…';
});
byId('signOut').onclick = () => perform(async () => {
  const { error } = await auth.signOut({ scope: 'local' });
  if (error) throw error;
  form.reset();
  registering = false;
  return 'Kamu sudah keluar.';
});
auth?.onAuthStateChange((_event, session) => {
  user = session?.user ?? null;
  renderAccount();
});
renderAccount();

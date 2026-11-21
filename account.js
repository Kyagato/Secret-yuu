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
const controls = ['authSubmit', 'signOut', 'forgotOpen', 'recoverySubmit', 'recoveryBack'];
let recovery = '';
let resetToken = '';
let user = null;
let registering = false;
let pending = false;
function accountHint() {
  return registering ? 'Gunakan kata sandi minimal 8 karakter.' : '';
}

function renderAccount() {
  byId('accountOpen').textContent = user ? 'Akun saya' : 'Masuk';
  byId('registerOpen').hidden = Boolean(user);
  byId('accountTitle').textContent = user ? 'Akun saya' : registering ? 'Daftar akun' : 'Masuk';
  byId('accountGuest').hidden = Boolean(user || recovery);
  byId('forgotOpen').hidden = registering;
  byId('recoveryPanel').hidden = !recovery;
  if (recovery) byId('accountTitle').textContent = recovery === 'reset' ? 'Buat kata sandi baru' : 'Lupa kata sandi';
  byId('accountMember').hidden = !user || !!recovery;
  byId('memberEmail').textContent = user?.email || '';
  passwordInput.autocomplete = registering ? 'new-password' : 'current-password';
  passwordInput.minLength = registering ? 8 : 1;
  byId('authSubmit').textContent = registering ? 'Daftar dengan email' : 'Masuk dengan email';
  byId('accountGuest').classList.toggle('is-registering', registering);
  byId('modeLogin').setAttribute('aria-pressed', String(!registering));
  byId('modeRegister').setAttribute('aria-pressed', String(registering));
  byId('modeLogin').disabled = byId('modeRegister').disabled = pending;
  for (const id of controls) byId(id).disabled = pending;
}

async function perform(action) {
  if (pending) return;
  pending = true;
  notice.textContent = 'Memproses…';
  renderAccount();
  try {
    notice.textContent = await action();
  } catch (error) {
    notice.textContent = error.message || 'Layanan akun belum tersedia.';
  } finally {
    pending = false;
    renderAccount();
  }
}

async function requestAccountData(action, body) {
  const response = await fetch('/api/account/' + action, body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  } : { cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new Error(data?.error || 'Layanan akun belum tersedia.');
  }
  return data;
}

async function accountRequest(action, body) {
  const data = await requestAccountData(action, body);
  user = data.user;
  if (action !== 'session') window.dispatchEvent(new Event('account-changed'));
}
let afterStoryLogin;
let checkingStorySession = false;
window.requireStoryAccount = async function(onReady) {
  if (checkingStorySession) return;
  checkingStorySession = true;
  try {
    await initialSession;
    await accountRequest('session');
    renderAccount();
    if (user) { onReady(); return; }
    afterStoryLogin = onReady;
    openAccount(false);
    notice.textContent = 'Masuk atau pilih Daftar untuk membuat cerita.';
  } catch {
    byId('toast').show('Sesi belum bisa diperiksa. Coba lagi sebentar.');
  } finally {
    checkingStorySession = false;
  }
};
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
dialog.addEventListener('close', () => { resetRecovery(); password.value = ''; afterStoryLogin = null; });
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
  perform(async () => {
    await accountRequest(registering ? 'register' : 'login', { email: email.value, password: password.value });
    password.value = '';
    if (afterStoryLogin && dialog.open) {
      const resume = afterStoryLogin;
      afterStoryLogin = null;
      dialog.close();
      resume();
    }
    return registering ? 'Akun berhasil dibuat.' : 'Kamu sudah masuk.';
  });
};
byId('signOut').onclick = () => perform(async () => {
  await accountRequest('logout', {});
  form.reset();
  registering = false;
  return 'Kamu sudah keluar.';
});
pending = true;
renderAccount();
const initialSession = accountRequest('session').catch(() => {}).finally(() => {
  pending = false;
  renderAccount();
});

function resetRecovery() {
  recovery = '';
  resetToken = '';
  byId('recoveryForm').reset();
}

function openRecovery(mode) {
  recovery = mode;
  const resetting = mode === 'reset';
  byId('recoveryEmailFields').hidden = resetting;
  byId('recoveryEmail').disabled = resetting;
  byId('recoveryPasswordFields').hidden = !resetting;
  byId('recoveryPassword').disabled = byId('recoveryConfirm').disabled = !resetting;
  byId('recoverySubmit').textContent = resetting ? 'Simpan kata sandi baru' : 'Kirim tautan pemulihan';
  byId('recoveryEmail').value = email.value;
  password.value = '';
  notice.textContent = resetting ? 'Gunakan minimal 8 karakter.' : '';
  renderAccount();
  if (!dialog.open) dialog.showModal();
  byId(resetting ? 'recoveryPassword' : 'recoveryEmail').focus();
}

byId('forgotOpen').onclick = () => openRecovery('forgot');
byId('recoveryBack').onclick = () => {
  resetRecovery();
  registering = false;
  notice.textContent = '';
  renderAccount();
  if (!user) email.focus();
};
byId('recoveryForm').onsubmit = event => {
  event.preventDefault();
  if (recovery === 'forgot') {
    perform(async () => {
      await requestAccountData('forgot', { email: byId('recoveryEmail').value });
      return 'Jika email terdaftar, cek kotak masuk atau spam untuk tautan pemulihan.';
    });
  } else if (recovery === 'reset') {
    const next = byId('recoveryPassword').value;
    if (next !== byId('recoveryConfirm').value) {
      notice.textContent = 'Kedua kata sandi harus sama.';
      byId('recoveryConfirm').focus();
      return;
    }
    perform(async () => {
      await requestAccountData('reset', {token:resetToken, password:next});
      resetRecovery();
      registering = false;
      await accountRequest('session');
      window.dispatchEvent(new Event('account-changed'));
      return 'Kata sandi berhasil diganti. Silakan masuk dengan kata sandi baru.';
    });
  }
};
if (location.hash.startsWith('#reset=')) {
  resetToken = location.hash.slice(7);
  history.replaceState(history.state, '', location.pathname + location.search);
  openRecovery('reset');
}

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
function accountHint() {
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

async function accountRequest(action, body) {
  const response = await fetch('/api/account/' + action, body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  } : { cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || !('user' in data)) {
    throw new Error(data?.error || 'Layanan akun belum tersedia.');
  }
  user = data.user;
  if (action !== 'session') window.dispatchEvent(new Event('account-changed'));
}
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
  perform(async () => {
    await accountRequest(registering ? 'register' : 'login', { email: email.value, password: password.value });
    password.value = '';
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
accountRequest('session').catch(() => {}).finally(() => {
  pending = false;
  renderAccount();
});

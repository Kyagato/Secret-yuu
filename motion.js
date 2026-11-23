// Keep the native button stationary. Only its painted face and lettering move.
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const buttonSelector = 'button.primary, button.share-button, button.textbtn, button.close, button[data-room]';
  const reactions = new WeakMap();
  const receipts = new WeakMap();

  function preparePrimary(button) {
    if (!button.classList.contains('primary') || button.classList.contains('manga-primary')) return;

    const style = getComputedStyle(button);
    const face = document.createElement('i');
    face.className = 'manga-face';
    face.setAttribute('aria-hidden', 'true');
    face.style.background = style.background;
    face.style.border = style.border;
    face.style.borderRadius = style.borderRadius;
    face.style.boxShadow = style.boxShadow;
    face.style.inset = [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth]
      .map(width => `-${width}`).join(' ');

    const label = document.createElement('span');
    label.className = 'manga-label';
    label.append(...Array.from(button.childNodes));
    button.append(face, label);
    button.classList.add('manga-primary');
  }

  function targetButton(event) {
    if (!(event.target instanceof Element)) return null;
    const button = event.target.closest(buttonSelector);
    return button && !button.matches(':disabled') ? button : null;
  }

  function removeReaction(button) {
    const previous = reactions.get(button);
    if (!previous) return;
    clearTimeout(previous.timer);
    previous.burst.remove();
    button.classList.remove('manga-spring');
    reactions.delete(button);
  }

  function preparePress(event) {
    if (reducedMotion.matches) return;
    const button = targetButton(event);
    if (button) {
      removeReaction(button);
      preparePrimary(button);
    }
  }

  function playRelease(event) {
    if (reducedMotion.matches) return;
    const button = targetButton(event);
    if (!button) return;
    removeReaction(button);
    preparePrimary(button);

    const primary = button.classList.contains('primary');
    const burst = document.createElement('i');
    burst.className = primary ? 'manga-burst' : 'manga-burst manga-burst-small';
    burst.setAttribute('aria-hidden', 'true');
    const strokes = primary ? 6 : 3;
    for (let index = 0; index < strokes; index++) {
      burst.append(document.createElement('i'));
    }
    button.append(burst);
    button.classList.add('manga-spring');
    const timer = setTimeout(() => removeReaction(button), 460);
    reactions.set(button, {burst, timer});
  }

  // Capture clicks before form handlers disable a pending submit button.
  document.addEventListener('pointerdown', event => {
    if (event.isPrimary && event.button === 0) preparePress(event);
  }, true);
  document.addEventListener('keydown', event => {
    if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) preparePress(event);
  }, true);
  document.addEventListener('click', playRelease, true);

  function receiptFor(owner) {
    const existing = receipts.get(owner);
    if (existing) return existing;
    const status = document.createElement('span');
    status.className = 'manga-receipt';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    const header = owner.querySelector('.dialoghead');
    if (header) header.insertBefore(status, header.querySelector('.close'));
    else owner.append(status);
    const receipt = {status, timer:0};
    receipts.set(owner, receipt);
    return receipt;
  }

  function clearReceipt(owner) {
    const receipt = receipts.get(owner);
    if (!receipt) return;
    clearTimeout(receipt.timer);
    receipt.status.textContent = '';
  }

  function success(element, message) {
    if (!element || !message) return;
    const dialog = element.closest('dialog');
    const owner = dialog || element.closest('form');
    if (!owner || (dialog && !dialog.open)) return;
    const receipt = receiptFor(owner);
    clearReceipt(owner);
    receipt.status.textContent = `✓ ${message}`;
    receipt.timer = setTimeout(() => clearReceipt(owner), 2800);
  }

  const pageEnd = document.querySelector('#page-end');
  const supportLink = document.querySelector('.support-link');
  if (pageEnd && supportLink && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const latest = entries[entries.length - 1];
      supportLink.classList.toggle('is-highlighted', latest.intersectionRatio >= 1);
    }, {threshold: 1});
    observer.observe(pageEnd);
  }

  document.querySelectorAll('dialog').forEach(receiptFor);
  document.addEventListener('close', event => clearReceipt(event.target), true);
  window.MangaMotion = {success};
})();

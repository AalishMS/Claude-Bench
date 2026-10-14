/* The Windows / macOS switch (install command, notes, shortcut keys) and the Copy buttons. */
(function (S) {
  'use strict';

  const root = document.documentElement;

  function setOs(os) {
    root.dataset.os = os;
    S.$$('[data-os-tab]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.osTab === os)));
    S.$$('kbd[data-win]').forEach(key => { key.textContent = os === 'mac' ? key.dataset.mac : key.dataset.win; });
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
      const field = document.createElement('textarea');
      field.value = text;
      field.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(field);
      field.select();
      const ok = document.execCommand('copy');
      field.remove();
      if (ok) resolve(); else reject(new Error('copy failed'));
    });
  }

  /* Copies the command of the OS that is showing. */
  function onCopy(button) {
    const label = S.$('span', button);
    const command = S.$$('.term__cmd', button.closest('.term')).find(el => el.offsetParent !== null);
    copyText(command.textContent.trim()).then(() => {
      label.textContent = 'Copied';
      button.classList.add('is-done');
    }, () => {
      label.textContent = 'Select and copy';
      window.getSelection().selectAllChildren(command);
    }).then(() => setTimeout(() => {
      label.textContent = 'Copy';
      button.classList.remove('is-done');
    }, 1800));
  }

  /* A mouse wheel over the one-line command scrolls it sideways. Who scrolls is decided once per wheel gesture
     (events less than WHEEL_GAP ms apart): a gesture that began on the page keeps scrolling the page when the
     command passes under the pointer, and one that began on the command stays there even after it reaches the
     end, so the two never move together. A new gesture at the end of the command scrolls the page. */
  const WHEEL_GAP = 200;
  let wheelOwner = null;
  let lastWheel = -Infinity;

  function newGesture(e) {
    const fresh = e.timeStamp - lastWheel > WHEEL_GAP;
    lastWheel = e.timeStamp;
    return fresh;
  }

  function canScroll(el, dy) {
    const max = el.scrollWidth - el.clientWidth;
    return dy < 0 ? el.scrollLeft > 0 : el.scrollLeft < max - 1;
  }

  function onWheel(e) {
    const el = e.currentTarget;
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; // Firefox reports lines
    const fresh = newGesture(e);
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // trackpad swipes sideways already work
    if (fresh) wheelOwner = canScroll(el, dy) ? el : null;
    if (wheelOwner !== el) return;
    e.preventDefault();
    el.scrollLeft += dy;
  }

  function onPageWheel(e) {
    if (e.target.closest && e.target.closest('.term__cmd')) return;
    newGesture(e);
    wheelOwner = null;
  }

  function init() {
    S.$$('[data-os-tab]').forEach(button => button.addEventListener('click', () => setOs(button.dataset.osTab)));
    S.$$('[data-copy]').forEach(button => button.addEventListener('click', () => onCopy(button)));
    S.$$('.term__cmd').forEach(cmd => cmd.addEventListener('wheel', onWheel, { passive: false }));
    window.addEventListener('wheel', onPageWheel, { passive: true });
    setOs(root.dataset.os);
  }

  S.install = { init };
})(window.Stanza);

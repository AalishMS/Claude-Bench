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

  function init() {
    S.$$('[data-os-tab]').forEach(button => button.addEventListener('click', () => setOs(button.dataset.osTab)));
    S.$$('[data-copy]').forEach(button => button.addEventListener('click', () => onCopy(button)));
    setOs(root.dataset.os);
  }

  S.install = { init };
})(window.Stanza);

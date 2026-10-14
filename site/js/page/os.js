/* The Windows / macOS / both switch: which install command and which shortcut keys the page shows. */
(function (S) {
  'use strict';

  const root = document.documentElement;
  const buttons = S.$$('[data-os-tab]');
  const keys = S.$$('kbd[data-win]');

  function set(os) {
    root.dataset.os = os;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.osTab === os)));
    keys.forEach(key => { key.textContent = os === 'mac' ? key.dataset.mac : key.dataset.win; });
  }

  function init() {
    buttons.forEach(button => button.addEventListener('click', () => set(button.dataset.osTab)));
    set(root.dataset.os);
  }

  S.os = { init };
})(window.Stanza);

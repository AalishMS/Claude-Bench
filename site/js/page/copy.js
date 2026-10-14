/* "Copy" buttons on the install commands. */
(function (S) {
  'use strict';

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

  function init() {
    S.$$('[data-copy]').forEach(button => {
      const label = S.$('span', button);
      const command = S.$('.cmd__text', button.closest('.cmd'));

      button.addEventListener('click', () => {
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
      });
    });
  }

  S.copy = { init };
})(window.Stanza);

/* Namespace and tiny helpers shared by every other script. Loaded first. */
(function () {
  'use strict';

  const S = window.Stanza = { mock: { screens: {} } };

  S.$ = (selector, root = document) => root.querySelector(selector);
  S.$$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  /* Anything a visitor types goes through this before it is put into markup. */
  S.esc = text => String(text).replace(/[&<>"']/g, ch => ESCAPES[ch]);

  S.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
})();

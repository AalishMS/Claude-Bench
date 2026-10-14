/* Runs in <head> before first paint, so the page never flashes the wrong theme.
   A saved choice wins; otherwise the system setting. Also picks the visitor's OS. */
(function () {
  'use strict';

  var root = document.documentElement;
  var theme = null;
  try { theme = localStorage.getItem('stanza-theme'); } catch (e) { /* storage blocked */ }
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  root.dataset.theme = theme;
  root.dataset.os = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? 'mac' : 'win';
  root.classList.add('js');
})();

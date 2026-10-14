/* Runs in <head> before first paint: picks the visitor's OS (install command, shortcut keys). */
(function () {
  'use strict';

  var root = document.documentElement;
  root.dataset.os = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? 'mac' : 'win';
  root.classList.add('js');
})();

/* Runs in <head> before first paint: picks the visitor's OS (install command, shortcut keys). */
(function () {
  'use strict';

  var root = document.documentElement;
  var uad = navigator.userAgentData;
  var platform = (uad && uad.platform) || navigator.platform || navigator.userAgent;
  root.dataset.os = /mac|iphone|ipad|ios/i.test(platform) ? 'mac' : 'win';
  root.classList.add('js');
  // The pinned, scroll-driven layout (js/page/scroll.js keeps this in step), set here so the first paint has it.
  if (matchMedia('(min-width: 901px) and (min-height: 640px)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('pin');
  }
})();

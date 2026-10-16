/* Runs in <head> before first paint: picks the visitor's OS (install command, shortcut keys). */
(function () {
  'use strict';

  var root = document.documentElement;
  var uad = navigator.userAgentData;
  var platform = (uad && uad.platform) || navigator.platform || navigator.userAgent;
  root.dataset.os = /mac|iphone|ipad|ios/i.test(platform) ? 'mac' : 'win';
  root.classList.add('js');
})();

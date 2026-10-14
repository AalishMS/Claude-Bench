/* Keeps the working screens alive: the spinner glyph and the seconds / token counters. Idle when the tab is hidden
   or the visitor asked for reduced motion. */
(function (S) {
  'use strict';

  const model = S.model;

  function spin() {
    model.advanceSpinner();
    S.$$('[data-live-spinner]').forEach(el => { el.textContent = model.spinnerText(el.dataset.liveSpinner); });
  }

  function count() {
    model.advanceCounters();
    S.$$('[data-live-counter]').forEach(el => { el.textContent = model.counterText(el.dataset.liveCounter); });
  }

  function init() {
    if (S.reducedMotion.matches) return;
    setInterval(() => { if (!document.hidden) spin(); }, 180);
    setInterval(() => { if (!document.hidden) count(); }, 1000);
  }

  S.ticker = { init };
})(window.Stanza);

/* Starts the page. Loaded last: every module it wires up is already on window.Stanza. */
(function (S) {
  'use strict';

  /* Repaints everything that shows the mock: the live window and the frozen ones (the split stage's counts too). */
  S.redraw = () => {
    S.hero.draw();
    S.windows.drawFrozen();
    S.quad.apply();
  };

  S.install.init();
  S.hero.init();
  S.windows.init();
  S.actions.init();
  S.ticker.init();
  S.redraw();

  // The stages measure the windows, so they start once those are drawn and sized.
  S.stage.init();
  S.quad.init();
  S.rail.init();
  S.fx.init();
  S.scroll.init();
})(window.Stanza);

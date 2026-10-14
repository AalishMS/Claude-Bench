/* Starts the page. Loaded last: every module it wires up is already on window.Stanza. */
(function (S) {
  'use strict';

  /* Repaints everything that shows the mock: the live hero window and the frozen ones. */
  S.redraw = () => {
    S.hero.draw();
    S.windows.drawFrozen();
  };

  S.install.init();
  S.hero.init();
  S.windows.init();
  S.tour.init();
  S.actions.init();
  S.ticker.init();
  S.fx.init();

  S.redraw();
})(window.Stanza);

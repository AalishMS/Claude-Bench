/* Starts the page. Loaded last: every module it wires up is already on window.Stanza. */
(function (S) {
  'use strict';

  /* Repaints everything that shows the mock: the live demo, the previews and the comparison. */
  S.redraw = () => {
    S.stage.draw();
    S.windows.drawCrops();
    S.compare.draw();
  };

  S.os.init();
  S.appearance.init();
  S.stage.init();
  S.windows.init();
  S.compare.init();
  S.copy.init();
  S.actions.init();
  S.scroll.init();
  S.ticker.init();

  S.redraw();
})(window.Stanza);

/* Mock windows. The mock is drawn at a fixed 1280x700 and scaled (and optionally cropped) to the window's width. */
(function (S) {
  'use strict';

  const FULL = [0, 0, 1280, 700];
  const wins = S.$$('.window');
  const frozen = S.$$('.window[data-screen]');
  const observer = new ResizeObserver(entries => entries.forEach(entry => fit(entry.target)));

  /* data-crop="x,y,w,h": the part of the mock this window shows. */
  function cropOf(win) {
    const [x, y, w, h] = win.dataset.crop ? win.dataset.crop.split(',').map(Number) : FULL;
    return { x, y, w, h };
  }

  function fit(win) {
    const { x, y, w } = cropOf(win);
    const scale = win.clientWidth / w;
    S.$$('.window__canvas', win).forEach(canvas => {
      canvas.style.transform = `scale(${scale}) translate(${-x}px, ${-y}px)`;
    });
  }

  /* Windows with a data-screen show that screen, frozen. data-editable ones keep their settings controls working. */
  function drawFrozen() {
    frozen.forEach(win => {
      S.$('.window__canvas', win).innerHTML = S.mock.build(win.dataset.screen, S.model.state.theme, { live: false });
    });
  }

  function init() {
    frozen.forEach(win => {
      const canvas = document.createElement('div');
      canvas.className = 'window__canvas';
      win.appendChild(canvas);
    });
    wins.forEach(win => {
      const { w, h } = cropOf(win);
      win.style.setProperty('--w', w);
      win.style.setProperty('--h', h);
      observer.observe(win);
    });
  }

  S.windows = { init, drawFrozen };
})(window.Stanza);

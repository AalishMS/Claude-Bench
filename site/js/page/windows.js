/* Mock windows. The mock is drawn at a fixed 1280x700 and scaled (and optionally cropped) to the window's width. */
(function (S) {
  'use strict';

  const FULL = [0, 0, 1280, 700];
  const wins = S.$$('.window');
  const crops = S.$$('.window[data-screen]');
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

  function addCanvas(win) {
    const canvas = document.createElement('div');
    canvas.className = 'window__canvas';
    win.appendChild(canvas);
    return canvas;
  }

  /* Windows with a data-screen show that screen, frozen. Settings previews are data-editable: their controls work. */
  function drawCrops() {
    crops.forEach(win => {
      const canvas = S.$('.window__canvas', win);
      canvas.innerHTML = S.mock.build(win.dataset.screen, S.appearance.currentTheme(), { live: false });
    });
  }

  function init() {
    crops.forEach(addCanvas);
    wins.forEach(win => {
      const { w, h } = cropOf(win);
      win.style.setProperty('--w', w);
      win.style.setProperty('--h', h);
      observer.observe(win);
    });
  }

  S.windows = { init, drawCrops };
})(window.Stanza);

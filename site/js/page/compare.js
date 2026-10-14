/* Dark / light comparison: both themes of one screen stacked, with a draggable divider. */
(function (S) {
  'use strict';

  const state = S.model.state;

  const box = S.$('#compare');
  const lightLayer = S.$('#compare-light');
  const darkLayer = S.$('#compare-dark');
  const clip = S.$('#compare-clip');
  const handle = S.$('#compare-handle');
  const viewButtons = S.$$('[data-compare-view]');
  const STATIC = { live: false };
  const KEY_STEP = 5;

  let percent = 50;

  function draw() {
    lightLayer.innerHTML = S.mock.build(state.sliderView, 'light', STATIC);
    darkLayer.innerHTML = S.mock.build(state.sliderView, 'dark', STATIC);
  }

  function setPosition(next) {
    percent = Math.max(0, Math.min(100, next));
    clip.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
    handle.style.left = `${percent}%`;
    box.setAttribute('aria-valuenow', String(Math.round(percent)));
  }

  function setView(screen) {
    state.sliderView = screen;
    viewButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.compareView === screen)));
    draw();
  }

  function init() {
    const moveTo = event => {
      const rect = box.getBoundingClientRect();
      setPosition(((event.clientX - rect.left) / rect.width) * 100);
    };

    box.addEventListener('pointerdown', event => {
      box.setPointerCapture(event.pointerId);
      moveTo(event);
    });
    box.addEventListener('pointermove', event => {
      if (box.hasPointerCapture(event.pointerId)) moveTo(event);
    });
    box.addEventListener('keydown', event => {
      const target = {
        ArrowLeft: percent - KEY_STEP, ArrowRight: percent + KEY_STEP, Home: 0, End: 100,
      }[event.key];
      if (target === undefined) return;
      event.preventDefault();
      setPosition(target);
    });

    viewButtons.forEach(button => button.addEventListener('click', () => setView(button.dataset.compareView)));
    setPosition(percent);
    setView(state.sliderView);
  }

  S.compare = { init, draw };
})(window.Stanza);

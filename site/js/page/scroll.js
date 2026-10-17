/* Scroll-driven stages. html.pin is on where a pinned layout fits (wide, tall screen, motion allowed; boot.js sets
   it before first paint). Each stage registers update(t), called with its 0..1 progress through its pinned run, or
   null when nothing is pinned, and layout(pinned) for anything measured. One requestAnimationFrame per scroll frame
   for all of them. */
(function (S) {
  'use strict';

  const root = document.documentElement;
  const wide = window.matchMedia('(min-width: 901px) and (min-height: 640px)');
  const parts = [];
  const frameFns = [];
  let queued = false;

  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  /* Where v sits between a and b, as 0..1. */
  const span = (v, a, b) => clamp((v - a) / (b - a));
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const pinned = () => root.classList.contains('pin');

  function progress(el) {
    const box = el.getBoundingClientRect();
    const run = box.height - window.innerHeight;
    return run > 0 ? clamp(-box.top / run) : 0;
  }

  function frame() {
    queued = false;
    const on = pinned();
    parts.forEach(part => part.update(on ? progress(part.el) : null));
    frameFns.forEach(fn => fn());
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  }

  /* Re-decide pinning and let every stage measure again. Order matters: a stage's layout may change the page height
     (the rail sets its own), which moves the ones after it. */
  function layout() {
    root.classList.toggle('pin', wide.matches && !S.reducedMotion.matches);
    parts.forEach(part => part.layout && part.layout(pinned()));
    frame();
  }

  let resizeQueued = false;
  function onResize() {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      layout();
    });
  }

  const add = (el, update, measure) => parts.push({ el, update, layout: measure });
  const onFrame = fn => frameFns.push(fn);

  function init() {
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', onResize);
    wide.addEventListener('change', layout);
    S.reducedMotion.addEventListener('change', layout);
    // The headline's height depends on the web font, and the window's place on the headline.
    if (document.fonts) document.fonts.ready.then(layout);
    layout();
  }

  S.scroll = { add, onFrame, init, schedule, layout, pinned, clamp, span, ease };
})(window.Stanza);

/* Page effects that aren't part of the mock: the hero mark following the pointer, the nav's backdrop once the page
   scrolls, and facts / questions fading up the first time they're on screen. */
(function (S) {
  'use strict';

  const nav = S.$('.nav');
  const hero = S.$('.hero');
  const mark = S.$('#mark');
  const finePointer = window.matchMedia('(pointer: fine)');

  /* --mx/--my in -1..1, from the pointer's offset to the mark's centre; the CSS turns them into tilt and depth. */
  function parallax() {
    let x = 0;
    let y = 0;
    let queued = false;
    const apply = () => {
      queued = false;
      mark.style.setProperty('--mx', x.toFixed(3));
      mark.style.setProperty('--my', y.toFixed(3));
    };
    const set = (nx, ny) => {
      x = nx;
      y = ny;
      if (!queued) {
        queued = true;
        requestAnimationFrame(apply);
      }
    };
    hero.addEventListener('pointermove', event => {
      if (S.reducedMotion.matches || !finePointer.matches) return;
      const box = mark.getBoundingClientRect();
      const clamp = v => Math.max(-1, Math.min(1, v));
      set(clamp((event.clientX - box.left - box.width / 2) / (window.innerWidth / 2)),
        clamp((event.clientY - box.top - box.height / 2) / (window.innerHeight / 2)));
    });
    hero.addEventListener('pointerleave', () => set(0, 0));
  }

  function navState() {
    const update = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  function reveals() {
    if (S.reducedMotion.matches || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    }), { rootMargin: '0px 0px -8% 0px' });
    /* Facts stagger across their two columns, questions down the list. */
    const stagger = (items, delay) => items.forEach((item, i) => {
      item.classList.add('reveal');
      item.style.setProperty('--rd', `${delay(i)}ms`);
      observer.observe(item);
    });
    stagger(S.$$('.facts > div'), i => (i % 2) * 90);
    stagger(S.$$('.qa__item'), i => i * 60);
  }

  function init() {
    if (hero && mark) parallax();
    navState();
    reveals();
  }

  S.fx = { init };
})(window.Stanza);

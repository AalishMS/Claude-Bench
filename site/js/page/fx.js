/* Page effects that aren't part of the mock or a stage: the nav's backdrop once the page scrolls, the nav button of
   the section on screen lit like the app's toggled title-bar buttons, and the FAQ rows fading up the first time
   they're on screen. */
(function (S) {
  'use strict';

  const nav = S.$('.nav');
  const links = S.$$('[data-nav]', nav);
  /* Each nav button's section. The opening stage counts as the demo once the window is on its way home. */
  const SECTIONS = { demo: '.stage', split: '.quad', features: '.rail', faq: '#faq', install: '#install' };
  const targets = links.map(link => ({ link, el: S.$(SECTIONS[link.dataset.nav]) }));

  function navState() {
    nav.classList.toggle('is-scrolled', window.scrollY > 8);
    const line = window.innerHeight * 0.4;
    let current = null;
    targets.forEach(({ link, el }) => {
      if (el && el.getBoundingClientRect().top <= line) current = link;
    });
    if (current && current.dataset.nav === 'demo' && window.scrollY < window.innerHeight * 0.45) current = null;
    links.forEach(link => link.classList.toggle('is-current', link === current));
  }

  function reveals() {
    if (S.reducedMotion.matches || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    }), { rootMargin: '0px 0px -8% 0px' });
    S.$$('.qa__item').forEach((item, i) => {
      item.classList.add('reveal');
      item.style.setProperty('--rd', `${i * 50}ms`);
      observer.observe(item);
    });
  }

  function init() {
    S.scroll.onFrame(navState);
    reveals();
  }

  S.fx = { init };
})(window.Stanza);

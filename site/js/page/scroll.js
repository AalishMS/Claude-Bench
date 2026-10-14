/* Scroll behaviour: the nav's bottom border once scrolled, and sections fading in as they arrive. */
(function (S) {
  'use strict';

  function init() {
    const nav = S.$('#nav');
    const onScroll = () => nav.classList.toggle('is-stuck', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const reveals = S.$$('.reveal');
    if (!('IntersectionObserver' in window)) {
      reveals.forEach(el => el.classList.add('in'));
      return;
    }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      observer.unobserve(entry.target);
    }), { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    reveals.forEach(el => observer.observe(el));
  }

  S.scroll = { init };
})(window.Stanza);

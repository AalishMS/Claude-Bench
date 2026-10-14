/* The feature tour: on wide screens one sticky frame beside the steps shows the step nearest the middle of the
   viewport. Narrow screens show each step's own window inline instead (CSS only). */
(function (S) {
  'use strict';

  const steps = S.$$('.tour__step');
  const frames = S.$$('.tour__frame');

  function activate(n) {
    steps.forEach(step => step.classList.toggle('is-active', step.dataset.step === n));
    frames.forEach(frame => frame.classList.toggle('is-active', frame.dataset.step === n));
  }

  function init() {
    if (!steps.length) return;
    activate(steps[0].dataset.step);
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) activate(entry.target.dataset.step);
    }), { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(step => observer.observe(step));
  }

  S.tour = { init };
})(window.Stanza);

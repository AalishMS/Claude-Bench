/* The feature tour. On wide, tall screens (the CSS pins .tour__pin there) the scroll position inside .tour picks the
   step: its caption, its frame, its pill (with a progress bar) and the spotlight's rect (data-focus, in mock px).
   Elsewhere the steps simply follow each other and this does nothing. */
(function (S) {
  'use strict';

  const track = S.$('.tour');
  const steps = S.$$('.tour__step');
  const frames = S.$$('.tour__frame');
  const pills = S.$$('.tour__pill');
  const spot = S.$('.tour__spot');
  const pinned = window.matchMedia('(min-width: 901px) and (min-height: 640px)');
  const NAV_H = 56;

  let active = null;
  let queued = false;

  /* 0..1 through the pinned part of the track. */
  function progress() {
    const box = track.getBoundingClientRect();
    const run = box.height - (window.innerHeight - NAV_H);
    return run > 0 ? Math.min(1, Math.max(0, (NAV_H - box.top) / run)) : 0;
  }

  function activate(n) {
    if (n === active) return;
    active = n;
    steps.forEach(step => step.classList.toggle('is-active', step.dataset.step === n));
    frames.forEach(frame => frame.classList.toggle('is-active', frame.dataset.step === n));
    pills.forEach(pill => {
      pill.classList.toggle('is-active', pill.dataset.go === n);
      pill.setAttribute('aria-current', String(pill.dataset.go === n));
    });
    const frame = frames.find(f => f.dataset.step === n);
    const [x, y, w, h] = frame.dataset.focus.split(',');
    Object.entries({ '--x': x, '--y': y, '--fw': w, '--fh': h }).forEach(([key, value]) => spot.style.setProperty(key, value));
  }

  function update() {
    queued = false;
    if (!pinned.matches) return;
    const at = progress() * steps.length;
    const index = Math.min(steps.length - 1, Math.floor(at));
    pills.forEach((pill, i) => pill.style.setProperty('--p', Math.min(1, Math.max(0, at - i)).toFixed(3)));
    activate(steps[index].dataset.step);
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }

  /* A pill scrolls to the start of its step's slice of the track. */
  function go(n) {
    const run = track.offsetHeight - (window.innerHeight - NAV_H);
    const top = track.getBoundingClientRect().top + window.scrollY - NAV_H;
    window.scrollTo({ top: top + run * ((n - 1) / steps.length) + 2 });
  }

  function init() {
    if (!track) return;
    activate(steps[0].dataset.step);
    pills.forEach(pill => pill.addEventListener('click', () => go(Number(pill.dataset.go))));
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    pinned.addEventListener('change', schedule);
    update();
  }

  S.tour = { init };
})(window.Stanza);

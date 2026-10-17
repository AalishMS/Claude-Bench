/* The features rail (html.pin only): vertical scroll pans the track sideways, one pixel for one pixel, with a short
   hold before it starts (to read the heading) and after it ends. The section's height is set to fit that. */
(function (S) {
  'use strict';

  const { clamp } = S.scroll;

  const section = S.$('.rail');
  const track = S.$('.rail__track');

  let travel = 0;
  let hold = 0;

  function layout(on) {
    track.style.removeProperty('--rx');
    section.style.removeProperty('--rail-h');
    travel = 0;
    if (!on) return;
    travel = Math.max(0, track.offsetWidth - document.documentElement.clientWidth);
    hold = window.innerHeight * 0.18;
    section.style.setProperty('--rail-h', `${Math.round(window.innerHeight + travel + hold * 2)}px`);
  }

  function update(t) {
    if (t === null || !travel) return;
    const x = clamp((t * (travel + hold * 2) - hold) / travel) * travel;
    track.style.setProperty('--rx', `${(-x).toFixed(1)}px`);
  }

  function init() {
    S.scroll.add(section, update, layout);
  }

  S.rail = { init };
})(window.Stanza);

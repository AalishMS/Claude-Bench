/* The split stage, the page's peak. Pinned, the scroll position picks how many panes the window shows: one alone
   for the first stretch (the quiet before it), then two, three and four, which then hold for the longest part of
   the run. The window leans in over the quiet stretch. Unpinned it shows all four. The mock is drawn once with every
   pane; only data-panes changes, plus the counts in its status lines. */
(function (S) {
  'use strict';

  const { span } = S.scroll;

  const section = S.$('.quad');
  const win = S.$('.quad__window');
  const says = S.$$('.quad__say');
  const ARRIVALS = [0.2, 0.36, 0.52]; // progress at which panes 2, 3 and 4 open

  let panes = 0;

  const set = (selector, text) => {
    const el = S.$(selector, win);
    if (el) el.textContent = text;
  };

  /* The texts the mock can't know: the split box's count and the two status lines. Also after every redraw. */
  function apply() {
    if (!panes) return;
    const working = [0, 2, 2, 3][panes - 1]; // pane C is a shell: running, not working
    set('[data-quad-count]', String(panes));
    set('[data-quad-sessions]', panes === 1 ? '1 session running' : `${panes} sessions running`);
    set('[data-quad-status]', working ? `${working} working` : '1 running');
    const status = S.$('[data-quad-status]', win);
    const dot = status && status.parentElement.previousElementSibling;
    if (dot) {
      dot.style.background = working ? 'var(--dot-amber)' : 'var(--dot-green)';
      dot.classList.toggle('dot-working-pulse', working > 0);
    }
  }

  function update(t) {
    if (t === null) win.style.removeProperty('--qs');
    else win.style.setProperty('--qs', (0.94 + 0.06 * span(t, 0, ARRIVALS[0])).toFixed(4));

    const next = t === null ? 4 : 1 + ARRIVALS.filter(at => t >= at).length;
    if (next === panes) return;
    panes = next;
    win.dataset.panes = String(panes);
    section.dataset.n = String(panes);
    says.forEach(say => say.classList.toggle('is-on', say.dataset.say === String(panes)));
    apply();
  }

  function init() {
    S.scroll.add(section, update);
  }

  S.quad = { init, apply };
})(window.Stanza);

/* The live demo in the hero: the screen tabs, the prev/next stepper, the working/idle switch and the caption. */
(function (S) {
  'use strict';

  const { TABS, CAPTIONS, state } = S.model;

  const tabsEl = S.$('#stage-tabs');
  const countEl = S.$('#stage-count');
  const captionEl = S.$('#stage-caption');
  const workingButton = S.$('#stage-working');
  const canvas = S.$('#stage-canvas');
  const workspace = S.$('#workspace');

  const activeTab = () => TABS[S.model.tabIndexOf(state.activeView)];

  function syncControls() {
    const index = S.model.tabIndexOf(state.activeView);
    S.$$('button', tabsEl).forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    countEl.textContent = `${index + 1} / ${TABS.length}`;
    captionEl.textContent = CAPTIONS[state.activeView];

    const hasTwin = TABS[index].screens.length > 1;
    workingButton.hidden = !hasTwin;
    workingButton.textContent = state.activeView.endsWith('-working') ? 'Show idle state' : 'Simulate working';
  }

  /* Redraws the whole mock. Typing in the search or prompt field must survive that, so focus and caret are restored. */
  function draw({ fade = false } = {}) {
    const focused = document.activeElement;
    const field = focused && focused.dataset ? focused.dataset.field : null;
    const caret = field ? focused.selectionStart : 0;

    canvas.innerHTML = S.mock.build(state.activeView, S.appearance.currentTheme(), { live: true });
    if (fade) canvas.querySelector('main').classList.add('view-fade');

    const input = field && S.$(`[data-field="${field}"]`, canvas);
    if (input) {
      input.focus();
      input.setSelectionRange(caret, caret);
    }
    syncControls();
  }

  function show(screen) {
    const changed = screen !== state.activeView;
    state.activeView = screen;
    state.recordingShortcutId = null;
    draw({ fade: changed });
  }

  /* Same, but from elsewhere on the page: bring the demo into view first. */
  function open(screen) {
    show(screen);
    workspace.scrollIntoView({ behavior: S.reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
  }

  function step(delta) {
    const next = (S.model.tabIndexOf(state.activeView) + delta + TABS.length) % TABS.length;
    show(TABS[next].screens[0]);
    return next;
  }

  /* Idle <-> working twin of the current screen; from a screen without one, jump to a working session. */
  function toggleWorking() {
    const twin = activeTab().screens.find(screen => screen !== state.activeView);
    show(twin || 'main-working');
  }

  function init() {
    tabsEl.innerHTML = TABS.map((tab, i) =>
      `<button class="seg__btn" type="button" data-tab="${i}" aria-pressed="false">${tab.label}</button>`).join('');

    tabsEl.addEventListener('click', event => {
      const button = event.target.closest('[data-tab]');
      if (button) show(TABS[button.dataset.tab].screens[0]);
    });
    tabsEl.addEventListener('keydown', event => {
      const delta = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (!delta) return;
      event.preventDefault();
      S.$$('button', tabsEl)[step(delta)].focus();
    });

    S.$$('[data-step]').forEach(button => button.addEventListener('click', () => step(Number(button.dataset.step))));
    workingButton.addEventListener('click', toggleWorking);
  }

  S.stage = { init, draw, show, open, toggleWorking };
})(window.Stanza);

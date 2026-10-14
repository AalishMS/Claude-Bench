/* The live window in the hero and the screen switch under it. */
(function (S) {
  'use strict';

  const { TABS, state } = S.model;

  const tabsEl = S.$('#hero-tabs');
  const canvas = S.$('#hero-canvas');

  function syncTabs() {
    const index = S.model.tabIndexOf(state.activeView);
    S.$$('button', tabsEl).forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  }

  /* Redraws the whole mock. Typing in the search or prompt field must survive that, so focus and caret are restored. */
  function draw({ fade = false } = {}) {
    const focused = document.activeElement;
    const field = focused && focused.dataset ? focused.dataset.field : null;
    const caret = field ? focused.selectionStart : 0;

    canvas.innerHTML = S.mock.build(state.activeView, state.theme, { live: true });
    if (fade) canvas.querySelector('main').classList.add('view-fade');

    const input = field && S.$(`[data-field="${field}"]`, canvas);
    if (input) {
      input.focus();
      input.setSelectionRange(caret, caret);
    }
    syncTabs();
  }

  function show(screen) {
    const changed = screen !== state.activeView;
    state.activeView = screen;
    state.recordingShortcutId = null;
    draw({ fade: changed });
  }

  /* Idle <-> working twin of the current screen; from a screen without one, jump to a working session. */
  const TWIN = { main: 'main-working', 'main-working': 'main', split: 'split-working', 'split-working': 'split' };
  const toggleWorking = () => show(TWIN[state.activeView] || 'main-working');

  function init() {
    tabsEl.innerHTML = TABS.map((tab, i) =>
      `<button class="switch__btn" type="button" data-tab="${i}" aria-pressed="false">${tab.label}</button>`).join('');

    tabsEl.addEventListener('click', event => {
      const button = event.target.closest('[data-tab]');
      if (button) show(TABS[button.dataset.tab].screens[0]);
    });
    tabsEl.addEventListener('keydown', event => {
      const delta = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (!delta) return;
      event.preventDefault();
      const next = (S.model.tabIndexOf(state.activeView) + delta + TABS.length) % TABS.length;
      show(TABS[next].screens[0]);
      S.$$('button', tabsEl)[next].focus();
    });
  }

  S.hero = { init, draw, show, toggleWorking };
})(window.Stanza);

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
    // Terminals that grew past the window keep their newest line in view
    S.$$('[data-autoscroll]', canvas).forEach(el => { el.scrollTop = el.scrollHeight; });
    syncTabs();
  }

  /* replay: start the screen's little story over (the permission prompt, its toast) even if it is already shown. */
  function show(screen, { replay = false } = {}) {
    const changed = screen !== state.activeView;
    state.activeView = screen;
    state.recordingShortcutId = null;
    if (changed || replay) {
      state.dialog = null;
      state.promptCursor = 0;
      state.promptAnswer = null;
      state.toastDismissed = false;
      state.toastSeen = false;
    }
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
      if (button) show(TABS[button.dataset.tab].screens[0], { replay: true });
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

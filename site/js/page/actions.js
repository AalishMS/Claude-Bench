/* Clicks inside the mock. The mock's markup only carries data-act / data-arg / data-field; this file
   decides what they do, so the templates stay free of inline handlers. */
(function (S) {
  'use strict';

  const state = S.model.state;

  const toggle = (map, key) => { map[key] = !map[key]; };

  const ACTIONS = {
    selectView: screen => S.hero.show(screen),
    toggleLeftSidebar: () => { state.leftSidebarOpen = !state.leftSidebarOpen; S.hero.draw(); },
    toggleRightSidebar: () => { state.rightSidebarOpen = !state.rightSidebarOpen; S.hero.draw(); },
    toggleFolder: key => { toggle(state.collapsedFolders, key); S.hero.draw(); },
    toggleRightSection: key => { toggle(state.collapsedRight, key); S.hero.draw(); },
    setSplitFocus: pane => { state.focusedSplitPane = Number(pane); S.hero.draw(); },
    cycleAutoMode: () => { S.model.cycleAutoMode(); S.redraw(); },
    toggleWorkingVariant: () => S.hero.toggleWorking(),
    setTheme: theme => S.look.setTheme(theme),
    toggleTheme: () => S.look.toggleTheme(),
    setStanzaAccent: key => S.look.setAccent(key),
    changeTermSize: delta => S.look.changeTermSize(Number(delta)),
    startShortcutRecord: name => {
      state.recordingShortcutId = state.recordingShortcutId === name ? null : name;
      S.redraw();
    },
  };

  /* Outside the hero only the settings controls of data-editable windows act; everything else there is a picture. */
  const IN_PLACE = new Set(['setTheme', 'toggleTheme', 'setStanzaAccent', 'changeTermSize', 'startShortcutRecord']);

  const REPLY = prompt => `This is a demo, so nothing ran. In Stanza, "${prompt}" goes to the real claude CLI.`;

  function onClick(event) {
    const control = event.target.closest('[data-act]');
    if (!control) return;
    const { act, arg } = control.dataset;
    if (!control.closest('#hero-window') && !IN_PLACE.has(act)) return;
    ACTIONS[act](arg);
  }

  function onKeydown(event) {
    const { target } = event;
    if (!(target instanceof Element)) return;

    if (target.dataset.field === 'prompt' && event.key === 'Enter') {
      const prompt = target.value.trim();
      if (!prompt) return;
      state.customPromptHistory.push({ prompt, reply: REPLY(prompt) });
      S.hero.draw();
    } else if (event.key === 'Escape' && state.recordingShortcutId) {
      state.recordingShortcutId = null;
      S.redraw();
    }
  }

  function onInput(event) {
    if (event.target.dataset.field !== 'search') return;
    state.searchQuery = event.target.value;
    S.hero.draw();
  }

  function init() {
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('input', onInput);
  }

  S.actions = { init };
})(window.Stanza);

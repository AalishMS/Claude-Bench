/* Clicks inside the mock. The mock's markup only carries data-act / data-arg / data-field; this file
   decides what they do, so the templates stay free of inline handlers. */
(function (S) {
  'use strict';

  const state = S.model.state;

  const toggle = (map, key) => { map[key] = !map[key]; };

  const ACTIONS = {
    selectView: screen => S.stage.show(screen),
    toggleLeftSidebar: () => { state.leftSidebarOpen = !state.leftSidebarOpen; S.stage.draw(); },
    toggleRightSidebar: () => { state.rightSidebarOpen = !state.rightSidebarOpen; S.stage.draw(); },
    toggleFolder: key => { toggle(state.collapsedFolders, key); S.stage.draw(); },
    toggleRightSection: key => { toggle(state.collapsedRight, key); S.stage.draw(); },
    setSplitFocus: pane => { state.focusedSplitPane = Number(pane); S.stage.draw(); },
    cycleAutoMode: () => { S.model.cycleAutoMode(); S.redraw(); },
    toggleWorkingVariant: () => S.stage.toggleWorking(),
    setTheme: theme => S.appearance.setTheme(theme),
    toggleTheme: () => S.appearance.toggleTheme(),
    setStanzaAccent: key => S.appearance.setAccent(key),
    changeTermSize: delta => S.appearance.changeTermSize(Number(delta)),
    startShortcutRecord: name => {
      state.recordingShortcutId = state.recordingShortcutId === name ? null : name;
      S.redraw();
    },
  };

  /* In a settings preview only the settings controls act in place. Anything else opens the live demo. */
  const IN_PLACE = new Set(['setTheme', 'toggleTheme', 'setStanzaAccent', 'changeTermSize', 'startShortcutRecord']);

  const REPLY = prompt => `This is a demo, so nothing ran. In Stanza, "${prompt}" goes to the real claude CLI.`;

  function onClick(event) {
    const opener = event.target.closest('[data-open-view]');
    if (opener) {
      S.stage.open(opener.dataset.openView);
      return;
    }

    const control = event.target.closest('[data-act]');
    if (!control) return;
    const { act, arg } = control.dataset;

    if (!control.closest('#stage') && !IN_PLACE.has(act)) {
      if (act === 'selectView') S.stage.open(arg);
      return;
    }
    ACTIONS[act](arg);
  }

  function onKeydown(event) {
    const { target } = event;
    if (!(target instanceof Element)) return;

    if (target.dataset.field === 'prompt' && event.key === 'Enter') {
      const prompt = target.value.trim();
      if (!prompt) return;
      state.customPromptHistory.push({ prompt, reply: REPLY(prompt) });
      S.stage.draw();
    } else if (event.key === 'Escape' && state.recordingShortcutId) {
      state.recordingShortcutId = null;
      S.redraw();
    } else if ((event.key === 'Enter' || event.key === ' ') && target.matches('[data-open-view][tabindex]')) {
      event.preventDefault();
      S.stage.open(target.dataset.openView);
    }
  }

  function onInput(event) {
    if (event.target.dataset.field !== 'search') return;
    state.searchQuery = event.target.value;
    S.stage.draw();
  }

  function init() {
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('input', onInput);
  }

  S.actions = { init };
})(window.Stanza);

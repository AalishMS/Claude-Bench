/* What the live demo can show and the state it keeps: screens, accents and the mock's own UI state. */
(function (S) {
  'use strict';

  /* The screen switch under the hero window. A second screen is the tab's working/idle twin. */
  const TABS = [
    { label: 'Session', screens: ['main', 'main-working'] },
    { label: 'Split view', screens: ['split-working', 'split'] },
    { label: 'Projects', screens: ['new-menu', 'home'] },
    { label: 'Settings', screens: ['settings-appearance', 'settings-shortcuts'] },
  ];

  /* The app's own accent hues (--hue-* in src/styles.css). */
  const ACCENTS = { blue: '#2850a5', violet: '#6b4fc8', teal: '#12776f', rose: '#b8336a' };

  const AUTO_MODES = ['▸▸ auto mode on', '▸▸ plan mode on', '▸▸ ask before edits'];
  const SPINNER_FRAMES = ['✻', '✢', '✳', '✶', '✹', '✵'];
  /* The tail of each "working" counter line, keyed like state.counters. */
  const COUNTER_NOTES = {
    main: 'thinking with high effort',
    split1: 'thought for 3s',
    split2: 'thinking with high effort',
  };

  const state = {
    activeView: 'main',
    theme: 'dark', // the mock's theme; the page itself is always dark
    accentKey: 'blue',
    fontSizePx: 14,
    leftSidebarOpen: true,
    rightSidebarOpen: true,
    searchQuery: '',
    collapsedFolders: { chats: true, claude: false, gym: false, hot: false },
    collapsedRight: { mcps: false, subagents: false },
    focusedSplitPane: 0,
    autoModeIndex: 0,
    recordingShortcutId: null,
    customPromptHistory: [],
    spinnerIdx: 0,
    counters: {
      main: { sec: 26, tokens: 2.7 },
      split1: { sec: 14, tokens: 1.4 },
      split2: { sec: 13, tokens: 1.1 },
    },
  };

  S.model = {
    TABS,
    ACCENTS,
    state,

    tabIndexOf: screen => TABS.findIndex(tab => tab.screens.includes(screen)),

    autoModeText: () => AUTO_MODES[state.autoModeIndex] || AUTO_MODES[0],
    cycleAutoMode: () => { state.autoModeIndex = (state.autoModeIndex + 1) % AUTO_MODES.length; },

    spinnerText: label => `${SPINNER_FRAMES[state.spinnerIdx % SPINNER_FRAMES.length]} ${label}…`,
    advanceSpinner: () => { state.spinnerIdx = (state.spinnerIdx + 1) % SPINNER_FRAMES.length; },

    counterText: key => {
      const { sec, tokens } = state.counters[key];
      return ` (${sec}s · ↓ ${tokens.toFixed(1)}k tokens · ${COUNTER_NOTES[key]})`;
    },
    advanceCounters: () => {
      Object.values(state.counters).forEach(counter => {
        counter.sec = (counter.sec % 59) + 1;
        counter.tokens = +(counter.tokens + 0.1).toFixed(1);
      });
    },
  };
})(window.Stanza);

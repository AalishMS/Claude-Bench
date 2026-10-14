/* What the live demo shows and the state it keeps: tabs, captions, accents and the mock's own UI state. */
(function (S) {
  'use strict';

  /* The tabs above the demo. `screens` are the mock screens a tab covers; a second entry is its working/idle twin. */
  const TABS = [
    { label: 'Session', screens: ['main', 'main-working'] },
    { label: 'Split view', screens: ['split-working', 'split'] },
    { label: 'Projects', screens: ['home'] },
    { label: 'Quick launch', screens: ['new-menu'] },
    { label: 'Appearance', screens: ['settings-appearance'] },
    { label: 'Shortcuts', screens: ['settings-shortcuts'] },
  ];

  const CAPTIONS = {
    main: 'Single-pane Claude Code session with live context meter and MCP inspector.',
    'main-working': 'Active session streaming with live working indicator and token counter.',
    split: 'Three-pane workspace with two Claude sessions and an integrated PowerShell.',
    'split-working': 'Parallel Claude Code sessions actively streaming side by side.',
    home: 'Launchpad with recent project folders, git status, and keyboard shortcuts.',
    'new-menu': 'Quick project picker for opening a new Claude session or a chat without a project.',
    'settings-appearance': 'Light, dark or system theme, accent colors, and terminal text size.',
    'settings-shortcuts': 'Customizable keyboard bindings for sessions, split panes, and window controls.',
  };

  const ACCENTS = { blue: '#2563eb', violet: '#6d5dfc', teal: '#0d9488', rose: '#e11d48' };

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
    sliderView: 'split-working',
    accentKey: 'violet',
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
    CAPTIONS,
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

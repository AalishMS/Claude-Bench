'use strict';

/* global Terminal, FitAddon, WebLinksAddon, WebglAddon, api */

// ------------------------------------------------------------- helpers ----

const $ = (sel, root = document) => root.querySelector(sel);
/** Read a CSS custom property from :root (styles.css is loaded before this script). */
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Tiny DOM builder. Text is always added as text nodes; `html` is for static icons only. */
function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

const ICONS = {
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  redo: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
  branch: '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  server: '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
  folderPlus: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>',
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  link: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  sidebar: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>',
  power: '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
  chevron: '<polyline points="9 18 15 12 9 6"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  pie: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  panelRight: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/>',
  columns: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/>',
  rows: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/>',
  undo: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  fork: '<circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/><path d="M12 12v3"/>',
  arrowUp: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
};
const ico = (name) =>
  h('span', { class: 'ico', html: `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>` });

const LOGO_IMG = `<img src="../assets/icon.png" alt="" aria-hidden="true" draggable="false">`;

// The official VS Code logo in its own colors (the one exception to monochrome icons, see DESIGN.md).
// stroke="none" on the outer group cancels the `.ico svg` outline styling.
const VSCODE_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true"><g stroke="none">
<defs>
<mask id="vsc-mask" mask-type="alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><path fill="#fff" fill-rule="evenodd" clip-rule="evenodd" d="M70.9119 99.3171C72.4869 99.9307 74.2828 99.8914 75.8725 99.1264L96.4608 89.2197C98.6242 88.1787 100 85.9892 100 83.5872V16.4133C100 14.0113 98.6243 11.8218 96.4609 10.7808L75.8725 0.873756C73.7862 -0.130129 71.3446 0.11576 69.5135 1.44695C69.252 1.63711 69.0028 1.84943 68.769 2.08341L29.3551 38.0415L12.1872 25.0096C10.589 23.7965 8.35363 23.8959 6.86933 25.2461L1.36303 30.2549C-0.452552 31.9064 -0.454633 34.7627 1.35853 36.417L16.2471 50.0001L1.35853 63.5832C-0.454633 65.2374 -0.452552 68.0938 1.36303 69.7453L6.86933 74.7541C8.35363 76.1043 10.589 76.2037 12.1872 74.9905L29.3551 61.9587L68.769 97.9167C69.3925 98.5406 70.1246 99.0104 70.9119 99.3171ZM75.0152 27.2989L45.1091 50.0001L75.0152 72.7012V27.2989Z"/></mask>
<filter id="vsc-shadow" x="-8.39" y="15.88" width="116.73" height="92.25" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feDropShadow dx="0" dy="0" stdDeviation="4.16667" flood-color="#000" flood-opacity="0.25"/></filter>
<filter id="vsc-shadow2" x="60.42" y="-8.08" width="47.92" height="116.15" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feDropShadow dx="0" dy="0" stdDeviation="4.16667" flood-color="#000" flood-opacity="0.25"/></filter>
<linearGradient id="vsc-sheen" x1="49.9392" y1="0.257812" x2="49.9392" y2="99.7423" gradientUnits="userSpaceOnUse"><stop stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>
<g mask="url(#vsc-mask)">
<path fill="#0065A9" d="M96.4614 10.7962L75.8569 0.875542C73.4719 -0.272773 70.6217 0.211611 68.75 2.08333L1.29858 63.5832C-0.515693 65.2373 -0.513607 68.0937 1.30308 69.7452L6.81272 74.754C8.29793 76.1042 10.5347 76.2036 12.1338 74.9905L93.3609 13.3699C96.086 11.3026 100 13.2462 100 16.6667V16.4275C100 14.0265 98.6246 11.8378 96.4614 10.7962Z"/>
<path fill="#007ACC" filter="url(#vsc-shadow)" d="M96.4614 89.2038L75.8569 99.1245C73.4719 100.273 70.6217 99.7884 68.75 97.9167L1.29858 36.4169C-0.515693 34.7627 -0.513607 31.9063 1.30308 30.2548L6.81272 25.246C8.29793 23.8958 10.5347 23.7964 12.1338 25.0095L93.3609 86.6301C96.086 88.6974 100 86.7538 100 83.3334V83.5726C100 85.9735 98.6246 88.1622 96.4614 89.2038Z"/>
<path fill="#1F9CF0" filter="url(#vsc-shadow2)" d="M75.8578 99.1263C73.4721 100.274 70.6219 99.7885 68.75 97.9166C71.0564 100.223 75 98.5895 75 95.3278V4.67213C75 1.41039 71.0564 -0.223106 68.75 2.08329C70.6219 0.211402 73.4721 -0.273666 75.8578 0.873633L96.4587 10.7807C98.6234 11.8217 100 14.0112 100 16.4132V83.5871C100 85.9891 98.6234 88.1786 96.4586 89.2196L75.8578 99.1263Z"/>
<path fill="url(#vsc-sheen)" opacity="0.25" style="mix-blend-mode:overlay" fill-rule="evenodd" clip-rule="evenodd" d="M70.8511 99.3171C72.4261 99.9306 74.2221 99.8913 75.8117 99.1264L96.4 89.2197C98.5634 88.1787 99.9392 85.9892 99.9392 83.5871V16.4133C99.9392 14.0112 98.5635 11.8217 96.4001 10.7807L75.8117 0.873695C73.7255 -0.13019 71.2838 0.115699 69.4527 1.44688C69.1912 1.63705 68.942 1.84937 68.7082 2.08335L29.2943 38.0414L12.1264 25.0096C10.5283 23.7964 8.29285 23.8959 6.80855 25.246L1.30225 30.2548C-0.513334 31.9064 -0.515415 34.7627 1.29775 36.4169L16.1863 50L1.29775 63.5832C-0.515415 65.2374 -0.513334 68.0937 1.30225 69.7452L6.80855 74.754C8.29285 76.1042 10.5283 76.2036 12.1264 74.9905L29.2943 61.9586L68.7082 97.9167C69.3317 98.5405 70.0638 99.0104 70.8511 99.3171ZM74.9544 27.2989L45.0483 50L74.9544 72.7012V27.2989Z"/>
</g></g></svg>`;

const baseName = (p) => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p;

// macOS: app shortcuts use Cmd so Ctrl stays Claude's (Ctrl+Tab stays, Cmd+Tab is the OS switcher; Alt+1..9 is Cmd+1..9).
const IS_MAC = api.platform === 'darwin';
const mod = (e) => (IS_MAC ? e.metaKey : e.ctrlKey);
/** Shortcut text for tooltips: "Ctrl+Shift+S" on Windows, "⌘⇧S" on macOS. */
const kbd = (s) => (IS_MAC
  ? s.replace(/Ctrl\+Alt\+/g, '⌘⌥').replace(/Alt\+/g, '⌘').replace(/Ctrl\+(?!Tab)/g, '⌘').replace(/Shift\+/g, '⇧')
  : s);
const SHELL_LABEL = IS_MAC ? 'Shell' : 'PowerShell';
const FILES_APP = IS_MAC ? 'Finder' : 'Explorer';

// ------------------------------------------------------------- shortcuts ----
// Every app shortcut is an action with a list of key combos, editable on the settings page (ui.keys stores only the
// actions that differ from these defaults). Combos name physical keys (KeyboardEvent.code), so Shift or Option never
// change the key: "Ctrl+Shift+KeyT". `Digits` stands for 1..9 and `Arrows` for the four arrow keys (the action gets
// the number or direction). An action that returns false didn't apply (pane keys without a split): the key then
// reaches the terminal as usual.

const M = IS_MAC ? 'Cmd' : 'Ctrl'; // macOS: Cmd, so Ctrl stays Claude's
const JUMP = IS_MAC ? 'Cmd' : 'Alt'; // Alt+1..9 / Alt+arrows are Cmd+1..9 / Cmd+arrows on macOS
const SHORTCUTS = [
  { id: 'newSession', group: 'Sessions', label: 'New Claude session', keys: [`${M}+KeyT`, `${M}+Shift+KeyT`], run: () => newSessionHere() },
  { id: 'closeSession', group: 'Sessions', label: 'Close session', keys: [`${M}+KeyW`, `${M}+Shift+KeyW`], run: () => { if (activeId) closeTab(activeId); } },
  { id: 'nextSession', group: 'Sessions', label: 'Next session', keys: ['Ctrl+Tab'], run: () => cycleTab(1) },
  { id: 'prevSession', group: 'Sessions', label: 'Previous session', keys: ['Ctrl+Shift+Tab'], run: () => cycleTab(-1) },
  { id: 'gotoSession', group: 'Sessions', label: 'Go to session 1–9', pattern: 'Digits', keys: [`${JUMP}+Digits`],
    run: (n) => { const id = [...tabs.keys()][n - 1]; if (id) activate(id); } },
  { id: 'splitRight', group: 'Split view', label: 'New session beside', keys: [`${M}+Backslash`], run: () => splitHere(false) },
  { id: 'splitDown', group: 'Split view', label: 'New session below', keys: [`${M}+Alt+Backslash`], run: () => splitHere(true) },
  { id: 'unsplit', group: 'Split view', label: 'Back to one terminal', keys: [`${M}+Shift+Backslash`], run: () => unsplit() },
  { id: 'focusPane', group: 'Split view', label: 'Move focus to the pane in that direction', hint: 'Only while split, otherwise the keys reach the terminal',
    pattern: 'Arrows', keys: [`${JUMP}+Arrows`], run: (dir) => focusPane(dir) },
  { id: 'resizePane', group: 'Split view', label: 'Resize panes', hint: 'Moves the divider in that direction, only while split',
    pattern: 'Arrows', keys: [`${M}+Alt+Arrows`], run: (dir) => nudgeSplit(dir) },
  { id: 'toggleSidebar', group: 'Window', label: 'Toggle sidebar', keys: [`${M}+KeyS`, `${M}+Shift+KeyB`], run: () => setSidebar(!ui.sidebar) },
  { id: 'toggleRside', group: 'Window', label: 'Toggle right sidebar', keys: [`${M}+Shift+KeyS`], run: () => setServers(!rsideShown()) },
  { id: 'search', group: 'Window', label: 'Search sessions', keys: [`${M}+Shift+KeyF`],
    run: () => { setSidebar(true); $('#session-search').focus(); $('#session-search').select(); } },
  { id: 'settings', group: 'Window', label: 'Settings', keys: [`${M}+Comma`], run: () => toggleSettings() },
  { id: 'zoomIn', group: 'Terminal', label: 'Larger text', keys: [`${M}+Equal`, `${M}+NumpadAdd`], run: () => setFontSize(ui.fontSize + 1) },
  { id: 'zoomOut', group: 'Terminal', label: 'Smaller text', keys: [`${M}+Minus`, `${M}+NumpadSubtract`], run: () => setFontSize(ui.fontSize - 1) },
  { id: 'zoomReset', group: 'Terminal', label: 'Default text size', keys: [`${M}+Digit0`, `${M}+Numpad0`], run: () => setFontSize(FONT_SIZE.default) },
];

const MODS = ['Ctrl', 'Alt', 'Shift', 'Cmd']; // canonical order (macOS shows ⌃⌥⇧⌘)
const normCombo = (c) => { const p = c.split('+'); const key = p.pop(); return [...MODS.filter((m) => p.includes(m)), key].join('+'); };
const comboOf = (e, key = e.code) =>
  [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Cmd', key].filter(Boolean).join('+');
const defaultKeys = (s) => s.keys.map(normCombo);

let keymap = {}; // action id -> [combo], the effective bindings

function loadKeys(saved) {
  keymap = {};
  for (const s of SHORTCUTS) {
    const own = saved && Array.isArray(saved[s.id]) ? saved[s.id].filter((c) => typeof c === 'string' && c) : null;
    keymap[s.id] = own ? [...new Set(own.map(normCombo))] : defaultKeys(s);
  }
}

const isCustom = (s) => keymap[s.id].join() !== defaultKeys(s).join();

function saveKeys() {
  const diff = {};
  for (const s of SHORTCUTS) if (isCustom(s)) diff[s.id] = keymap[s.id];
  api.setUi({ keys: diff });
}

/** Run the action bound to this key event. Exact combos win over Digits / Arrows patterns. Returns whether it was handled. */
function runShortcut(e) {
  const patterns = [];
  if (/^Digit[1-9]$/.test(e.code)) patterns.push(comboOf(e, 'Digits'));
  if (e.code.startsWith('Arrow')) patterns.push(comboOf(e, 'Arrows'));
  const exact = comboOf(e);
  const s = SHORTCUTS.find((x) => keymap[x.id].includes(exact))
    || SHORTCUTS.find((x) => x.pattern && keymap[x.id].some((c) => patterns.includes(c)));
  if (!s) return false;
  const arg = s.pattern === 'Digits' ? Number(e.code.slice(5)) : s.pattern === 'Arrows' ? e.code.slice(5).toLowerCase() : undefined;
  return s.run(arg) !== false;
}

const KEY_TEXT = {
  Backslash: '\\', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',',
  Period: '.', Slash: '/', Backquote: '`', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  Digits: '1…9', Arrows: '←↑→↓', Escape: 'Esc', NumpadAdd: 'Num+', NumpadSubtract: 'Num-',
};
const MAC_MOD = { Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Cmd: '⌘' };

/** "Ctrl+Shift+KeyT" -> "Ctrl+Shift+T" on Windows, "⇧⌘T" on macOS. */
function comboText(c) {
  const p = c.split('+');
  const code = p.pop();
  const key = KEY_TEXT[code] || code.replace(/^(Key|Digit)/, '').replace(/^Numpad/, 'Num');
  return IS_MAC ? p.map((m) => MAC_MOD[m]).join('') + key : [...p.map((m) => (m === 'Cmd' ? 'Win' : m)), key].join('+');
}
/** The first combo of an action as text ('' when unbound), and a tooltip with it: "Close session (Ctrl+W)". */
const keyText = (id) => (keymap[id]?.[0] ? comboText(keymap[id][0]) : '');
const tip = (label, id) => (keyText(id) ? `${label} (${keyText(id)})` : label);

// --------------------------------------------------------------- state ----

let projects = [];
let ui = { sidebar: true, servers: true, fontSize: 14, collapsed: [] }; // replaced by the saved state in init()
const tabs = new Map(); // id -> tab
let activeId = null;
// Split groups (runtime only): [{ ids: [tab id, 2-4 of them], cx, ry, v }], newest first; a tab is in at most one.
// The group holding activeId is on screen (activeId is its focused pane); v = stacked.
let splits = [];
const groupOf = (id) => splits.find((g) => g.ids.includes(id)) || null;
const curSplit = () => groupOf(activeId);
let tabSeq = 0; // creation counter: tabLabel numbers by it, so a new tab at the front doesn't renumber the others
let settingsOpen = false; // the settings page covers the terminal area
let rsideAuto = false; // the right sidebar was hidden by autoRside (ui.servers still holds the user's choice)
let rsideForced = false; // the user reopened it by hand in a cramped split: leave it alone until the split changes
let git = {}; // projectPath -> info | null
let ports = { ok: true, servers: [] };
let sessionsBy = {}; // projectPath -> [{ id, title, mtime, birth, model, ctx }], newest first
let usage = null; // { ok, limits: [{ kind, label, percent, resetsAt }] } plan limits from Anthropic
let update = null; // { available, behind, packaged, subjects } new commits upstream of the app's own git checkout
let updating = false; // git pull / npm install running
const expanded = new Set(); // project paths whose sessions are shown
const showMore = new Set(); // projects listing every session instead of the newest few
let query = '';
let lastActiveProject = null;
let detailKind = null; // which footer popover is open: 'usage' | 'context' | 'state'
let menuFor = null; // project path whose "…" menu is open
const infoBy = new Map(); // tab id -> { model, effort, agents } for the bar under the terminal
const imagesBy = new Map(); // tab id -> { session, items: [{ id, kind, label, file, exists }] }, newest first
const thumbsBy = new Map(); // tab id -> Map(image id -> data URL, or null when it can't be decoded)
const mcpBy = new Map(); // project path -> { ok, servers: [{ name, status, label }] } from `claude mcp list`
const definedBy = new Map(); // project path -> [{ name, model }] subagents defined in ~/.claude/agents and <project>/.claude/agents

const SESSIONS_SHOWN = 6; // rows per project (open tabs included) before "Show N more"
// The window size is not stored in transcripts, so it is derived from the model: 1M for current models (Opus/Sonnet
// 4.6+, Haiku 5+, Fable, Mythos, unknown newer ones) or a "[1m]" model, 200k for older ones (Claude 3, Haiku 4.x,
// Opus/Sonnet up to 4.5) until a session has gone past it.
const CONTEXT_WINDOW = 200000;
const CONTEXT_WINDOW_LARGE = 1000000;
function contextWindow(model, used) {
  const m = String(model || '').toLowerCase();
  if (used > CONTEXT_WINDOW || m.includes('[1m]')) return CONTEXT_WINDOW_LARGE;
  if (/claude-(instant|2|3)\b/.test(m)) return CONTEXT_WINDOW;
  // "claude-sonnet-4-5-20250929", "Sonnet 4.5", "claude-haiku-5-5"; the (?!\d) keeps a date out of the minor version
  const v = /(haiku|sonnet|opus)[- ]?(\d+)(?:[-.](\d)(?!\d))?/.exec(m);
  if (!v) return CONTEXT_WINDOW_LARGE;
  const ver = Number(v[2]) + Number(v[3] || 0) / 10;
  return (v[1] === 'haiku' ? ver < 5 : ver < 4.6) ? CONTEXT_WINDOW : CONTEXT_WINDOW_LARGE;
}
const WINDOW_NOTE = 'Approximate: the window size is assumed from the model (1M for current models, 200k for Haiku 4.x and Opus/Sonnet up to 4.5). Type /context in the tab for exact numbers.';

// Terminal typography. A light body weight with a clearly heavier bold, and generous line spacing, so
// headings, prose, code and dim "thinking"/tool lines stay distinguishable. Size is user-adjustable (Ctrl +/-/0).
const TERM_FONT = {
  fontFamily: '"Cascadia Mono", Consolas, Menlo, monospace', // Menlo: macOS
  fontWeight: '300',
  fontWeightBold: '700',
  minimumContrastRatio: 3, // keeps brightBlack text (shell flags, hints) readable now that brightBlack is a dark bar
  lineHeight: 1.4,
  letterSpacing: 0.2,
};
const FONT_SIZE = { min: 10, max: 24, default: 14 };

const XTERM_THEME = {
  background: cssVar('--background'),
  foreground: '#dcdcdc',
  cursor: '#eaeaea',
  cursorAccent: cssVar('--background'),
  selectionBackground: 'rgba(255, 255, 255, 0.22)',
  black: '#2a2a2a', red: '#e5736f', green: '#86c06c', yellow: '#e2b657',
  blue: '#6fa8dc', magenta: '#c490d1', cyan: '#6ec5c0', white: '#b0b0b0',
  brightBlack: '#262626', // the user's message bar: one step above --background (#0a0a0a)
  brightRed: '#f0908c', brightGreen: '#a3d58b', brightYellow: '#efce7d',
  brightBlue: '#8cc2f0', brightMagenta: '#d8aee3', brightCyan: '#92d9d4', brightWhite: '#ffffff',
};

// -------------------------------------------------------------- dialogs ----

/**
 * In-app confirm dialog. `items` is an optional list of { name, sub } rows.
 * Destructive dialogs start with Cancel focused and ignore a bare Enter, so a stray keypress can't confirm.
 */
let cancelDialog = null; // the open confirmDialog's cancel: a new one first resolves the old one as cancelled
function confirmDialog({ title, message, items = [], okLabel = 'OK', cancelLabel = 'Cancel', danger = false }) {
  cancelDialog?.();
  closeModal?.();
  return new Promise((resolve) => {
    const modal = $('#modal');
    const done = (result) => {
      if (cancelDialog !== cancel) return; // already settled
      cancelDialog = null;
      window.removeEventListener('keydown', onKey, true);
      modal.hidden = true;
      modal.replaceChildren();
      activeTab()?.term.focus();
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') done(false);
      else if (e.key === 'Enter' && !danger) done(true);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    const cancelBtn = h('button', { class: 'btn outline', onclick: () => done(false) }, cancelLabel);
    modal.replaceChildren(
      h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true' },
        h('h3', {}, title),
        message ? h('p', {}, message) : null,
        items.length
          ? h('ul', { class: 'items' }, items.map((it) =>
              h('li', {}, h('span', { class: 'it-name' }, it.name), h('span', { class: 'it-sub' }, it.sub))))
          : null,
        h('div', { class: 'row' },
          cancelBtn,
          h('button', { class: `btn ${danger ? 'destructive' : 'primary'}`, onclick: () => done(true) }, okLabel))));
    const cancel = () => done(false);
    cancelDialog = cancel;
    modal.hidden = false;
    window.addEventListener('keydown', onKey, true);
    cancelBtn.focus();
  });
}

/**
 * Read-only popup in #modal with a title row and a body: Esc, a click on the backdrop and × close it.
 * Returns `isOpen()` for "closed while loading" checks. A new popup closes the previous one, and settles an open
 * confirmDialog as cancelled.
 */
let closeModal = null;
function openModal(title, extra, body) {
  closeModal?.();
  cancelDialog?.();
  const modal = $('#modal');
  let open = true;
  const done = () => {
    if (!open) return;
    open = false;
    closeModal = null;
    window.removeEventListener('keydown', onKey, true);
    modal.onclick = null;
    modal.hidden = true;
    modal.replaceChildren();
    activeTab()?.term.focus();
  };
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    done();
    e.preventDefault();
    e.stopPropagation();
  };
  modal.replaceChildren(
    h('div', { class: 'dialog wide', role: 'dialog', 'aria-modal': 'true', onclick: (e) => e.stopPropagation() },
      h('div', { class: 'ag-head' },
        h('h3', {}, title), extra,
        h('button', { class: 'btn ghost icon sm', title: 'Close (Esc)', onclick: done }, ico('x'))),
      body));
  modal.onclick = done; // click on the backdrop
  modal.hidden = false;
  window.addEventListener('keydown', onKey, true);
  closeModal = done;
  return { isOpen: () => open };
}

/** Read-only popup with a subagent's prompt: its definition's system prompt and/or what each run of it was given. */
async function agentDialog(a, tab) {
  const body = h('div', { class: 'ag-body' }, h('div', { class: 'rnote' }, 'Loading…'));
  const dlg = openModal(a.name, h('span', { class: 'ag-model mono' }, a.model ? prettyModel(a.model) : ''), body);

  const sec = (label, text) => h('section', { class: 'ag-sec' }, h('div', { class: 'ag-label' }, label), h('pre', { class: 'ag-prompt' }, text));
  let res = null;
  try { res = await api.agentPrompt(tab?.project.path, tab?.sessionId, a.name); } catch { /* shown as empty below */ }
  if (!dlg.isOpen()) return; // closed while loading
  const parts = [];
  if (res?.definition) parts.push(sec('Agent prompt', res.definition));
  const runs = res?.runs || [];
  const ctxLine = (r) => {
    if (!r.ctx) return null;
    const win = contextWindow(r.model || a.model, r.ctx);
    const pct = Math.min(100, Math.round((r.ctx / win) * 100));
    return h('div', { class: 'ag-ctx' }, h('div', { class: 'ctx-line' }, h('span', { class: 'ctx-title' }, 'Context'),
      h('span', { class: 'ctx-val' }, `${fmtTok(r.ctx)} / ${fmtTok(win)} (${pct}%)`)),
      h('span', { class: `meter big ${levelOf(pct)}`.trim() }, h('i', { style: `width:${pct}%` })));
  };
  runs.slice(0, 5).forEach((r) => parts.push(h('div', {}, ctxLine(r), sec(runs.length > 1 || res?.definition ? `Prompt given${r.description ? `: ${r.description}` : ''}` : (r.description ? `Prompt given: ${r.description}` : 'Prompt given'), r.prompt || '(empty)'))));
  if (runs.length > 5) parts.push(h('div', { class: 'rnote' }, `${runs.length - 5} older runs not shown.`));
  body.replaceChildren(...(parts.length ? parts : [h('div', { class: 'rnote' }, 'No prompt found: this agent is not defined in a file and has not run in this session.')]));
}

/** Lightbox for an image from the session (Images section): full size is fetched only now. `session` is the transcript the
 * image came from, which stays right after /clear re-points the tab. */
async function imageDialog(tab, session, it) {
  const body = h('div', { class: 'ag-body img-body' }, h('div', { class: 'rnote' }, 'Loading…'));
  const reveal = it.exists
    ? h('button', { class: 'btn outline sm', onclick: () => api.revealImage(tab.project.path, session, it.id) }, `Show in ${FILES_APP}`)
    : null;
  const dlg = openModal(it.label, [h('span', { class: 'ag-model mono', title: it.file || '' }, it.file || 'Pasted image'), reveal], body);
  let url = null;
  try { url = await api.imageFull(tab.project.path, session, it.id); } catch { /* shown below */ }
  if (!dlg.isOpen()) return;
  body.replaceChildren(url ? h('img', { class: 'img-full', src: url, alt: it.label }) : h('div', { class: 'rnote' }, 'Could not read this image.'));
}

// ----------------------------------------------------------------- tabs ----

const activeTab = () => tabs.get(activeId);
const tabsOf = (projectPath) => [...tabs.values()].filter((t) => t.project.path === projectPath);

/** The parent folders that tell a project apart from others of the same folder name ("clients" for C:\code\clients\app), else ''. */
function projParent(p) {
  const same = projects.filter((x) => x.path !== p.path && x.name.toLowerCase() === p.name.toLowerCase());
  if (!same.length) return '';
  const up = (q) => q.path.replace(/[\\/]+$/, '').split(/[\\/]/).slice(0, -1).reverse(); // nearest parent first
  const mine = up(p);
  for (let k = 1; k <= mine.length; k++) {
    const tail = mine.slice(0, k).join('/').toLowerCase();
    if (same.every((x) => up(x).slice(0, k).join('/').toLowerCase() !== tail)) return mine.slice(0, k).reverse().join('/');
  }
  return p.path;
}
/** A project's name for labels and notifications: "app (clients)" when another project is also called "app". */
const projName = (p) => { const up = projParent(p); return up ? `${p.name} (${up})` : p.name; };

/**
 * Is Claude actively working in this tab? Claude Code puts a spinner glyph in the terminal title while it
 * works and "✳" when idle, and it keeps redrawing while busy. Requiring both avoids flagging an idle
 * prompt where you are just typing, or a title that merely lingers.
 */
function isWorking(tab) {
  if (tab.kind !== 'claude' || tab.status !== 'running') return false;
  if (Date.now() - tab.lastOutput > 3000) return false;
  return !tab.title.startsWith('✳');
}

// ------------------------------------------------------- notifications ----
// "Needs input" and "Done" for Claude tabs in the background (or any tab while the window is unfocused).
// Claude Code's default notification channel sends nothing to a terminal it doesn't know (no bell, no OSC 9), and the
// transcript only records a tool call once it has run. What is reliable: the idle title ("✳", see isWorking) plus Claude's
// input dialogs (permission, AskUserQuestion, folder trust), which all end in an "Esc to cancel" footer at the bottom
// of the screen. A bell or OSC 9/777 (users who set Claude's notification channel) also counts as needs input.

const DONE_MIN_RUN = 10000; // a run shorter than this is not worth a "Done"
const DONE_IDLE = 4000; // idle this long before a run counts as finished, so a flicker between steps is one run

/** Is one of Claude's input dialogs open at the bottom of this tab's screen? */
function awaitingInput(tab) {
  const b = tab.term.buffer.active;
  for (let i = b.length - 1, seen = 0; i >= 0 && seen < 3; i--) {
    const s = b.getLine(i)?.translateToString(true).trim();
    if (!s) continue;
    seen++;
    if (s.includes('Esc to cancel')) return true;
  }
  return false;
}

function notifyTab(tab, what) {
  tab.notified = true;
  if (visibleIds().includes(tab.id) && document.hasFocus()) return; // the user is looking at it (any pane of the split)
  api.notify({ tabId: tab.id, title: `${projName(tab.project)}: ${what}`, body: paneTitle(tab) });
}

/** Called every 1.5 s per Claude tab: follows runs (working stretches) and dialogs, one notification per event. */
function trackTab(t) {
  if (t.kind !== 'claude' || t.status !== 'running') return;
  const now = Date.now();
  if (isWorking(t)) {
    if (!t.run) t.run = { start: now };
    t.run.last = now;
    t.notified = false;
    return;
  }
  if (t.title.startsWith('✳') && awaitingInput(t)) {
    if (!t.prompted) { t.prompted = true; t.run = null; notifyTab(t, 'Needs input'); }
    return;
  }
  t.prompted = false; // dialog answered: the next one is a new event
  if (t.run && now - t.run.last > DONE_IDLE) {
    const long = t.run.last - t.run.start >= DONE_MIN_RUN;
    t.run = null;
    if (long) notifyTab(t, 'Done');
  }
}

/** A bell or OSC 9/777 from Claude: needs input, unless this idle stretch was already announced (Claude's 60 s idle ping). */
function onClaudeSignal(tab) {
  if (tab.kind !== 'claude' || tab.notified || tab.prompted) return;
  tab.run = null;
  notifyTab(tab, 'Needs input');
}

function tabLabel(tab) {
  const same = [...tabs.values()].filter((t) => t.project.path === tab.project.path && t.kind === tab.kind)
    .sort((a, b) => a.seq - b.seq);
  const n = same.indexOf(tab) + 1;
  return same.length > 1 ? `${projName(tab.project)} ${n}` : projName(tab.project);
}

async function openSession(project, { kind = 'claude', args = [], resumeId = null, fork = false, beside = false, below = false, at } = {}) {
  const tab = createTab(project, { kind, args, resumeId, fork });
  if (beside) addToSplit(tab.id, at, below);
  activate(tab.id);
  fitTab(tab);
  await startPty(tab);
  return tab;
}

/** A tab with its terminal, not started and not shown yet. New tabs go first (newest on top); `append` keeps a restored order. */
function createTab(project, { kind = 'claude', args = [], resumeId = null, fork = false, append = false } = {}) {
  if (resumeId) args = ['--resume']; // main builds the real argv from resumeId; this only labels the tab
  fork = !!(fork && resumeId); // --fork-session: resumes a copy under a new session id, matched later like a fresh tab
  const id = crypto.randomUUID();
  const head = h('div', { class: 'pane-head' });
  const host = h('div', { class: 'term-host' }, head);
  $('#terminals').append(host);
  hostObserver.observe(host);
  host.addEventListener('mousedown', () => { if (activeId !== id && visibleIds().includes(id)) activate(id); }, true);

  const term = new Terminal({
    ...TERM_FONT,
    fontSize: ui.fontSize,
    cursorBlink: true,
    scrollback: 20000,
    allowProposedApi: true,
    theme: XTERM_THEME,
    // macOS (both are already the defaults on Windows): right-click must not select a word, or the contextmenu
    // handler copies it instead of pasting; Option acts as Meta so Claude's Option+P/T/B/F shortcuts work.
    rightClickSelectsWord: false,
    macOptionIsMeta: IS_MAC,
  });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  // Links open on Ctrl+click (Cmd on macOS), so a plain click in Claude's screen never opens a browser or editor by accident.
  term.loadAddon(new WebLinksAddon.WebLinksAddon((e, uri) => { if (mod(e)) api.openExternal(uri); }));
  term.open(host);

  const tab = {
    id, project, kind, args, term, fit, host, head, seq: ++tabSeq,
    resumeId, fork, sessionId: fork ? null : resumeId, startedAt: Date.now(), // sessionId of fresh/forked tabs is matched later (assignSessions)
    status: 'starting', exitCode: null, title: '',
    parked: !!resumeId && !fork && !append, // a reopened past session keeps its place until the first prompt (trackTab)
    lastActive: 0, lastOutput: 0, attention: false, busy: false, busyTimer: null,
  };
  tabs.set(id, tab);
  if (!append && !tab.parked) toFront([id]);
  term.registerLinkProvider(fileLinks(tab));
  wireTerminal(tab);
  wireScrollbar(tab);
  return tab;
}

/**
 * Reopen the tabs of the last run (main already dropped entries whose project or transcript is gone), in their saved
 * order. The active one starts first; the others follow one by one so a dozen `claude --resume` don't boot at once.
 */
async function restoreTabs(saved) {
  const bySaved = []; // saved index -> tab (null if it couldn't be made), so split groups can name their members
  for (const r of saved?.tabs || []) {
    let tab = null;
    try {
      const project = projects.find((p) => p.path === r.project);
      if (project) tab = createTab(project, { kind: r.kind, resumeId: r.kind === 'claude' ? r.sessionId : null, append: true });
    } catch { /* skip this one */ }
    bySaved.push(tab);
  }
  const made = bySaved.filter(Boolean);
  if (!made.length) return;
  made.forEach((t, i) => { t.seq = tabSeq - i; }); // saved newest first: the oldest keeps the lowest number
  for (const g of saved.splits || []) {
    const ids = [...new Set(g.tabs.map((i) => bySaved[i]?.id).filter((id) => id && !groupOf(id)))].slice(0, SPLIT_MAX);
    if (ids.length >= 2) splits.push({ ids, cx: g.cx, ry: g.ry, v: g.v, color: splits.length % GROUP_COLORS });
  }
  const first = bySaved[saved.active] || made[0];
  activate(first.id);
  fitTab(first);
  await startPty(first);
  // the panes on screen with it start next, then the rest
  const shown = visibleIds();
  for (const t of [...made.filter((x) => shown.includes(x.id)), ...made.filter((x) => !shown.includes(x.id))]) {
    if (t === first) continue;
    await new Promise((r) => setTimeout(r, 400));
    if (!tabs.has(t.id)) continue; // closed meanwhile
    // Hidden terminals can't measure themselves: start at the visible one's size, activate() refits later.
    if (t.host.offsetWidth) fitTab(t);
    else try { t.term.resize(first.term.cols, first.term.rows); } catch { /* keep 80x24 */ }
    await startPty(t).catch(() => {});
  }
}

/** Remember the open tabs for the next launch: shells, and Claude tabs once their transcript is known. Diffed, so cheap to call. */
let savedTabsKey = '';
function saveTabs() {
  const seen = new Set();
  const list = [...tabs.values()].filter((t) => {
    if (t.kind === 'shell') return true;
    if (!t.sessionId || seen.has(t.sessionId)) return false; // a session shown twice (cloneBeside) is reopened once
    seen.add(t.sessionId);
    return true;
  });
  const payload = {
    tabs: list.map((t) => ({ project: t.project.path, kind: t.kind, sessionId: t.kind === 'claude' ? t.sessionId : null })),
    active: list.indexOf(activeTab()),
    // split groups by index into `tabs`; members not saved (no transcript yet) drop out
    splits: splits.map((g) => ({
      tabs: g.ids.map((id) => list.findIndex((t) => t.id === id)).filter((i) => i >= 0),
      cx: Math.round(g.cx * 1000) / 1000, ry: Math.round(g.ry * 1000) / 1000, v: !!g.v,
    })).filter((g) => g.tabs.length >= 2),
  };
  const key = JSON.stringify(payload);
  if (key === savedTabsKey) return;
  savedTabsKey = key;
  api.saveTabs(payload);
}

async function startPty(tab) {
  if (!tabs.has(tab.id)) return;
  const res = await api.ptyCreate({
    id: tab.id, cwd: tab.project.path, kind: tab.kind, args: tab.args, resumeId: tab.resumeId, fork: tab.fork,
    cols: tab.term.cols, rows: tab.term.rows,
  });
  if (!tabs.has(tab.id)) { if (res.ok) api.ptyKill(tab.id); return; } // closed while starting
  if (res.ok) {
    tab.status = 'running';
    tab.exitCode = null;
  } else {
    tab.status = 'exited';
    showOverlay(tab, `Could not start: ${res.error}`, true);
  }
  renderSidebar(true);
  renderStatus();
}

/** A reopened past session stops keeping its place: it joins the open tabs at the front (`front` false: just clear the flag). */
function unpark(tab, front = true) {
  if (!tab.parked) return;
  tab.parked = false;
  if (front) { toFront([tab.id]); renderSidebar(true); }
}

function wireTerminal(tab) {
  const { term, host } = tab;

  term.onData((d) => {
    if (tab.parked && d.includes('\r')) unpark(tab); // Enter = the first prompt: the row moves up
    api.ptyWrite(tab.id, d);
  });
  term.onResize(({ cols, rows }) => { api.ptyResize(tab.id, cols, rows); autoRside(); });
  term.onTitleChange((t) => { tab.title = t; });
  // OSC 9 (iTerm2) and 777 (notify): what Claude sends when its notification channel is set to one of those.
  // OSC 9;4;... is a progress report (ConEmu), not a message.
  term.parser.registerOscHandler(9, (d) => { if (!/^\d+;/.test(d)) onClaudeSignal(tab); return true; });
  term.parser.registerOscHandler(777, (d) => { if (d.startsWith('notify;')) onClaudeSignal(tab); return true; });
  term.onBell(() => {
    onClaudeSignal(tab);
    if (visibleIds().includes(tab.id) && document.hasFocus()) return;
    tab.attention = true;
    renderSidebar();
    api.flash();
  });

  term.attachCustomKeyEventHandler((e) => {
    // xterm sends a plain \r for Ctrl/Shift+Enter; Claude Code reads \n (Ctrl+J) as "newline".
    if (e.key === 'Enter' && (e.ctrlKey || e.shiftKey) && !e.altKey) {
      if (e.type === 'keydown') { e.preventDefault(); api.ptyWrite(tab.id, '\n'); }
      return false;
    }
    // macOS: Ctrl+C/V belong to Claude (interrupt, image paste); Cmd+C/V come through the Edit menu as native copy/paste.
    if (IS_MAC || e.type !== 'keydown' || !e.ctrlKey || e.altKey) return true;
    const k = e.key.toLowerCase();
    if (k === 'c' && (term.hasSelection() || e.shiftKey)) {
      e.preventDefault();
      copySelection(tab);
      return false;
    }
    if (k === 'v') {
      e.preventDefault();
      pasteInto(tab);
      return false;
    }
    return true;
  });

  host.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (term.hasSelection()) copySelection(tab);
    else pasteInto(tab);
  });

  // Dropping files pastes their paths, which Claude Code understands (including images).
  host.addEventListener('dragover', (e) => e.preventDefault());
  host.addEventListener('drop', (e) => {
    e.preventDefault();
    const paths = [...e.dataTransfer.files].map((f) => api.pathForFile(f)).filter(Boolean);
    if (paths.length) term.paste(paths.map((p) => (/\s/.test(p) ? `"${p}"` : p)).join(' ') + ' ');
    term.focus();
  });
}

// File links: paths Claude prints (src/main.js:123, C:\x\y.ts:4:2, ./README.md) open in VS Code at that line. A match
// becomes a link only if main finds that file (relative to the tab's project); answers are cached briefly per folder.
// One buffer line at a time, so a path wrapped over two rows is not a link. URLs are left to the web-links addon.
const FILE_RE = /(?:[A-Za-z]:[\\/]|\.{1,2}[\\/]|[\\/])?(?:[\w.@+-]+[\\/])*[\w@+-][\w.@+-]*\.[A-Za-z][A-Za-z0-9]{0,11}(?::(\d+)(?::(\d+))?)?/g;
const URL_RE = /[a-z][a-z0-9+.-]*:\/\/\S+/gi;
const FILE_TTL = 10000;
const fileCache = new Map(); // `${cwd}\n${path}` -> { abs | null, at }

/** The line's text plus the cell column of each character (wide characters take two cells). */
function lineCells(term, y) {
  const line = term.buffer.active.getLine(y);
  if (!line) return null;
  let text = '';
  const col = [];
  for (let x = 0; x < line.length; x++) {
    const cell = line.getCell(x);
    if (!cell || cell.getWidth() === 0) continue; // second half of a wide character
    const ch = cell.getChars() || ' ';
    for (let i = 0; i < ch.length; i++) col.push(x);
    text += ch;
  }
  return { text, col };
}

function fileLinks(tab) {
  return {
    async provideLinks(y, callback) {
      const cells = lineCells(tab.term, y - 1);
      if (!cells || !/[\w]\.[A-Za-z]/.test(cells.text)) return callback(undefined);
      const urls = [...cells.text.matchAll(URL_RE)].map((m) => [m.index, m.index + m[0].length]);
      const found = [...cells.text.matchAll(FILE_RE)]
        .filter((m) => !urls.some(([a, b]) => m.index < b && m.index + m[0].length > a))
        .slice(0, 20)
        .map((m) => ({ m, file: m[0].replace(/(?::\d+){1,2}$/, '') }));
      if (!found.length) return callback(undefined);
      const cwd = tab.project.path;
      const now = Date.now();
      const ask = [...new Set(found.map((f) => f.file).filter((f) => !(fileCache.get(`${cwd}\n${f}`)?.at > now - FILE_TTL)))];
      if (ask.length) {
        try {
          const res = await api.resolveFiles(cwd, ask);
          ask.forEach((f, i) => fileCache.set(`${cwd}\n${f}`, { abs: res[i] || null, at: now }));
        } catch { /* no links this time */ }
        if (fileCache.size > 2000) fileCache.clear();
      }
      const links = found.map(({ m, file }) => {
        const abs = fileCache.get(`${cwd}\n${file}`)?.abs;
        if (!abs) return null;
        const last = m.index + m[0].length - 1;
        return {
          range: { start: { x: cells.col[m.index] + 1, y }, end: { x: cells.col[last] + 1, y } },
          text: m[0],
          decorations: { underline: true, pointerCursor: true },
          activate: (e) => mod(e) && api.openFile(abs, Number(m[1]) || null, Number(m[2]) || null),
        };
      }).filter(Boolean);
      callback(links.length ? links : undefined);
    },
  };
}

// A thin scrollbar of our own (xterm's is hidden). On the normal buffer (shells) it shows the real position.
// Claude Code's fullscreen UI runs on the alternate screen, which has no scrollback: Claude scrolls its own view,
// so there the strip forwards wheel input to it and the thumb rests in the middle (it can't know the position).
const ALT_THUMB = 40;
const DRAG_STEP = 14; // px of thumb drag per forwarded wheel notch on the alternate screen

/** Forward wheel notches to xterm, which turns them into mouse reports (Claude) or viewport scrolling (shells). */
function wheelInto(tab, notches) {
  const screen = tab.term.element?.querySelector('.xterm-screen');
  if (!screen) return;
  const r = screen.getBoundingClientRect();
  for (let i = 0; i < Math.abs(notches); i++) {
    screen.dispatchEvent(new WheelEvent('wheel', {
      deltaY: Math.sign(notches), deltaMode: WheelEvent.DOM_DELTA_LINE,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true,
    }));
  }
}

function wireScrollbar(tab) {
  const { term, host } = tab;
  const thumb = h('div', { class: 'vthumb' });
  const bar = h('div', { class: 'vbar' }, thumb);
  host.append(bar);
  let drag = null; // { y, top, sent }
  let queued = false;

  const geometry = () => {
    const buf = term.buffer.active;
    const track = bar.clientHeight;
    if (buf.type === 'alternate') return { alt: true, track, size: ALT_THUMB, top: (track - ALT_THUMB) / 2 };
    const max = buf.baseY;
    if (max <= 0) return null;
    const size = Math.max(24, Math.round((track * term.rows) / buf.length));
    return { alt: false, track, size, max, top: ((track - size) * buf.viewportY) / max };
  };

  const sync = () => {
    queued = false;
    const g = geometry();
    bar.classList.toggle('alt', !!g?.alt);
    bar.classList.toggle('empty', !g);
    if (!g) return;
    let top = g.top;
    if (drag && g.alt) top = Math.min(g.track - g.size, Math.max(0, g.top + drag.dy));
    thumb.style.height = `${g.size}px`;
    thumb.style.transform = `translateY(${Math.round(top)}px)`;
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(sync); } };
  tab.syncScrollbar = queue;
  term.onScroll(queue);
  term.onWriteParsed(queue);
  term.onResize(queue);
  term.buffer.onBufferChange(queue);

  bar.addEventListener('wheel', (e) => {
    e.preventDefault();
    wheelInto(tab, Math.sign(e.deltaY) * Math.max(1, Math.round(Math.abs(e.deltaY) / 100)));
  });

  // Clicking the track pages up/down; dragging the thumb scrolls.
  bar.addEventListener('pointerdown', (e) => {
    e.preventDefault(); // keep focus in the terminal
    const g = geometry();
    if (!g) return;
    const y = e.clientY - bar.getBoundingClientRect().top;
    if (e.target !== thumb) {
      const dir = y < g.top ? -1 : 1;
      if (g.alt) wheelInto(tab, dir * Math.max(1, term.rows - 3));
      else term.scrollPages(dir);
      return;
    }
    drag = { y: e.clientY, top: g.top, dy: 0, sent: 0 };
    bar.setPointerCapture(e.pointerId);
    bar.classList.add('dragging');
  });
  bar.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.dy = e.clientY - drag.y;
    const g = geometry();
    if (!g) return;
    if (g.alt) {
      const want = Math.trunc(drag.dy / DRAG_STEP);
      wheelInto(tab, want - drag.sent);
      drag.sent = want;
    } else {
      const ratio = Math.min(1, Math.max(0, (drag.top + drag.dy) / (g.track - g.size)));
      term.scrollToLine(Math.round(ratio * g.max));
    }
    queue();
  });
  const end = () => {
    if (!drag) return;
    drag = null;
    bar.classList.remove('dragging');
    queue();
  };
  bar.addEventListener('pointerup', end);
  bar.addEventListener('pointercancel', end);
  queue();
}

function copySelection(tab) {
  const text = tab.term.getSelection();
  if (text) api.writeClipboard(text); // Ctrl+Shift+C with nothing selected must not wipe the clipboard
  tab.term.clearSelection();
}

async function pasteInto(tab) {
  const text = await api.readClipboard();
  if (text) tab.term.paste(text);
  else if (tab.kind === 'claude') api.ptyWrite(tab.id, '\x1bv'); // Alt+V: Claude Code's image paste on Windows
}

/**
 * Exit (or failed start) overlay. A Claude tab that ended with a transcript offers Resume (that session again) and
 * New session; otherwise Restart runs the same command again.
 */
function showOverlay(tab, message, isError = false) {
  tab.host.querySelector('.overlay')?.remove();
  const resumable = !isError && tab.kind === 'claude' && !!tab.sessionId;
  tab.host.append(
    h('div', { class: `overlay${isError ? ' error' : ''}` },
      h('span', { class: 'msg' }, message),
      resumable
        ? [h('button', { class: 'btn outline sm', onclick: () => restartTab(tab, 'resume') }, ico('redo'), 'Resume'),
          h('button', { class: 'btn outline sm', onclick: () => restartTab(tab, 'fresh') }, ico('plus'), 'New session')]
        : h('button', { class: 'btn outline sm', onclick: () => restartTab(tab) }, ico('redo'), 'Restart'),
      h('button', { class: 'btn outline sm', onclick: () => closeTab(tab.id) }, 'Close tab')));
}

/** `mode`: 'resume' = the tab's current session (`--resume`), 'fresh' = a new session, else the same command as before. */
async function restartTab(tab, mode) {
  tab.host.querySelector('.overlay')?.remove();
  unpark(tab, false);
  if (mode === 'resume') { tab.resumeId = tab.sessionId; tab.args = ['--resume']; tab.fork = false; }
  if (mode === 'fresh') { tab.resumeId = null; tab.args = []; tab.fork = false; }
  tab.term.write(`\r\n\x1b[2m— ${mode === 'resume' ? 'resuming' : 'restarting'} —\x1b[0m\r\n`);
  tab.status = 'starting';
  tab.sessionId = tab.fork ? null : tab.resumeId; // a restarted fresh (or forked) tab is a new Claude session
  tab.startedAt = Date.now();
  await startPty(tab);
  tab.term.focus();
}

/** Only asks if closing interrupts something: Claude mid-task or a dev server this tab started. */
async function confirmClose(tab) {
  if (tab.status !== 'running') return true;
  let scan = ports;
  if (Date.now() - portsAt > 10000) scan = await api.listPorts();
  const servers = scan.ok ? scan.servers.filter((s) => s.owner?.type === 'session' && s.owner.sessionId === tab.id) : [];
  const working = isWorking(tab);
  if (!working && !servers.length) return true;
  return confirmDialog({
    title: 'End this session?',
    message: `Closing "${tabLabel(tab)}" will stop:`,
    items: [
      ...(working ? [{ name: 'Claude', sub: 'is working in this session' }] : []),
      ...servers.map((s) => ({ name: `:${s.port}`, sub: s.name })),
    ],
    okLabel: 'End session',
    danger: true,
  });
}

const closing = new Set(); // tab ids whose close is in progress (asking or scanning), so a second close is a no-op
async function closeTab(id) {
  const tab = tabs.get(id);
  if (!tab || closing.has(id)) return;
  closing.add(id);
  try {
    if (!(await confirmClose(tab)) || !tabs.has(id)) return;
  } finally {
    closing.delete(id);
  }
  api.ptyKill(id);
  clearTimeout(tab.busyTimer);
  tab.term.dispose();
  tab.host.remove();
  infoBy.delete(id);
  imagesBy.delete(id);
  thumbsBy.delete(id);
  hostObserver.unobserve(tab.host);
  const order = [...tabs.keys()];
  const idx = order.indexOf(id);
  const slot = groupOf(id)?.ids.indexOf(id) ?? -1;
  tabs.delete(id);
  const mates = removeFromSplit(id);
  if (activeId === id) {
    activeId = null;
    // closing a focused pane hands focus to its neighbour in the split, else to the nearest tab
    const next = slot >= 0 && mates.length ? mates[Math.min(slot, mates.length - 1)] : [...tabs.keys()][Math.min(idx, tabs.size - 1)];
    if (next) activate(next);
  } else syncVisible();
  renderAll();
  saveTabs();
}

function activate(id) {
  const tab = tabs.get(id);
  if (!tab) return;
  if (settingsOpen) toggleSettings(false);
  activeId = id;
  tab.lastActive = Date.now();
  tab.attention = false;
  syncVisible();
  requestAnimationFrame(() => tab.term.focus());
  document.body.classList.toggle('no-tabs', tabs.size === 0);
  if (tab.project.path !== lastActiveProject) { // entering a project reveals its sessions
    lastActiveProject = tab.project.path;
    if (!expanded.has(lastActiveProject)) { expanded.add(lastActiveProject); saveExpanded(); }
  }
  renderSidebar(true);
  renderStatus();
  renderFoot();
  renderInfo();
  renderRside();
  pollGit(false);
  pollInfo();
  pollMcp();
  pollDefinedAgents();
  saveTabs();
}

/**
 * Fit the terminal to its box, one row short if the renderer's rounded cell height would make the screen taller than
 * the box (it would cover the status bar). Resizes once, straight to the final size, and only when it changed: every
 * resize makes the pty redraw (Claude repaints its whole screen), so fitting to N rows and then dropping to N-1 on each
 * tab switch made the terminal jitter.
 */
function fitTab(tab) {
  try {
    const dims = tab.fit.proposeDimensions();
    if (!dims || !Number.isFinite(dims.cols) || !Number.isFinite(dims.rows)) return;
    let { cols, rows } = dims;
    const box = tab.host.querySelector('.xterm');
    // Row height = xterm's measured cell height (the value the fit addon divides by, private API). Not the screen
    // element's height / rows: right after a tab is shown that height can still be the old row count's (the WebGL
    // renderer, loaded in the same frame, updates it on its next render), so a second fit in that frame got a tiny row
    // height, skipped the check below and kept a row too many, which ran under the status bar.
    const rowH = tab.term._core?._renderService?.dimensions?.css?.cell?.height || 0;
    // the fit addon reads the host's border-box height (padding included, 30px more in a split pane), so its row
    // count can be several too many: count the rows that fit the .xterm box
    if (box && rowH && rows * rowH > box.clientHeight) rows = Math.max(1, Math.floor(box.clientHeight / rowH));
    if (cols !== tab.term.cols || rows !== tab.term.rows) tab.term.resize(cols, rows);
  } catch { /* not measurable yet */ }
}

/** Fit every visible pane (just the active tab when not split). */
function fitActive() {
  for (const id of visibleIds()) {
    const tab = tabs.get(id);
    if (tab?.host.offsetWidth) fitTab(tab);
  }
}

// ---------------------------------------------------------------- split ----
// Up to 4 tabs side by side. 2 = A|B, 3 = A|(B over C), 4 = (A B)/(C D). cx / ry are the column and row ratios.
// A stacked split (v, started with "New session below") is the same layout transposed: 2 = A over B, 3 = A over (B|C).
// There can be several split groups; focusing a member shows its group, a tab in none shows alone.

const SPLIT_MAX = 4;
const GROUP_COLORS = 5; // .split-group.g0..g4 in styles.css; one group alone is always g0 (--primary)
const SPLIT_MIN_W = 240; // px a pane keeps when a divider is dragged
const SPLIT_MIN_H = 120;
const RSIDE_MIN_COLS = 100; // below this a pane is hard to read: the right sidebar steps aside
const RSIDE_BACK_COLS = RSIDE_MIN_COLS + 6; // ...and returns only with this much room, so it can't flap

const visibleIds = () => curSplit()?.ids || (activeId ? [activeId] : []);

/**
 * Put a tab that is not on screen yet into the visible split at position `at` (default: last), or start a new group with
 * the active tab. A tab leaves its old group first. `below` stacks a new group; one already on screen keeps its orientation.
 * The group moves to the front of the tab order, so it is the newest thing in the sidebar and stays put when unsplit.
 */
function addToSplit(id, at, below = false) {
  if (!activeId || !tabs.has(id)) return;
  const cur = curSplit();
  const base = cur ? cur.ids : [activeId];
  if (base.includes(id) || base.length >= SPLIT_MAX) return;
  removeFromSplit(id);
  const ids = [...base];
  ids.splice(at ?? ids.length, 0, id);
  if (cur) cur.ids = ids;
  else {
    const used = new Set(splits.map((g) => g.color));
    let color = 0;
    while (used.has(color) && color < GROUP_COLORS) color++;
    if (color === GROUP_COLORS) color = splits.length % GROUP_COLORS; // more groups than colors: reuse
    splits.unshift({ ids, cx: 0.5, ry: 0.5, v: below, color });
  }
  rsideForced = false;
  for (const x of ids) { const t = tabs.get(x); if (t) unpark(t, false); }
  toFront(ids);
}

/** Drops a tab from its group (the tab itself stays open); a group of one is no group. Returns the remaining members. */
function removeFromSplit(id) {
  const g = groupOf(id);
  if (!g) return [];
  g.ids = g.ids.filter((x) => x !== id);
  rsideForced = false;
  if (g.ids.length < 2) splits = splits.filter((x) => x !== g);
  return g.ids;
}

/** End a split group (default: the one on screen); its tabs stay open where they are. */
function unsplit(g = curSplit()) {
  if (!g) return;
  splits = splits.filter((x) => x !== g);
  rsideForced = false;
  syncVisible();
  renderSidebar(true); // drops the split group
  saveTabs();
}

/** Move tabs to the front of the tab order (sidebar, Alt+1..9, Ctrl+Tab, saved order), keeping their given order. */
function toFront(ids) {
  const order = [...ids, ...[...tabs.keys()].filter((x) => !ids.includes(x))];
  if (order.join() === [...tabs.keys()].join()) return;
  const entries = order.map((x) => [x, tabs.get(x)]);
  tabs.clear();
  for (const [k, v] of entries) tabs.set(k, v);
  saveTabs();
}

/** Show exactly the visible tabs (all split members, or just the active one), then refit them. */
/**
 * WebGL renderer for panes on screen only: Chromium keeps 16 live WebGL contexts per page and drops the oldest past
 * that, so with many tabs the hidden ones use xterm's DOM renderer (free while hidden) and get WebGL back when shown.
 */
function setWebgl(t, on) {
  if (!on) {
    if (!t.gl) return;
    // The addon's dispose leaves the context to GC, and Chromium counts it until then: release it now.
    const ctx = t.host.querySelector('.xterm-screen canvas:not(.xterm-link-layer)')?.getContext('webgl2');
    t.gl.dispose();
    t.gl = null;
    try { ctx?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* already gone */ }
    return;
  }
  if (t.gl) return;
  try {
    const gl = new WebglAddon.WebglAddon();
    gl.onContextLoss(() => { gl.dispose(); if (t.gl === gl) t.gl = null; });
    t.term.loadAddon(gl);
    t.gl = gl;
  } catch {
    /* falls back to the DOM renderer */
  }
}

function syncVisible() {
  const shown = visibleIds();
  for (const t of tabs.values()) {
    t.host.classList.toggle('active', shown.includes(t.id));
    if (!shown.includes(t.id)) setWebgl(t, false);
  }
  renderSplit();
  requestAnimationFrame(() => {
    for (const id of visibleIds()) { const t = tabs.get(id); if (t) setWebgl(t, true); }
    fitActive();
    for (const id of shown) {
      const t = tabs.get(id);
      if (!t) continue;
      t.term.refresh(0, t.term.rows - 1);
      t.syncScrollbar();
    }
  });
}

/** A new session of the active tab's project beside it (`below`: under it, for a new split). */
function splitHere(below = false) {
  const tab = activeTab();
  if (!tab) return newSessionHere();
  if (visibleIds().length >= SPLIT_MAX) return;
  openSession(tab.project, { beside: true, below });
}

/**
 * Another copy of what a tab runs, opened beside: a fork of the Claude session (once it has a transcript; resuming the same
 * one would have two processes appending to one transcript), else a new session, or a fresh shell.
 */
function cloneBeside(tab, at) {
  if (tab.kind === 'shell') return openSession(tab.project, { kind: 'shell', beside: true, at });
  return openSession(tab.project, { resumeId: tab.sessionId || null, fork: !!tab.sessionId, beside: true, at });
}

/** Shift+click on a session row: show it beside the focused pane instead of replacing it. A session already on screen is opened a second time. */
function besideRow(open, openNew) {
  if (open && visibleIds().includes(open.id) && visibleIds().length >= SPLIT_MAX) return activate(open.id);
  if (visibleIds().length >= SPLIT_MAX) return; // the split is full, like splitHere
  if (!open) openNew();
  else if (visibleIds().includes(open.id)) cloneBeside(open);
  else { addToSplit(open.id); activate(open.id); }
}

// ------------------------------------------------------- drag and drop ----
// Drag a session row from the sidebar onto the terminal area (or the home screen): a preview shows the pane it would
// become in the resulting layout. The drop slot is the one (among all positions) whose pane centre is nearest the pointer.
// A session that is already on screen is opened again beside it (the same Claude session resumed in a second pane).

let dragSrc = null; // { id: tab id | null, project, resumeId } while a session row is being dragged
let dropAt = null; // the slot under the pointer, or null when nothing can be dropped

/** Pixel rect of pane `i` in an `n`-pane layout inside a W x H area (`v`: stacked, the 2/3 layouts transposed). */
function cellRect(n, i, cx, ry, W, H, v = false) {
  if (n === 1) return { x: 0, y: 0, w: W, h: H };
  if (v && n < 4) { const c = cellRect(n, i, ry, cx, H, W); return { x: c.y, y: c.x, w: c.h, h: c.w }; }
  const col = n === 2 ? i : n === 3 ? (i === 0 ? 0 : 1) : i % 2;
  const row = n === 2 || (n === 3 && i === 0) ? -1 : n === 3 ? i - 1 : i >> 1;
  return {
    x: col ? cx * W : 0, w: col ? (1 - cx) * W : cx * W,
    y: row === 1 ? ry * H : 0, h: row < 0 ? H : row === 1 ? (1 - ry) * H : ry * H,
  };
}

function rowDrag(src) {
  return {
    draggable: 'true',
    ondragstart: (e) => {
      dragSrc = src;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', src.resumeId || src.id || '');
      setTimeout(() => document.body.classList.toggle('dragging-session', !!dragSrc)); // after the drag image is taken
    },
    ondragend: endDrag,
  };
}

function endDrag() {
  const was = dragSrc;
  dragSrc = dropAt = null;
  document.body.classList.remove('dragging-session');
  $('#drop-preview').hidden = true;
  if (was) renderSidebar(true); // renders were held back while dragging
}

function wireDropZone() {
  const zone = $('#dropzone');
  const preview = $('#drop-preview');
  const box = $('#terminals');

  zone.addEventListener('dragover', (e) => {
    if (!dragSrc) return;
    const base = visibleIds(); // empty on the home screen: the whole area is the target
    if (base.length >= SPLIT_MAX) { dropAt = null; preview.hidden = true; e.dataTransfer.dropEffect = 'none'; return; }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const r = box.getBoundingClientRect();
    const n = base.length + 1;
    const cur = curSplit();
    const cx = cur?.cx ?? 0.5, ry = cur?.ry ?? 0.5, v = !!cur?.v;
    let best = null;
    for (let k = 0; k < n; k++) {
      const c = cellRect(n, k, cx, ry, r.width, r.height, v);
      const d = Math.hypot(e.clientX - r.left - (c.x + c.w / 2), e.clientY - r.top - (c.y + c.h / 2));
      if (!best || d < best.d) best = { k, c, d };
    }
    dropAt = best.k;
    preview.hidden = false;
    const { x, y, w, h } = best.c; // inset 4px so the outline sits inside the pane
    Object.assign(preview.style, { left: `${x + 4}px`, top: `${y + 4}px`, width: `${w - 8}px`, height: `${h - 8}px` });
  });
  zone.addEventListener('dragleave', (e) => {
    if (e.relatedTarget && zone.contains(e.relatedTarget)) return;
    dropAt = null;
    preview.hidden = true;
  });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    const src = dragSrc, at = dropAt;
    endDrag();
    if (!src || at == null) return;
    const tab = src.id && tabs.get(src.id);
    if (!activeId) { // home screen: just open it
      if (tab) activate(tab.id);
      else openSession(src.project, { resumeId: src.resumeId });
    } else if (!tab) openSession(src.project, { resumeId: src.resumeId, beside: true, at });
    else if (visibleIds().includes(tab.id)) cloneBeside(tab, at);
    else { addToSplit(tab.id, at); activate(tab.id); }
  });
}

/**
 * Focus the pane next to the focused one in a direction ('left' | 'right' | 'up' | 'down'): the nearest pane whose
 * centre lies that way, preferring one in line. Returns false without a split, so the keys reach the terminal.
 */
function focusPane(dir) {
  const ids = visibleIds();
  if (ids.length < 2) return false;
  const centre = (id) => { const r = tabs.get(id).host.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const [ax, ay] = centre(activeId);
  let best = null;
  for (const id of ids) {
    if (id === activeId) continue;
    const [x, y] = centre(id);
    const horiz = dir === 'left' || dir === 'right';
    const along = horiz ? (dir === 'right' ? x - ax : ax - x) : (dir === 'down' ? y - ay : ay - y);
    if (along <= 1) continue;
    const score = along + 2 * Math.abs(horiz ? y - ay : x - ax);
    if (!best || score < best.score) best = { id, score };
  }
  if (best) activate(best.id);
  return true;
}

const RESIZE_STEP = 0.05; // of the terminal area per key press

/** Keyboard resize: move the divider that runs across `dir` (Left/Right the vertical one, Up/Down the horizontal one). */
function nudgeSplit(dir) {
  if (visibleIds().length < 2) return false;
  const axis = dir === 'left' || dir === 'right' ? 'x' : 'y';
  if ($(axis === 'x' ? '#pz-v' : '#pz-h').hidden) return true; // this layout has no divider that way
  const step = dir === 'left' || dir === 'up' ? -RESIZE_STEP : RESIZE_STEP;
  const g = curSplit();
  setSplitRatio(axis, (axis === 'x' ? g.cx : g.ry) + step);
  saveTabs();
  return true;
}

/** [grid-column, grid-row] of pane `i` in an `n`-pane split (`v`: stacked, the 2/3 layouts transposed). */
function paneCell(n, i, v = false) {
  if (v && n < 4) { const [c, r] = paneCell(n, i); return [r, c]; }
  if (n === 2) return [String(i + 1), '1'];
  if (n === 3) return i === 0 ? ['1', '1 / span 2'] : ['2', String(i)];
  return [String((i % 2) + 1), String(Math.floor(i / 2) + 1)];
}

/** Grid placement, dividers and pane headers for the current split (or back to the plain single-terminal layout). */
function renderSplit() {
  const box = $('#terminals');
  const split = curSplit();
  const ids = split ? split.ids : [];
  const n = ids.length;
  const v = n > 1 && split.v;
  box.classList.toggle('split', n > 1);
  $('#split-tab').classList.toggle('on', !!split);
  $('#split-tab').title = split ? tip('Back to one terminal', 'unsplit') : tip('New session beside this one', 'splitRight');

  for (const t of tabs.values()) {
    const i = ids.indexOf(t.id);
    t.host.classList.toggle('pane', i >= 0);
    t.host.classList.toggle('focus', i >= 0 && t.id === activeId);
    const [col, row] = i < 0 ? ['', ''] : paneCell(n, i, v);
    t.host.style.gridColumn = col;
    t.host.style.gridRow = row;
  }

  // The vertical divider (at cx) and the horizontal one (at ry); a 3-pane layout's second divider spans only its half.
  const vz = $('#pz-v'), hz = $('#pz-h');
  vz.hidden = n < (v ? 3 : 2);
  hz.hidden = n < (v ? 2 : 3);
  if (n > 1) {
    const { cx, ry } = split;
    const cols = `${cx}fr ${1 - cx}fr`, rows = `${ry}fr ${1 - ry}fr`;
    box.style.gridTemplateColumns = v && n === 2 ? '1fr' : cols;
    box.style.gridTemplateRows = !v && n === 2 ? '1fr' : rows;
    vz.style.left = `calc(${cx * 100}% - 2px)`;
    vz.style.top = v && n === 3 ? `${ry * 100}%` : '0';
    hz.style.top = `calc(${ry * 100}% - 2px)`;
    hz.style.left = !v && n === 3 ? `${cx * 100}%` : '0';
  } else {
    box.style.gridTemplateColumns = box.style.gridTemplateRows = '';
  }
  renderPanes();
  autoRside();
}

/** Pane headers: status dot, title, and a button that takes the pane out of the split. Key-diffed. */
let lastPanesKey = '';
function renderPanes() {
  const ids = curSplit()?.ids || [];
  const key = JSON.stringify([ids.map((id) => { const t = tabs.get(id); return [id, tabDot(t), paneTitle(t)]; }), activeId, sessionsVer]);
  if (key === lastPanesKey) return;
  lastPanesKey = key;
  for (const id of ids) {
    const t = tabs.get(id);
    t.head.replaceChildren(
      h('span', { class: 's-mark' }, tabDot(t) ? h('i', { class: `dot ${tabDot(t)}` }) : null),
      h('span', { class: 'ph-title' }, paneTitle(t)),
      h('button', {
        class: 'btn ghost icon sm', title: tip('Close session', 'closeSession'),
        onclick: (e) => { e.stopPropagation(); closeTab(id); },
      }, ico('x')));
  }
}

/** A tab's name in the sidebar and pane headers: its transcript title once known, else a placeholder. */
function paneTitle(t) {
  const known = t.sessionId && (sessionsBy[t.project.path] || []).find((s) => s.id === t.sessionId);
  if (known) return known.title;
  if (t.kind === 'shell') {
    const shells = tabsOf(t.project.path).filter((x) => x.kind === 'shell').sort((a, b) => a.seq - b.seq);
    return `${SHELL_LABEL}${shells.length > 1 ? ' ' + (shells.indexOf(t) + 1) : ''}`;
  }
  return t.fork ? 'Forked session' : t.resumeId ? 'Resumed session' : t.args[0] === '--continue' ? 'Continued session' : 'New session';
}

/**
 * Hide the right sidebar when a split would leave a pane under RSIDE_MIN_COLS columns, bring it back when
 * there is room again (or the split ends). It never touches ui.servers, so the saved choice survives.
 */
let autoQueued = false;
function autoRside() {
  if (autoQueued) return;
  autoQueued = true;
  requestAnimationFrame(() => {
    autoQueued = false;
    const open = document.body.classList.contains('rside-open');
    const panes = visibleIds().map((id) => tabs.get(id)).filter((t) => t?.host.offsetWidth);
    const cramped = panes.length >= 2;
    if (!cramped && rsideAuto) { rsideAuto = false; applyRside(ui.servers); return; }
    if (!cramped || rsideForced) return;
    const cols = Math.min(...panes.map((t) => t.term.cols));
    if (open && ui.servers && cols < RSIDE_MIN_COLS) {
      rsideAuto = true;
      applyRside(false);
    } else if (!open && rsideAuto) {
      const main = $('#terminals').offsetWidth;
      if ((cols * (main - ui.rsideW)) / main >= RSIDE_BACK_COLS) { rsideAuto = false; applyRside(ui.servers); }
    }
  });
}

/** Set the column (x) or row (y) ratio of the split, keeping every pane at least SPLIT_MIN_W x SPLIT_MIN_H. */
function setSplitRatio(axis, v) {
  const split = curSplit();
  if (!split) return;
  const r = $('#terminals').getBoundingClientRect();
  if (axis === 'x') split.cx = Math.min(1 - SPLIT_MIN_W / r.width, Math.max(SPLIT_MIN_W / r.width, v));
  else split.ry = Math.min(1 - SPLIT_MIN_H / r.height, Math.max(SPLIT_MIN_H / r.height, v));
  renderSplit();
}

/** Dividers: drag to resize (ratio of the grid), double-click to reset. */
function wireDivider(el, axis) {
  const box = $('#terminals');
  const apply = (v) => setSplitRatio(axis, v);
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    el.setPointerCapture(e.pointerId);
    el.classList.add('drag');
    document.body.classList.add('resizing');
  });
  el.addEventListener('pointermove', (e) => {
    if (!curSplit() || !el.hasPointerCapture(e.pointerId)) return;
    const r = box.getBoundingClientRect();
    apply(axis === 'x' ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height);
  });
  const end = (e) => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    el.releasePointerCapture(e.pointerId);
    el.classList.remove('drag');
    document.body.classList.remove('resizing');
    saveTabs(); // the ratio is saved with the split, once per drag
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('dblclick', () => { if (curSplit()) { apply(0.5); saveTabs(); } });
}

const hostObserver = new ResizeObserver(() => requestAnimationFrame(fitActive));

function cycleTab(dir) {
  const ids = [...tabs.keys()];
  if (ids.length < 2) return;
  activate(ids[(ids.indexOf(activeId) + dir + ids.length) % ids.length]);
}

function focusProject(project) {
  const existing = tabsOf(project.path).sort((a, b) => b.lastActive - a.lastActive)[0];
  if (existing) activate(existing.id);
  else openSession(project);
}

// ------------------------------------------------------------- rendering ----

/** A tab's status dot: blue = needs attention (bell, or exited in the background), yellow = working, green = running. */
function tabDot(t) {
  if (t.attention) return 'attention';
  if (t.status !== 'running') return '';
  return isWorking(t) || (t.busy && t.id !== activeId) ? 'working' : 'running';
}

function gitPills(info) {
  if (info === undefined) return [h('span', { class: 'g muted' }, 'checking…')];
  if (info === null) return [h('span', { class: 'g muted' }, 'not a git repository')];

  const parts = [
    h('span', { class: 'g branch', title: info.upstream ? `Tracking ${info.upstream}` : 'No upstream branch' },
      ico('branch'), h('span', {}, info.detached ? `@${info.branch}` : info.branch)),
  ];
  if (info.conflicts) parts.push(h('span', { class: 'g conflict', title: 'Merge conflicts' }, `${info.conflicts} conflicts`));
  if (info.dirty === 0) {
    parts.push(h('span', { class: 'g clean' }, 'clean'));
  } else {
    parts.push(h('span', {
      class: 'g dirty',
      title: `${info.staged} staged, ${info.modified} modified, ${info.untracked} untracked`,
    }, `${info.dirty} changed`));
  }
  if (info.ahead) parts.push(h('span', { class: 'g sync', title: `${info.ahead} to push` }, `↑${info.ahead}`));
  if (info.behind) parts.push(h('span', { class: 'g sync', title: `${info.behind} to pull` }, `↓${info.behind}`));
  return parts;
}

function rowButton(icon, title, onClick, extraClass = '') {
  return h('button', {
    class: `btn ghost icon sm ${extraClass}`.trim(), title,
    onclick: (e) => { e.stopPropagation(); onClick(); },
  }, ico(icon));
}

const fmtAgo = (ms) => {
  const m = Math.floor((Date.now() - ms) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const hr = Math.floor(m / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  return d < 30 ? `${d}d` : `${Math.floor(d / 30)}mo`;
};

const saveExpanded = () => api.setUi({ expanded: [...expanded] });

function toggleExpand(p) {
  if (expanded.delete(p.path)) showMore.delete(p.path); // collapsing folds the list again: reopening shows the first few
  else expanded.add(p.path);
  saveExpanded();
  renderSidebar(true);
}

const tabOfSession = (id) => [...tabs.values()].find((t) => t.sessionId === id);


/**
 * Tabs we started fresh (or with --continue) don't know their transcript yet. Match each to a session of its
 * project: a new session file is created after the tab started, a continued one is the newest touched since.
 * Best effort: a Claude run in an outside terminal in the same folder could be mistaken for ours.
 */
function assignSessions() {
  const claimed = new Set([...tabs.values()].map((t) => t.sessionId).filter(Boolean));
  const pending = [...tabs.values()]
    .filter((t) => t.kind === 'claude' && !t.sessionId && t.status === 'running')
    .sort((a, b) => a.startedAt - b.startedAt);
  for (const t of pending) {
    const free = (sessionsBy[t.project.path] || []).filter((s) => !claimed.has(s.id)); // newest first
    const pick = t.args[0] === '--continue'
      ? free.find((s) => s.mtime >= t.startedAt)
      : free.filter((s) => s.birth >= t.startedAt - 1000).sort((a, b) => a.birth - b.birth)[0];
    if (pick) { t.sessionId = pick.id; claimed.add(pick.id); }
  }
  // /clear (and /resume inside a tab) switches to a new transcript: follow it, or the right sidebar keeps reading the old
  // session's subagents. Only while the tab is idle and its old transcript went quiet when the new one began (another
  // session of the same project writing meanwhile must not hijack it), and when no fresh tab of the project is still waiting for its first transcript.
  for (const t of tabs.values()) {
    if (t.kind !== 'claude' || !t.sessionId || t.status !== 'running') continue;
    const list = sessionsBy[t.project.path] || [];
    const cur = list.find((s) => s.id === t.sessionId);
    if (!cur || isWorking(t) || [...tabs.values()].some((o) => o !== t && o.kind === 'claude' && !o.sessionId && o.project.path === t.project.path)) continue;
    const next = list.filter((s) => !claimed.has(s.id) && s.birth >= t.startedAt && s.birth >= cur.mtime - 2000 && cur.mtime <= s.birth + 2000 && s.mtime > cur.mtime)
      .sort((a, b) => a.birth - b.birth)[0];
    if (next) { t.sessionId = next.id; claimed.add(next.id); infoBy.delete(t.id); }
  }
  saveTabs(); // diffed: only writes when a tab just got its transcript
}

function openSessionRow(project, s) {
  const open = tabOfSession(s.id);
  if (open) activate(open.id);
  else openSession(project, { resumeId: s.id });
}

/** The dot slot of a session row (under the project's badge): empty unless the row's tab is live. */
const dotMark = (state) => h('span', { class: 's-mark' }, state ? h('i', { class: `dot ${state}` }) : null);

/** Rows backed by an open tab show × in place of their time on hover; middle-click closes too, as on the old tabs. */
function closeButton(t) {
  return h('button', {
    class: 'btn ghost icon sm s-close', title: tip('Close', 'closeSession'),
    onclick: (e) => { e.stopPropagation(); closeTab(t.id); },
  }, ico('x'));
}
const auxClose = (t) => (e) => { if (t && e.button === 1) closeTab(t.id); };

/** Project name on rows of a split group that mixes projects, in place of the time. */
const projTag = (t, show) => (show ? h('span', { class: 's-proj' }, projName(t.project)) : null);

/** A transcript row; `t` is the open tab showing it (a session opened twice gets one row per tab). */
function sessionRow(p, s, t = null, showProject = false) {
  return h('div', {
    class: `session${t ? (t.id === activeId ? ' active' : '') + ' has-tab' : ''}`,
    'data-tab': t?.id,
    ...rowDrag({ id: t?.id || null, project: p, resumeId: s.id }),
    title: `${s.title}\n${new Date(s.last).toLocaleString()}\nDrag onto the terminal (or ${kbd('Shift+click')}) to open beside the current session\nRight-click to fork`,
    onclick: (e) => (e.shiftKey && activeId
      ? besideRow(t, () => openSession(p, { resumeId: s.id, beside: true }))
      : openSessionRow(p, s)),
    oncontextmenu: (e) => { e.preventDefault(); sessionMenu(p, s, t, e); },
    onauxclick: auxClose(t),
  },
    dotMark(t ? tabDot(t) : ''),
    h('span', { class: 's-title' }, s.title),
    showProject ? projTag(t, true) : h('span', { class: 's-time' }, fmtAgo(s.last)),
    t ? closeButton(t) : null);
}

/** An open tab's row: its transcript row once known, else a placeholder. Exited tabs stay listed so they can be closed. */
function tabRow(t, showProject = false) {
  const s = t.kind === 'claude' && t.sessionId && (sessionsBy[t.project.path] || []).find((x) => x.id === t.sessionId);
  return s ? sessionRow(t.project, s, t, showProject) : pendingRow(t, showProject);
}

/**
 * A split group's members in one soft card, like a browser tab group: inside their project's list, or at the top of the
 * sidebar when they come from different projects (each row then names its project). Clicking the header shows the
 * group when it isn't on screen; its × unsplits it. With several groups each has its own color.
 */
function splitGroup(g, showProject) {
  const members = g.ids.map((id) => tabs.get(id)).filter(Boolean);
  const live = members.some((t) => t.id === activeId);
  const color = splits.length > 1 ? g.color : 0;
  return h('div', { class: `split-group g${color}${live ? '' : ' idle'}` },
    h('div', {
      class: 'sg-head', title: live ? 'On screen side by side' : 'Click to show these side by side again',
      onclick: () => { if (!live) activate(members[0].id); },
    },
      h('span', { class: 'sg-ico' }, ico(g.v ? 'rows' : 'columns')),
      h('span', { class: 'sg-label' }, 'Split view'),
      h('span', { class: 'sg-count' }, String(members.length)),
      h('button', {
        class: 'btn ghost icon sm', title: live ? tip('Back to one terminal', 'unsplit') : 'Unsplit',
        onclick: (e) => { e.stopPropagation(); unsplit(g); },
      }, ico('x'))),
    members.map((t) => tabRow(t, showProject)));
}

/** Claude tabs before their first reply (placeholder title) and shell tabs. */
function pendingRow(t, showProject = false) {
  return h('div', {
    class: `session has-tab${t.kind === 'claude' ? ' pending' : ''}${t.id === activeId ? ' active' : ''}`,
    'data-tab': t.id,
    ...rowDrag({ id: t.id, project: t.project, resumeId: null }),
    title: t.kind === 'shell' ? `${SHELL_LABEL} in ${t.project.path}` : 'Its title appears after the first reply',
    onclick: (e) => { if (e.shiftKey && activeId) besideRow(t, null); else activate(t.id); },
    onauxclick: auxClose(t),
  },
    dotMark(tabDot(t)),
    h('span', { class: 's-title' }, paneTitle(t)),
    showProject ? projTag(t, true) : h('span', { class: 's-time' }, fmtAgo(t.startedAt)),
    closeButton(t));
}

/** ["main", "3 changed · ↑1"] for the project tooltip and the active project's sub-line. */
function gitParts(info) {
  if (info === undefined) return null;
  if (info === null) return ['not a git repository', ''];
  return [
    info.detached ? `@${info.branch}` : info.branch,
    [
      info.conflicts ? `${info.conflicts} conflicts` : null,
      info.dirty ? `${info.dirty} changed` : 'clean',
      info.ahead ? `↑${info.ahead}` : null,
      info.behind ? `↓${info.behind}` : null,
    ].filter(Boolean).join(' · '),
  ];
}
const gitSummary = (info) => gitParts(info)?.filter(Boolean).join(' · ') || null;

/** The active project's one muted line: a long branch name truncates, the counts never do. */
function gitSubLine(info) {
  const [branch, rest] = gitParts(info);
  return h('div', { class: 'p-sub' }, h('span', { class: 'p-branch' }, branch), rest ? h('span', {}, ` · ${rest}`) : null);
}

let lastSidebarKey = '';
let sessionsVer = 0; // bumped when sessionsBy changes, so the render key stays cheap
function renderSidebar(force = false) {
  if (dragSrc || projDrag) return; // rebuilding rows mid-drag would drop the dragged element; the drag's end re-renders
  document.body.classList.toggle('no-tabs', tabs.size === 0);
  const tab = activeTab();
  const activeProject = tab?.project.path;
  const key = JSON.stringify([projects, git, activeId, tab?.sessionId, sessionsVer, [...expanded], [...showMore], query,
    Math.floor(Date.now() / 60000), splits.map((g) => [g.ids, g.v, g.color]),
    [...tabs.values()].map((t) => [t.id, t.project.path, t.kind, t.sessionId, tabDot(t), t.parked])]);
  if (!force && key === lastSidebarKey) return;
  lastSidebarKey = key;
  renderPanes();

  const root = $('#projects');
  if (!projects.length) {
    root.replaceChildren(h('div', { class: 'empty-note' }, 'No projects yet.', h('br'), 'Add a folder to start a Claude session in it.'));
    return;
  }
  const q = query.trim().toLowerCase();
  // Split groups sit in their project's list where their first member is in tab order, or (mixed projects) at the top.
  const homeOf = new Map(q ? [] : splits.map((g) => {
    const paths = new Set(g.ids.map((id) => tabs.get(id)?.project.path));
    return [g, paths.size === 1 ? [...paths][0] : null];
  }));
  const openRows = (open, p) => {
    const done = new Set();
    return open.map((t) => {
      const g = homeOf.size ? groupOf(t.id) : null;
      if (!g) return tabRow(t);
      if (homeOf.get(g) !== p.path || done.has(g)) return null;
      done.add(g);
      return splitGroup(g, false);
    });
  };
  const groups = projects.map((p) => {
    const loaded = sessionsBy[p.path];
    const matches = q ? (loaded || []).filter((s) => s.title.toLowerCase().includes(q)) : loaded || [];
    if (q && !matches.length) return null;
    const isOpen = q ? true : expanded.has(p.path);
    // Open tabs first, in tab order (newest first), then the project's other sessions, newest first.
    // A reopened past session (parked, not in a split) stays among them at its own place until its first prompt.
    // Only while its transcript is listed (a restarted-as-new tab has no sessionId, so it needs its open row).
    const mine = tabsOf(p.path);
    const listed = loaded && mine.some((t) => t.parked) ? new Set(loaded.map((s) => s.id)) : null;
    const inPlace = new Set(); // session ids of parked tabs whose row stays in the list below
    for (const t of mine) if (t.parked && listed?.has(t.sessionId) && !groupOf(t.id)) inPlace.add(t.sessionId);
    const open = q ? [] : mine.filter((t) => !inPlace.has(t.sessionId));
    const openIds = new Set(open.map((t) => t.sessionId));
    const rest = matches.filter((s) => !openIds.has(s.id));
    const isActive = p.path === activeProject;

    let list = null;
    if (isOpen && (loaded || open.length)) {
      const all = q || showMore.has(p.path);
      const room = Math.max(0, SESSIONS_SHOWN - open.length); // open tabs count toward the limit but are never folded
      const shown = all ? rest : rest.filter((s, i) => i < room || inPlace.has(s.id)); // a parked tab's row is never folded away
      const hidden = rest.length - shown.length;
      list = h('div', { class: 'sessions' },
        openRows(open, p),
        rest.length
          ? shown.map((s) => sessionRow(p, s, tabOfSession(s.id)))
          : open.length ? null : h('div', { class: 's-note' }, 'No sessions yet'),
        hidden ? h('div', { class: 's-more', onclick: () => { showMore.add(p.path); renderSidebar(true); } }, `Show ${hidden} more`) : null,
        !q && showMore.has(p.path) && rest.length > room
          ? h('div', { class: 's-more', onclick: () => { showMore.delete(p.path); renderSidebar(true); } }, 'Show less')
          : null);
    }
    return h('div', { class: 'group' },
      projectRow(p, isActive, isOpen),
      isActive && git[p.path] ? gitSubLine(git[p.path]) : null,
      list);
  }).filter(Boolean);
  const mixed = splits.filter((g) => homeOf.has(g) && !homeOf.get(g));
  groups.unshift(...mixed.map((g) => h('div', { class: 'group' }, splitGroup(g, true))));
  root.replaceChildren(...(groups.length ? groups
    : [h('div', { class: 'empty-note' }, `No sessions match "${query.trim()}"`)]));
}

/** One line: chevron, folder icon, name, and a running dot (swapped for + and … on hover). */
function projectRow(p, isActive, isOpen) {
  const dots = tabsOf(p.path).map(tabDot);
  const run = ['attention', 'working', 'running'].find((d) => dots.includes(d));
  return h('div', {
    class: `project${isActive && !isOpen ? ' current' : ''}${menuFor === p.path ? ' menu-open' : ''}`,
    title: [p.path, gitSummary(git[p.path]), 'Drag to reorder'].filter(Boolean).join('\n'),
    onclick: () => toggleExpand(p), // only collapses/expands; new sessions come from + or the shortcut
    ...projDragProps(p),
  },
    h('button', {
      class: `chev${isOpen ? ' open' : ''}`, title: isOpen ? 'Hide sessions' : 'Show sessions',
      onclick: (e) => { e.stopPropagation(); toggleExpand(p); },
    }, ico('chevron')),
    h('span', { class: 'p-icon' }, ico('folder')),
    h('span', { class: 'p-name' }, p.name, projParent(p) ? h('span', { class: 'p-parent' }, projParent(p)) : null),
    h('span', { class: 'p-run', title: run ? 'Something is running' : null }, run ? h('i', { class: `dot ${run}` }) : null),
    h('div', { class: 'p-acts' },
      rowButton('plus', 'New Claude session', () => openSession(p)),
      h('button', {
        class: 'btn ghost icon sm p-more', title: 'More actions',
        onclick: (e) => { e.stopPropagation(); toggleMenu(p, e.currentTarget); },
      }, ico('more'))));
}

// ------------------------------------------------------------ "…" menu ----

const menuItem = (icon, label, run, danger = false) => h('button', {
  class: `menu-item${danger ? ' danger' : ''}`, role: 'menuitem',
  onclick: () => { closeMenu(); run(); },
}, ico(icon), label);

/** Show #menu with these items at (x, y), or ending at `flipY` when it would run off the bottom. */
function openMenu(key, items, x, y, flipY = y) {
  const el = $('#menu');
  el.replaceChildren(...items.filter(Boolean));
  el.hidden = false;
  el.style.left = `${Math.max(8, Math.min(x, window.innerWidth - el.offsetWidth - 8))}px`;
  el.style.top = `${y + el.offsetHeight > window.innerHeight - 8 ? Math.max(8, flipY - el.offsetHeight) : y}px`;
  menuFor = key;
}

function toggleMenu(p, anchor) {
  if (menuFor === p.path) { closeMenu(); return; }
  const r = anchor.getBoundingClientRect();
  openMenu(p.path, [
    menuItem('redo', 'Continue last conversation', () => openSession(p, { args: ['--continue'] })),
    menuItem('terminal', `Open ${SHELL_LABEL} here`, () => openSession(p, { kind: 'shell' })),
    menuItem('folder', `Show in ${FILES_APP}`, () => api.openFolder(p.path)),
    projects[0]?.path !== p.path ? menuItem('arrowUp', 'Move to top', () => moveProject(p.path, projects[0].path, false)) : null,
    h('div', { class: 'menu-sep' }),
    menuItem('trash', 'Remove from list', () => removeProject(p), true),
  ], r.left, r.bottom + 4, r.top - 4);
  anchor.closest('.project').classList.add('menu-open'); // keeps + and … visible; projectRow re-applies it on renders
}

/** Right-click on a transcript row: open it (beside), or fork it, i.e. resume a copy under a new session id to try another way. */
function sessionMenu(p, s, t, e) {
  const room = activeId && visibleIds().length < SPLIT_MAX;
  openMenu(`s:${s.id}`, [
    menuItem('arrowRight', t ? 'Show' : 'Open', () => openSessionRow(p, s)),
    room ? menuItem('columns', 'Open beside', () => besideRow(t, () => openSession(p, { resumeId: s.id, beside: true }))) : null,
    h('div', { class: 'menu-sep' }),
    menuItem('fork', 'Fork session', () => openSession(p, { resumeId: s.id, fork: true })),
    room ? menuItem('fork', 'Fork beside', () => openSession(p, { resumeId: s.id, fork: true, beside: true })) : null,
  ], e.clientX, e.clientY, e.clientY);
}

// Projects are reordered by dragging their rows (a line shows where the row lands) or with "Move to top".
let projDrag = null; // path of the project row being dragged

function projDragProps(p) {
  const clear = (el) => el.classList.remove('drop-before', 'drop-after');
  const after = (e) => { const r = e.currentTarget.getBoundingClientRect(); return e.clientY > r.top + r.height / 2; };
  return {
    draggable: 'true',
    ondragstart: (e) => {
      projDrag = p.path;
      closeMenu();
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', p.path);
    },
    ondragover: (e) => {
      if (!projDrag || projDrag === p.path) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      e.currentTarget.classList.toggle('drop-after', after(e));
      e.currentTarget.classList.toggle('drop-before', !after(e));
    },
    ondragleave: (e) => clear(e.currentTarget),
    ondrop: (e) => {
      e.preventDefault();
      clear(e.currentTarget);
      const from = projDrag;
      projDrag = null;
      if (from && from !== p.path) moveProject(from, p.path, after(e));
    },
    ondragend: () => { if (projDrag) { projDrag = null; renderSidebar(true); } },
  };
}

/** Put project `from` just before (or `after`) project `to`; main saves the order. */
async function moveProject(from, to, after) {
  const order = projects.map((x) => x.path).filter((x) => x !== from);
  const i = order.indexOf(to);
  if (i < 0) return;
  order.splice(i + (after ? 1 : 0), 0, from);
  projects = await api.reorderProjects(order);
  renderAll();
}

// No re-render here: closing happens on mousedown, and rebuilding the rows then would swallow the click.
function closeMenu() {
  if (!menuFor) return;
  menuFor = null;
  $('#menu').hidden = true;
  $('.project.menu-open')?.classList.remove('menu-open');
}

// ---------------------------------------------------------------- footer ----
// One slim row under the project list: compact plan usage, context of the active session
// and what is running on the right. Each stat opens a details popover (`#detail`) above it.

const fmtTok = (n) => (n < 1000 ? String(n)
  : n < 1e4 ? `${(n / 1e3).toFixed(1)}k`
  : n < 1e6 ? `${Math.round(n / 1e3)}k`
  : `${+(n / 1e6).toFixed(1)}M`);
const modelName = (m) => (m || 'unknown').replace(/^claude-/, '');
/** A limit whose window already reset counts as 0% until the next window starts. */
const limitPct = (l) => (l.resetsAt && l.resetsAt < Date.now() ? 0 : l.percent);
function fmtReset(l) {
  if (!l.resetsAt || l.resetsAt < Date.now()) return 'no active window';
  const mins = Math.max(1, Math.round((l.resetsAt - Date.now()) / 60000));
  if (mins < 60) return `resets in ${mins}m`;
  if (mins < 24 * 60) return `resets in ${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `resets ${new Date(l.resetsAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`;
}
const levelOf = (pct) => (pct >= 90 ? 'crit' : pct >= 70 ? 'warn' : '');

function contextInfo() {
  const tab = activeTab();
  if (!tab || tab.kind !== 'claude') return null;
  const session = (sessionsBy[tab.project.path] || []).find((s) => s.id === tab.sessionId) || null;
  if (!session?.ctx) return { tab, session, pct: null };
  const model = infoBy.get(tab.id)?.model || session.model;
  const win = contextWindow(model, session.ctx);
  return { tab, session, win, pct: Math.min(100, Math.round((session.ctx / win) * 100)) };
}

const liveTabs = () => [...tabs.values()].filter((t) => t.status === 'running');

function tabState(t) {
  if (t.status === 'exited') return 'exited';
  if (t.status === 'starting') return 'starting';
  return isWorking(t) ? 'working' : 'idle';
}

function fstat(kind, title, ...value) {
  return h('button', {
    class: `fstat${detailKind === kind ? ' on' : ''}`, 'data-kind': kind, title,
    onclick: () => setDetail(detailKind === kind ? null : kind),
  }, value);
}
const pctText = (pct) => h('span', { class: levelOf(pct) || null }, `${pct}%`);
/** Ring gauge (CSS conic-gradient): `pct` null = empty track. */
const gauge = (pct) => h('span', { class: `gauge ${pct == null ? '' : levelOf(pct)}`.trim(), style: `--p:${pct ?? 0}` });

let lastFootKey = '';
function renderFoot(force = false) {
  const ctx = contextInfo();
  const live = liveTabs();
  const working = live.filter(isWorking).length;
  const lim = (kind) => usage?.ok && usage.limits.find((l) => l.kind === kind);
  const sess = lim('session');
  const week = lim('weekly_all');

  const key = JSON.stringify([usage, Math.floor(Date.now() / 60000), ctx && [ctx.session?.id, ctx.session?.ctx, ctx.pct, ctx.tab.id], detailKind,
    [...tabs.values()].map((t) => [t.id, tabLabel(t), tabState(t)]), sessionsVer, settingsOpen, keyText('settings')]);
  if (!force && key === lastFootKey) return;
  lastFootKey = key;

  // Each stat is icon + value. The plan's current session limit gets the ring; weekly lives in the tooltip/popover.
  const sessPct = sess ? limitPct(sess) : null;
  const usageTip = sess
    ? [`Session usage ${sessPct}% (${fmtReset(sess)})`, week && `Weekly ${limitPct(week)}%`,
      usage.stale && `Last updated ${Math.round((Date.now() - usage.fetchedAt) / 60000)} min ago`].filter(Boolean).join('\n')
    : usage && !usage.ok ? `Plan usage unavailable: ${usage.error}` : 'Plan usage';
  $('#side-foot').replaceChildren(
    h('button', {
      class: `btn ghost icon sm${settingsOpen ? ' on' : ''}`, title: tip('Settings', 'settings'), onclick: () => toggleSettings(),
    }, ico('settings')),
    h('div', { class: 'fstats' },
      fstat('usage', usageTip, gauge(sessPct), sess ? pctText(sessPct) : '—'),
      fstat('context', ctx?.pct != null ? `Context of this session: ${ctx.pct}% of ${fmtTok(ctx.win)}` : 'Context of this session',
        ico('pie'), ctx?.pct != null ? pctText(ctx.pct) : '—'),
      fstat('state', 'Open sessions',
        h('i', { class: `dot${working ? ' working' : live.length ? ' running' : ''}` }),
        working ? `${working} working` : `${live.length} running`)));
  if (detailKind) renderDetail();
}

const dNote = (text, cls = '') => h('p', { class: `d-note ${cls}`.trim() }, text);
const dRow = (k, ...vals) => h('div', { class: 'd-row' }, h('span', { class: 'd-k' }, k), vals.map((v) => h('span', { class: 'd-v' }, v)));

const DETAILS = {
  usage() {
    if (!usage) return h('div', {}, h('h4', {}, 'Plan usage'), dNote('Loading…'));
    if (!usage.ok) return h('div', {}, h('h4', {}, 'Plan usage'), dNote(usage.error, 'err'));
    return h('div', {},
      h('h4', {}, 'Plan usage'),
      usage.limits.map((l) => {
        const pct = limitPct(l);
        return h('div', { class: 'lim' },
          h('div', { class: 'd-row' }, h('span', { class: 'd-k' }, l.label), h('span', { class: 'd-v' }, `${pct}%`)),
          h('span', { class: `meter big ${levelOf(pct)}` }, h('i', { style: `width:${pct}%` })),
          h('div', { class: 'd-reset' }, fmtReset(l)));
      }));
  },

  context() {
    const c = contextInfo();
    if (!c) return h('div', {}, h('h4', {}, 'Context'), dNote('Open a Claude tab to see how full its context is.'));
    if (c.pct == null) return h('div', {}, h('h4', {}, 'Context'), dNote('Nothing to show yet. It appears after Claude\'s first reply in this session.'));
    return h('div', {},
      h('h4', {}, 'Context'),
      h('div', { class: 'd-sub' }, c.session.title),
      h('span', { class: `meter big ${levelOf(c.pct)}` }, h('i', { style: `width:${c.pct}%` })),
      dRow('Used', `${fmtTok(c.session.ctx)} of ${fmtTok(c.win)} (${c.pct}%)`),
      dRow('Model', modelName(c.session.model)),
      dNote(WINDOW_NOTE));
  },

  state() {
    const all = [...tabs.values()];
    if (!all.length) return h('div', {}, h('h4', {}, 'Sessions'), dNote('No sessions open.'));
    return h('div', {},
      h('h4', {}, 'Sessions'),
      all.map((t) => {
        const st = tabState(t);
        return h('div', {
          class: `d-tab${t.id === activeId ? ' active' : ''}`, title: t.project.path,
          onclick: () => { setDetail(null); activate(t.id); },
        },
          h('i', { class: `dot ${st === 'working' ? 'working' : st === 'idle' ? 'running' : ''}` }),
          h('span', { class: 'd-k' }, tabLabel(t)),
          h('span', { class: 'd-v' }, st));
      }));
  },
};

function renderDetail() {
  const el = $('#detail');
  const anchor = detailKind && $(`#side-foot .fstat[data-kind="${detailKind}"]`);
  if (!anchor) { el.hidden = true; return; }
  el.replaceChildren(DETAILS[detailKind]());
  el.hidden = false;
  const r = anchor.getBoundingClientRect();
  el.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - el.offsetWidth - 8))}px`;
  el.style.bottom = `${window.innerHeight - r.top + 6}px`;
}

function setDetail(kind) {
  detailKind = kind;
  if (kind === 'usage') pollUsage();
  if (!kind) $('#detail').hidden = true;
  renderFoot(true);
}

function renderWelcome() {
  const root = $('#welcome');
  root.replaceChildren(
    h('div', { class: 'welcome-inner' },
      h('div', { class: 'big-logo', html: LOGO_IMG }),
      h('h1', {}, 'What should we build?'),
      h('p', {}, projects.length ? 'Pick a project to start a Claude session.' : 'Add a project folder to get started.'),
      projects.length
        ? h('div', { class: 'proj-list' },
            h('div', { class: 'proj-label' }, 'Projects'),
            projects.map((p) =>
              h('div', { class: 'proj', onclick: () => focusProject(p) },
                h('div', { class: 'proj-main' },
                  h('div', { class: 'p-name' }, projName(p)),
                  h('div', { class: 'p-path' }, h('bdi', {}, p.path))),
                h('div', { class: 'p-git' }, gitPills(git[p.path])),
                h('span', { class: 'proj-go' }, ico('arrowRight')))))
        : h('button', { class: 'btn primary', onclick: addProjects }, ico('folderPlus'), 'Add project'),
      h('div', { class: 'hint' },
        [['newSession', 'new session'], ['nextSession', 'switch'], ['toggleSidebar', 'sidebar'], ['toggleRside', 'side panel'], ['settings', 'settings']]
          .map(([id, label]) => (keyText(id) ? h('span', {}, h('kbd', {}, keyText(id)), ` ${label}`) : null)))));
}

// -------------------------------------------------------------- settings ----
// A page over the terminal area (gear in the sidebar footer). For now one section: the shortcuts, each editable.
// Recording a combo another action uses takes it from that action.

let recording = null; // { id, index } while waiting for keys: index of the combo to replace, or -1 to add one
let keysNote = null; // { text, err } under the section header after the last change

function toggleSettings(open = !settingsOpen) {
  if (open === settingsOpen) return;
  settingsOpen = open;
  recording = keysNote = null;
  document.body.classList.toggle('settings-open', open);
  if (open) {
    setDetail(null);
    closeMenu();
    renderSettings();
    $('#settings').scrollTop = 0;
    $('#settings').focus();
  } else {
    $('#settings').replaceChildren();
    activeTab()?.term.focus();
  }
  renderFoot(true);
}

function renderSettings() {
  if (!settingsOpen) return;
  const groups = [...new Set(SHORTCUTS.map((s) => s.group))];
  const anyCustom = SHORTCUTS.some(isCustom);
  $('#settings').replaceChildren(h('div', { class: 'set-inner' },
    h('div', { class: 'set-head' },
      h('h1', {}, 'Settings'),
      h('button', { class: 'btn ghost icon', title: 'Close (Esc)', onclick: () => toggleSettings(false) }, ico('x'))),
    h('section', {},
      h('div', { class: 'set-sec-head' },
        h('div', {},
          h('h2', {}, 'Shortcuts'),
          h('p', {}, 'Click a shortcut to change it, or + to add another. Esc cancels.')),
        anyCustom ? h('button', { class: 'btn outline sm', onclick: resetAllKeys }, 'Reset all') : null),
      keysNote ? h('div', { class: `set-note${keysNote.err ? ' err' : ''}` }, keysNote.text) : null,
      groups.map((g) => h('div', { class: 'set-group' },
        h('div', { class: 'set-label' }, g),
        SHORTCUTS.filter((s) => s.group === g).map(shortcutRow))))));
}

function shortcutRow(s) {
  const rec = recording?.id === s.id ? recording : null;
  const recChip = () => h('span', { class: 'chip rec' }, 'Press keys…');
  const chip = (c, i) => (rec?.index === i ? recChip() : h('span', { class: 'chip' },
    h('button', { class: 'chip-key', title: 'Click, then press the new keys', onclick: () => startRecording(s.id, i) }, comboText(c)),
    h('button', { class: 'chip-x', title: 'Remove', onclick: () => setKeys(s.id, keymap[s.id].filter((_, j) => j !== i)) }, ico('x'))));
  return h('div', { class: `set-row${rec ? ' recording' : ''}` },
    h('div', { class: 'set-text' },
      h('div', { class: 'set-name' }, s.label),
      s.hint ? h('div', { class: 'set-hint' }, s.hint) : null),
    h('div', { class: 'set-keys' },
      keymap[s.id].map(chip),
      rec?.index === -1 ? recChip() : null,
      !keymap[s.id].length && !rec ? h('span', { class: 'set-none' }, 'Not set') : null,
      h('button', { class: 'btn ghost icon sm', title: 'Add a shortcut', onclick: () => startRecording(s.id, -1) }, ico('plus')),
      isCustom(s)
        ? h('button', { class: 'btn ghost icon sm', title: 'Reset to default', onclick: () => setKeys(s.id, defaultKeys(s)) }, ico('undo'))
        : h('span', { class: 'set-pad' })));
}

function startRecording(id, index) {
  recording = { id, index };
  keysNote = null;
  renderSettings();
}

function setKeys(id, list, note = null) {
  keymap[id] = list;
  keysNote = note;
  saveKeys();
  keysChanged();
}

function resetAllKeys() {
  loadKeys(null);
  keysNote = null;
  saveKeys();
  keysChanged();
}

/** Tooltips, hints and the settings page show the bindings: redraw them all. */
function keysChanged() {
  applyKeyTitles();
  renderWelcome();
  renderSplit();
  lastPanesKey = '';
  renderPanes();
  renderSidebar(true);
  renderFoot(true);
  renderSettings();
}

function applyKeyTitles() {
  $('#toggle-sidebar').title = tip('Toggle sidebar', 'toggleSidebar');
  $('.search').title = tip('Search sessions', 'search');
  $('#new-tab').title = tip('New Claude session in current project', 'newSession');
  $('#close-tab').title = tip('Close session', 'closeSession');
  $('#toggle-rside').title = tip('Context, MCPs, subagents and running servers', 'toggleRside');
}

/** While recording, every keydown comes here first. Needs a real key with Ctrl, Alt or Cmd/Win (or an F key). */
function recordKey(e) {
  if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'].includes(e.key)) return; // wait for the key itself
  const s = SHORTCUTS.find((x) => x.id === recording.id);
  const plain = !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey;
  if (e.key === 'Escape' && plain) { recording = null; keysNote = null; renderSettings(); return; }
  const fail = (text) => { keysNote = { text, err: true }; renderSettings(); };
  let key = e.code;
  if (s.pattern === 'Digits') {
    if (!/^Digit[1-9]$/.test(e.code)) return fail('This one needs a number key, e.g. ' + comboText(`${JUMP}+Digit1`) + '.');
    key = 'Digits';
  } else if (s.pattern === 'Arrows') {
    if (!e.code.startsWith('Arrow')) return fail('This one needs an arrow key, e.g. ' + comboText(`${JUMP}+ArrowLeft`) + '.');
    key = 'Arrows';
  }
  if (!e.ctrlKey && !e.altKey && !e.metaKey && !/^F\d+$/.test(e.code)) {
    return fail(`Hold ${IS_MAC ? '⌘, ⌥ or ⌃' : 'Ctrl or Alt'} with the key, so typing in the terminal still works.`);
  }
  const c = comboOf(e, key);
  const from = SHORTCUTS.filter((x) => x.id !== s.id && keymap[x.id].includes(c));
  for (const x of from) keymap[x.id] = keymap[x.id].filter((k) => k !== c);
  const list = [...keymap[s.id]];
  if (recording.index >= 0) list[recording.index] = c;
  else list.push(c);
  recording = null;
  setKeys(s.id, [...new Set(list)],
    from.length ? { text: `${comboText(c)} now runs "${s.label}" instead of "${from.map((x) => x.label).join('", "')}".` } : null);
}

function renderStatus() {
  const tab = activeTab();
  const left = $('#status-left');
  left.replaceChildren();
  if (tab) {
    const info = git[tab.project.path];
    if (info) {
      left.append(h('span', { class: 'stat' }, ico('branch'), info.detached ? `@${info.branch}` : info.branch));
      left.append(info.dirty
        ? h('span', { class: 'stat warn' }, `● ${info.dirty} change${info.dirty === 1 ? '' : 's'}`)
        : h('span', { class: 'stat ok' }, '✓ clean'));
      if (info.ahead) left.append(h('span', { class: 'stat info' }, `↑${info.ahead}`));
      if (info.behind) left.append(h('span', { class: 'stat info' }, `↓${info.behind}`));
    }
    left.append(h('span', { class: 'path' }, tab.project.path));
  }
  const running = [...tabs.values()].filter((t) => t.status === 'running').length;
  $('#status-right').replaceChildren(
    h('span', { class: 'stat' }, `${running} session${running === 1 ? '' : 's'} running`));
}

// ------------------------------------------------------------ right sidebar ----
// Active tab's context fill, MCP health, subagents, and the running dev servers. Each section folds shut (ui.collapsed).

/** "node_modules/vite/bin/vite.js" -> "vite", python.exe -> "python". */
function itemName(s) {
  const pkg = /node_modules[\\/](?:\.bin[\\/])?((?:@[^\\/\s"]+[\\/])?[^\\/\s"]+)/i.exec(s.cmd || '')?.[1];
  return pkg ? pkg.replace('\\', '/') : s.name.replace(/\.exe$/i, '');
}

const MCP_STATUS = { // status -> [color class, label]
  connected: ['ok', 'connected'],
  failed: ['err', 'failed'],
  needs_client_registration: ['err', 'needs registration'],
  needs_auth: ['warn', 'needs auth'],
  disabled: ['mute', 'disabled'],
  unknown: ['mute', 'unknown'],
};
/** "plugin:design:slack" -> "slack"; the full name stays in the tooltip. */
const mcpName = (n) => (n.startsWith('plugin:') ? n.split(':').pop() : n);

const statusDot = (cls) => h('i', { class: `dot s ${cls}` });
let mcpMore = false; // MCPs that are not connected stay folded behind a "Show N more" row
let copiedPort = null; // port whose address was just copied (its row says "Copied" for a moment)

function rsection(id, title, count, ...body) {
  const open = !ui.collapsed.includes(id);
  return h('section', { class: 'rsec' },
    h('button', { class: `rsec-head${open ? ' open' : ''}`, 'aria-expanded': String(open), onclick: () => toggleRsection(id) },
      ico('chevron'), title, count != null ? h('span', { class: 'count' }, count) : null),
    open ? body.flat(2) : null);
}

function toggleRsection(id) {
  const set = new Set(ui.collapsed);
  if (!set.delete(id)) set.add(id);
  ui.collapsed = [...set];
  api.setUi({ collapsed: ui.collapsed });
  renderRside(true);
  if (id === 'images') pollImages();
}

/** One tile per image; the thumbnail arrives later (pollImages sets src on the tile already on screen). */
function imageTile(tab, session, it) {
  const url = thumbsBy.get(tab.id)?.get(it.id);
  return h('button', { class: 'img-tile', 'data-id': it.id, title: it.file || `Pasted image ${it.label}`, onclick: () => imageDialog(tab, session, it) },
    h('img', { alt: '', src: url || null }),
    h('span', { class: 'img-label' }, it.label));
}

function copyServer(s) {
  api.writeClipboard(`http://localhost:${s.port}`);
  copiedPort = s.port;
  renderRside();
  setTimeout(() => { if (copiedPort === s.port) { copiedPort = null; renderRside(); } }, 1200);
}

/** Subagents: everything defined for the project, plus built-in/plugin types that ran in this session. */
function agentRows(proj, tab) {
  const info = tab?.kind === 'claude' ? infoBy.get(tab.id) : null;
  const rows = new Map((definedBy.get(proj?.path) || []).map((d) => [d.name, { name: d.name, model: d.model, running: 0, done: 0 }]));
  for (const a of info?.agents || []) { // newest first
    if (!rows.has(a.type)) rows.set(a.type, { name: a.type, model: null, running: 0, done: 0 });
    const r = rows.get(a.type);
    if (a.running) r.running++; else r.done++;
    if (a.model && !r.live) { r.model = a.model; r.live = true; } // the model it actually ran with beats the definition's
  }
  const rank = (r) => (r.running ? 0 : r.done ? 1 : 2);
  return [...rows.values()]
    .map((r) => ({ ...r, model: !r.model || r.model === 'inherit' ? info?.model || null : r.model }))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

let lastRsideKey = '';
function renderRside(force = false) {
  const proj = currentProject();
  const ctx = contextInfo();
  const mcp = proj && mcpBy.get(proj.path);
  const agents = agentRows(proj, activeTab());
  const servers = ports.ok ? ports.servers.filter((s) => s.dev) : [];
  const tab = activeTab();
  const imgs = tab?.kind === 'claude' && tab.sessionId && imagesBy.get(tab.id)?.session === tab.sessionId ? imagesBy.get(tab.id).items : null;

  const key = JSON.stringify([ctx && [ctx.session?.ctx, ctx.pct, ctx.win], proj?.path, mcp, agents, ports.ok && servers, ports.error, ui.collapsed, copiedPort, mcpMore, tab?.id, imgs]);
  if (!force && key === lastRsideKey) return;
  lastRsideKey = key;

  const lvl = ctx?.pct != null ? levelOf(ctx.pct) : '';
  const head = ctx?.pct != null
    ? h('div', { class: 'ctx-head', title: WINDOW_NOTE },
        h('div', { class: 'ctx-line' },
          h('span', { class: 'ctx-title' }, 'Context'),
          h('span', { class: 'ctx-val' }, `${fmtTok(ctx.session.ctx)} / ${fmtTok(ctx.win)}`)),
        h('div', { class: `ctx-pct ${lvl}`.trim() }, `${ctx.pct}%`),
        h('span', { class: `meter big ${lvl}`.trim() }, h('i', { style: `width:${ctx.pct}%` })))
    : h('div', { class: 'ctx-head' },
        h('div', { class: 'ctx-line' }, h('span', { class: 'ctx-title' }, 'Context')),
        h('div', { class: 'rnote' }, ctx ? 'Shown after Claude\'s first reply.' : 'Open a Claude tab to see context.'));

  const mcpBody = !proj ? h('div', { class: 'rnote' }, 'Select a project.')
    : !mcp ? h('div', { class: 'rrow' }, statusDot('wait'), h('span', { class: 'name' }, 'Checking…'))
    : !mcp.ok ? h('div', { class: 'rnote' }, 'Could not read MCP status.')
    : !mcp.servers.length ? h('div', { class: 'rnote' }, 'No MCP servers configured.')
    : (() => {
        const mcpRow = (m) => {
          const [cls, label] = MCP_STATUS[m.status] || MCP_STATUS.unknown;
          return h('div', { class: 'rrow', title: `${m.name}: ${m.label || label}` },
            statusDot(cls), h('span', { class: 'name' }, mcpName(m.name)),
            h('span', { class: `meta t-${cls}` }, m.status === 'unknown' && m.label ? m.label : label));
        };
        const rest = mcp.servers.filter((m) => m.status !== 'connected');
        return [
          ...mcp.servers.filter((m) => m.status === 'connected').map(mcpRow),
          rest.length ? h('div', { class: 'rrow rmore', title: rest.map((m) => `${mcpName(m.name)}: ${m.label || m.status}`).join('\n'),
            onclick: () => { mcpMore = !mcpMore; renderRside(true); } }, mcpMore ? 'Show less' : `Show ${rest.length} more`) : null,
          ...(mcpMore ? rest.map(mcpRow) : []),
        ];
      })();

  const agentBody = agents.length ? agents.map((a) => {
    const st = a.running ? 'working' : a.done ? 'done' : 'idle';
    const tip = `${a.name}: ${st}${a.running > 1 ? ` (${a.running} running)` : ''}${a.done ? `, ${a.done} finished this session` : ''}`;
    return h('div', { class: 'rrow copy', title: `${tip}\nClick to see its prompt`, onclick: () => agentDialog(a, activeTab()) },
      st === 'working' ? h('i', { class: 'dot s working' }) : st === 'done' ? h('span', { class: 't-ok' }, ico('check')) : statusDot('mute'),
      h('span', { class: 'name' }, a.name),
      h('span', { class: 'meta mono' }, a.model ? prettyModel(a.model) : '—'));
  }) : h('div', { class: 'rnote' }, 'No subagents defined.');

  const runBody = !ports.ok ? h('div', { class: 'rnote t-err' }, ports.error || 'Port scan failed')
    : !servers.length ? h('div', { class: 'rnote' }, 'Nothing running.')
    : servers.map((s) => {
        const copyable = !!s.port && !/emulator|qemu|adb/i.test(`${s.name} ${s.cmd || ''}`);
        return h('div', {
          class: `rrow${copyable ? ' copy' : ''}${copiedPort === s.port ? ' copied' : ''}`,
          title: copyable ? `Copy http://localhost:${s.port}\n${kbd('Shift+click')} to open it in the browser` : (s.cmd || s.name),
          onclick: copyable ? (e) => (e.shiftKey ? api.openExternal(`http://localhost:${s.port}`) : copyServer(s)) : null,
        }, statusDot('ok'), h('span', { class: 'name' }, itemName(s)),
          h('span', { class: 'meta mono' }, copiedPort === s.port ? 'Copied' : s.port ? `:${s.port}` : ''));
      });

  const imgBody = tab?.kind !== 'claude' ? h('div', { class: 'rnote' }, 'Open a Claude tab to see its images.')
    : !imgs ? h('div', { class: 'rnote' }, tab.sessionId ? 'Loading…' : 'No images yet.')
    : !imgs.length ? h('div', { class: 'rnote' }, 'No images in this session.')
    : h('div', { class: 'img-grid' }, imgs.map((it) => imageTile(tab, tab.sessionId, it)));

  const working = agents.filter((a) => a.running).length;
  $('#rside').replaceChildren(head,
    rsection('mcp', 'MCPs', mcp?.ok ? `${mcp.servers.filter((m) => m.status === 'connected').length}/${mcp.servers.length}` : null, mcpBody),
    rsection('agents', 'Subagents', working ? `${working} working` : agents.length || null, agentBody),
    rsection('images', 'Images', imgs?.length || null, imgBody),
    rsection('running', 'Running', servers.length || null, runBody));
}

/** Both are slow-ish and rarely change: fetched per project, only while the panel is open and the window visible. */
const rsideBusy = new Set();
async function pollMcp() {
  const proj = currentProject();
  if (!proj || !rsideShown() || document.hidden || rsideBusy.has(proj.path)) return;
  rsideBusy.add(proj.path);
  try {
    const next = await api.mcpList(proj.path);
    if (JSON.stringify(next) !== JSON.stringify(mcpBy.get(proj.path))) { mcpBy.set(proj.path, next); renderRside(); }
  } finally {
    rsideBusy.delete(proj.path);
  }
}

async function pollDefinedAgents() {
  const proj = currentProject();
  if (!proj || !rsideShown() || document.hidden) return;
  const next = await api.definedAgents(proj.path);
  if (JSON.stringify(next) !== JSON.stringify(definedBy.get(proj.path))) { definedBy.set(proj.path, next); renderRside(); }
}

// --------------------------------------------------------------- session info ----
// In the status bar for a Claude tab: model, effort, and the session's subagents (from its transcript folder).

/** claude-opus-5-5 -> "Opus 5.5"; aliases ("opus") and display names pass through. */
function prettyModel(m) {
  const id = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(\[1m\])?$/i.exec(m);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  if (!id) return cap(m);
  return `${cap(id[1])} ${id[2]}${id[3] ? '.' + id[3] : ''}${id[4] ? ' (1M)' : ''}`;
}

let lastInfoKey = '';
function renderInfo() {
  const tab = activeTab();
  const show = !!tab && tab.kind === 'claude';
  const i = show ? infoBy.get(tab.id) : null;
  const key = JSON.stringify([show && tab.id, i]);
  if (key === lastInfoKey) return;
  lastInfoKey = key;

  const bar = $('#status-info');
  if (!show) { bar.replaceChildren(); return; }
  const running = i ? i.agents.filter((a) => a.running) : [];
  const done = i ? i.agents.length - running.length : 0;
  const agentTip = i?.agents.map((a) => `${a.type}${a.description ? ': ' + a.description : ''} (${a.running ? 'running' : 'done'})`).join('\n');
  bar.replaceChildren(...[
    h('span', { class: 'i-item', title: 'Model' }, ico('cpu'), h('span', { class: 'i-main' }, i?.model ? prettyModel(i.model) : '—')),
    h('span', { class: 'i-item', title: 'Effort level (/effort to change)' }, ico('zap'), i?.effort ? `${i.effort} effort` : '—'),
    i?.agents.length
      ? h('span', { class: 'i-item i-agents', title: agentTip },
          ico('users'),
          running.length ? [h('i', { class: 'dot working' }), `${running.length} running`,
            h('span', { class: 'i-names' }, running.map((a) => a.type).join(', '))] : null,
          done ? h('span', { class: 'i-done' }, `${done} subagent${done === 1 ? '' : 's'} done`) : null)
      : null,
  ].filter(Boolean));
}

const infoBusy = new Set(); // per tab, so a slow poll of one tab never drops the poll of the tab just focused
async function pollInfo() {
  const tab = activeTab();
  if (!tab || tab.kind !== 'claude') { renderInfo(); return; }
  if (infoBusy.has(tab.id) || document.hidden) return;
  infoBusy.add(tab.id);
  try {
    const next = await api.sessionInfo(tab.project.path, tab.sessionId);
    if (tabs.has(tab.id)) infoBy.set(tab.id, next);
    renderInfo(); // key-diffed, shows whichever tab is active now
    renderRside();
  } finally {
    infoBusy.delete(tab.id);
  }
  pollImages();
}

/** Images of the active session: only while the panel is open and the section expanded. Thumbnails only for new ids. */
const imagesBusy = new Set();
async function pollImages() {
  const tab = activeTab();
  if (!tab || tab.kind !== 'claude' || !tab.sessionId || !rsideShown() || ui.collapsed.includes('images') || document.hidden || imagesBusy.has(tab.id)) return;
  imagesBusy.add(tab.id);
  try {
    const session = tab.sessionId;
    const next = await api.imagesList(tab.project.path, session);
    if (!tabs.has(tab.id) || tab.sessionId !== session) return;
    if (imagesBy.get(tab.id)?.session !== session) thumbsBy.set(tab.id, new Map());
    const thumbs = thumbsBy.get(tab.id);
    for (const id of thumbs.keys()) if (!next.items.some((i) => i.id === id)) thumbs.delete(id);
    imagesBy.set(tab.id, { session, items: next.items });
    renderRside();
    for (const it of next.items) {
      if (thumbs.has(it.id)) continue;
      if (activeTab() !== tab) return; // left the tab: the rest load when it is active again
      const url = await api.imageThumb(tab.project.path, session, it.id);
      if (tab.sessionId !== session || thumbsBy.get(tab.id) !== thumbs) return;
      thumbs.set(it.id, url);
      const img = url && $(`#rside .img-tile[data-id="${CSS.escape(it.id)}"] img`);
      if (img && activeTab() === tab) img.src = url;
    }
  } finally {
    imagesBusy.delete(tab.id);
  }
}

function renderAll() {
  renderSidebar(true);
  renderWelcome();
  renderStatus();
  renderRside();
  renderFoot();
  renderInfo();
}

// --------------------------------------------------------------- actions ----

async function addProjects() {
  const { projects: list, added } = await api.addProjects();
  projects = list;
  renderAll();
  pollGit();
  if (added.length === 1) {
    const p = projects.find((x) => x.path === added[0]);
    if (p) focusProject(p);
  }
}

async function removeProject(p) {
  const ok = await confirmDialog({
    title: 'Remove project?',
    message: `"${projName(p)}" will be removed from this list. The folder itself is not touched, and open tabs stay open.`,
    okLabel: 'Remove',
    danger: true,
  });
  if (!ok) return;
  projects = await api.removeProject(p.path);
  if (expanded.delete(p.path)) saveExpanded();
  renderAll();
}

function setFontSize(size) {
  ui.fontSize = Math.min(FONT_SIZE.max, Math.max(FONT_SIZE.min, size));
  for (const t of tabs.values()) t.term.options.fontSize = ui.fontSize;
  api.setUi({ fontSize: ui.fontSize });
  requestAnimationFrame(fitActive);
}

// Sidebar widths: the CSS vars hold the live value, ui.sidebarW / ui.rsideW the saved one.
const PANEL_W = {
  sidebarW: { min: 180, max: 480, def: 232, cssVar: '--sidebar-w' },
  rsideW: { min: 240, max: 600, def: 300, cssVar: '--rside-w' },
};
const clampW = (key, w) => Math.min(PANEL_W[key].max, Math.max(PANEL_W[key].min, Math.round(w) || PANEL_W[key].def));
function applyPanelW(key, w) {
  ui[key] = clampW(key, w);
  document.documentElement.style.setProperty(PANEL_W[key].cssVar, ui[key] + 'px');
}

/** Drag handle on a divider. `widthAt(clientX)` gives the panel width for a pointer position; the terminal refits via its ResizeObserver. */
function wireResizer(el, key, widthAt) {
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    el.setPointerCapture(e.pointerId);
    el.classList.add('drag');
    document.body.classList.add('resizing');
  });
  el.addEventListener('pointermove', (e) => {
    if (el.hasPointerCapture(e.pointerId)) applyPanelW(key, widthAt(e.clientX));
  });
  const end = (e) => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    el.releasePointerCapture(e.pointerId);
    el.classList.remove('drag');
    document.body.classList.remove('resizing');
    api.setUi({ [key]: ui[key] });
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('dblclick', () => { applyPanelW(key, PANEL_W[key].def); api.setUi({ [key]: ui[key] }); });
}

/** Toggle + logo live in the sidebar's top row; while it is collapsed they move to the start of the top bar. */
function placeBrand() {
  document.body.classList.toggle('sidebar-collapsed', !ui.sidebar);
  if (ui.sidebar) $('#sidebar').prepend($('#brand'));
  else $('#topbar').prepend($('#brand'));
  placeUpdatePop(); // the update icon moved with #brand
}

function setSidebar(open) {
  ui.sidebar = open;
  if (!open && detailKind) setDetail(null);
  if (!open) closeMenu();
  placeBrand();
  api.setUi({ sidebar: open });
  requestAnimationFrame(fitActive);
}

const rsideShown = () => document.body.classList.contains('rside-open');

/** Show or hide the right sidebar without touching the saved choice (autoRside uses this directly). */
function applyRside(open) {
  document.body.classList.toggle('rside-open', open);
  $('#toggle-rside').classList.toggle('on', open);
  if (open) { renderRside(); pollPorts(); pollMcp(); pollDefinedAgents(); pollInfo(); }
  requestAnimationFrame(fitActive);
}

function setServers(open) { // the user's choice for the right sidebar (ui.servers is its saved flag)
  ui.servers = open;
  rsideAuto = false;
  rsideForced = open && visibleIds().length > 1; // reopened by hand in a split: don't hide it again
  api.setUi({ servers: open });
  applyRside(open);
}

/** Window close: only interrupt the user if quitting would stop real work. */
let closeAsked = false;
async function onCloseRequest() {
  if (closeAsked) return;
  closeAsked = true;
  try {
    const working = [...tabs.values()].filter(isWorking);

    // Dev servers started from our tabs die with the app. Reuse the last scan unless it is stale.
    let scan = ports;
    if (Date.now() - portsAt > 10000) scan = await api.listPorts();
    const servers = scan.ok ? scan.servers.filter((s) => s.owner?.type === 'session') : [];

    if (!working.length && !servers.length) return api.quit();

    const items = [
      ...working.map((t) => ({ name: tabLabel(t), sub: 'Claude is working' })),
      ...servers.map((s) => {
        const t = tabs.get(s.owner.sessionId);
        return { name: `:${s.port}`, sub: `${s.name}${t ? ' · ' + tabLabel(t) : ''}` };
      }),
    ];
    const ok = await confirmDialog({
      title: 'Quit Claude Bench?',
      message: 'Quitting will stop:',
      items,
      okLabel: 'Quit and stop',
      cancelLabel: 'Keep open',
      danger: true,
    });
    if (ok) api.quit();
  } finally {
    closeAsked = false;
  }
}

/** Update button at the end of the brand row, only while the app's repo has new commits upstream. */
function renderUpdate() {
  const n = update?.behind || 0;
  renderCheck(); // its disabled state follows `updating`
  $('#update-slot').replaceChildren(...(update?.available ? [h('button', {
    class: `btn ghost icon sm update${updating ? ' busy' : ''}`,
    title: updating ? 'Updating…' : `Update available: ${n} new commit${n === 1 ? '' : 's'}`,
    disabled: updating, onclick: runUpdate,
  }, ico('download'))] : []));
  renderUpdatePop();
}

/**
 * The icon alone is easy to miss, so a new update also opens a popover under it: what's new, Later / Update.
 * It stays until dismissed (no outside-click or Escape close: Escape belongs to Claude) and only comes back when
 * more commits arrive. Runtime only, so a restart reminds once more.
 */
let updateSeen = 0; // `behind` count the user has dismissed
let updateStep = 'info'; // 'info' | 'confirm': the popover's step (the confirm replaces the old centered dialog)
function renderUpdatePop() {
  const pop = $('#update-pop');
  if (checkNote) { // result of a manual check with nothing to install: a short note, closes itself
    pop.hidden = false;
    pop.replaceChildren(
      h('h4', {}, checkNote.error ? "Couldn't check for updates" : "You're up to date"),
      h('p', { class: 'up-sub' }, checkNote.text),
      h('div', { class: 'row' }, h('button', { class: 'btn outline sm', onclick: closeCheckNote }, 'OK')));
    placeUpdatePop();
    return;
  }
  const show = !!update?.available && (updating || update.behind > updateSeen);
  pop.hidden = !show;
  if (!show) return;
  const n = update.behind;
  const what = `${n} new commit${n === 1 ? '' : 's'}`;
  const how = update.packaged
    ? `The app closes and a separate ${IS_MAC ? 'process' : 'window'} rebuilds it (a minute or two), then reopens it.`
    : 'Pulls the update, runs npm install if dependencies changed, and restarts the app.';
  if (updating) { // progress: no buttons, the app restarts by itself
    pop.replaceChildren(
      h('h4', {}, 'Updating Claude Bench…'),
      h('p', { class: 'up-sub' }, update.packaged ? 'Closing now so the rebuild can run.' : 'Pulling changes, the app restarts when done.'),
      h('div', { class: 'up-busy' }, ico('redo'), h('span', {}, update.packaged ? 'A minute or two' : 'Hold on')));
    placeUpdatePop();
    return;
  }
  const back = () => { updateStep = 'info'; renderUpdatePop(); };
  const later = () => { updateSeen = n; updateStep = 'info'; renderUpdatePop(); activeTab()?.term.focus(); };
  const more = n - (update.subjects?.length || 0);
  const log = update.subjects?.length
    ? h('ul', { class: 'up-log' }, update.subjects.map((s) => h('li', { title: s }, s)), more > 0 ? h('li', { class: 'up-more' }, `and ${more} more`) : null)
    : null;
  if (updateStep === 'confirm') {
    const working = [...tabs.values()].filter(isWorking);
    const live = liveTabs().length;
    pop.replaceChildren(
      h('h4', {}, 'Update and restart?'),
      h('p', { class: 'up-sub' }, `${what}. ${how}`),
      log,
      live ? h('p', { class: 'up-warn' }, `${live} open session${live === 1 ? '' : 's'} end and reopen afterwards; dev servers started from them stop.`) : null,
      working.length
        ? h('ul', { class: 'up-items' }, working.map((t) => h('li', {}, h('span', { class: 'it-name' }, tabLabel(t)), h('span', { class: 'it-sub' }, 'Claude is working'))))
        : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn outline sm', onclick: back }, 'Back'),
        h('button', { class: `btn ${working.length ? 'destructive' : 'primary'} sm`, onclick: startUpdate }, 'Update and restart')));
    placeUpdatePop();
    return;
  }
  pop.replaceChildren(
    h('h4', {}, 'Update available'),
    h('p', { class: 'up-sub' }, `${what} for Claude Bench.`),
    log,
    h('div', { class: 'row' },
      h('button', { class: 'btn outline sm', onclick: later }, 'Later'),
      h('button', { class: 'btn primary sm', onclick: runUpdate }, 'Update')));
  placeUpdatePop();
}

/** Under the update icon (sidebar top row, or the top bar while the sidebar is collapsed). */
function placeUpdatePop() {
  const pop = $('#update-pop');
  if (pop.hidden) return;
  const r = $(checkNote ? '#check-slot' : '#update-slot').getBoundingClientRect();
  const left = !r.width ? 8 : checkNote ? r.left - 4 : r.right - pop.offsetWidth + 4;
  pop.style.left = `${Math.max(8, Math.min(left, window.innerWidth - pop.offsetWidth - 8))}px`;
  pop.style.top = `${(r.height ? r.bottom : 40) + 6}px`;
}

/** The always-visible refresh icon next to the app name: check for updates now (the periodic poll runs every 30 min). */
let checking = false;
let checkNote = null; // { text, error } shown in #update-pop after a manual check that found nothing to install
let checkNoteTimer = 0;
function renderCheck() {
  $('#check-slot').replaceChildren(h('button', {
    class: `btn ghost icon sm${checking ? ' busy' : ''}`,
    title: checking ? 'Checking for updates…' : 'Check for updates',
    disabled: checking || updating, onclick: checkNow,
  }, ico('redo')));
}

function closeCheckNote() {
  clearTimeout(checkNoteTimer);
  checkNote = null;
  renderUpdatePop();
  activeTab()?.term.focus();
}

async function checkNow() {
  if (checking || updating || updateBusy) return;
  checking = true;
  updateBusy = true; // keeps the periodic poll from overlapping
  clearTimeout(checkNoteTimer);
  checkNote = null;
  renderCheck();
  renderUpdatePop();
  try {
    const next = await api.checkUpdate();
    update = next;
    if (next?.available) { updateSeen = 0; updateStep = 'info'; } // reopen the "Update available" popover even if it was dismissed before
    else checkNote = next?.error ? { text: next.error, error: true } : { text: 'Claude Bench is on the latest version.' };
  } catch (e) {
    checkNote = { text: String(e?.message || e).slice(0, 160), error: true };
  } finally {
    checking = false;
    updateBusy = false;
  }
  renderCheck();
  renderUpdate();
  if (checkNote) checkNoteTimer = setTimeout(closeCheckNote, 5000);
}

/** Pull the app's own repo and restart (source runs), or close and let scripts/update.* rebuild a built copy. */
function runUpdate() { // opens the confirm step in the popover; startUpdate does the work
  if (!update?.available || updating) return;
  updateStep = 'confirm';
  updateSeen = 0;
  renderUpdatePop();
}

async function startUpdate() {
  if (!update?.available || updating) return;
  updating = true;
  renderUpdate();
  const r = await api.applyUpdate(); // on success the app restarts before this returns
  updating = false;
  renderUpdate();
  if (!r?.ok) {
    await confirmDialog({ title: 'Update failed', message: r?.error || 'Unknown error.', okLabel: 'OK', cancelLabel: 'Close' });
    pollUpdate();
  }
}

function newSessionHere() {
  const tab = activeTab();
  if (tab) openSession(tab.project);
  else if (projects.length === 1) openSession(projects[0]);
  else addProjects();
}

/** The project the top bar's shortcuts act on: the active tab's, else the only one. */
function currentProject() {
  return activeTab()?.project || (projects.length === 1 ? projects[0] : null);
}

function projectAction(fn) {
  const p = currentProject();
  if (p) fn(p);
  else if (!projects.length) addProjects();
}

// --------------------------------------------------------------- polling ----

// The active project every 4 s, all of them every 20 s (and on focus, project changes).
let gitBusy = false;
let gitTick = 0;
async function pollGit(all = true) {
  if (gitBusy || document.hidden || !projects.length) return;
  const cur = all ? null : currentProject();
  if (!all && !cur) return;
  gitBusy = true;
  try {
    const res = await api.gitStatus(all ? projects.map((p) => p.path) : [cur.path]);
    const next = all ? res : { ...git, ...res };
    if (JSON.stringify(next) !== JSON.stringify(git)) {
      git = next;
      renderSidebar();
      renderStatus();
      renderWelcome();
    }
  } finally {
    gitBusy = false;
  }
}

let sessionsBusy = false;
async function pollSessions() {
  if (sessionsBusy || document.hidden || !projects.length) return;
  sessionsBusy = true;
  try {
    const next = await api.listSessions(projects.map((p) => p.path));
    if (JSON.stringify(next) !== JSON.stringify(sessionsBy)) { sessionsBy = next; sessionsVer++; }
    assignSessions();
    renderSidebar();
    renderFoot();
    renderRside();
    pollInfo();
  } finally {
    sessionsBusy = false;
  }
}

let usageBusy = false;
let usageRetries = 0;
async function pollUsage() {
  if (usageBusy || document.hidden) return;
  usageBusy = true;
  try {
    const next = await api.getUsage();
    if (JSON.stringify(next) !== JSON.stringify(usage)) { usage = next; renderFoot(); }
    // At launch the network or token may not be ready yet: retry soon instead of waiting for the next poll.
    // Not for HTTP failures (429 above all): main backs off by Retry-After, fast retries would only extend it.
    if (!next.ok && !next.status && ++usageRetries <= 5) setTimeout(pollUsage, 3000);
    else if (next.ok) usageRetries = 0;
  } catch {
    if (++usageRetries <= 5) setTimeout(pollUsage, 3000);
  } finally {
    usageBusy = false;
  }
}

let updateBusy = false;
async function pollUpdate() {
  if (updateBusy || updating || document.hidden) return;
  updateBusy = true;
  try {
    const next = await api.checkUpdate();
    if (JSON.stringify(next) !== JSON.stringify(update)) { update = next; renderUpdate(); }
  } finally {
    updateBusy = false;
  }
}

let portsBusy = false;
let portsAt = 0;
async function pollPorts() {
  // Only the right sidebar shows ports; closeTab / onCloseRequest rescan themselves when the last scan is stale.
  if (portsBusy || document.hidden || !rsideShown()) return;
  portsBusy = true;
  try {
    const next = await api.listPorts();
    portsAt = Date.now();
    if (JSON.stringify(next) !== JSON.stringify(ports)) {
      ports = next;
      renderRside();
    }
  } finally {
    portsBusy = false;
  }
}

// ------------------------------------------------------------------ init ----

function wireGlobalEvents() {
  api.onPtyData((id, data) => {
    const tab = tabs.get(id);
    if (!tab) return;
    tab.term.write(data);
    tab.lastOutput = Date.now();
    if (!visibleIds().includes(id)) {
      if (!tab.busy) { tab.busy = true; renderSidebar(); }
      clearTimeout(tab.busyTimer);
      tab.busyTimer = setTimeout(() => { tab.busy = false; renderSidebar(); }, 1500);
    }
  });

  api.onPtyExit((id, code) => {
    const tab = tabs.get(id);
    if (!tab) return;
    tab.status = 'exited';
    tab.exitCode = code;
    tab.busy = false;
    showOverlay(tab, code === 0 ? 'Session ended.' : `Session ended (exit code ${code}).`);
    if (id !== activeId) { tab.attention = true; api.flash(); }
    renderSidebar(true);
    renderStatus();
    pollPorts();
  });

  api.onCloseRequest(onCloseRequest);
  api.onNotifyClick((id) => { if (tabs.has(id)) activate(id); });

  api.onOpenPath(async (p) => {
    if (!p) return;
    projects = (await api.getState()).projects;
    renderAll();
    const project = projects.find((x) => x.path.toLowerCase() === p.toLowerCase());
    if (project) focusProject(project);
  });

  // App shortcuts (SHORTCUTS, editable in settings). The defaults take Ctrl+T/S/W from Claude Code on purpose and
  // otherwise avoid its keys; on macOS they use Cmd. Capture phase, so the terminal never sees a handled key.
  window.addEventListener('keydown', (e) => {
    if (recording) { e.preventDefault(); e.stopPropagation(); recordKey(e); return; }
    let handled = true;
    if (e.key === 'Escape' && menuFor) closeMenu();
    else if (e.key === 'Escape' && detailKind) setDetail(null);
    else if (e.key === 'Escape' && settingsOpen && $('#modal').hidden) toggleSettings(false);
    else if (!$('#modal').hidden) handled = false; // a dialog is open: no shortcuts (Ctrl+W again would stack a second one)
    else handled = runShortcut(e);
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  window.addEventListener('focus', () => {
    pollGit(); pollPorts(); pollSessions(); pollUsage();
    if (settingsOpen) $('#settings').focus();
    else if (document.activeElement?.id !== 'session-search') activeTab()?.term.focus();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { pollGit(); pollPorts(); pollSessions(); pollUsage(); }
  });
  document.addEventListener('mousedown', (e) => {
    if (detailKind && !e.target.closest('#detail, .fstat')) setDetail(null);
    // the "…" button toggles the menu itself on click, so a mousedown on it must not close it first
    if (menuFor && !e.target.closest('#menu, .project.menu-open .p-more')) closeMenu();
  });
  window.addEventListener('blur', closeMenu);
  window.addEventListener('resize', closeMenu);
  window.addEventListener('resize', placeUpdatePop);
  $('#projects').addEventListener('scroll', closeMenu);

  const search = $('#session-search');
  let searchTimer = null;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { query = search.value; renderSidebar(true); }, 80);
  });
  search.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    search.value = '';
    query = '';
    renderSidebar(true);
    search.blur();
    activeTab()?.term.focus();
  });

  $('#new-tab').addEventListener('click', newSessionHere);
  $('#open-code').addEventListener('click', () => projectAction((p) => api.openInCode(p.path)));
  $('#open-shell').addEventListener('click', () => projectAction((p) => openSession(p, { kind: 'shell' })));
  $('#open-folder').addEventListener('click', () => projectAction((p) => api.openFolder(p.path)));
  $('#toggle-sidebar').addEventListener('click', () => setSidebar(!ui.sidebar));
  $('#toggle-rside').addEventListener('click', () => setServers(!rsideShown()));
  $('#close-tab').addEventListener('click', () => { if (activeId) closeTab(activeId); });
  $('#split-tab').addEventListener('click', () => (curSplit() ? unsplit() : splitHere()));
  wireDropZone();
  wireDivider($('#pz-v'), 'x');
  wireDivider($('#pz-h'), 'y');

  wireResizer($('#rz-left'), 'sidebarW', (x) => x);
  wireResizer($('#rz-right'), 'rsideW', (x) => window.innerWidth - x);

  new ResizeObserver(() => requestAnimationFrame(fitActive)).observe($('#terminals'));
}

async function init() {
  $('#logo').innerHTML = LOGO_IMG;
  $('#toggle-sidebar').append(ico('sidebar'));
  renderCheck();
  $('#new-tab').append(ico('plus'));
  $('#close-tab').append(ico('x'));
  $('#split-tab').append(ico('columns'));
  $('#open-code').append(h('span', { class: 'ico', html: VSCODE_SVG }));
  $('#open-shell').append(ico('terminal'));
  $('#open-folder').append(ico('folder'));
  $('#toggle-rside').append(ico('panelRight'));
  $('#search-icon').append(ico('search'));
  $('#add-project').append(ico('folderPlus'));
  $('#add-project').onclick = addProjects;
  if (IS_MAC) {
    document.body.classList.add('mac'); // room for the traffic lights (styles.css)
    for (const el of document.querySelectorAll('[title]')) {
      el.title = kbd(el.title).replace('PowerShell', SHELL_LABEL).replace('Explorer', FILES_APP);
    }
  }

  const state = await api.getState();
  projects = state.projects;
  ui = state.ui;
  ui.collapsed ||= [];
  loadKeys(ui.keys);
  applyKeyTitles();
  for (const key of Object.keys(PANEL_W)) applyPanelW(key, ui[key]);
  for (const p of ui.expanded || []) expanded.add(p);
  placeBrand();
  document.body.classList.toggle('rside-open', ui.servers);
  $('#toggle-rside').classList.toggle('on', ui.servers);

  wireGlobalEvents();
  renderAll();
  restoreTabs(state.restore).catch(() => {});

  pollGit();
  pollPorts();
  pollSessions();
  pollUsage();
  pollMcp();
  pollDefinedAgents();
  setInterval(() => pollGit(++gitTick % 5 === 0), 4000);
  setInterval(pollPorts, 6000);
  setInterval(pollSessions, 4000);
  setInterval(pollUsage, 60000);
  setInterval(pollMcp, 60000); // served from main's 5 min cache; a project change polls at once (activate)
  setTimeout(pollUpdate, 10000); // after startup settles; git fetch is network
  setInterval(pollUpdate, 30 * 60 * 1000);
  // "Working" depends on recent output, so re-check it (cheap: the renders are key-diffed).
  setInterval(() => { if (!document.hidden) { renderSidebar(); renderFoot(); } }, 1500);
  // Notifications matter most while the window is hidden, so this one runs regardless (it only reads a few buffer lines).
  setInterval(() => { for (const t of tabs.values()) trackTab(t); }, 1500);
}

init();

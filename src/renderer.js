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
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
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
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
};
const ico = (name) =>
  h('span', { class: 'ico', html: `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>` });

const LOGO_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="3" y="3" width="58" height="58" rx="14" fill="#ececec"/><path d="M22 22 L34 32 L22 42" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M38 43 H48" stroke="#111" stroke-width="5" stroke-linecap="round"/></svg>`;

const baseName = (p) => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p;

// --------------------------------------------------------------- state ----

let projects = [];
let ui = { sidebar: true, servers: false, fontSize: 14 }; // replaced by the saved state in init()
const tabs = new Map(); // id -> tab
let activeId = null;
let git = {}; // projectPath -> info | null
let ports = { ok: true, servers: [] };
let showAll = false;
let sessionsBy = {}; // projectPath -> [{ id, title, mtime, birth, model, ctx }], newest first
let usage = null; // { ok, limits: [{ kind, label, percent, resetsAt }] } plan limits from Anthropic
const expanded = new Set(); // project paths whose sessions are shown
const showMore = new Set(); // projects listing every session instead of the newest few
let query = '';
let lastActiveProject = null;
let detailKind = null; // which footer popover is open: 'usage' | 'context' | 'state'
let menuFor = null; // project path whose "…" menu is open
const infoBy = new Map(); // tab id -> { model, effort, agents } for the bar under the terminal
const seenOwned = new Set(); // servers/MCPs/browsers of our sessions already seen; a new one opens the panel

const SESSIONS_SHOWN = 8;
const CONTEXT_WINDOW = 200000; // not stored in transcripts: assume 200k, or 1M once a session has gone past it
const CONTEXT_WINDOW_LARGE = 1000000;

// Terminal typography. A light body weight with a clearly heavier bold, and generous line spacing, so
// headings, prose, code and dim "thinking"/tool lines stay distinguishable. Size is user-adjustable (Ctrl +/-/0).
const TERM_FONT = {
  fontFamily: '"Cascadia Mono", Consolas, monospace',
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
  brightBlack: '#333333', // the user's message bar: one step above --background (#171717) brightRed: '#f0908c', brightGreen: '#a3d58b', brightYellow: '#efce7d',
  brightBlue: '#8cc2f0', brightMagenta: '#d8aee3', brightCyan: '#92d9d4', brightWhite: '#ffffff',
};

// -------------------------------------------------------------- dialogs ----

/**
 * In-app confirm dialog. `items` is an optional list of { name, sub } rows.
 * Destructive dialogs start with Cancel focused and ignore a bare Enter, so a stray keypress can't confirm.
 */
function confirmDialog({ title, message, items = [], okLabel = 'OK', cancelLabel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const modal = $('#modal');
    const done = (result) => {
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
    modal.hidden = false;
    window.addEventListener('keydown', onKey, true);
    cancelBtn.focus();
  });
}

// ----------------------------------------------------------------- tabs ----

const activeTab = () => tabs.get(activeId);
const tabsOf = (projectPath) => [...tabs.values()].filter((t) => t.project.path === projectPath);

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

function tabLabel(tab) {
  const same = [...tabs.values()].filter((t) => t.project.path === tab.project.path && t.kind === tab.kind);
  const n = same.indexOf(tab) + 1;
  return same.length > 1 ? `${tab.project.name} ${n}` : tab.project.name;
}

async function openSession(project, { kind = 'claude', args = [], resumeId = null } = {}) {
  if (resumeId) args = ['--resume']; // main builds the real argv from resumeId; this only labels the tab
  const id = crypto.randomUUID();
  const host = h('div', { class: 'term-host' });
  $('#terminals').append(host);

  const term = new Terminal({
    ...TERM_FONT,
    fontSize: ui.fontSize,
    cursorBlink: true,
    scrollback: 20000,
    allowProposedApi: true,
    theme: XTERM_THEME,
  });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.loadAddon(new WebLinksAddon.WebLinksAddon((_e, uri) => api.openExternal(uri)));
  term.open(host);
  try {
    const gl = new WebglAddon.WebglAddon();
    gl.onContextLoss(() => gl.dispose());
    term.loadAddon(gl);
  } catch {
    /* falls back to the DOM renderer */
  }

  const tab = {
    id, project, kind, args, term, fit, host,
    resumeId, sessionId: resumeId, startedAt: Date.now(), // sessionId of fresh tabs is matched later (assignSessions)
    status: 'starting', exitCode: null, title: '',
    lastActive: 0, lastOutput: 0, attention: false, busy: false, busyTimer: null,
  };
  tabs.set(id, tab);
  wireTerminal(tab);
  wireScrollbar(tab);

  activate(id);
  fitTab(tab);
  await startPty(tab);
  return tab;
}

async function startPty(tab) {
  const res = await api.ptyCreate({
    id: tab.id, cwd: tab.project.path, kind: tab.kind, args: tab.args, resumeId: tab.resumeId,
    cols: tab.term.cols, rows: tab.term.rows,
  });
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

function wireTerminal(tab) {
  const { term, host } = tab;

  term.onData((d) => api.ptyWrite(tab.id, d));
  term.onResize(({ cols, rows }) => api.ptyResize(tab.id, cols, rows));
  term.onTitleChange((t) => { tab.title = t; });
  term.onBell(() => {
    if (tab.id === activeId && document.hasFocus()) return;
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
    if (e.type !== 'keydown' || !e.ctrlKey || e.altKey) return true;
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
  api.writeClipboard(tab.term.getSelection());
  tab.term.clearSelection();
}

async function pasteInto(tab) {
  const text = await api.readClipboard();
  if (text) tab.term.paste(text);
  else if (tab.kind === 'claude') api.ptyWrite(tab.id, '\x1bv'); // Alt+V: Claude Code's image paste on Windows
}

function showOverlay(tab, message, isError = false) {
  tab.host.querySelector('.overlay')?.remove();
  tab.host.append(
    h('div', { class: `overlay${isError ? ' error' : ''}` },
      h('span', { class: 'msg' }, message),
      h('button', { class: 'btn outline sm', onclick: () => restartTab(tab) }, ico('redo'), 'Restart'),
      h('button', { class: 'btn outline sm', onclick: () => closeTab(tab.id) }, 'Close tab')));
}

async function restartTab(tab) {
  tab.host.querySelector('.overlay')?.remove();
  tab.term.write('\r\n\x1b[2m— restarting —\x1b[0m\r\n');
  tab.status = 'starting';
  tab.sessionId = tab.resumeId; // a restarted fresh tab is a new Claude session
  tab.startedAt = Date.now();
  await startPty(tab);
  tab.term.focus();
}

async function closeTab(id) {
  const tab = tabs.get(id);
  if (!tab) return;
  if (tab.status === 'running') {
    const ok = await confirmDialog({
      title: 'End this session?',
      message: `"${tabLabel(tab)}" is still running. Closing it ends the session and any servers it started.`,
      okLabel: 'End session',
      danger: true,
    });
    if (!ok) return;
  }
  api.ptyKill(id);
  clearTimeout(tab.busyTimer);
  tab.term.dispose();
  tab.host.remove();
  infoBy.delete(id);
  const order = [...tabs.keys()];
  const idx = order.indexOf(id);
  tabs.delete(id);
  if (activeId === id) {
    activeId = null;
    const next = [...tabs.keys()][Math.min(idx, tabs.size - 1)];
    if (next) activate(next);
  }
  renderAll();
}

function activate(id) {
  const tab = tabs.get(id);
  if (!tab) return;
  activeId = id;
  tab.lastActive = Date.now();
  tab.attention = false;
  for (const t of tabs.values()) t.host.classList.toggle('active', t.id === id);
  requestAnimationFrame(() => {
    fitActive();
    tab.term.refresh(0, tab.term.rows - 1);
    tab.syncScrollbar();
    tab.term.focus();
  });
  document.body.classList.toggle('no-tabs', tabs.size === 0);
  if (tab.project.path !== lastActiveProject) { // entering a project reveals its sessions
    lastActiveProject = tab.project.path;
    if (!expanded.has(lastActiveProject)) { expanded.add(lastActiveProject); saveExpanded(); }
  }
  renderSidebar(true);
  renderStatus();
  renderFoot();
  renderInfo();
  pollGit();
  pollInfo();
}

/** Fit, then drop a row if the renderer's rounded cell height made the screen taller than its box (covers the status bar). */
function fitTab(tab) {
  try {
    tab.fit.fit();
    const box = tab.host.querySelector('.xterm');
    const screen = tab.host.querySelector('.xterm-screen');
    if (box && screen && tab.term.rows > 1 && screen.offsetHeight > box.clientHeight) {
      tab.term.resize(tab.term.cols, tab.term.rows - 1);
    }
  } catch { /* not measurable yet */ }
}

function fitActive() {
  const tab = activeTab();
  if (!tab || !tab.host.offsetWidth) return;
  fitTab(tab);
}

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
  if (!expanded.delete(p.path)) expanded.add(p.path);
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
    class: 'btn ghost icon sm s-close', title: 'Close (Ctrl+Shift+W)',
    onclick: (e) => { e.stopPropagation(); closeTab(t.id); },
  }, ico('x'));
}
const auxClose = (t) => (e) => { if (t && e.button === 1) closeTab(t.id); };

function sessionRow(p, s, activeSession) {
  const t = tabOfSession(s.id);
  return h('div', {
    class: `session${s.id === activeSession ? ' active' : ''}${t ? ' has-tab' : ''}`,
    title: `${s.title}\n${new Date(s.mtime).toLocaleString()}`,
    onclick: () => openSessionRow(p, s),
    onauxclick: auxClose(t),
  },
    dotMark(t ? tabDot(t) : ''),
    h('span', { class: 's-title' }, s.title),
    h('span', { class: 's-time' }, fmtAgo(s.mtime)),
    t ? closeButton(t) : null);
}

/**
 * Open tabs that have no transcript row: Claude tabs before their first reply (placeholder title) and
 * PowerShell tabs. Exited ones stay listed so they can still be focused and closed.
 */
const pendingTabs = (projectPath) => tabsOf(projectPath).filter((t) => t.kind === 'shell'
  || !(t.sessionId && (sessionsBy[projectPath] || []).some((s) => s.id === t.sessionId)));

function pendingRow(t) {
  const shells = tabsOf(t.project.path).filter((x) => x.kind === 'shell');
  const title = t.kind === 'shell'
    ? `PowerShell${shells.length > 1 ? ' ' + (shells.indexOf(t) + 1) : ''}`
    : t.resumeId ? 'Resumed session' : t.args[0] === '--continue' ? 'Continued session' : 'New session';
  return h('div', {
    class: `session has-tab${t.kind === 'claude' ? ' pending' : ''}${t.id === activeId ? ' active' : ''}`,
    title: t.kind === 'shell' ? `PowerShell in ${t.project.path}` : 'Its title appears after the first reply',
    onclick: () => activate(t.id),
    onauxclick: auxClose(t),
  },
    dotMark(tabDot(t)),
    h('span', { class: 's-title' }, title),
    h('span', { class: 's-time' }, fmtAgo(t.startedAt)),
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
  document.body.classList.toggle('no-tabs', tabs.size === 0);
  const tab = activeTab();
  const activeProject = tab?.project.path;
  const key = JSON.stringify([projects, git, activeId, tab?.sessionId, sessionsVer, [...expanded], [...showMore], query,
    Math.floor(Date.now() / 60000),
    [...tabs.values()].map((t) => [t.id, t.project.path, t.kind, t.sessionId, tabDot(t)])]);
  if (!force && key === lastSidebarKey) return;
  lastSidebarKey = key;

  const root = $('#projects');
  if (!projects.length) {
    root.replaceChildren(h('div', { class: 'empty-note' }, 'No projects yet.', h('br'), 'Add a folder to start a Claude session in it.'));
    return;
  }
  const q = query.trim().toLowerCase();
  const groups = projects.map((p) => {
    const loaded = sessionsBy[p.path];
    const matches = q ? (loaded || []).filter((s) => s.title.toLowerCase().includes(q)) : loaded || [];
    if (q && !matches.length) return null;
    const isOpen = q ? true : expanded.has(p.path);
    const pending = q ? [] : pendingTabs(p.path);
    const isActive = p.path === activeProject;

    let list = null;
    if (isOpen && (loaded || pending.length)) {
      const all = q || showMore.has(p.path);
      const hidden = all ? 0 : Math.max(0, matches.length - SESSIONS_SHOWN);
      list = h('div', { class: 'sessions' },
        pending.map(pendingRow),
        matches.length
          ? (all ? matches : matches.slice(0, SESSIONS_SHOWN)).map((s) => sessionRow(p, s, tab?.sessionId))
          : pending.length ? null : h('div', { class: 's-note' }, 'No sessions yet'),
        hidden ? h('div', { class: 's-more', onclick: () => { showMore.add(p.path); renderSidebar(true); } }, `Show ${hidden} more`) : null,
        !q && showMore.has(p.path) && matches.length > SESSIONS_SHOWN
          ? h('div', { class: 's-more', onclick: () => { showMore.delete(p.path); renderSidebar(true); } }, 'Show less')
          : null);
    }
    return h('div', { class: 'group' },
      projectRow(p, isActive, isOpen),
      isActive && git[p.path] ? gitSubLine(git[p.path]) : null,
      list);
  }).filter(Boolean);
  root.replaceChildren(...(groups.length ? groups
    : [h('div', { class: 'empty-note' }, `No sessions match "${query.trim()}"`)]));
}

/** One line: chevron, folder icon, name, and a running dot (swapped for + and … on hover). */
function projectRow(p, isActive, isOpen) {
  const dots = tabsOf(p.path).map(tabDot);
  const run = ['attention', 'working', 'running'].find((d) => dots.includes(d));
  return h('div', {
    class: `project${isActive && !isOpen ? ' current' : ''}${menuFor === p.path ? ' menu-open' : ''}`,
    title: [p.path, gitSummary(git[p.path])].filter(Boolean).join('\n'),
    onclick: () => (isActive ? toggleExpand(p) : focusProject(p)), // a second click collapses
  },
    h('button', {
      class: `chev${isOpen ? ' open' : ''}`, title: isOpen ? 'Hide sessions' : 'Show sessions',
      onclick: (e) => { e.stopPropagation(); toggleExpand(p); },
    }, ico('chevron')),
    h('span', { class: 'p-icon' }, ico('folder')),
    h('span', { class: 'p-name' }, p.name),
    h('span', { class: 'p-run', title: run ? 'Something is running' : null }, run ? h('i', { class: `dot ${run}` }) : null),
    h('div', { class: 'p-acts' },
      rowButton('plus', 'New Claude session', () => openSession(p)),
      h('button', {
        class: 'btn ghost icon sm p-more', title: 'More actions',
        onclick: (e) => { e.stopPropagation(); toggleMenu(p, e.currentTarget); },
      }, ico('more'))));
}

// ------------------------------------------------------------ "…" menu ----

function toggleMenu(p, anchor) {
  if (menuFor === p.path) { closeMenu(); return; }
  const item = (icon, label, run, danger = false) => h('button', {
    class: `menu-item${danger ? ' danger' : ''}`, role: 'menuitem',
    onclick: () => { closeMenu(); run(); },
  }, ico(icon), label);
  const el = $('#menu');
  el.replaceChildren(
    item('redo', 'Continue last conversation', () => openSession(p, { args: ['--continue'] })),
    item('terminal', 'Open PowerShell here', () => openSession(p, { kind: 'shell' })),
    item('folder', 'Show in Explorer', () => api.openFolder(p.path)),
    h('div', { class: 'menu-sep' }),
    item('trash', 'Remove from list', () => removeProject(p), true));
  el.hidden = false;
  const r = anchor.getBoundingClientRect();
  el.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - el.offsetWidth - 8))}px`;
  const below = r.bottom + 4;
  el.style.top = `${below + el.offsetHeight > window.innerHeight - 8 ? r.top - 4 - el.offsetHeight : below}px`;
  menuFor = p.path;
  anchor.closest('.project').classList.add('menu-open'); // keeps + and … visible; projectRow re-applies it on renders
}

// No re-render here: closing happens on mousedown, and rebuilding the rows then would swallow the click.
function closeMenu() {
  if (!menuFor) return;
  menuFor = null;
  $('#menu').hidden = true;
  $('.project.menu-open')?.classList.remove('menu-open');
}

// ---------------------------------------------------------------- footer ----
// One slim row under the project list: add-project on the left; compact plan usage, context of the active session
// and what is running on the right. Each stat opens a details popover (`#detail`) above it.

const fmtTok = (n) => (n < 1000 ? String(n)
  : n < 1e4 ? `${(n / 1e3).toFixed(1)}k`
  : n < 1e6 ? `${Math.round(n / 1e3)}k`
  : `${(n / 1e6).toFixed(1)}M`);
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
  const win = session.ctx > CONTEXT_WINDOW ? CONTEXT_WINDOW_LARGE : CONTEXT_WINDOW;
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
    [...tabs.values()].map((t) => [t.id, tabLabel(t), tabState(t)]), sessionsVer]);
  if (!force && key === lastFootKey) return;
  lastFootKey = key;

  // Each stat is icon + value. The plan's current session limit gets the ring; weekly lives in the tooltip/popover.
  const sessPct = sess ? limitPct(sess) : null;
  const usageTip = sess
    ? [`Session usage ${sessPct}% (${fmtReset(sess)})`, week && `Weekly ${limitPct(week)}%`].filter(Boolean).join('\n')
    : 'Plan usage';
  $('#side-foot').replaceChildren(
    h('button', { class: 'btn ghost icon sm', title: 'Add a project folder', onclick: addProjects }, ico('folderPlus')),
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
      dNote('Approximate: the window size is assumed (200k, or 1M once a session passes 200k). Type /context in the tab for exact numbers.'));
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
      h('div', { class: 'big-logo', html: LOGO_SVG }),
      h('h1', {}, 'What should we build?'),
      h('p', {}, projects.length ? 'Pick a project to start a Claude session.' : 'Add a project folder to get started.'),
      projects.length
        ? h('div', { class: 'proj-list' },
            h('div', { class: 'proj-label' }, 'Projects'),
            projects.map((p) =>
              h('div', { class: 'proj', onclick: () => focusProject(p) },
                h('div', { class: 'proj-main' },
                  h('div', { class: 'p-name' }, p.name),
                  h('div', { class: 'p-path' }, h('bdi', {}, p.path))),
                h('div', { class: 'p-git' }, gitPills(git[p.path])),
                h('span', { class: 'proj-go' }, ico('arrowRight')))))
        : h('button', { class: 'btn primary', onclick: addProjects }, ico('folderPlus'), 'Add project'),
      h('div', { class: 'hint' },
        h('span', {}, h('kbd', {}, 'Ctrl+Shift+T'), ' new session'),
        h('span', {}, h('kbd', {}, 'Ctrl+Tab'), ' switch'),
        h('span', {}, h('kbd', {}, 'Ctrl+Shift+B'), ' sidebar'),
        h('span', {}, h('kbd', {}, 'Ctrl+Shift+S'), ' servers'))));
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

const sessionProcs = () => (ports.ok && ports.procs) || []; // MCP servers and browsers under our sessions

/** Short display names: "@playwright/mcp" -> "playwright", node running vite -> "vite", chrome.exe -> "chrome". */
function itemName(s) {
  if (s.kind === 'mcp') {
    const words = s.label.replace(/^@/, '').split(/[/-]/).filter((w) => w && !/^(mcp|server)$/i.test(w));
    return [...new Set(words)].join('-') || s.label;
  }
  if (s.kind === 'browser') return s.label;
  const pkg = /node_modules[\\/](?:\.bin[\\/])?((?:@[^\\/\s"]+[\\/])?[^\\/\s"]+)/i.exec(s.cmd || '')?.[1];
  return pkg ? pkg.replace('\\', '/') : s.name.replace(/\.exe$/i, '');
}

function serverRow(s) {
  const sessionTab = s.owner?.type === 'session' ? tabs.get(s.owner.sessionId) : null;
  const kind = s.kind === 'mcp' ? 'MCP server' : s.kind === 'browser' ? (s.headless ? 'Headless browser' : 'Browser') : 'Server';
  // Everything but the name lives in the tooltip.
  const tip = [
    `${kind}${s.port ? ` on :${s.port}` : ''}${s.debugPort ? ` (debug :${s.debugPort})` : ''}`,
    s.exposed ? 'Listening on all network interfaces' : null,
    sessionTab ? `Started in ${tabLabel(sessionTab)}` : null,
    `pid ${s.pid}`,
    s.cmd || null,
  ].filter(Boolean).join('\n');
  const meta = s.port ? `:${s.port}` : s.debugPort ? `:${s.debugPort}` : '';
  return h('div', { class: 'srv', title: tip },
    ico(s.kind === 'mcp' ? 'box' : s.kind === 'browser' ? 'globe' : 'server'),
    h('span', { class: 'name' }, itemName(s)),
    meta ? h('span', { class: `meta${s.exposed ? ' exposed' : ''}` }, meta) : null,
    h('div', { class: 'acts' },
      s.port ? h('button', { class: 'btn ghost icon sm', title: `Open http://localhost:${s.port}`, onclick: () => api.openExternal(`http://localhost:${s.port}`) }, ico('link')) : null,
      h('button', { class: 'btn ghost icon sm danger', title: 'Stop', onclick: () => killServer(s) }, ico('power'))));
}

function renderServers() {
  const procPids = new Set(sessionProcs().map((p) => p.pid)); // a browser's debug port is shown on its own row
  const visible = [...ports.servers.filter((s) => (showAll || s.dev) && !procPids.has(s.pid)), ...sessionProcs()];
  $('#servers-count').textContent = String(ports.servers.filter((s) => s.dev && !procPids.has(s.pid)).length + sessionProcs().length);

  const root = $('#server-list');
  if (!ports.ok) {
    root.replaceChildren(h('div', { class: 'scan-error' }, ports.error || 'Port scan failed'));
    return;
  }
  if (!visible.length) {
    root.replaceChildren(h('div', { class: 'empty-note' }, 'Nothing running.', h('br'),
      'Dev servers, MCP servers and browsers started from a session show up here.'));
    return;
  }

  const groups = new Map();
  for (const s of visible) {
    const key = s.owner?.projectPath || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  const nodes = [];
  const keys = [...groups.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
  for (const key of keys) {
    nodes.push(h('div', { class: 'group-title' }, ico(key ? 'folder' : 'server'), key ? baseName(key) : 'Other'));
    nodes.push(...groups.get(key).map(serverRow)); // ports first (sorted), then MCP servers and browsers
  }
  root.replaceChildren(...nodes);
}

/** Open the panel when one of our sessions starts something new (a server, MCP server or browser). */
function revealNewOwned() {
  if (!ports.ok) return;
  const keys = [
    ...ports.servers.filter((s) => s.owner?.type === 'session').map((s) => `port:${s.pid}:${s.port}`),
    ...sessionProcs().map((p) => `${p.kind}:${p.pid}`),
  ];
  const fresh = keys.filter((k) => !seenOwned.has(k));
  for (const k of fresh) seenOwned.add(k);
  if (fresh.length && !ui.servers) setServers(true);
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

let infoBusy = false;
async function pollInfo() {
  const tab = activeTab();
  if (!tab || tab.kind !== 'claude') { renderInfo(); return; }
  if (infoBusy || document.hidden) return;
  infoBusy = true;
  try {
    const next = await api.sessionInfo(tab.project.path, tab.sessionId);
    if (tabs.has(tab.id)) infoBy.set(tab.id, next);
    renderInfo(); // key-diffed
  } finally {
    infoBusy = false;
  }
}

function renderAll() {
  renderSidebar(true);
  renderWelcome();
  renderStatus();
  renderServers();
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
    message: `"${p.name}" will be removed from this list. The folder itself is not touched, and open tabs stay open.`,
    okLabel: 'Remove',
    danger: true,
  });
  if (!ok) return;
  projects = await api.removeProject(p.path);
  if (expanded.delete(p.path)) saveExpanded();
  renderAll();
}

async function killServer(s) {
  const ok = await confirmDialog({
    title: `Stop ${itemName(s)}?`,
    message: s.kind === 'mcp'
      ? `This force-stops MCP server process ${s.pid} (and its children). Claude loses its tools until you reconnect it with /mcp.`
      : s.kind === 'browser'
        ? `This force-stops browser process ${s.pid} (and its children).`
        : `This force-stops process ${s.pid} (and its children) listening on port ${s.port}.`,
    okLabel: 'Stop process',
    danger: true,
  });
  if (!ok) return;
  const res = await api.killProcess(s.pid);
  if (!res.ok) await confirmDialog({ title: 'Could not stop it', message: res.error, okLabel: 'OK' });
  pollPorts();
}

function setFontSize(size) {
  ui.fontSize = Math.min(FONT_SIZE.max, Math.max(FONT_SIZE.min, size));
  for (const t of tabs.values()) t.term.options.fontSize = ui.fontSize;
  api.setUi({ fontSize: ui.fontSize });
  requestAnimationFrame(fitActive);
}

/** Toggle + logo live in the sidebar's top row; while it is collapsed they move to the start of the top bar. */
function placeBrand() {
  document.body.classList.toggle('sidebar-collapsed', !ui.sidebar);
  if (ui.sidebar) $('#sidebar').prepend($('#brand'));
  else $('#topbar').prepend($('#brand'));
}

function setSidebar(open) {
  ui.sidebar = open;
  if (!open && detailKind) setDetail(null);
  if (!open) closeMenu();
  placeBrand();
  api.setUi({ sidebar: open });
  requestAnimationFrame(fitActive);
}

function setServers(open) {
  ui.servers = open;
  document.body.classList.toggle('servers-open', open);
  $('#toggle-servers').classList.toggle('on', open);
  api.setUi({ servers: open });
  if (open) pollPorts();
  requestAnimationFrame(fitActive);
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

let gitBusy = false;
async function pollGit() {
  if (gitBusy || document.hidden || !projects.length) return;
  gitBusy = true;
  try {
    const next = await api.gitStatus(projects.map((p) => p.path));
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
    pollInfo();
  } finally {
    sessionsBusy = false;
  }
}

let usageBusy = false;
async function pollUsage() {
  if (usageBusy || document.hidden) return;
  usageBusy = true;
  try {
    const next = await api.getUsage();
    if (JSON.stringify(next) !== JSON.stringify(usage)) { usage = next; renderFoot(); }
  } finally {
    usageBusy = false;
  }
}

let portsBusy = false;
let portsAt = 0;
async function pollPorts() {
  if (portsBusy || document.hidden) return;
  portsBusy = true;
  try {
    const next = await api.listPorts();
    portsAt = Date.now();
    if (JSON.stringify(next) !== JSON.stringify(ports)) {
      ports = next;
      renderServers();
      revealNewOwned();
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
    if (id !== activeId) {
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

  api.onOpenPath(async (p) => {
    if (!p) return;
    projects = (await api.getState()).projects;
    renderAll();
    const project = projects.find((x) => x.path.toLowerCase() === p.toLowerCase());
    if (project) focusProject(project);
  });

  // Shortcuts avoid keys Claude Code itself uses (Ctrl+B, Ctrl+T, Ctrl+W, ...).
  window.addEventListener('keydown', (e) => {
    let handled = true;
    if (e.key === 'Escape' && menuFor) closeMenu();
    else if (e.key === 'Escape' && detailKind) setDetail(null);
    else if (e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === '=' || e.key === '+')) setFontSize(ui.fontSize + 1);
    else if (e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === '-' || e.key === '_')) setFontSize(ui.fontSize - 1);
    else if (e.ctrlKey && !e.altKey && !e.shiftKey && e.key === '0') setFontSize(FONT_SIZE.default);
    else if (e.ctrlKey && !e.altKey && e.key === 'Tab') cycleTab(e.shiftKey ? -1 : 1);
    else if (e.altKey && !e.ctrlKey && !e.shiftKey && /^[1-9]$/.test(e.key)) {
      const id = [...tabs.keys()][Number(e.key) - 1];
      if (id) activate(id);
    } else if (e.ctrlKey && e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 't') newSessionHere();
      else if (k === 'w') { if (activeId) closeTab(activeId); }
      else if (k === 'b') setSidebar(!ui.sidebar);
      else if (k === 's') setServers(!ui.servers);
      else if (k === 'f') { setSidebar(true); $('#session-search').focus(); $('#session-search').select(); }
      else handled = false;
    } else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  window.addEventListener('focus', () => {
    pollGit(); pollPorts(); pollSessions(); pollUsage();
    if (document.activeElement?.id !== 'session-search') activeTab()?.term.focus();
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
  $('#toggle-servers').addEventListener('click', () => setServers(!ui.servers));
  $('#show-all').addEventListener('change', (e) => { showAll = e.target.checked; renderServers(); });

  new ResizeObserver(() => requestAnimationFrame(fitActive)).observe($('#terminals'));
}

async function init() {
  $('#logo').innerHTML = LOGO_SVG;
  $('#toggle-sidebar').append(ico('sidebar'));
  $('#new-tab').append(ico('plus'));
  $('#open-code').append(ico('code'));
  $('#open-shell').append(ico('terminal'));
  $('#open-folder').append(ico('folder'));
  $('#servers-icon').append(ico('server'));
  $('#search-icon').append(ico('search'));

  const state = await api.getState();
  projects = state.projects;
  ui = state.ui;
  for (const p of ui.expanded || []) expanded.add(p);
  placeBrand();
  document.body.classList.toggle('servers-open', ui.servers);
  $('#toggle-servers').classList.toggle('on', ui.servers);

  wireGlobalEvents();
  renderAll();

  pollGit();
  pollPorts();
  pollSessions();
  pollUsage();
  setInterval(pollGit, 4000);
  setInterval(pollPorts, 6000);
  setInterval(pollSessions, 4000);
  setInterval(pollUsage, 15000);
  // "Working" depends on recent output, so re-check it (cheap: the renders are key-diffed).
  setInterval(() => { if (!document.hidden) { renderSidebar(); renderFoot(); } }, 1500);
}

init();

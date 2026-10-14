'use strict';

// Pure helpers for renderer.js: no DOM, no `api`. index.html loads this with a <script> tag before renderer.js (classic
// scripts share one global scope); `npm test` requires it (test/ui.test.js). Everything is inside a function, so only the
// exported helpers become globals and a same-named const in renderer.js can't clash with a private one here.

(() => {
  // ------------------------------------------------------------- context ----
  // The window size is not stored in transcripts, so it is derived from the model. Current models have 1M by default:
  // Opus and Sonnet 4.6+, Haiku 5+, Fable, Mythos. Older ones (Haiku 4.5, Opus/Sonnet up to 4.5, Claude 2/3) and
  // unknown names are 200k unless chosen with "[1m]" (main.js re-attaches it from settings or /model, since
  // transcripts drop it) or a session has gone past it.
  const CONTEXT_WINDOW = 200000;
  const CONTEXT_WINDOW_LARGE = 1000000;
  const LARGE_FROM = { opus: 4.6, sonnet: 4.6, haiku: 5 };
  function contextWindow(model, used) {
    const m = String(model || '').toLowerCase();
    if (used > CONTEXT_WINDOW || m.includes('[1m]')) return CONTEXT_WINDOW_LARGE;
    if (/\b(fable|mythos)\b/.test(m)) return CONTEXT_WINDOW_LARGE;
    // "claude-sonnet-4-6-20260101", "Sonnet 4.6", "claude-haiku-5-5"; the (?!\d) keeps a date out of the version, so
    // old-style ids ("claude-3-opus-20240229") don't match at all
    const v = /(opus|sonnet|haiku)[- ]?(\d{1,2})(?!\d)(?:[-.](\d)(?!\d))?/.exec(m);
    if (v && Number(v[2]) + Number(v[3] || 0) / 10 >= LARGE_FROM[v[1]]) return CONTEXT_WINDOW_LARGE;
    return CONTEXT_WINDOW;
  }

  // ----------------------------------------------------------- shortcuts ----

  const MODS = ['Ctrl', 'Alt', 'Shift', 'Cmd']; // canonical order (macOS shows ⌃⌥⇧⌘)
  const normCombo = (c) => { const p = c.split('+'); const key = p.pop(); return [...MODS.filter((m) => p.includes(m)), key].join('+'); };
  const comboOf = (e, key = e.code) =>
    [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Cmd', key].filter(Boolean).join('+');

  /**
   * The action bound to this key event, as { s, arg } (arg = the digit or arrow direction for pattern actions), or null.
   * Exact combos win over Digits / Arrows patterns.
   */
  function matchShortcut(list, keymap, e) {
    const patterns = [];
    if (/^Digit[1-9]$/.test(e.code)) patterns.push(comboOf(e, 'Digits'));
    if (e.code.startsWith('Arrow')) patterns.push(comboOf(e, 'Arrows'));
    const exact = comboOf(e);
    const s = list.find((x) => keymap[x.id].includes(exact))
      || list.find((x) => x.pattern && keymap[x.id].some((c) => patterns.includes(c)));
    if (!s) return null;
    const arg = s.pattern === 'Digits' ? Number(e.code.slice(5)) : s.pattern === 'Arrows' ? e.code.slice(5).toLowerCase() : undefined;
    return { s, arg };
  }

  // ------------------------------------------------------------ projects ----

  /**
   * The parent folders that tell project `p` apart from the others in `all` with the same folder name ("clients" for
   * C:\code\clients\app), else ''.
   */
  function distinctParent(p, all) {
    const same = all.filter((x) => x.path !== p.path && x.name.toLowerCase() === p.name.toLowerCase());
    if (!same.length) return '';
    const up = (q) => q.path.replace(/[\\/]+$/, '').split(/[\\/]/).slice(0, -1).reverse(); // nearest parent first
    const mine = up(p);
    for (let k = 1; k <= mine.length; k++) {
      const tail = mine.slice(0, k).join('/').toLowerCase();
      if (same.every((x) => up(x).slice(0, k).join('/').toLowerCase() !== tail)) return mine.slice(0, k).reverse().join('/');
    }
    return p.path;
  }

  // -------------------------------------------------------------- screen ----

  /**
   * Is one of Claude's input dialogs open at the bottom of this xterm buffer? Permission prompts, AskUserQuestion and the
   * folder trust dialog all end in an "Esc to cancel" footer within the bottom 3 non-empty lines.
   */
  function dialogOpen(b) {
    for (let i = b.length - 1, seen = 0; i >= 0 && seen < 3; i--) {
      const s = b.getLine(i)?.translateToString(true).trim();
      if (!s) continue;
      seen++;
      if (s.includes('Esc to cancel')) return true;
    }
    return false;
  }

  // File links: paths Claude prints (src/main.js:123, C:\x\y.ts:4:2, ./README.md). One buffer line at a time, so a path
  // wrapped over two rows is not a link. URLs are left to the web-links addon.
  const FILE_RE = /(?:[A-Za-z]:[\\/]|\.{1,2}[\\/]|[\\/])?(?:[\w.@+-]+[\\/])*[\w@+-][\w.@+-]*\.[A-Za-z][A-Za-z0-9]{0,11}(?::(\d+)(?::(\d+))?)?/g;
  const URL_RE = /[a-z][a-z0-9+.-]*:\/\/\S+/gi;

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

  /** File-like matches in a line of text, outside URLs, at most 20: [{ m (the match: index, [1] line, [2] col), file }]. */
  function fileMatches(text) {
    const urls = [...text.matchAll(URL_RE)].map((m) => [m.index, m.index + m[0].length]);
    return [...text.matchAll(FILE_RE)]
      .filter((m) => !urls.some(([a, b]) => m.index < b && m.index + m[0].length > a))
      .slice(0, 20)
      .map((m) => ({ m, file: m[0].replace(/(?::\d+){1,2}$/, '') }));
  }

  // Claude's fullscreen view shows this pill above the prompt only while it is scrolled up: "Jump to bottom" or
  // "3 new messages", then " (ctrl+End) ↓", " (click) ↓" or ": fn+↓ to scroll" (Claude Code v2.1.299).
  const PILL_RE = /(?:Jump to bottom|\d+ new messages?)(?: \(|: )/;

  /**
   * True if Claude's "scrolled up" pill is in these bottom screen lines: in the 2 rows above the prompt box (its
   * upper `───` border, the second border from the bottom), so a reply or the typed prompt quoting it doesn't count.
   */
  function jumpPill(lines) {
    const top = promptBox(lines);
    return top > 0 && lines.slice(Math.max(0, top - 2), top).some((l) => PILL_RE.test(l));
  }

  /** Row of the upper `───` border of Claude's prompt box (the second border from the bottom), or -1. */
  function promptBox(lines) {
    let found = 0;
    for (let i = lines.length - 1; i >= 0; i--) if (lines[i].startsWith('───') && ++found === 2) return i;
    return -1;
  }

  /**
   * How many rows the text moved down from `prev` to `cur` (two snapshots of the same screen area): > 0 = the view
   * scrolled up. Only non-blank rows count; the shift needs 3+ of them to match and 4x more matches than
   * mismatches, the smallest such shift wins a tie. null = no match (moved more than a screen, or redrawn).
   */
  function lineShift(prev, cur) {
    const n = Math.min(prev.length, cur.length);
    let best = null;
    let bestSame = 0;
    for (let k = -(n - 3); k <= n - 3; k++) {
      let same = 0;
      let diff = 0;
      for (let i = Math.max(0, -k); i < n && i + k < n; i++) {
        if (!prev[i].trim()) continue;
        if (prev[i] === cur[i + k]) same++;
        else diff++;
      }
      if (same < 3 || same < 4 * diff) continue;
      if (same > bestSame || (same === bestSame && Math.abs(k) < Math.abs(best))) {
        best = k;
        bestSame = same;
      }
    }
    return best;
  }

  /** True if Claude's start banner (logo + "Claude Code v2.1.299") is in these lines: its fullscreen view is at the top. */
  function claudeBanner(lines) {
    return lines.some((l) => /[▐▛▜▌▝▘].*Claude Code v\d/.test(l));
  }

  /**
   * The wheel report xterm 6 sends for a wheel event in mouse-tracking mode: -1 up, 1 down, 0 none (a small
   * touchpad delta still adding up). Mirrors CoreMouseService.consumeWheelEvent; `acc.partial` carries the remainder.
   */
  function wheelNotch(acc, e, cellH) {
    if (!e.deltaY || e.shiftKey) return 0;
    if (e.deltaMode !== 0) return Math.sign(e.deltaY); // lines or pages
    if (!cellH) return 0;
    let r = e.deltaY / cellH;
    if (e.altKey || e.ctrlKey) r *= 5; // xterm's default fastScrollSensitivity
    if (Math.abs(e.deltaY) < 50) r *= 0.3;
    acc.partial += r;
    const n = Math.trunc(acc.partial);
    acc.partial %= 1;
    return Math.sign(n);
  }

  /**
   * Thumb offset on the alternate screen: `off` wheel notches above the bottom, the top `max` notches up
   * (0 = not reached yet, then `guess`), `room` = track height minus thumb height. Bottom = `room`.
   */
  function altThumbTop(off, max, room, guess) {
    if (off <= 0) return room;
    return room * (1 - off / Math.max(off, max || guess));
  }

  const helpers = {
    contextWindow, normCombo, comboOf, matchShortcut, distinctParent, dialogOpen, lineCells, fileMatches,
    jumpPill, promptBox, lineShift, claudeBanner, wheelNotch, altThumbTop,
  };
  if (typeof module === 'object' && module.exports) module.exports = helpers;
  else Object.assign(globalThis, helpers);
})();

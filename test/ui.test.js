'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ui = require('../src/lib/ui');

test('renderer.js declares only names lib/ui.js defines', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');
  const decl = /\/\* global ([^*]+?) -- lib\/ui\.js \*\//.exec(src);
  assert.ok(decl, 'the /* global ... -- lib/ui.js */ line is missing in renderer.js');
  for (const name of decl[1].split(',').map((s) => s.trim())) {
    assert.equal(typeof ui[name], 'function', `${name} is not exported by lib/ui.js`);
  }
});

test('contextWindow: 1M for Opus/Sonnet 4.6+, Haiku 5+, Fable, Mythos, [1m] or past 200k; else 200k', () => {
  const M = 1000000;
  const K = 200000;
  for (const [model, want] of [
    ['claude-opus-4-6-20260101', M],
    ['claude-opus-4-6', M],
    ['Opus 4.6', M],
    ['claude-opus-5-5', M],
    ['claude-opus-4-5-20251101', K],
    ['claude-opus-4-20250514', K], // the date is not a minor version
    ['claude-sonnet-5-5', M],
    ['claude-sonnet-5', M],
    ['claude-sonnet-4-6', M],
    ['Sonnet 5.5', M],
    ['claude-sonnet-4-5-20250929', K],
    ['claude-sonnet-4-5[1m]', M],
    ['claude-fable-5-1', M],
    ['Mythos', M],
    ['claude-haiku-5-5', M],
    ['Haiku 5.5', M],
    ['claude-haiku-4-5-20251001', K],
    ['Haiku 4.5', K],
    ['claude-3-opus-20240229', K], // old-style id: the date is not a version
    ['claude-3-5-sonnet-20241022', K],
    [null, K],
  ]) assert.equal(ui.contextWindow(model, 0), want, String(model));
  assert.equal(ui.contextWindow('claude-haiku-4-5', 250000), M);
});

test('normCombo puts modifiers in canonical order', () => {
  assert.equal(ui.normCombo('Shift+Ctrl+KeyT'), 'Ctrl+Shift+KeyT');
  assert.equal(ui.normCombo('Cmd+Alt+Backslash'), 'Alt+Cmd+Backslash');
  assert.equal(ui.normCombo('F5'), 'F5');
});

test('matchShortcut: exact combos win over patterns, patterns pass the digit / direction', () => {
  const key = (code, mods = {}) => ({ code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods });
  const list = [
    { id: 'goto', pattern: 'Digits' },
    { id: 'first', },
    { id: 'focus', pattern: 'Arrows' },
    { id: 'close' },
  ];
  const keymap = { goto: ['Alt+Digits'], first: ['Alt+Digit1'], focus: ['Alt+Arrows'], close: ['Ctrl+KeyW', 'Ctrl+Shift+KeyW'] };
  const hit = (e) => { const r = ui.matchShortcut(list, keymap, e); return r && [r.s.id, r.arg]; };
  assert.deepEqual(hit(key('Digit1', { altKey: true })), ['first', undefined]);
  assert.deepEqual(hit(key('Digit7', { altKey: true })), ['goto', 7]);
  assert.deepEqual(hit(key('ArrowLeft', { altKey: true })), ['focus', 'left']);
  assert.deepEqual(hit(key('KeyW', { ctrlKey: true, shiftKey: true })), ['close', undefined]);
  assert.equal(hit(key('Digit0', { altKey: true })), null); // Digits is 1..9
  assert.equal(hit(key('KeyW', { altKey: true })), null);
  assert.equal(hit(key('ArrowLeft', { altKey: true, shiftKey: true })), null);
});

test('distinctParent names the fewest parent folders that tell same-name projects apart', () => {
  const proj = (p) => ({ path: p, name: p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() });
  const all = [proj('C:\\code\\clients\\app'), proj('C:\\code\\internal\\app'), proj('C:\\x\\other'),
    proj('D:\\a\\x\\tool'), proj('D:\\b\\x\\tool\\')];
  assert.equal(ui.distinctParent(all[0], all), 'clients');
  assert.equal(ui.distinctParent(all[1], all), 'internal');
  assert.equal(ui.distinctParent(all[2], all), '');
  assert.equal(ui.distinctParent(all[3], all), 'a/x');
  assert.equal(ui.distinctParent(all[4], all), 'b/x');
  assert.equal(ui.distinctParent(proj('/Users/me/App'), [proj('/Users/me/App'), proj('/tmp/app')]), 'me');
});

/** A fake xterm buffer of text lines. */
const buffer = (lines) => ({ length: lines.length, getLine: (i) => ({ translateToString: () => lines[i] }) });

test('dialogOpen: "Esc to cancel" within the bottom 3 non-empty lines', () => {
  assert.equal(ui.dialogOpen(buffer(['Allow edit?', '❯ 1. Yes', '  2. No', 'Esc to cancel · Tab to amend', '', ''])), true);
  assert.equal(ui.dialogOpen(buffer(['Esc to cancel', 'a', 'b', 'c'])), false);
  assert.equal(ui.dialogOpen(buffer(['Esc to cancel', '', 'b', '   ', 'c'])), true);
  assert.equal(ui.dialogOpen(buffer([])), false);
});

test('lineCells maps characters to cells, wide characters take two', () => {
  const cell = (chars, width) => ({ getChars: () => chars, getWidth: () => width });
  const cells = [cell('a', 1), cell('中', 2), cell('', 0), cell('b', 1), cell('', 1)];
  const term = { buffer: { active: { getLine: (y) => (y === 0 ? { length: cells.length, getCell: (x) => cells[x] } : undefined) } } };
  assert.deepEqual(ui.lineCells(term, 0), { text: 'a中b ', col: [0, 1, 3, 4] });
  assert.equal(ui.lineCells(term, 1), null);
});

test('fileMatches finds paths with line and column, not inside URLs', () => {
  const found = ui.fileMatches('see src/main.js:123 and C:\\x\\y.ts:4:2, ./README.md or https://example.com/a.js');
  assert.deepEqual(found.map((f) => [f.file, f.m[1], f.m[2]]), [
    ['src/main.js', '123', undefined],
    ['C:\\x\\y.ts', '4', '2'],
    ['./README.md', undefined, undefined],
  ]);
  assert.equal(found[0].m.index, 4);
  assert.deepEqual(ui.fileMatches('version 1.2.3, no files'), []);
  assert.equal(ui.fileMatches(Array.from({ length: 30 }, (_, i) => `f${i}.js`).join(' ')).length, 20);
});

test('jumpPill finds Claude\'s scrolled-up pill in its variants (v2.1.299), not plain text', () => {
  const row = (s) => ['', s, '─────', '> ', '─────'];
  assert.ok(ui.jumpPill(row('  every file" prompts. The finished sp Jump to bottom (ctrl+End) ↓ inutes.')));
  assert.ok(ui.jumpPill(row('3 new messages (ctrl+End) ↓')));
  assert.ok(ui.jumpPill(row('1 new message (click) ↓')));
  assert.ok(ui.jumpPill(row('Jump to bottom: fn+↓ to scroll')));
  assert.ok(!ui.jumpPill(row('✻ Churned for 14s · done Tuesday 10:41 PM')));
  assert.ok(!ui.jumpPill(row('we discussed the Jump to bottom pill')));
});

test('wheelNotch: one report per line/page event, touchpad pixels add up like xterm', () => {
  const acc = { partial: 0 };
  assert.equal(ui.wheelNotch(acc, { deltaY: -1, deltaMode: 1 }, 17), -1);
  assert.equal(ui.wheelNotch(acc, { deltaY: 3, deltaMode: 2 }, 17), 1);
  assert.equal(ui.wheelNotch(acc, { deltaY: 100, deltaMode: 0 }, 17), 1); // a mouse notch
  assert.equal(ui.wheelNotch(acc, { deltaY: 100, deltaMode: 0, shiftKey: true }, 17), 0);
  const pad = { partial: 0 };
  const sent = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(() => ui.wheelNotch(pad, { deltaY: 10, deltaMode: 0 }, 17));
  assert.equal(sent.filter((n) => n === 1).length, 1); // 10 x (10 / 17 * 0.3) = 1.76 lines
  assert.ok(sent.every((n) => n === 0 || n === 1));
});

test('altThumbTop: bottom at 0, top once the known top is reached, guess until then', () => {
  assert.equal(ui.altThumbTop(0, 0, 100, 60), 100);
  assert.equal(ui.altThumbTop(30, 0, 100, 60), 50);
  assert.equal(ui.altThumbTop(90, 0, 100, 60), 0);
  assert.equal(ui.altThumbTop(55, 220, 100, 60), 75);
  assert.equal(ui.altThumbTop(220, 220, 100, 60), 0);
});

test('claudeBanner spots the start banner at the top of Claude\'s view', () => {
  assert.ok(ui.claudeBanner(['', ' ▐▛███▜▌   Claude Code v2.1.299', '▝▜█████▛▘  Haiku 5.5 with high effort']));
  assert.ok(!ui.claudeBanner(['● The real Stanza app is already running', 'Claude Code is a CLI']));
});

test('jumpPill only reads the rows above the prompt box, not the prompt or older lines', () => {
  assert.ok(!ui.jumpPill(['', '', '─────', '> Jump to bottom (ctrl+End) ↓', '─────'])); // typed in the prompt
  assert.ok(!ui.jumpPill(['Jump to bottom: fn+↓ to scroll', 'reply', 'text', '', '─────', '> ', '─────']));
  assert.ok(!ui.jumpPill(['Jump to bottom (ctrl+End) ↓'])); // no prompt box on screen
});

test('claudeBanner needs the logo, not a version quoted in a reply', () => {
  assert.ok(!ui.claudeBanner(['  (tested on Claude Code v2.1.296)']));
});

test('wheelNotch: Alt/Ctrl touchpad deltas add up 5x faster, like xterm', () => {
  const plain = { partial: 0 }, fast = { partial: 0 };
  const e = { deltaY: 10, deltaMode: 0 };
  assert.equal(ui.wheelNotch(plain, e, 17), 0);
  assert.equal(ui.wheelNotch(fast, { ...e, altKey: true }, 17), 0); // 10 / 17 * 5 * 0.3 = 0.88
  assert.equal(ui.wheelNotch(fast, { ...e, altKey: true }, 17), 1);
});

test('promptBox finds the upper border of Claude\'s prompt box', () => {
  assert.equal(ui.promptBox(['text', '────────', 'more', '', '────────', '> ', '────────', '  ⏵⏵ auto mode on']), 4);
  assert.equal(ui.promptBox(['text', '> ', '────────']), -1);
});

test('lineShift measures how far the transcript rows moved between two repaints', () => {
  const doc = Array.from({ length: 60 }, (_, i) => (i % 4 === 3 ? '' : `line ${i}: some reply text`));
  const at = (top) => doc.slice(top, top + 20); // a 20-row view starting at row `top`
  assert.equal(ui.lineShift(at(30), at(30)), 0);
  assert.equal(ui.lineShift(at(30), at(25)), 5); // scrolled up 5
  assert.equal(ui.lineShift(at(30), at(36)), -6); // scrolled down 6
  assert.equal(ui.lineShift(at(30), at(14)), 16); // little overlap is enough
  assert.equal(ui.lineShift(at(40), at(0)), null); // more than a screen
  const fresh = at(30).map((l) => l && `${l} (redrawn)`);
  assert.equal(ui.lineShift(at(30), fresh), null);
  const streaming = [...at(30).slice(0, 18), 'new line', 'another']; // the bottom rows changed, the rest stayed
  assert.equal(ui.lineShift(at(30), streaming), 0);
});

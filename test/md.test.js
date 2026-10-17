'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMarkdown } = require('../src/lib/md');

const blocks = (src) => parseMarkdown(src).blocks;
const inl = (src) => blocks(src)[0].c;

test('headings: ATX with closing hashes, setext, GitHub anchors with repeats numbered', () => {
  const b = blocks('# Plan ##\n\nIntro\n===\n\nNext\n---\n\n## Plan\n#hashtag');
  assert.deepEqual(b.map((x) => [x.t, x.level, x.id]), [
    ['h', 1, 'plan'], ['h', 1, 'intro'], ['h', 2, 'next'], ['h', 2, 'plan-1'], ['p', undefined, undefined],
  ]);
  assert.deepEqual(b[4].c, ['#hashtag']);
  assert.equal(blocks('## Step 1: `parse.js` (pure)!')[0].id, 'step-1-parsejs-pure');
});

test('paragraphs: soft breaks join with a space, two trailing spaces or a backslash make a hard break', () => {
  assert.deepEqual(inl('one\ntwo'), ['one two']);
  assert.deepEqual(inl('one  \ntwo\\\nthree'), ['one', { t: 'br' }, 'two', { t: 'br' }, 'three']);
  assert.deepEqual(inl('a<br>b<br/>c'), ['a', { t: 'br' }, 'b', { t: 'br' }, 'c']);
});

test('fenced and indented code keep their text verbatim; an unclosed fence runs to the end', () => {
  assert.deepEqual(blocks('```js title\nconst a = `x`;\n  *not em*\n```\nafter'), [
    { t: 'code', lang: 'js', text: 'const a = `x`;\n  *not em*' },
    { t: 'p', c: ['after'] },
  ]);
  assert.deepEqual(blocks('~~~~\n```\n~~~~'), [{ t: 'code', lang: '', text: '```' }]);
  assert.deepEqual(blocks('    npm test\n\n    npm run lint\n'), [{ t: 'code', lang: '', text: 'npm test\n\nnpm run lint' }]);
  assert.deepEqual(blocks('```\nopen'), [{ t: 'code', lang: '', text: 'open' }]);
  assert.deepEqual(blocks('para\n    still para')[0].c, ['para still para']); // indented code can't interrupt a paragraph
});

test('lists: bullets, ordered with a start, nesting, tasks, tight vs loose', () => {
  const [l] = blocks('- one\n- two\n  - nested\n- [x] done\n- [ ] todo');
  assert.equal(l.t, 'list');
  assert.equal(l.ordered, false);
  assert.equal(l.loose, false);
  assert.equal(l.items.length, 4);
  assert.deepEqual(l.items[1].blocks[1].items[0].blocks, [{ t: 'p', c: ['nested'] }]);
  assert.deepEqual(l.items.map((i) => i.task), [null, null, true, false]);
  assert.deepEqual(l.items[2].blocks, [{ t: 'p', c: ['done'] }]);

  const [o] = blocks('3. three\n4. four');
  assert.equal(o.ordered, true);
  assert.equal(o.start, 3);
  assert.equal(blocks('1. a\n\n2. b')[0].loose, true);
  assert.equal(blocks('- a\n\n  more of a')[0].loose, true);
  // a different bullet starts a new list; a lazy line continues the item's paragraph
  assert.equal(blocks('- a\n* b').length, 2);
  assert.deepEqual(blocks('- a\nlazy')[0].items[0].blocks, [{ t: 'p', c: ['a lazy'] }]);
  // a thematic break is not an item
  assert.deepEqual(blocks('- a\n* * *').map((b) => b.t), ['list', 'hr']);
  // the next item after a nested list is the outer list's, not a lazy line of the nested one
  const [n] = blocks('1. a\n   - x\n   - y\n2. b\n3. c');
  assert.equal(n.items.length, 3);
  assert.deepEqual(n.items[0].blocks[1].items.map((i) => i.blocks), [[{ t: 'p', c: ['x'] }], [{ t: 'p', c: ['y'] }]]);
});

test('lists inside paragraphs: only "1." or a non-empty bullet interrupts', () => {
  assert.deepEqual(blocks('see\n2. not a list').map((b) => b.t), ['p']);
  assert.deepEqual(blocks('see\n1. a list').map((b) => b.t), ['p', 'list']);
  assert.deepEqual(blocks('see\n- a list').map((b) => b.t), ['p', 'list']);
});

test('block quotes, lazy continuation and GitHub alerts', () => {
  const [q] = blocks('> # Title\n> text\nlazy');
  assert.equal(q.t, 'quote');
  assert.equal(q.alert, null);
  assert.deepEqual(q.blocks, [{ t: 'h', level: 1, id: 'title', c: ['Title'] }, { t: 'p', c: ['text lazy'] }]);
  const [a] = blocks('> [!WARNING]\n> Careful');
  assert.equal(a.alert, 'warning');
  assert.deepEqual(a.blocks, [{ t: 'p', c: ['Careful'] }]);
});

test('tables: alignment, escaped pipes, pipes in code spans, short rows padded', () => {
  const [t] = blocks('| a | b | c |\n|:--|:-:|--:|\n| 1 | x \\| y | `p|q` |\n| 2 |');
  assert.equal(t.t, 'table');
  assert.deepEqual(t.aligns, ['left', 'center', 'right']);
  assert.deepEqual(t.head, [['a'], ['b'], ['c']]);
  assert.deepEqual(t.rows, [[['1'], ['x | y'], [{ t: 'code', text: 'p|q' }]], [['2'], [], []]]);
  assert.deepEqual(blocks('a | b\n--- | ---\n1 | 2')[0].rows, [[['1'], ['2']]]);
  // a delimiter row with a different cell count is no table
  assert.deepEqual(blocks('a | b\n---').map((b) => b.t), ['h']);
});

test('emphasis: strong, em, both, strikethrough, nesting, intraword underscores, lone stars', () => {
  assert.deepEqual(inl('**b** *i* ***bi*** ~~s~~ __u__ _e_'), [
    { t: 'b', c: ['b'] }, ' ', { t: 'i', c: ['i'] }, ' ', { t: 'b', c: [{ t: 'i', c: ['bi'] }] }, ' ',
    { t: 's', c: ['s'] }, ' ', { t: 'b', c: ['u'] }, ' ', { t: 'i', c: ['e'] },
  ]);
  assert.deepEqual(inl('**bold *it* more**'), [{ t: 'b', c: ['bold ', { t: 'i', c: ['it'] }, ' more'] }]);
  assert.deepEqual(inl('*a **b***'), [{ t: 'i', c: ['a ', { t: 'b', c: ['b'] }] }]);
  assert.deepEqual(inl('snake_case_name and 2 * 3 * 4'), ['snake_case_name and 2 * 3 * 4']);
  assert.deepEqual(inl('**not closed'), ['**not closed']);
  assert.deepEqual(inl('*`a*b`*'), [{ t: 'i', c: [{ t: 'code', text: 'a*b' }] }]);
});

test('code spans: any backtick run length, one padding space stripped, unmatched runs are text', () => {
  assert.deepEqual(inl('`a` ``b`c`` ` `` ` x'), [{ t: 'code', text: 'a' }, ' ', { t: 'code', text: 'b`c' }, ' ', { t: 'code', text: '``' }, ' x']);
  assert.deepEqual(inl('a `b'), ['a `b']);
  assert.deepEqual(inl('`**x**`'), [{ t: 'code', text: '**x**' }]);
});

test('links: inline with titles and parens, references, autolinks, bare URLs; links do not nest', () => {
  assert.deepEqual(inl('[the *plan*](docs/PLAN.md "Plan")'), [{ t: 'a', href: 'docs/PLAN.md', c: ['the ', { t: 'i', c: ['plan'] }] }]);
  assert.deepEqual(inl('[w](https://en.wikipedia.org/wiki/Foo_(bar))'), [{ t: 'a', href: 'https://en.wikipedia.org/wiki/Foo_(bar)', c: ['w'] }]);
  assert.deepEqual(inl('[sp](<my file.md>)'), [{ t: 'a', href: 'my file.md', c: ['sp'] }]);
  assert.deepEqual(inl('[#top](#top)'), [{ t: 'a', href: '#top', c: ['#top'] }]);
  const ref = blocks('[full][r] [r][] [R]\n\n[r]: https://x.dev "t"');
  assert.equal(ref.length, 1);
  assert.deepEqual(ref[0].c, [
    { t: 'a', href: 'https://x.dev', c: ['full'] }, ' ', { t: 'a', href: 'https://x.dev', c: ['r'] }, ' ',
    { t: 'a', href: 'https://x.dev', c: ['R'] },
  ]);
  assert.deepEqual(inl('[unknown] and [^1]'), ['[unknown] and [^1]']);
  assert.deepEqual(inl('<https://a.b/c> <me@x.io>'), [
    { t: 'a', href: 'https://a.b/c', c: ['https://a.b/c'] }, ' ', { t: 'a', href: 'mailto:me@x.io', c: ['me@x.io'] },
  ]);
  assert.deepEqual(inl('see https://x.dev/a_b. and www.y.org, (https://z.io)'), [
    'see ', { t: 'a', href: 'https://x.dev/a_b', c: ['https://x.dev/a_b'] }, '. and ',
    { t: 'a', href: 'http://www.y.org', c: ['www.y.org'] }, ', (', { t: 'a', href: 'https://z.io', c: ['https://z.io'] }, ')',
  ]);
  assert.deepEqual(inl('nohttps://x'), ['nohttps://x']);
  assert.deepEqual(inl('[go https://x.dev](y.md)'), [{ t: 'a', href: 'y.md', c: ['go https://x.dev'] }]);
});

test('images: alt text is plain, src kept as written', () => {
  assert.deepEqual(inl('![a **logo**](assets/icon.png) !not'), [{ t: 'img', src: 'assets/icon.png', alt: 'a logo' }, ' !not']);
});

test('escapes and raw HTML: punctuation escapes, HTML stays text, comments are dropped', () => {
  assert.deepEqual(inl('\\*not em\\* \\a'), ['*not em* \\a']);
  assert.deepEqual(inl('<details><summary>x</summary>'), ['<details><summary>x</summary>']);
  assert.deepEqual(blocks('<!-- hidden\nstill hidden -->\ntext'), [{ t: 'p', c: ['text'] }]);
});

test('thematic breaks', () => {
  assert.deepEqual(blocks('***\n- - -\n___').map((b) => b.t), ['hr', 'hr', 'hr']);
});

test('front matter: key/value pairs, quotes stripped, block scalars and lists joined', () => {
  const r = parseMarkdown('---\nname: code-scout\ndescription: "Read-only search"\ntools:\n  - Read\n  - Grep\nprompt: |\n  line one\n  line two\n---\n# Body');
  assert.deepEqual(r.front, [
    { key: 'name', value: 'code-scout' },
    { key: 'description', value: 'Read-only search' },
    { key: 'tools', value: '- Read\n- Grep' },
    { key: 'prompt', value: 'line one\nline two' },
  ]);
  assert.deepEqual(r.blocks.map((b) => b.t), ['h']);
  // a leading rule without key: value lines is not front matter
  assert.equal(parseMarkdown('---\njust text\n---\nmore').front, null);
});

test('input oddities: CRLF, BOM, tabs, NUL, empty', () => {
  assert.deepEqual(blocks('\uFEFF# A\r\n\r\n-\tb\r\n'), [
    { t: 'h', level: 1, id: 'a', c: ['A'] },
    { t: 'list', ordered: false, start: 1, loose: false, items: [{ task: null, blocks: [{ t: 'p', c: ['b'] }] }] },
  ]);
  assert.deepEqual(parseMarkdown(''), { front: null, blocks: [] });
  assert.deepEqual(parseMarkdown(null), { front: null, blocks: [] });
  assert.deepEqual(inl('a\0b'), ['a\uFFFDb']);
});

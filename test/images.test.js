'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scanImages, SCAN_CHUNK } = require('../src/lib/images');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-images-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
let n = 0;
const transcript = () => path.join(dir, `t${n++}.jsonl`);

const img = (data) => ({ type: 'image', source: { type: 'base64', media_type: 'image/png', data } });
const line = (o) => JSON.stringify(o) + '\n';

/** The image block an index entry points at, re-read from its byte range like main's imageSource. */
function blockAt(file, it) {
  const buf = fs.readFileSync(file).subarray(it.off, it.off + it.len);
  const b = JSON.parse(buf.toString('utf8')).message.content[it.block];
  return it.sub >= 0 ? b.content[it.sub] : b;
}

test('indexes pastes and Read results by byte range', async () => {
  const file = transcript();
  fs.writeFileSync(file, [
    line({ type: 'user', message: { content: 'ünïcödé first, so byte and char offsets differ' } }),
    line({ type: 'user', imagePasteIds: [3, 4], message: { content: [
      { type: 'text', text: '[Attached image "a.png" is saved at: C:\\tmp\\a.png]' }, img('AAAA'), img('BBBB'),
    ] } }),
    line({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'tu1', name: 'Read', input: { file_path: 'C:\\shots\\x.png' } }] } }),
    line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu1', content: [img('CCCC')] }] } }),
    line({ type: 'user', message: { content: [img('DDDD')] } }), // no imagePasteIds: numbered by block order
  ].join(''));

  const st = await scanImages(file);
  assert.deepEqual(st.items.map((i) => [i.kind, i.label, i.file]), [
    ['paste', '#3', 'C:\\tmp\\a.png'],
    ['paste', '#4', null],
    ['file', 'x.png', 'C:\\shots\\x.png'],
    ['paste', '#1', null],
  ]);
  assert.deepEqual(st.items.map((i) => blockAt(file, i).source.data), ['AAAA', 'BBBB', 'CCCC', 'DDDD']);
});

test('a line spanning several read chunks is joined once and points at the right bytes', async () => {
  const file = transcript();
  const big = 'Q'.repeat(Math.round(SCAN_CHUNK * 2.5));
  fs.writeFileSync(file, line({ type: 'user', message: { content: 'x'.repeat(SCAN_CHUNK - 10) } }) // ends just past a chunk edge
    + line({ type: 'user', message: { content: [img(big)] } })
    + line({ type: 'user', message: { content: [img('SMALL')] } }));
  const st = await scanImages(file);
  assert.equal(st.items.length, 2);
  assert.equal(blockAt(file, st.items[0]).source.data.length, big.length);
  assert.equal(blockAt(file, st.items[1]).source.data, 'SMALL');
});

test('a line still being written waits for the next scan; appends are read incrementally', async () => {
  const file = transcript();
  const done = line({ type: 'user', message: { content: [img('ONE')] } });
  const partial = line({ type: 'user', message: { content: [img('TWO')] } });
  fs.writeFileSync(file, done + partial.slice(0, 20));
  let st = await scanImages(file);
  assert.equal(st.items.length, 1);
  assert.equal(st.offset, Buffer.byteLength(done));

  fs.appendFileSync(file, partial.slice(20));
  st = await scanImages(file);
  assert.deepEqual(st.items.map((i) => blockAt(file, i).source.data), ['ONE', 'TWO']);
});

test('keeps the newest 20 and returns null for a missing file', async () => {
  const file = transcript();
  let text = '';
  for (let i = 0; i < 30; i++) text += line({ type: 'user', message: { content: [img(`I${i}`)] } });
  fs.writeFileSync(file, text);
  const st = await scanImages(file);
  assert.equal(st.items.length, 20);
  assert.equal(blockAt(file, st.items[0]).source.data, 'I10');
  assert.equal(await scanImages(path.join(dir, 'missing.jsonl')), null);
});

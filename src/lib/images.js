'use strict';

// Images in a session (right sidebar): pasted images and images Claude got from the Read tool. An image makes a line of
// hundreds of KB, so the transcript is scanned incrementally by byte offset and only an index is kept (where each image's
// line sits); thumbnails and full images are decoded from that byte range on demand (main.js). The same scan collects
// the markdown files Claude wrote or edited (`docs`, the right sidebar's Docs section). Subagent transcripts are not
// read. No Electron here, so `npm test` covers it (test/images.test.js).

const fs = require('fs');
const path = require('path');

const IMAGE_KEEP = 20; // newest images indexed per session
const PENDING_KEEP = 50; // Read calls waiting for their result (a failed Read never gets an image result)
const SESSIONS_KEEP = 20; // transcripts whose image index is kept (LRU)
const DOCS_KEEP = 50; // markdown files written or edited, newest last
const SCAN_CHUNK = 1024 * 1024;
const imageCache = new Map(); // transcript file -> { offset, sig, pending: Map(tool_use_id -> path), items, docs: Map(path -> true), scan }
const DOC_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);
const isDoc = (f) => typeof f === 'string' && /\.(?:md|markdown)$/i.test(f);

const isB64Image = (b) => b?.type === 'image' && b.source?.type === 'base64' && typeof b.source.data === 'string';

function imagesFromLine(j, off, len, st) {
  const c = j.message?.content;
  if (!Array.isArray(c)) return;
  if (j.type === 'assistant') {
    for (const b of c) {
      if (b?.type !== 'tool_use' || typeof b.input?.file_path !== 'string') continue;
      if (DOC_TOOLS.has(b.name) && isDoc(b.input.file_path)) {
        st.docs.delete(b.input.file_path); // moves to the end: newest
        st.docs.set(b.input.file_path, true);
        if (st.docs.size > DOCS_KEEP) st.docs.delete(st.docs.keys().next().value);
        continue;
      }
      if (b.name !== 'Read') continue;
      st.pending.set(b.id, b.input.file_path);
      if (st.pending.size > PENDING_KEEP) st.pending.delete(st.pending.keys().next().value);
    }
    return;
  }
  if (j.type !== 'user') return;
  // Pastes: "#n" from imagePasteIds (not always present: then block order 1..n). Some clients name the saved file in the text.
  const ids = Array.isArray(j.imagePasteIds) ? j.imagePasteIds : [];
  const text = c.filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
  const saved = [...text.matchAll(/\[Attached image "[^"\r\n]*" is saved at: ([^\]\r\n]+)\]/g)].map((m) => m[1].trim());
  let n = 0;
  c.forEach((b, block) => {
    if (isB64Image(b)) {
      const k = n++;
      const label = `#${Number.isInteger(ids[k]) ? ids[k] : k + 1}`;
      st.items.push({ id: `${off}:${block}`, kind: 'paste', label, file: saved[k] || null, off, len, block, sub: -1 });
    } else if (b?.type === 'tool_result' && st.pending.has(b.tool_use_id)) {
      const file = st.pending.get(b.tool_use_id);
      st.pending.delete(b.tool_use_id);
      if (!Array.isArray(b.content)) return;
      b.content.forEach((x, sub) => {
        if (isB64Image(x)) st.items.push({ id: `${off}:${block}:${sub}`, kind: 'file', label: path.basename(file), file, off, len, block, sub });
      });
    }
  });
}

const DOC_MARKS = ['"name":"Read"', '"name":"Write"', '"name":"Edit"', '"name":"MultiEdit"'];

/** Reads what was appended since the last scan. Offsets are bytes; a line still being written is left for the next scan. */
async function scanImages(file) {
  let stat;
  try { stat = await fs.promises.stat(file); } catch { imageCache.delete(file); return null; }
  const sig = `${stat.mtimeMs}:${stat.size}`;
  let st = imageCache.get(file);
  if (st) { imageCache.delete(file); imageCache.set(file, st); } // most recently used last
  if (st?.sig === sig) return st;
  if (st?.scan) return st.scan;
  if (!st || stat.size < st.offset) { // new, or the file was replaced
    st = { offset: 0, sig: '', pending: new Map(), items: [], docs: new Map(), scan: null };
    imageCache.set(file, st);
    if (imageCache.size > SESSIONS_KEEP) imageCache.delete(imageCache.keys().next().value);
  }
  const cur = st;
  cur.scan = (async () => {
    const fh = await fs.promises.open(file, 'r');
    try {
      let pos = cur.offset;
      // A pasted line can span many chunks: its pieces are collected and joined once, and only each new chunk is searched.
      let parts = [];
      let partStart = pos; // file offset of the collected line
      while (pos < stat.size) {
        const chunk = Buffer.alloc(Math.min(SCAN_CHUNK, stat.size - pos));
        const { bytesRead } = await fh.read(chunk, 0, chunk.length, pos);
        if (!bytesRead) break;
        const buf = chunk.subarray(0, bytesRead);
        const base = pos; // file offset of buf[0]
        pos += bytesRead;
        let a = 0;
        for (let nl; (nl = buf.indexOf(0x0a, a)) !== -1; a = nl + 1) {
          const piece = buf.subarray(a, nl);
          const line = parts.length ? Buffer.concat([...parts, piece]) : piece;
          const off = parts.length ? partStart : base + a;
          parts = [];
          cur.offset = base + nl + 1;
          if (!line.includes('"type":"base64"') && !DOC_MARKS.some((m) => line.includes(m))) continue; // big text results stay unparsed
          try { imagesFromLine(JSON.parse(line.toString('utf8')), off, line.length, cur); } catch { /* foreign line */ }
        }
        if (a < buf.length) {
          if (!parts.length) partStart = base + a;
          parts.push(buf.subarray(a));
        }
        if (cur.items.length > IMAGE_KEEP * 4) cur.items.splice(0, cur.items.length - IMAGE_KEEP);
      }
    } finally {
      await fh.close();
    }
    if (cur.items.length > IMAGE_KEEP) cur.items.splice(0, cur.items.length - IMAGE_KEEP);
    cur.sig = sig;
    return cur;
  })().finally(() => { cur.scan = null; });
  return cur.scan;
}

module.exports = { scanImages, IMAGE_KEEP, SCAN_CHUNK };

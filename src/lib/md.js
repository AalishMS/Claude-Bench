'use strict';

// Markdown -> plain data for the right sidebar's reader. renderer.js builds the DOM from it with h(), so file text only
// ever becomes text nodes. CommonMark's common cases plus GitHub's tables, task lists, strikethrough, bare URLs and
// alerts (> [!NOTE]); raw HTML stays text (only <br> becomes a break), HTML comments are dropped, and a YAML front matter
// block becomes key/value pairs. Not a full CommonMark implementation: emphasis and list looseness are simplified.
// index.html loads this with a <script> tag before renderer.js, like lib/ui.js; `npm test` requires it (test/md.test.js).
//
// parseMarkdown(text) -> { front: [{ key, value }] | null, blocks }. Blocks:
//   { t: 'h', level, id, c }   { t: 'p', c }   { t: 'code', lang, text }   { t: 'hr' }
//   { t: 'quote', alert: null | 'note' | 'tip' | 'important' | 'warning' | 'caution', blocks }
//   { t: 'list', ordered, start, loose, items: [{ task: null | true | false, blocks }] }
//   { t: 'table', aligns: ['left' | 'center' | 'right' | null], head: [c], rows: [[c]] }
// Inline content (c) is a list of strings and { t: 'b' | 'i' | 's', c }, { t: 'code', text }, { t: 'a', href, c },
// { t: 'img', src, alt }, { t: 'br' }.

(() => {
  const FENCE = /^( {0,3})(`{3,}|~{3,})(.*)$/;
  const ATX = /^ {0,3}(#{1,6})(?=[ \t]|$)(.*)$/;
  const HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
  const QUOTE = /^ {0,3}> ?/;
  const ITEM = /^( {0,3})([-*+]|\d{1,9}[.)])(?=[ \t]|$)( *)/;
  const SETEXT1 = /^ {0,3}=+[ \t]*$/;
  const SETEXT2 = /^ {0,3}-+[ \t]*$/;
  const DELIM = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
  const REFDEF = /^ {0,3}\[([^\]]+)\]:[ \t]*<?([^\s>]+)>?(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?[ \t]*$/;
  const COMMENT = /^ {0,3}<!--/;
  const ALERT = /^\[!(note|tip|important|warning|caution)\][ \t]*$/i;
  const PUNCT = /[!-/:-@[-`{-~]/;

  const blank = (l) => !l.trim();
  const indentOf = (l) => /^ */.exec(l)[0].length;
  const stripIndent = (l, n) => l.replace(new RegExp(`^ {0,${n}}`), '');
  const markerKind = (m) => (/\d/.test(m) ? m.slice(-1) : m); // '.' / ')' for ordered lists, else the bullet
  /** Leading tabs -> spaces (to the next multiple of 4), so indentation is counted in one unit. */
  const expandTabs = (l) => l.replace(/^[ \t]+/, (ws) => {
    let out = '';
    for (const ch of ws) out += ch === '\t' ? ' '.repeat(4 - (out.length % 4)) : ch;
    return out;
  });

  /** Can this line start a block that ends a paragraph? Inside one, only "1." starts an ordered list, and no empty item does. */
  function startsBlock(l, inPara) {
    if (FENCE.test(l) || ATX.test(l) || HR.test(l) || QUOTE.test(l) || COMMENT.test(l)) return true;
    const m = ITEM.exec(l);
    if (!m) return false;
    if (!inPara) return true;
    return !!l.slice(m[0].length).trim() && (!/\d/.test(m[2]) || parseInt(m[2], 10) === 1);
  }

  /** A table row's cells: outer pipes dropped, split on pipes that are not escaped or inside a code span. */
  function cells(line) {
    const s = line.trim().replace(/^\|/, '');
    const out = [];
    let cur = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '\\' && i + 1 < s.length) { cur += ch + s[++i]; continue; }
      if (ch === '`') {
        const run = /^`+/.exec(s.slice(i))[0];
        const end = s.indexOf(run, i + run.length);
        if (end > 0) { cur += s.slice(i, end + run.length); i = end + run.length - 1; continue; }
      }
      if (ch === '|') { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim() || !/\|\s*$/.test(s)) out.push(cur.trim());
    return out;
  }

  function isTable(lines, i) {
    if (!lines[i].includes('|') || i + 1 >= lines.length || !DELIM.test(lines[i + 1])) return false;
    return cells(lines[i]).length === cells(lines[i + 1]).length;
  }

  function frontMatter(lines) {
    const out = [];
    for (const l of lines) {
      const m = /^([A-Za-z0-9_][\w .-]*):(?:[ \t]+(.*)|[ \t]*)$/.exec(l);
      if (m) out.push({ key: m[1].trim(), value: (m[2] || '').trim() });
      else if (out.length && l.trim()) {
        const last = out[out.length - 1];
        last.value = last.value ? `${last.value}\n${l.trim()}` : l.trim();
      }
    }
    for (const e of out) {
      if (/^[|>][+-]?$/.test(e.value)) e.value = ''; // a block scalar with no lines
      e.value = e.value.replace(/^[|>][+-]?\n/, '').replace(/^(["'])([\s\S]*)\1$/, '$2');
    }
    return out.length ? out : null;
  }

  // ----------------------------------------------------------------- blocks ----
  // Inline text is kept raw here (`text`) and parsed once every link reference definition is known (finish()).

  function parseBlocks(lines, refs) {
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (blank(line)) { i++; continue; }
      let m = FENCE.exec(line);
      if (m && !(m[2][0] === '`' && m[3].includes('`'))) {
        const [, ind, fence, info] = m;
        const close = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*$`);
        const body = [];
        for (i++; i < lines.length && !close.test(lines[i]); i++) body.push(stripIndent(lines[i], ind.length));
        i++; // the closing fence (or past the end: an unclosed fence runs to the end of the file)
        out.push({ t: 'code', lang: info.trim().split(/\s+/)[0] || '', text: body.join('\n') });
        continue;
      }
      if (indentOf(line) >= 4) { // indented code (it can't interrupt a paragraph, so it is only checked here)
        const body = [];
        while (i < lines.length && (blank(lines[i]) || indentOf(lines[i]) >= 4)) body.push(lines[i++].slice(4));
        while (body.length && blank(body[body.length - 1])) body.pop();
        out.push({ t: 'code', lang: '', text: body.join('\n') });
        continue;
      }
      if ((m = ATX.exec(line))) {
        out.push({ t: 'h', level: m[1].length, text: m[2].replace(/(?:^|[ \t]+)#+[ \t]*$/, '').trim() });
        i++;
        continue;
      }
      if (HR.test(line)) { out.push({ t: 'hr' }); i++; continue; }
      if (COMMENT.test(line)) {
        while (i < lines.length && !lines[i].includes('-->')) i++;
        i++;
        continue;
      }
      if (QUOTE.test(line)) {
        const body = [];
        while (i < lines.length) {
          const l = lines[i];
          if (QUOTE.test(l)) body.push(l.replace(QUOTE, ''));
          else if (!blank(l) && !blank(body[body.length - 1]) && !startsBlock(l, true)) body.push(l); // lazy continuation
          else break;
          i++;
        }
        const alert = ALERT.exec(body[0].trim())?.[1].toLowerCase() || null;
        out.push({ t: 'quote', alert, blocks: parseBlocks(alert ? body.slice(1) : body, refs) });
        continue;
      }
      if ((m = ITEM.exec(line))) {
        const kind = markerKind(m[2]);
        const list = { t: 'list', ordered: /\d/.test(m[2]), start: /\d/.test(m[2]) ? parseInt(m[2], 10) : 1, loose: false, items: [] };
        let gap = false; // blank lines after the previous item
        while (i < lines.length && !HR.test(lines[i]) && (m = ITEM.exec(lines[i])) && markerKind(m[2]) === kind) {
          const sp = m[3].length;
          const rest = lines[i].slice(m[0].length);
          const empty = !rest.trim();
          const indent = m[1].length + m[2].length + (empty || sp === 0 || sp > 4 ? 1 : sp);
          const body = [empty ? '' : sp > 4 ? ' '.repeat(sp - 1) + rest : rest];
          let lastBlank = empty;
          for (i++; i < lines.length; i++) {
            const l = lines[i];
            if (blank(l)) { body.push(''); lastBlank = true; continue; }
            if (indentOf(l) >= indent) { body.push(l.slice(indent)); lastBlank = false; continue; }
            // a lazy paragraph line; never another item ("2." can't interrupt a paragraph, but it does continue a list)
            if (!lastBlank && !ITEM.test(l) && !startsBlock(l, true) && !isTable(lines, i)) { body.push(l.trim()); continue; }
            break;
          }
          let trailing = 0;
          while (body.length && blank(body[body.length - 1])) { body.pop(); trailing++; }
          if (gap) list.loose = true;
          gap = trailing > 0;
          let task = null;
          const tm = /^\[([ xX])\](?=[ \t]|$)[ \t]?/.exec(body[0] || '');
          if (tm) { task = tm[1] !== ' '; body[0] = body[0].slice(tm[0].length); }
          const blocks = parseBlocks(body, refs);
          if (blocks.length > 1 && body.some(blank)) list.loose = true;
          list.items.push({ task, blocks });
        }
        out.push(list);
        continue;
      }
      if (isTable(lines, i)) {
        const head = cells(line);
        const aligns = cells(lines[i + 1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center'
          : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : null));
        const rows = [];
        for (i += 2; i < lines.length && !blank(lines[i]) && !startsBlock(lines[i], true); i++) {
          const r = cells(lines[i]);
          rows.push(head.map((_, k) => r[k] || ''));
        }
        out.push({ t: 'table', aligns, head, rows });
        continue;
      }
      // Paragraph, possibly a setext heading (text underlined with === or ---).
      const para = [];
      let level = 0;
      while (i < lines.length && !blank(lines[i])) {
        const l = lines[i];
        if (para.length) {
          if (SETEXT1.test(l) || SETEXT2.test(l)) { level = SETEXT1.test(l) ? 1 : 2; i++; break; }
          if (startsBlock(l, true) || isTable(lines, i)) break;
        } else if ((m = REFDEF.exec(l))) {
          const key = m[1].trim().toLowerCase();
          if (!(key in refs)) refs[key] = m[2];
          i++;
          continue;
        }
        para.push(l.replace(/^[ \t]+/, ''));
        i++;
      }
      if (!para.length) continue;
      const text = para.join('\n');
      out.push(level ? { t: 'h', level, text: text.trim() } : { t: 'p', text: text.replace(/[ \t]+$/, '') });
    }
    return out;
  }

  // ----------------------------------------------------------------- inline ----
  // The renderer parses on its main thread, so a big odd file must not freeze the window: every search for a closing
  // backtick run, bracket or delimiter is linear overall. Brackets are matched in one pass per string; a failed search
  // for a run remembers how far it looked (`miss`), so the next opener of the same kind continues from there instead of
  // rescanning; spans, labels and destinations longer than LOOK are left as text.
  const LOOK = 4000;
  const DEST_MAX = 2000; // a longer link destination is not a link (its text stays as written)

  const runLen = (s, i) => { let n = 1; while (s[i + n] === s[i]) n++; return n; };
  const spacesAtEnd = (t) => { let k = 0; while (t[t.length - 1 - k] === ' ') k++; return k; };

  /** The start of the next run of exactly n backticks at or after `from` (within LOOK), else -1. */
  function closingTicks(x, n, from) {
    const s = x.s;
    const key = '`' + n;
    const end = Math.min(s.length, from + LOOK);
    let j = Math.max(from, x.miss[key] || 0);
    for (; j < end; j++) {
      if (s[j] !== '`') continue;
      const m = runLen(s, j);
      if (m === n) return j;
      j += m - 1;
    }
    x.miss[key] = j;
    return -1;
  }

  /** Where each `[` is closed (nesting, escapes and code spans respected): Map(open -> close), built once per string. */
  function brackets(x) {
    if (x.br) return x.br;
    const s = x.s;
    const br = new Map();
    const stack = [];
    for (let j = 0; j < s.length; j++) {
      const ch = s[j];
      if (ch === '\\') { j++; continue; }
      if (ch === '`') {
        const n = runLen(s, j);
        const e = closingTicks(x, n, j + n);
        j = (e >= 0 ? e + n : j + n) - 1;
        continue;
      }
      if (ch === '[') stack.push(j);
      else if (ch === ']' && stack.length) br.set(stack.pop(), j);
    }
    return (x.br = br);
  }

  const unescape = (s) => s.replace(/\\([!-/:-@[-`{-~])/g, '$1');
  const skipSpace = (s, j) => { while (s[j] === ' ' || s[j] === '\n') j++; return j; };

  /** [label](dest "title"), [label][ref], [ref][] or [ref] at i: { label, href, end }, else null. */
  function link(x, i) {
    const s = x.s;
    const close = brackets(x).get(i);
    if (close == null || close - i > LOOK) return null;
    const label = s.slice(i + 1, close);
    let j = close + 1;
    if (s[j] === '(') {
      j = skipSpace(s, j + 1);
      let dest;
      if (s[j] === '<') {
        const end = s.indexOf('>', j);
        if (end < 0 || end - j > LOOK) return null;
        dest = s.slice(j + 1, end);
        j = end + 1;
      } else {
        const start = j;
        let depth = 0;
        for (const stop = Math.min(s.length, j + DEST_MAX); j < stop; j++) {
          const ch = s[j];
          if (ch === '\\') { j++; continue; }
          if (ch === ' ' || ch === '\n' || ch === '\t') break;
          if (ch === '(') depth++;
          else if (ch === ')' && depth-- === 0) break;
        }
        dest = s.slice(start, j);
      }
      j = skipSpace(s, j);
      const title = /^(?:"(?:[^"\\]|\\.){0,500}"|'(?:[^'\\]|\\.){0,500}'|\((?:[^)\\]|\\.){0,500}\))/.exec(s.slice(j, j + 1010));
      if (title) j = skipSpace(s, j + title[0].length);
      if (s[j] !== ')') return null;
      return { label, href: unescape(dest), end: j + 1 };
    }
    let key = label;
    if (s[j] === '[') {
      const end = brackets(x).get(j);
      if (end != null) {
        if (end > j + 1) key = s.slice(j + 1, end);
        j = end + 1;
      }
    }
    const href = x.refs[key.trim().replace(/\s+/g, ' ').toLowerCase()];
    return href == null ? null : { label, href: unescape(href), end: j };
  }

  /** The start of a closing run of exactly `len` `ch` for an opener ending at `from` (a *** run also closes 1 or 2), else -1. */
  function closingDelim(x, ch, len, from) {
    const s = x.s;
    const key = ch + len;
    const end = Math.min(s.length, from + LOOK);
    let j = Math.max(from, x.miss[key] || 0);
    for (; j < end; j++) {
      const c = s[j];
      if (c === '\\') { j++; continue; }
      if (c === '`') {
        const n = runLen(s, j);
        const e = closingTicks(x, n, j + n);
        j = (e >= 0 ? e : j) + n - 1;
        continue;
      }
      if (c !== ch) continue;
      const n = runLen(s, j);
      const closes = !/\s/.test(s[j - 1]) && (ch !== '_' || !/[\p{L}\p{N}]/u.test(s[j + n] || ''));
      if (closes && j > from && (n === len || (n === 3 && len < 3))) return j + (n - len);
      j += n - 1;
    }
    x.miss[key] = j;
    return -1;
  }

  /** Emphasis, strong or strikethrough opening with the run of n at i: { node, end }, else null. */
  function emphasis(x, i, n) {
    const s = x.s;
    const ch = s[i];
    const after = s[i + n];
    if (!after || /\s/.test(after)) return null; // not left-flanking
    if (ch === '_' && /[\p{L}\p{N}]/u.test(s[i - 1] || '')) return null; // snake_case_words
    if (n > (ch === '~' ? 2 : 3)) return null;
    for (let len = n; len >= 1; len--) {
      const close = closingDelim(x, ch, len, i + len);
      if (close < 0) continue;
      const c = inline(s.slice(i + len, close), x.refs, x.noLinks);
      const node = ch === '~' ? { t: 's', c } : len === 3 ? { t: 'b', c: [{ t: 'i', c }] } : { t: len === 2 ? 'b' : 'i', c };
      return { node, end: close + len };
    }
    return null;
  }

  const SPECIAL = /[\\\n`![<*_~hHwW]/g;
  const AUTOLINK = /<((?:https?|mailto|ftp):[^\s<>]{0,2000}|[^\s@<>]{1,200}@[^\s@<>]{1,200}\.[A-Za-z]{2,})>/y;
  const BARE_URL = /(?:https?:\/\/|www\.)[^\s<]{0,2000}[^\s<?!.,:*_~'")\]]/iy;
  const BR_TAG = /<br\s*\/?>/iy;

  /** Inline markdown -> nodes. `noLinks` inside a link's label (links don't nest). */
  function inline(s, refs, noLinks = false) {
    const x = { s, refs, noLinks, br: null, miss: Object.create(null) };
    const out = [];
    let text = '';
    const flush = () => { if (text) out.push(text); text = ''; };
    let i = 0;
    while (i < s.length) {
      SPECIAL.lastIndex = i;
      const sm = SPECIAL.exec(s);
      if (!sm) { text += s.slice(i); break; }
      text += s.slice(i, sm.index);
      i = sm.index;
      const c = s[i];
      if (c === '\\') {
        if (s[i + 1] === '\n') { text = text.slice(0, text.length - spacesAtEnd(text)); flush(); out.push({ t: 'br' }); i += 2; continue; }
        if (PUNCT.test(s[i + 1] || '')) { text += s[i + 1]; i += 2; continue; }
        text += c; i++;
        continue;
      }
      if (c === '\n') { // soft break, or a hard one after 2+ spaces
        const sp = spacesAtEnd(text);
        text = text.slice(0, text.length - sp);
        if (sp >= 2) { flush(); out.push({ t: 'br' }); } else text += ' ';
        for (i++; s[i] === ' '; i++);
        continue;
      }
      if (c === '`') {
        const n = runLen(s, i);
        const end = closingTicks(x, n, i + n);
        if (end < 0) { text += s.slice(i, i + n); i += n; continue; }
        let code = s.slice(i + n, end).replace(/\n/g, ' ');
        if (code.length > 2 && code[0] === ' ' && code[code.length - 1] === ' ' && code.trim()) code = code.slice(1, -1);
        flush();
        out.push({ t: 'code', text: code });
        i = end + n;
        continue;
      }
      if (c === '!') {
        const l = s[i + 1] === '[' && link(x, i + 1);
        if (l) { flush(); out.push({ t: 'img', src: l.href, alt: plainText(inline(l.label, refs, true)) }); i = l.end; continue; }
        text += c; i++;
        continue;
      }
      if (c === '[') {
        const l = !noLinks && link(x, i);
        if (l) { flush(); out.push({ t: 'a', href: l.href, c: inline(l.label, refs, true) }); i = l.end; continue; }
        text += c; i++;
        continue;
      }
      if (c === '<') {
        BR_TAG.lastIndex = i;
        const br = BR_TAG.exec(s);
        if (br) { flush(); out.push({ t: 'br' }); i += br[0].length; continue; }
        AUTOLINK.lastIndex = i;
        const m = !noLinks && AUTOLINK.exec(s);
        if (m) { flush(); out.push({ t: 'a', href: m[1].includes(':') ? m[1] : `mailto:${m[1]}`, c: [m[1]] }); i += m[0].length; continue; }
        text += c; i++;
        continue;
      }
      if (c !== '*' && c !== '_' && c !== '~') { // h / w: a bare URL at a word start
        BARE_URL.lastIndex = i;
        const m = !noLinks && !/[\p{L}\p{N}]/u.test(s[i - 1] || '') && BARE_URL.exec(s);
        if (m) {
          let url = m[0];
          // a closing paren belongs to the URL only when it balances one inside it (wiki/Foo_(bar))
          while (s[i + url.length] === ')' && (url.match(/\(/g) || []).length > (url.match(/\)/g) || []).length) url += ')';
          flush();
          out.push({ t: 'a', href: /^www\./i.test(url) ? `http://${url}` : url, c: [url] });
          i += url.length;
          continue;
        }
        text += c; i++;
        continue;
      }
      const n = runLen(s, i);
      const em = emphasis(x, i, n);
      if (em) { flush(); out.push(em.node); i = em.end; continue; }
      text += s.slice(i, i + n);
      i += n;
    }
    flush();
    return out;
  }

  /** The text of inline nodes (image alt, heading anchors). */
  function plainText(nodes) {
    return nodes.map((n) => (typeof n === 'string' ? n : n.t === 'br' ? ' ' : n.t === 'img' ? n.alt : n.text ?? plainText(n.c || []))).join('');
  }

  /** GitHub's heading anchors: lower case, punctuation dropped, spaces -> '-', repeats get -1, -2... */
  function slugger() {
    const seen = new Map();
    return (text) => {
      const base = text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
      const n = seen.get(base) || 0;
      seen.set(base, n + 1);
      return n ? `${base}-${n}` : base;
    };
  }

  function finish(blocks, refs, slug) {
    for (const b of blocks) {
      if (b.t === 'h' || b.t === 'p') {
        b.c = inline(b.text, refs);
        delete b.text;
        if (b.t === 'h') b.id = slug(plainText(b.c));
      } else if (b.t === 'quote') finish(b.blocks, refs, slug);
      else if (b.t === 'list') for (const it of b.items) finish(it.blocks, refs, slug);
      else if (b.t === 'table') {
        b.head = b.head.map((c) => inline(c, refs));
        b.rows = b.rows.map((r) => r.map((c) => inline(c, refs)));
      }
    }
    return blocks;
  }

  function parseMarkdown(src) {
    let lines = String(src ?? '').replace(/^\uFEFF/, '').replace(/\0/g, '\uFFFD').replace(/\r\n?/g, '\n').split('\n').map(expandTabs);
    let front = null;
    if (/^---[ \t]*$/.test(lines[0])) {
      const end = lines.findIndex((l, k) => k > 0 && /^(?:---|\.\.\.)[ \t]*$/.test(l));
      const fm = end > 0 && frontMatter(lines.slice(1, end));
      if (fm) { front = fm; lines = lines.slice(end + 1); }
    }
    const refs = Object.create(null);
    const blocks = parseBlocks(lines, refs);
    return { front, blocks: finish(blocks, refs, slugger()) };
  }

  const helpers = { parseMarkdown };
  if (typeof module === 'object' && module.exports) module.exports = helpers;
  else Object.assign(globalThis, helpers);
})();

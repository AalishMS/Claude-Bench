'use strict';

// Pure parsers for main.js: text from git, netstat, lsof, ps, `claude mcp list` and transcripts in, plain data out.
// No Electron, no fs, so `npm test` runs them on plain Node (test/parse.test.js).

const path = require('path');

// ------------------------------------------------------------------ git ----

/** `git status --porcelain=v2 --branch` -> { branch, detached, upstream, ahead, behind, staged, modified, untracked, conflicts, dirty } */
function parseGitStatus(out) {
  const info = {
    branch: null, detached: false, upstream: null,
    ahead: 0, behind: 0, staged: 0, modified: 0, untracked: 0, conflicts: 0,
  };
  let oid = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('# branch.head ')) {
      info.branch = line.slice(14).trim();
      if (info.branch === '(detached)') info.detached = true;
    } else if (line.startsWith('# branch.oid ')) {
      oid = line.slice(13).trim();
    } else if (line.startsWith('# branch.upstream ')) {
      info.upstream = line.slice(18).trim();
    } else if (line.startsWith('# branch.ab ')) {
      const m = /\+(\d+) -(\d+)/.exec(line);
      if (m) { info.ahead = +m[1]; info.behind = +m[2]; }
    } else if (line.startsWith('1 ') || line.startsWith('2 ')) {
      const xy = line.split(' ')[1];
      if (xy[0] !== '.') info.staged++;
      if (xy[1] !== '.') info.modified++;
    } else if (line.startsWith('u ')) {
      info.conflicts++;
    } else if (line.startsWith('? ')) {
      info.untracked++;
    }
  }
  if (info.detached && oid && oid !== '(initial)') info.branch = oid.slice(0, 7);
  info.dirty = info.staged + info.modified + info.untracked + info.conflicts;
  return info;
}

// ---------------------------------------------------------------- ports ----

/**
 * A process's real parent pid, or 0. Windows never clears ParentProcessId, so once the parent exits its pid can be
 * reused by an unrelated process; a parent that was created after its child cannot be the real one.
 */
function parentPid(procs, p) {
  const parent = procs.get(p.ParentProcessId);
  return parent && parent.T > p.T ? 0 : p.ParentProcessId;
}

/**
 * `netstat -ano` TCP rows whose foreign address is 0.0.0.0:0 / [::]:0 (listeners; the state column is localized)
 * -> [{ LocalAddress, LocalPort, OwningProcess }]. Relies on `-a` without `-q`: `-q` would add BOUND sockets, which
 * have the same zero foreign address but serve nothing.
 */
function parseNetstat(out) {
  const conns = [];
  for (const line of out.split('\n')) {
    const m = /^\s*TCP\s+(\S+):(\d+)\s+(\S+)\s.*?(\d+)\s*$/.exec(line);
    if (!m || !/^(0\.0\.0\.0|\[::\]):0$/.test(m[3])) continue;
    conns.push({ LocalAddress: m[1].replace(/^\[|\]$/g, '').replace(/%\d+$/, ''), LocalPort: +m[2], OwningProcess: +m[4] });
  }
  return conns;
}

/**
 * Git Bash's own `ps -l` (PID PPID PGID WINPID ...) -> Map(Windows pid -> Windows pid of its MSYS parent). MSYS emulates
 * fork/exec with new Windows processes and the one in between can exit, so a server started from Git Bash may have a
 * dead Windows parent; its MSYS parent (which survives the exec) is still listed here. Rows may start with a status letter.
 */
function parseMsysPs(out) {
  const rows = [];
  const winOf = new Map();
  for (const line of out.split('\n')) {
    const m = /^\D*?(\d+)\s+(\d+)\s+\d+\s+(\d+)\s/.exec(line);
    if (!m) continue;
    rows.push([+m[2], +m[3]]);
    winOf.set(+m[1], +m[3]);
  }
  const parents = new Map();
  for (const [ppid, win] of rows) if (winOf.has(ppid)) parents.set(win, winOf.get(ppid));
  return parents;
}

/** ps etime "[[dd-]hh:]mm:ss" -> seconds */
function etimeSeconds(s) {
  const [days, rest] = s.includes('-') ? s.split('-') : ['0', s];
  return rest.split(':').reduce((acc, n) => acc * 60 + (+n || 0), 0) + (+days || 0) * 86400;
}

/** `lsof -F pcn` records -> [{ LocalAddress, LocalPort, OwningProcess }], plus pid -> command name. */
function parseLsof(out) {
  const conns = [];
  const names = new Map();
  let pid = 0;
  for (const line of out.split('\n')) {
    const v = line.slice(1).trim();
    if (line[0] === 'p') pid = +v;
    else if (line[0] === 'c') names.set(pid, v);
    else if (line[0] === 'n') {
      const m = /^(.*):(\d+)$/.exec(v); // 127.0.0.1:3000, *:3000, [::1]:3000
      if (!m) continue;
      const addr = m[1].replace(/^\[|\]$/g, '');
      conns.push({ LocalAddress: addr === '*' ? '0.0.0.0' : addr, LocalPort: +m[2], OwningProcess: pid });
    }
  }
  return { conns, names };
}

/** `ps -o pid=,ppid=,etime=,args=` lines -> processes in the Windows scan's shape. */
function parsePs(out, names, now) {
  const procs = [];
  for (const line of out.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line);
    if (!m) continue;
    const pid = +m[1];
    const cmd = m[4].trim();
    procs.push({
      ProcessId: pid,
      ParentProcessId: +m[2],
      Name: names.get(pid) || path.basename(cmd.split(' ')[0]),
      CommandLine: cmd,
      T: now - etimeSeconds(m[3]) * 1000, // creation time, so parentPid's pid-reuse guard works here too
    });
  }
  return procs;
}

/** "python3.12" -> "python.exe", so DEV_PROCESSES serves both platforms. */
const macDevName = (name) => `${name.toLowerCase().replace(/[\d.]+$/, '')}.exe`;

/**
 * A command line, lowercased, without `--flag=value` arguments. Paths in flags don't make a process a project's server:
 * editor helpers (e.g. Antigravity's `agy.exe --add-dir=<project>`) mention projects without serving them.
 */
const withoutFlagValues = (cmd) => (cmd || '').toLowerCase().replace(/"--?[\w-]+=[^"]*"|(^|\s)--?[\w-]+=("[^"]*"|\S*)/g, ' ');

// ----------------------------------------------------------- transcripts ----

const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 160);

const usageTokens = (u) => u ? (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.output_tokens || 0) : 0;

function parseTail(text) {
  const out = { title: null, prompt: null, usage: null, model: null, last: 0 };
  for (const line of text.split('\n')) {
    try {
      const msg = line.includes('"type":"assistant"') ? 'assistant' : line.includes('"type":"user"') ? 'user' : null;
      if (msg) {
        // Last real conversation entry. The file's mtime also moves on a mere resume and on exit (Claude touches the
        // transcript and appends a cost-state line), so the sidebar sorts by this instead.
        const j = JSON.parse(line);
        if (j.type !== msg) continue;
        if (!j.isMeta && j.timestamp) out.last = Date.parse(j.timestamp) || out.last;
        const m = j.message;
        if (msg === 'assistant' && m?.usage && m.model !== '<synthetic>') { out.usage = m.usage; out.model = m.model; }
      } else if (line.includes('"type":"ai-title"')) {
        const j = JSON.parse(line);
        if (j.type === 'ai-title' && j.aiTitle) out.title = j.aiTitle;
      } else if (line.includes('"type":"last-prompt"')) {
        const j = JSON.parse(line);
        if (j.type === 'last-prompt' && j.lastPrompt) out.prompt = j.lastPrompt;
      }
    } catch { /* partial or foreign line */ }
  }
  return out;
}

function firstPrompt(text) {
  for (const line of text.split('\n')) {
    if (!line.includes('"type":"user"')) continue;
    try {
      const j = JSON.parse(line);
      if (j.type !== 'user' || j.isMeta) continue;
      const c = j.message?.content;
      const s = typeof c === 'string' ? c : Array.isArray(c) ? c.find((x) => x.type === 'text')?.text : null;
      if (s && !s.startsWith('<')) return s;
    } catch { /* truncated line */ }
  }
  return null;
}

/** The folder a session ran in: the first `cwd` field in the transcript head (folder names in ~/.claude/projects are lossy). */
function transcriptCwd(text) {
  for (const line of text.split('\n')) {
    if (!line.includes('"cwd"')) continue;
    try {
      const cwd = JSON.parse(line).cwd;
      if (typeof cwd === 'string' && cwd) return cwd;
    } catch { /* truncated line */ }
  }
  return null;
}

/** Effort for a model from settings: modelSettings by id ("Opus 5.5" -> claude-opus-5-5), else by family, else global. */
function defaultEffort(settings, model) {
  const per = settings?.modelSettings || {};
  const m = String(model || '').toLowerCase().replace(/\[1m\]$/, '');
  const id = m.startsWith('claude-') ? m : `claude-${m.replace(/[\s.]+/g, '-')}`;
  if (per[id]?.effortLevel) return per[id].effortLevel;
  const fam = /opus|sonnet|haiku|fable|mythos/.exec(m)?.[0];
  const keys = fam ? Object.keys(per).filter((k) => k.includes(fam) && per[k]?.effortLevel) : [];
  return keys.length === 1 ? per[keys[0]].effortLevel : settings?.effortLevel || null;
}

const modelFamily = (m) => /\b(opus|sonnet|haiku|fable|mythos)\b/i.exec(String(m || ''))?.[1].toLowerCase() || null;
/**
 * Transcripts record the bare API id ("claude-sonnet-5-5"), never the "[1m]" a model was chosen with. Re-attach it when
 * the model that was configured ("sonnet[1m]", "claude-sonnet-4-5[1m]") is of the same family, so the renderer can tell
 * a 1M session of a 200k-by-default model (Sonnet/Opus 4.5) from a 200k one.
 */
function withLongContext(model, configured) {
  if (!model || /\[1m\]$/i.test(model) || !/\[1m\]$/i.test(String(configured || ''))) return model;
  const fam = modelFamily(model);
  return fam && fam === modelFamily(configured) ? `${model}[1m]` : model;
}

/**
 * Latest model (from replies or /model) and effort (from /effort or /model) in transcript text. `prev` = the result for
 * the text before it, so a transcript can be read in pieces: a value is kept until a later line changes it.
 */
function parseModelEffort(text, prev) {
  const out = { model: prev?.model || null, effort: prev?.effort || null };
  for (const line of text.split('\n')) {
    try {
      if (line.includes('"type":"assistant"') && line.includes('"model"')) {
        const m = JSON.parse(line).message?.model;
        if (m && m !== '<synthetic>') out.model = withLongContext(m, out.model); // keep a "[1m]" set by /model
      } else if (line.includes('local-command-stdout')) {
        const c = JSON.parse(line).message?.content;
        if (typeof c !== 'string') continue;
        const model = /Set model to `([^`]+)`/.exec(c)?.[1] || /Set model to ([^\s(<]+(?: [\d.]+)?)/.exec(c)?.[1];
        // "Set model to Opus 4.6 (1M context)" names the window only in the trailing note
        if (model) out.model = /\[1m\]$/i.test(model) || !/\b1M context\b/i.test(c) ? model : `${model}[1m]`;
        const effort = /Set effort level to (\w+)/.exec(c)?.[1] || /with `?(\w+)`? effort/.exec(c)?.[1];
        if (effort) out.effort = effort;
      }
    } catch { /* partial or foreign line */ }
  }
  return out;
}

/**
 * Is the subagent whose transcript ends in `tail` finished? Judged by its last message line: a SubagentHandback call
 * (or its tool result), a text reply that ended the turn (Explore, Plan and /code-review runs report this way, no
 * handback), or a stop (TaskStop / Esc leave a "[Request interrupted by user]" user line). Text and the next tool call
 * are separate lines, and mid-run text has `stop_reason` null, so only end_turn / stop_sequence count (else a run that
 * talks before acting would blink done). Other lines are skipped: a finished run is followed by a ~100 KB
 * `prompt_snapshot` attachment whose tool list names SubagentHandback, so a text search would call any run done.
 * null = no complete message line in the tail (read more of the file).
 */
function agentDone(tail) {
  const lines = tail.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes('"type":"assistant"') && !lines[i].includes('"type":"user"')) continue;
    let j;
    try { j = JSON.parse(lines[i]); } catch { continue; } // cut off at the tail's start, or still being written
    const c = j.message?.content;
    if (j.type === 'assistant' && Array.isArray(c)) {
      if (c.some((x) => x.type === 'tool_use')) return c.some((x) => x.type === 'tool_use' && x.name === 'SubagentHandback');
      const stop = j.message.stop_reason;
      return (stop === 'end_turn' || stop === 'stop_sequence') && c.some((x) => x.type === 'text');
    }
    if (j.type !== 'user') continue;
    if (Array.isArray(c) && c.length && c.every((x) => x.type === 'tool_result')) continue; // judged by the call before it
    return (typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x.text || '').join('') : '').startsWith('[Request interrupted by user');
  }
  return null;
}

/**
 * The model of the last real reply in a subagent transcript tail, or null. Synthetic replies (API errors, interrupts)
 * don't count, nor does a "model" inside a tool call's input.
 */
function lastModel(tail) {
  const lines = tail.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes('"type":"assistant"')) continue;
    try {
      const j = JSON.parse(lines[i]);
      const m = j.type === 'assistant' ? j.message?.model : null;
      if (typeof m === 'string' && m && m !== '<synthetic>') return m;
    } catch { /* line still being written */ }
  }
  return null;
}

/**
 * A subagent definition (~/.claude/agents/<file>.md) -> { name, model, body }. The frontmatter is the block between a
 * leading `---` line and the next one; without it the name is the file name and the whole text is the body.
 * `model` is null when not set.
 */
function parseAgentFile(text, fileName) {
  const t = text.replace(/^\uFEFF/, '');
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/.exec(t);
  const fm = m ? m[1] : '';
  const field = (k) => new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(fm)?.[1].trim().replace(/^["']|["']$/g, '') || null;
  return { name: oneLine(field('name') || fileName.replace(/\.md$/i, '')), model: field('model'), body: (m ? m[2] : t).trim() };
}

// ------------------------------------------------------------------ mcp ----

/** "name: target - ✔ Connected" -> { name, status, label }. Names can contain ":" (plugin:design:slack), target is after ": ". */
function parseMcpList(out) {
  const servers = [];
  for (const line of out.split(/\r?\n/)) {
    const cut = line.lastIndexOf(' - ');
    const sep = line.indexOf(': ');
    if (cut < 0 || sep < 0 || sep > cut) continue;
    const label = line.slice(cut + 3).replace(/^[^\w]+/, '').trim().toLowerCase();
    const status = /needs? client registration/.test(label) ? 'needs_client_registration'
      : /needs? auth/.test(label) ? 'needs_auth'
      : /fail|error/.test(label) ? 'failed'
      : /disabled/.test(label) ? 'disabled'
      : /^connected/.test(label) ? 'connected'
      : 'unknown';
    servers.push({ name: line.slice(0, sep).trim(), status, label });
  }
  return servers;
}

// -------------------------------------------------------------- restore ----

/**
 * Saved split groups name their members by saved tab index. `at` maps a saved index to its index among the tabs that
 * could be restored: keep the members still there, and the groups that still have two.
 */
function remapSplits(splits, at) {
  return (Array.isArray(splits) ? splits : []).map((g) => ({
    cx: g?.cx, ry: g?.ry, v: g?.v === true,
    tabs: (Array.isArray(g?.tabs) ? g.tabs : []).filter((i) => at.has(i)).map((i) => at.get(i)),
  })).filter((g) => g.tabs.length >= 2);
}

module.exports = {
  parseGitStatus,
  parentPid, parseNetstat, parseMsysPs, etimeSeconds, parseLsof, parsePs, macDevName, withoutFlagValues,
  oneLine, usageTokens, parseTail, firstPrompt, transcriptCwd, defaultEffort, modelFamily, withLongContext, parseModelEffort,
  agentDone, lastModel, parseAgentFile,
  parseMcpList,
  remapSplits,
};

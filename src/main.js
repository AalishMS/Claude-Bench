'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile, spawn } = require('child_process');
const pty = require('@lydell/node-pty');

const ICON = path.join(__dirname, '..', 'assets', 'icon.png');

app.setAppUserModelId('com.local.claudebench');

// ---------------------------------------------------------------- state ----

const defaults = {
  projects: [], // [{ path, name }]
  ui: { sidebar: true, servers: false, sidebarW: 232, rsideW: 300, fontSize: 14, expanded: [], collapsed: [] }, // expanded: project paths showing sessions; collapsed: right-sidebar sections folded shut
  bounds: null,
  maximized: false,
};
let state = structuredClone(defaults);
const stateFile = () => path.join(app.getPath('userData'), 'state.json');
// The app was called "Claude Terminal" (userData = %APPDATA%\claude-terminal); read that once if nothing is saved yet.
const legacyStateFile = () => path.join(app.getPath('appData'), 'claude-terminal', 'state.json');

function loadState() {
  try {
    const file = fs.existsSync(stateFile()) ? stateFile() : legacyStateFile();
    const saved = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
    state = { ...defaults, ...saved, ui: { ...defaults.ui, ...saved.ui } };
  } catch {
    /* first run or unreadable file: keep defaults */
  }
}

function saveState() {
  try {
    fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
    const tmp = stateFile() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, stateFile());
  } catch (err) {
    console.error('Could not save state:', err);
  }
}

const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};
const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

function addProject(p) {
  const abs = path.resolve(p);
  if (!isDir(abs)) return null;
  if (!state.projects.some((x) => samePath(x.path, abs))) {
    state.projects.push({ path: abs, name: path.basename(abs) || abs });
    saveState();
  }
  return abs;
}

// ----------------------------------------------------------------- ptys ----

const sessions = new Map(); // id -> { pty, pid, cwd, kind, buf, timer }

// Variables that mark "I am running inside a Claude Code session". If the app was
// started from one, nested `claude` processes would otherwise inherit them.
const STRIP_ENV = [
  'CLAUDECODE', 'CLAUDE_PID',
  'CLAUDE_CODE_CHILD_SESSION', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_CODE_SESSION_ATTENDED', 'CLAUDE_CODE_SSE_PORT',
  'CLAUDE_CODE_MESSAGING_SOCKET', 'CLAUDE_CODE_MESSAGING_TOKEN',
];
const ALLOWED_CLAUDE_ARGS = new Set(['--continue', '--resume']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function send(channel, ...args) {
  const win = mainWindow;
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args);
}

function flushSession(id) {
  const s = sessions.get(id);
  if (!s || !s.buf) return;
  const data = s.buf;
  s.buf = '';
  s.timer = null;
  send('pty:data', id, data);
}

function createSession({ id, cwd, kind, args, resumeId, cols, rows }) {
  if (sessions.has(id)) return { ok: false, error: 'Session already exists' };
  if (!isDir(cwd)) return { ok: false, error: `Folder not found: ${cwd}` };
  // Only a bare UUID may reach the command line as a session id.
  if (resumeId != null && !(typeof resumeId === 'string' && UUID_RE.test(resumeId))) {
    return { ok: false, error: 'Invalid session id' };
  }

  const env = { ...process.env, COLORTERM: 'truecolor', TERM_PROGRAM: 'ClaudeBench' };
  for (const k of STRIP_ENV) delete env[k];

  let file;
  let argv;
  if (kind === 'claude') {
    const extra = resumeId ? ['--resume', resumeId] : (args || []).filter((a) => ALLOWED_CLAUDE_ARGS.has(a));
    // cmd resolves both claude.cmd (npm) and claude.exe (native installer).
    file = 'cmd.exe';
    argv = ['/d', '/c', 'claude', ...extra];
  } else {
    file = 'powershell.exe';
    argv = ['-NoLogo'];
  }

  let p;
  try {
    p = pty.spawn(file, argv, {
      name: 'xterm-256color',
      cols: Math.max(cols || 80, 2),
      rows: Math.max(rows || 24, 2),
      cwd,
      env,
    });
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }

  const s = { pty: p, cwd, kind, buf: '', timer: null };
  sessions.set(id, s);

  // Coalesce bursts of output into one IPC message per few milliseconds.
  p.onData((d) => {
    s.buf += d;
    if (!s.timer) s.timer = setTimeout(() => flushSession(id), 6);
  });
  p.onExit(({ exitCode }) => {
    clearTimeout(s.timer);
    flushSession(id);
    sessions.delete(id);
    send('pty:exit', id, exitCode);
  });

  return { ok: true };
}

// ------------------------------------------------------------------ git ----

function run(file, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      { windowsHide: true, timeout: 10000, maxBuffer: 32 * 1024 * 1024, ...opts },
      (err, stdout) => resolve(err ? null : stdout)
    );
  });
}

async function gitStatus(cwd) {
  const out = await run('git', ['-C', cwd, 'status', '--porcelain=v2', '--branch'], {
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  });
  if (out == null) return null;

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

const DEV_PROCESSES = new Set([
  'node.exe', 'bun.exe', 'deno.exe', 'python.exe', 'pythonw.exe', 'py.exe', 'ruby.exe',
  'java.exe', 'javaw.exe', 'php.exe', 'php-cgi.exe', 'dotnet.exe', 'go.exe', 'cargo.exe',
  'uvicorn.exe', 'gunicorn.exe', 'hugo.exe', 'caddy.exe',
]);

const PORT_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$c = Get-NetTCPConnection -State Listen | Select-Object LocalAddress, LocalPort, OwningProcess
$p = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, CommandLine, @{ n = 'T'; e = { ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() } }
@{ c = @($c); p = @($p) } | ConvertTo-Json -Compress -Depth 4
`;

// Session children shown next to the ports: MCP servers Claude starts, and browsers (Playwright, DevTools MCP...).
const BROWSERS = new Set(['chrome.exe', 'msedge.exe', 'firefox.exe', 'chromium.exe', 'chrome-headless-shell.exe', 'brave.exe']);
const SHELLS = new Set(['bash.exe', 'sh.exe', 'powershell.exe', 'pwsh.exe']); // tool commands, not MCP servers

/** "cmd.exe /c npx -y @playwright/mcp@latest" -> "@playwright/mcp" */
function mcpLabel(cmd) {
  const tokens = (cmd.match(/"[^"]*"|\S+/g) || []).map((t) => t.replace(/[\^"]/g, '')); // cmd escapes quotes as ^"
  const tok = tokens.find((t) => !t.startsWith('-') && /mcp/i.test(t));
  if (!tok) return 'MCP server';
  const name = /[\\/]/.test(tok) && !tok.startsWith('@')
    ? tok.split(/[\\/]/).filter((seg) => /mcp/i.test(seg)).pop() || tok
    : tok;
  return name.replace(/(.)@[^/@]*$/, '$1').replace(/\.(js|cmd|exe|py)$/i, '');
}

/**
 * A process's real parent pid, or 0. Windows never clears ParentProcessId, so once the parent exits its pid can be
 * reused by an unrelated process; a parent that was created after its child cannot be the real one.
 */
function parentPid(procs, p) {
  const parent = procs.get(p.ParentProcessId);
  return parent && parent.T > p.T ? 0 : p.ParentProcessId;
}

function sessionProcesses(procs, sessionByPid) {
  const children = new Map();
  for (const p of procs.values()) {
    const parent = parentPid(procs, p);
    if (!parent) continue;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(p);
  }
  const items = [];
  const seen = new Set();
  const walk = (pid, s, ctx) => {
    for (const c of children.get(pid) || []) {
      if (seen.has(c.ProcessId)) continue; // pid reuse can make cycles
      seen.add(c.ProcessId);
      const name = (c.Name || '').toLowerCase();
      const cmd = c.CommandLine || '';
      const next = { ...ctx, shell: ctx.shell || SHELLS.has(name) };
      let item = null;
      if (!ctx.browser && BROWSERS.has(name) && !cmd.includes('--type=')) {
        const port = /--remote-debugging-port=(\d+)/.exec(cmd)?.[1];
        item = { kind: 'browser', label: name.replace(/\.exe$/, ''), headless: /--headless/.test(cmd), debugPort: port ? +port : null };
        next.browser = true;
      } else if (s.kind === 'claude' && !ctx.mcp && !ctx.browser && !next.shell && /mcp/i.test(cmd)) {
        item = { kind: 'mcp', label: mcpLabel(cmd) };
        next.mcp = true;
      }
      if (item) items.push({ ...item, pid: c.ProcessId, cmd, owner: { type: 'session', sessionId: s.id, projectPath: s.cwd, kind: s.kind } });
      walk(c.ProcessId, s, next);
    }
  };
  for (const [pid, s] of sessionByPid) walk(pid, s, {});
  return items;
}

let portScan = null;

async function scanPorts() {
  const out = await run(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', PORT_SCRIPT],
    { timeout: 20000 }
  );
  if (!out) return { ok: false, error: 'Could not read listening ports' };

  let data;
  try {
    data = JSON.parse(out);
  } catch {
    return { ok: false, error: 'Could not parse port scan output' };
  }

  const procs = new Map();
  for (const p of data.p || []) procs.set(p.ProcessId, p);

  const sessionByPid = new Map();
  // ConPTY reports pid 0 until it has connected, so read it now rather than at spawn time.
  for (const [id, s] of sessions) {
    if (s.pty.pid) sessionByPid.set(s.pty.pid, { id, cwd: s.cwd, kind: s.kind });
  }

  const projectsByLength = [...state.projects].sort((a, b) => b.path.length - a.path.length);

  const ownerOf = (pid, cmd) => {
    // 1. Started from one of our terminals (walk up the parent chain).
    let cur = pid;
    for (let i = 0; i < 40 && cur; i++) {
      const s = sessionByPid.get(cur);
      if (s) return { type: 'session', sessionId: s.id, projectPath: s.cwd, kind: s.kind };
      const p = procs.get(cur);
      cur = p && parentPid(procs, p);
    }
    // 2. Its executable or a script argument points inside a known project folder. Paths in flags don't count:
    //    editor helpers (e.g. Antigravity's `agy.exe --add-dir=<project>`) mention projects without serving them.
    const lower = (cmd || '').toLowerCase().replace(/"--?[\w-]+=[^"]*"|(^|\s)--?[\w-]+=("[^"]*"|\S*)/g, ' ');
    for (const pr of projectsByLength) {
      if (lower.includes(pr.path.toLowerCase())) return { type: 'project', projectPath: pr.path };
    }
    return null;
  };

  const byKey = new Map();
  for (const c of data.c || []) {
    const pid = c.OwningProcess;
    if (!pid || pid <= 4) continue;
    const proc = procs.get(pid);
    const name = proc?.Name || 'unknown';
    const key = `${pid}:${c.LocalPort}`;
    const loopback = c.LocalAddress === '127.0.0.1' || c.LocalAddress === '::1';
    const existing = byKey.get(key);
    if (existing) {
      // IPv4 + IPv6 listeners for the same port: exposed if any of them is.
      if (!loopback) existing.exposed = true;
      continue;
    }
    const owner = ownerOf(pid, proc?.CommandLine);
    byKey.set(key, {
      port: c.LocalPort,
      pid,
      name,
      cmd: proc?.CommandLine || '',
      exposed: !loopback,
      owner,
      dev: !!owner || DEV_PROCESSES.has(name.toLowerCase()),
    });
  }

  const servers = [...byKey.values()].sort((a, b) => a.port - b.port);
  const children = sessionProcesses(procs, sessionByPid);
  return { ok: true, servers, procs: children };
}

function listPorts() {
  // Never run two PowerShell scans at once; callers share the in-flight one.
  if (!portScan) portScan = scanPorts().finally(() => { portScan = null; });
  return portScan;
}

// ------------------------------------------------- sessions and usage ----
// Claude Code keeps one transcript per session at ~/.claude/projects/<cwd with non-alphanumerics -> "-">/<uuid>.jsonl.
// Transcripts reach several MB, so lists only read the tail (title, context) and results are cached by mtime+size.

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const TAIL_BYTES = 64 * 1024;
const WIDE_TAIL_BYTES = 1024 * 1024;
const HEAD_BYTES = 16 * 1024;

const projectDir = (cwd) => path.join(PROJECTS_DIR, path.resolve(cwd).replace(/[^a-zA-Z0-9]/g, '-'));
const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 160);

async function readRange(file, start, length) {
  const fh = await fs.promises.open(file, 'r');
  try {
    const buf = Buffer.alloc(length);
    const { bytesRead } = await fh.read(buf, 0, length, start);
    return buf.toString('utf8', 0, bytesRead);
  } finally {
    await fh.close();
  }
}

async function readTail(file, size, bytes) {
  const start = Math.max(0, size - bytes);
  const text = await readRange(file, start, Math.min(size, bytes));
  return start > 0 ? text.slice(text.indexOf('\n') + 1) : text; // drop the partial first line
}

function parseTail(text) {
  const out = { title: null, prompt: null, usage: null, model: null };
  for (const line of text.split('\n')) {
    try {
      if (line.includes('"type":"ai-title"')) {
        const j = JSON.parse(line);
        if (j.type === 'ai-title' && j.aiTitle) out.title = j.aiTitle;
      } else if (line.includes('"type":"last-prompt"')) {
        const j = JSON.parse(line);
        if (j.type === 'last-prompt' && j.lastPrompt) out.prompt = j.lastPrompt;
      } else if (line.includes('"type":"assistant"') && line.includes('"usage"')) {
        const j = JSON.parse(line);
        const m = j.message;
        if (j.type === 'assistant' && m?.usage && m.model !== '<synthetic>') { out.usage = m.usage; out.model = m.model; }
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

const sessionCache = new Map(); // file -> { sig, info }

async function readSession(file, st) {
  const sig = `${st.mtimeMs}:${st.size}`;
  const hit = sessionCache.get(file);
  if (hit?.sig === sig) return hit.info;

  let read = Math.min(st.size, TAIL_BYTES);
  let t = parseTail(await readTail(file, st.size, TAIL_BYTES));
  if (!t.usage && st.size > TAIL_BYTES) { // a huge tool result can push the last reply out of the tail
    read = Math.min(st.size, WIDE_TAIL_BYTES);
    t = parseTail(await readTail(file, st.size, WIDE_TAIL_BYTES));
  }

  let info = null;
  // Sessions that never got a reply or a title (only /model and friends) are noise.
  if (t.title || t.usage || st.size > read) {
    const title = oneLine(t.title)
      || oneLine(firstPrompt(await readRange(file, 0, Math.min(st.size, HEAD_BYTES))))
      || oneLine(t.prompt)
      || 'Untitled session';
    const u = t.usage;
    info = {
      id: path.basename(file, '.jsonl'),
      title,
      mtime: Math.round(st.mtimeMs),
      birth: Math.round(st.birthtimeMs),
      model: t.model,
      ctx: u ? (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.output_tokens || 0) : 0,
    };
  }
  sessionCache.set(file, { sig, info });
  return info;
}

async function listSessions(cwd) {
  const dir = projectDir(cwd);
  let names;
  try {
    names = await fs.promises.readdir(dir);
  } catch {
    return [];
  }
  const rows = await Promise.all(names
    .filter((n) => n.endsWith('.jsonl') && UUID_RE.test(n.slice(0, -6)))
    .map(async (n) => {
      const file = path.join(dir, n);
      try { return await readSession(file, await fs.promises.stat(file)); } catch { return null; }
    }));
  return rows.filter(Boolean).sort((a, b) => b.mtime - a.mtime).slice(0, 200);
}

// Model, effort and subagents of one session, for the bar under the terminal. Effort is only in the transcript as
// /effort and /model output, so it falls back to the defaults in ~/.claude/settings.json. Subagents live in
// <session>/subagents/agent-*.jsonl with an agent-*.meta.json (type, description) next to each.
const SETTINGS_FILE = path.join(os.homedir(), '.claude', 'settings.json');
const AGENT_STALE_MS = 10 * 60 * 1000; // an unfinished agent silent this long was cut off (session closed)

async function readJson(file) {
  try {
    return JSON.parse((await fs.promises.readFile(file, 'utf8')).replace(/^﻿/, ''));
  } catch {
    return null;
  }
}

/** Effort for a model from settings: modelSettings by id ("Opus 5.5" -> claude-opus-5-5), else by family, else global. */
function defaultEffort(settings, model) {
  const per = settings?.modelSettings || {};
  const m = String(model || '').toLowerCase();
  const id = m.startsWith('claude-') ? m : `claude-${m.replace(/[\s.]+/g, '-')}`;
  if (per[id]?.effortLevel) return per[id].effortLevel;
  const fam = /opus|sonnet|haiku|fable/.exec(m)?.[0];
  const keys = fam ? Object.keys(per).filter((k) => k.includes(fam) && per[k]?.effortLevel) : [];
  return keys.length === 1 ? per[keys[0]].effortLevel : settings?.effortLevel || null;
}

/** Latest model (from replies or /model) and effort (from /effort or /model) in a transcript tail. */
function parseModelEffort(text) {
  const out = { model: null, effort: null };
  for (const line of text.split('\n')) {
    try {
      if (line.includes('"type":"assistant"') && line.includes('"model"')) {
        const m = JSON.parse(line).message?.model;
        if (m && m !== '<synthetic>') out.model = m;
      } else if (line.includes('local-command-stdout')) {
        const c = JSON.parse(line).message?.content;
        if (typeof c !== 'string') continue;
        const model = /Set model to `([^`]+)`/.exec(c)?.[1] || /Set model to ([^\s(<]+(?: [\d.]+)?)/.exec(c)?.[1];
        if (model) out.model = model;
        const effort = /Set effort level to (\w+)/.exec(c)?.[1] || /with `?(\w+)`? effort/.exec(c)?.[1];
        if (effort) out.effort = effort;
      }
    } catch { /* partial or foreign line */ }
  }
  return out;
}

const modelCache = new Map(); // file -> { sig, value }
async function readModelEffort(file) {
  const st = await fs.promises.stat(file);
  const sig = `${st.mtimeMs}:${st.size}`;
  const hit = modelCache.get(file);
  if (hit?.sig === sig) return hit.value;
  const value = parseModelEffort(await readTail(file, st.size, TAIL_BYTES));
  modelCache.set(file, { sig, value });
  return value;
}

const agentCache = new Map(); // file -> { sig, agent }
async function readAgent(dir, name) {
  const file = path.join(dir, name);
  const st = await fs.promises.stat(file);
  const sig = `${st.mtimeMs}:${st.size}`;
  const hit = agentCache.get(file);
  if (hit?.sig === sig) return hit.agent;
  const meta = (await readJson(file.replace(/\.jsonl$/, '.meta.json'))) || {};
  const tail = await readTail(file, st.size, TAIL_BYTES);
  const lines = tail.split('\n').filter(Boolean);
  // Finished = it handed its report back, or its last line is a reply with text and no further tool call.
  let done = tail.includes('"name":"SubagentHandback"');
  if (!done) try {
    const j = JSON.parse(lines[lines.length - 1]);
    const c = j.type === 'assistant' && j.message?.content;
    done = Array.isArray(c) && c.some((x) => x.type === 'text') && !c.some((x) => x.type === 'tool_use');
  } catch { /* last line longer than the tail, or still being written: working */ }
  const models = tail.match(/"model":"([^"]+)"/g);
  const agent = {
    id: name.slice(6, -6),
    type: oneLine(meta.agentType) || 'agent',
    model: models ? models[models.length - 1].slice(9, -1) : null,
    description: oneLine(meta.description),
    done,
    start: Math.round(st.birthtimeMs),
    mtime: Math.round(st.mtimeMs),
  };
  agentCache.set(file, { sig, agent });
  return agent;
}

async function sessionInfo(cwd, sessionId) {
  const settings = await readJson(SETTINGS_FILE);
  let model = null;
  let effort = null;
  let agents = [];
  if (typeof cwd === 'string' && typeof sessionId === 'string' && UUID_RE.test(sessionId)) {
    try {
      ({ model, effort } = await readModelEffort(path.join(projectDir(cwd), `${sessionId}.jsonl`)));
    } catch { /* no transcript yet */ }
    const dir = path.join(projectDir(cwd), sessionId, 'subagents');
    try {
      const names = (await fs.promises.readdir(dir)).filter((n) => /^agent-.+\.jsonl$/.test(n));
      agents = await Promise.all(names.map((n) => readAgent(dir, n).catch(() => null)));
    } catch { /* no subagents */ }
  }
  model = model || settings?.model || null;
  effort = effort || defaultEffort(settings, model);
  const now = Date.now();
  agents = agents.filter(Boolean)
    .map((a) => ({ ...a, running: !a.done && now - a.mtime < AGENT_STALE_MS }))
    .sort((a, b) => b.start - a.start);
  return { model, effort, agents };
}

// Right sidebar data. MCP health comes from `claude mcp list` (the transcript does not store it): it health-checks every
// configured server, so it is slow (seconds), cached per folder and never run twice at once.
const MCP_TTL_MS = 30 * 1000;
const mcpCache = new Map(); // cwd -> { at, value } | { pending }

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

function mcpList(cwd) {
  if (typeof cwd !== 'string' || !fs.existsSync(cwd)) return Promise.resolve({ ok: false, servers: [] });
  const hit = mcpCache.get(cwd);
  if (hit?.pending) return hit.pending;
  if (hit && Date.now() - hit.at < MCP_TTL_MS) return Promise.resolve(hit.value);
  const env = { ...process.env };
  for (const k of STRIP_ENV) delete env[k];
  const pending = new Promise((resolve) => {
    execFile('cmd.exe', ['/d', '/c', 'claude', 'mcp', 'list'],
      { cwd, env, windowsHide: true, timeout: 60000, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => resolve(err && !stdout ? { ok: false, servers: [] } : { ok: true, servers: parseMcpList(stdout) }));
  }).then((value) => {
    mcpCache.set(cwd, { at: Date.now(), value });
    return value;
  });
  mcpCache.set(cwd, { ...hit, pending });
  return pending;
}

/** Subagents the user has defined: ~/.claude/agents/*.md and <project>/.claude/agents/*.md (frontmatter name + model). */
async function definedAgents(cwd) {
  const dirs = [path.join(os.homedir(), '.claude', 'agents')];
  if (typeof cwd === 'string') dirs.push(path.join(cwd, '.claude', 'agents'));
  const out = new Map();
  for (const dir of dirs) {
    let names = [];
    try { names = (await fs.promises.readdir(dir)).filter((n) => n.endsWith('.md')); } catch { continue; }
    for (const n of names) {
      try {
        const head = (await fs.promises.readFile(path.join(dir, n), 'utf8')).replace(/^﻿/, '').split(/\r?\n---/)[0];
        const field = (k) => new RegExp(`^${k}:\s*(.+)$`, 'm').exec(head)?.[1].trim().replace(/^["']|["']$/g, '');
        const name = oneLine(field('name') || n.slice(0, -3));
        out.set(name, { name, model: oneLine(field('model')) || 'inherit' }); // project agents override user ones
      } catch { /* unreadable file */ }
    }
  }
  return [...out.values()];
}

// Plan limits (session, weekly, per-model weekly) come from the same endpoint Claude Code's /usage reads, using the
// OAuth token Claude Code keeps in ~/.claude/.credentials.json. The token only goes to api.anthropic.com.
// Claude Code refreshes the token while it runs; we never write the credentials file.
const CREDENTIALS_FILE = path.join(os.homedir(), '.claude', '.credentials.json');
let limitsCache = { at: 0, value: null };
let limitsFetch = null;

async function fetchLimits() {
  let oauth;
  try {
    oauth = JSON.parse((await fs.promises.readFile(CREDENTIALS_FILE, 'utf8')).replace(/^﻿/, '')).claudeAiOauth;
  } catch { /* handled below */ }
  if (!oauth?.accessToken) return { ok: false, error: 'Not signed in. Run claude and log in.' };
  if (oauth.expiresAt && oauth.expiresAt < Date.now()) return { ok: false, error: 'Login expired. Open a Claude tab to refresh it.' };
  try {
    const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: { Authorization: `Bearer ${oauth.accessToken}`, 'anthropic-beta': 'oauth-2025-04-20' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, error: `Usage request failed (${res.status})` };
    const j = await res.json();
    const limits = (j.limits || []).map((l) => ({
      kind: l.kind,
      label: l.kind === 'session' ? 'Session' : l.kind === 'weekly_all' ? 'Weekly' : l.scope?.model?.display_name || 'Weekly (model)',
      percent: Math.round(l.percent),
      resetsAt: Date.parse(l.resets_at) || null,
    }));
    return { ok: true, limits, fetchedAt: Date.now() };
  } catch {
    return { ok: false, error: 'Could not reach Anthropic (offline?)' };
  }
}

function getLimits() { // cached for a minute; overlapping calls share one request
  if (limitsCache.value?.ok && Date.now() - limitsCache.at < 60000) return Promise.resolve(limitsCache.value);
  if (!limitsFetch) {
    limitsFetch = fetchLimits().then((v) => { limitsCache = { at: Date.now(), value: v }; return v; }).finally(() => { limitsFetch = null; });
  }
  return limitsFetch;
}

// --------------------------------------------------------------- window ----

let mainWindow = null;
let forceClose = false;

function createWindow() {
  const b = state.bounds;
  mainWindow = new BrowserWindow({
    width: b?.width ?? 1440,
    height: b?.height ?? 900,
    x: b?.x,
    y: b?.y,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: '#0a0a0a', // = --background (DESIGN.md sync point)
    title: 'Claude Bench',
    icon: ICON,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0a0a0a', symbolColor: '#a1a1a1', height: 40 }, // sits on the top bar (--background)
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (state.maximized) mainWindow.maximize();

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // External links open in the real browser, never inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());

  mainWindow.webContents.on('before-input-event', (e, input) => {
    const devtools = input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i');
    if (devtools && input.type === 'keyDown') mainWindow.webContents.toggleDevTools();
  });

  const rememberBounds = () => {
    if (mainWindow.isDestroyed() || mainWindow.isMinimized()) return;
    state.maximized = mainWindow.isMaximized();
    if (!state.maximized) state.bounds = mainWindow.getBounds();
  };

  mainWindow.on('close', (e) => {
    rememberBounds();
    saveState();
    if (forceClose || sessions.size === 0) return;
    const wc = mainWindow.webContents;
    if (wc.isCrashed() || wc.isLoading()) return; // nobody to ask
    // The renderer knows what is actually busy; it replies with `app:quit` if it is fine to go.
    e.preventDefault();
    send('app:close-request');
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// A folder passed on the command line: `claude-bench.exe C:\some\project`.
// In dev the app's own folder ("electron .") is also an argument, so skip that one.
function pathFromArgv(argv) {
  const self = path.resolve(app.getAppPath()).toLowerCase();
  const candidates = argv.slice(1).filter(
    (a) => !a.startsWith('-') && isDir(a) && path.resolve(a).toLowerCase() !== self
  );
  return candidates[candidates.length - 1];
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    const p = pathFromArgv(argv);
    if (p) send('open-path', addProject(p));
  });

  app.whenReady().then(() => {
    loadState();
    registerIpc();
    createWindow();
    const p = pathFromArgv(process.argv);
    if (p) {
      const abs = addProject(p);
      mainWindow.webContents.once('did-finish-load', () => send('open-path', abs));
    }
  });
}

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  for (const s of sessions.values()) {
    try { s.pty.kill(); } catch { /* already gone */ }
  }
});

// ------------------------------------------------------------------ ipc ----

function registerIpc() {
  ipcMain.handle('state:get', () => ({ projects: state.projects, ui: state.ui }));

  ipcMain.handle('projects:add', async () => {
    const r = await dialog.showOpenDialog(mainWindow, {
      title: 'Add a project folder',
      properties: ['openDirectory', 'multiSelect'],
    });
    const added = r.canceled ? [] : r.filePaths.map(addProject).filter(Boolean);
    return { projects: state.projects, added };
  });

  ipcMain.handle('projects:remove', (_e, p) => {
    state.projects = state.projects.filter((x) => !samePath(x.path, p));
    saveState();
    return state.projects;
  });

  ipcMain.handle('ui:set', (_e, patch) => {
    for (const k of Object.keys(defaults.ui)) {
      if (k !== 'expanded' && k !== 'collapsed' && typeof patch?.[k] === typeof defaults.ui[k]) state.ui[k] = patch[k];
    }
    if (Array.isArray(patch?.collapsed)) {
      state.ui.collapsed = patch.collapsed.filter((k) => typeof k === 'string').slice(0, 20);
    }
    if (Array.isArray(patch?.expanded)) {
      state.ui.expanded = patch.expanded.filter((p) => typeof p === 'string').slice(0, 200);
    }
    state.ui.fontSize = Math.min(24, Math.max(10, Math.round(state.ui.fontSize) || 14));
    saveState();
  });

  ipcMain.handle('pty:create', (_e, opts) => createSession(opts));
  ipcMain.on('pty:write', (_e, id, data) => sessions.get(id)?.pty.write(data));
  ipcMain.on('pty:resize', (_e, id, cols, rows) => {
    try { sessions.get(id)?.pty.resize(Math.max(cols, 2), Math.max(rows, 2)); } catch { /* exited */ }
  });
  ipcMain.on('pty:kill', (_e, id) => {
    try { sessions.get(id)?.pty.kill(); } catch { /* exited */ }
  });

  ipcMain.handle('git:status', async (_e, paths) => {
    const entries = await Promise.all((paths || []).map(async (p) => [p, await gitStatus(p)]));
    return Object.fromEntries(entries);
  });

  ipcMain.handle('sessions:list', async (_e, paths) => {
    const entries = await Promise.all((paths || []).map(async (p) => [p, await listSessions(p)]));
    return Object.fromEntries(entries);
  });
  ipcMain.handle('session:info', (_e, cwd, sessionId) => sessionInfo(cwd, sessionId));
  ipcMain.handle('mcp:list', (_e, cwd) => mcpList(cwd));
  ipcMain.handle('agents:defined', (_e, cwd) => definedAgents(cwd));
  ipcMain.handle('usage:get', () => getLimits());

  ipcMain.handle('ports:list', () => listPorts());

  ipcMain.handle('shell:openExternal', (_e, url) => {
    if (/^https?:\/\//i.test(url)) return shell.openExternal(url);
  });
  ipcMain.handle('shell:showInFolder', (_e, p) => {
    if (isDir(p)) return shell.openPath(p);
  });

  ipcMain.handle('shell:openInCode', (_e, p) => {
    if (!isDir(p)) return { ok: false, error: 'Folder not found' };
    return new Promise((resolve) => {
      // `code` is a .cmd shim on PATH; fall back to the per-user install when PATH lacks it.
      const exe = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'Code.exe');
      const [file, args] = fs.existsSync(exe) ? [exe, [p]] : ['cmd.exe', ['/d', '/c', 'code', p]];
      const child = spawn(file, args, { detached: true, stdio: 'ignore', windowsHide: true });
      child.on('error', () => resolve({ ok: false, error: 'Could not start VS Code' }));
      child.on('spawn', () => { child.unref(); resolve({ ok: true }); });
    });
  });

  ipcMain.handle('clipboard:read', () => clipboard.readText());
  ipcMain.on('clipboard:write', (_e, text) => clipboard.writeText(String(text)));

  ipcMain.on('app:quit', () => {
    forceClose = true;
    mainWindow?.close();
  });

  ipcMain.on('win:flash', () => {
    if (!mainWindow || mainWindow.isFocused()) return;
    mainWindow.flashFrame(true);
    mainWindow.once('focus', () => mainWindow.flashFrame(false));
  });
}

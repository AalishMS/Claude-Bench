'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const pty = require('@lydell/node-pty');

const ICON = path.join(__dirname, '..', 'assets', 'icon.png');

app.setAppUserModelId('com.local.claudebench');

// ---------------------------------------------------------------- state ----

const defaults = {
  projects: [], // [{ path, name }]
  ui: { sidebar: true, servers: false, fontSize: 14, expanded: [] }, // expanded: project paths showing sessions
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
$p = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, CommandLine
@{ c = @($c); p = @($p) } | ConvertTo-Json -Compress -Depth 4
`;

let knownPortPids = new Set();
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
      cur = procs.get(cur)?.ParentProcessId;
    }
    // 2. Its command line points inside a known project folder.
    const lower = (cmd || '').toLowerCase();
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
  knownPortPids = new Set(servers.map((s) => s.pid));
  return { ok: true, servers };
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
const DAY_MS = 86400000;

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
      ctx: u ? (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0) : 0,
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

const pad2 = (n) => String(n).padStart(2, '0');
const localDay = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const usageCache = new Map(); // file -> { sig, days: { day: { model: [in, out, cacheWrite, cacheRead] } } }

async function fileUsage(file, st) {
  const sig = `${st.mtimeMs}:${st.size}`;
  const hit = usageCache.get(file);
  if (hit?.sig === sig) return hit.days;

  // The same assistant message is written on several lines (one per content block) with identical usage.
  const byId = new Map();
  for (const line of (await fs.promises.readFile(file, 'utf8')).split('\n')) {
    if (!line.includes('"usage"') || !line.includes('"type":"assistant"')) continue;
    try {
      const j = JSON.parse(line);
      const m = j.message;
      if (j.type !== 'assistant' || !m?.usage || !m.model || m.model === '<synthetic>') continue;
      const ms = Date.parse(j.timestamp);
      if (ms) byId.set(m.id || j.uuid, { ms, model: m.model, u: m.usage });
    } catch { /* truncated line */ }
  }

  const days = {};
  for (const { ms, model, u } of byId.values()) {
    const row = ((days[localDay(ms)] ||= {})[model] ||= [0, 0, 0, 0]);
    row[0] += u.input_tokens || 0;
    row[1] += u.output_tokens || 0;
    row[2] += u.cache_creation_input_tokens || 0;
    row[3] += u.cache_read_input_tokens || 0;
  }
  usageCache.set(file, { sig, days });
  return days;
}

async function scanUsage() {
  const now = Date.now();
  const week = new Set(Array.from({ length: 7 }, (_, i) => localDay(now - i * DAY_MS)));
  const today = localDay(now);
  const out = { ok: true, today: {}, week: {} };
  const seen = new Set();
  try {
    for (const d of await fs.promises.readdir(PROJECTS_DIR)) {
      let names;
      try { names = await fs.promises.readdir(path.join(PROJECTS_DIR, d)); } catch { continue; }
      for (const n of names) {
        if (!n.endsWith('.jsonl')) continue;
        const file = path.join(PROJECTS_DIR, d, n);
        try {
          const st = await fs.promises.stat(file);
          if (now - st.mtimeMs > 8 * DAY_MS) continue;
          seen.add(file);
          const days = await fileUsage(file, st);
          for (const [day, models] of Object.entries(days)) {
            if (!week.has(day)) continue;
            for (const [model, v] of Object.entries(models)) {
              for (const bucket of day === today ? [out.today, out.week] : [out.week]) {
                const row = (bucket[model] ||= [0, 0, 0, 0]);
                for (let i = 0; i < 4; i++) row[i] += v[i];
              }
            }
          }
        } catch { /* file vanished mid-scan */ }
      }
    }
  } catch {
    return { ok: false, error: 'Could not read Claude transcripts' };
  }
  for (const f of usageCache.keys()) if (!seen.has(f)) usageCache.delete(f);
  return out;
}

let usageScan = null;
function getUsage() {
  if (!usageScan) usageScan = scanUsage().finally(() => { usageScan = null; });
  return usageScan;
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
    backgroundColor: '#101010',
    title: 'Claude Bench',
    icon: ICON,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#101010', symbolColor: '#c4c4c4', height: 40 },
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
      if (k !== 'expanded' && typeof patch?.[k] === typeof defaults.ui[k]) state.ui[k] = patch[k];
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
  ipcMain.handle('usage:get', () => getUsage());

  ipcMain.handle('ports:list', () => listPorts());
  ipcMain.handle('ports:kill', async (_e, pid) => {
    // Only processes we just showed the user as listening can be killed.
    if (!knownPortPids.has(pid)) return { ok: false, error: 'Process is no longer listening' };
    const out = await run('taskkill', ['/PID', String(pid), '/T', '/F']);
    return out == null ? { ok: false, error: 'taskkill failed (access denied?)' } : { ok: true };
  });

  ipcMain.handle('shell:openExternal', (_e, url) => {
    if (/^https?:\/\//i.test(url)) return shell.openExternal(url);
  });
  ipcMain.handle('shell:showInFolder', (_e, p) => {
    if (isDir(p)) return shell.openPath(p);
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

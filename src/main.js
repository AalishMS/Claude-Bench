'use strict';

const { app, BrowserWindow, Menu, Notification, ipcMain, dialog, shell, clipboard, screen, nativeImage, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile, spawn } = require('child_process');
const pty = require('@lydell/node-pty');
const {
  parseGitStatus, parentPid, parseNetstat, parseLsof, parsePs, macDevName, withoutFlagValues,
  oneLine, usageTokens, parseTail, firstPrompt, transcriptCwd, defaultEffort, withLongContext, parseModelEffort, agentDone, lastModel,
  parseAgentFile, parseMcpList, remapSplits,
} = require('./lib/parse');
const { scanImages } = require('./lib/images');

// Windows is the main platform. macOS gets small `IS_MAC` branches next to the Windows code (best effort, untested here).
const IS_MAC = process.platform === 'darwin';
const ICON = path.join(__dirname, '..', 'assets', IS_MAC ? 'icon-mac.png' : 'icon.ico');
const ICON_PNG = path.join(__dirname, '..', 'assets', 'icon.png');

const AUMID = 'com.local.stanza'; // = build.appId
if (!IS_MAC) app.setAppUserModelId(AUMID);

/**
 * Windows shows toasts of an unregistered AppUserModelID under the host exe's name ("Electron" for npm start).
 * Registering a display name and icon for it (per user, no installer needed) gives "Stanza" for both the packaged
 * exe and source runs. The icon is copied out of the asar, which Windows can't read. Best effort.
 */
function registerToastIdentity() {
  try {
    const icon = path.join(app.getPath('userData'), 'toast-icon.png');
    fs.copyFileSync(ICON_PNG, icon); // Refresh existing profiles when the app logo changes.
    const key = `HKCU\\Software\\Classes\\AppUserModelId\\${AUMID}`;
    for (const [name, value] of [['DisplayName', 'Stanza'], ['IconUri', icon]]) {
      execFile('reg.exe', ['add', key, '/v', name, '/t', 'REG_SZ', '/d', value, '/f'], { windowsHide: true }, () => {});
    }
    // The ID of the app's old name ("Claude Bench"); fails quietly once it is gone.
    execFile('reg.exe', ['delete', 'HKCU\\Software\\Classes\\AppUserModelId\\com.local.claudebench', '/f'], { windowsHide: true }, () => {});
  } catch { /* toasts still work, just under the exe's name */ }
}

// An app started from Finder gets PATH=/usr/bin:/bin:/usr/sbin:/sbin, which misses claude, node (nvm, Homebrew) and code.
// Ask the user's login shell for its PATH once; sessions and `claude mcp list` wait for it.
// An rc file can block (an "update? [Y/n]" prompt, `exec tmux`) and interactive shells ignore SIGTERM, so stdin is closed,
// the shell gets its own process group, and after 5 s the whole group is SIGKILLed and we go on with the fallback folders.
const shellEnvReady = !IS_MAC ? Promise.resolve() : new Promise((resolve) => {
  let out = '';
  let done = false;
  let child = null;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
    const found = /__CB_PATH__=(.+)/.exec(out)?.[1]?.trim();
    if (found && found.includes(':')) process.env.PATH = found; // a single entry means the shell printed something else
    // Also add the usual folders when the shell's PATH lacks them (or the shell never answered).
    const have = new Set((process.env.PATH || '').split(':'));
    const extra = ['/opt/homebrew/bin', '/usr/local/bin', path.join(os.homedir(), '.local', 'bin'), path.join(os.homedir(), '.claude', 'local')];
    process.env.PATH = [...have, ...extra.filter((d) => !have.has(d))].filter(Boolean).join(':');
    resolve();
  };
  const timer = setTimeout(finish, 5000);
  try {
    child = spawn(process.env.SHELL || '/bin/zsh', ['-ilc', 'echo "__CB_PATH__=$PATH"'], { stdio: ['ignore', 'pipe', 'ignore'], detached: true });
    child.stdout.on('data', (d) => { out += d; if (/__CB_PATH__=.*\n/.test(out)) finish(); });
    child.on('error', finish);
    child.on('close', finish);
  } catch {
    finish();
  }
});
if (IS_MAC && !process.env.LANG) process.env.LANG = 'en_US.UTF-8'; // Finder launches have no locale; claude and zsh want UTF-8

// ---------------------------------------------------------------- state ----

const defaults = {
  projects: [], // [{ path, name }]
  ui: { sidebar: true, servers: true, rsideMigrated: true, sidebarW: 232, rsideW: 300, fontSize: 14, theme: 'dark', accent: 'blue', expanded: [], collapsed: [], keys: {} }, // theme: dark | light | system; accent: ACCENTS; expanded: project paths showing sessions; collapsed: right-sidebar sections folded shut; keys: shortcut overrides (action id -> combos)
  bounds: null,
  maximized: false,
  tabs: [], // open tabs in tab order, reopened at launch: [{ project: path, kind: 'claude' | 'shell', sessionId }]
  activeTab: -1, // index into tabs
  splits: [], // split groups of the open tabs: [{ tabs: [index into tabs, 2-4], cx, ry, v }]
  chatDir: null, // folder of "No project" chats chosen in settings; null = ~/Claude Chats
};
let state = structuredClone(defaults);
const stateFile = () => path.join(app.getPath('userData'), 'state.json');
// The app was called "Claude Bench" and before that "Claude Terminal" (userData = %APPDATA%\claude-bench, \claude-terminal);
// the newest of those is read once if nothing is saved yet. undefined when there is none. Looked up next to userData, not
// in appData, so a test instance with its own --user-data-dir never loads (and restores the tabs of) the real install.
const legacyStateFile = () => ['claude-bench', 'claude-terminal']
  .map((name) => path.join(path.dirname(app.getPath('userData')), name, 'state.json')).find((f) => fs.existsSync(f));
let firstRun = false; // no state file at all: the sidebar is seeded with recent Claude Code projects (recentProjects)

function loadState() {
  try {
    const file = fs.existsSync(stateFile()) ? stateFile() : legacyStateFile();
    const saved = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    state = { ...defaults, ...saved, ui: { ...defaults.ui, ...saved.ui } };
    // The right sidebar used to default to closed, so a saved `false` is usually just that old default: reopen it once.
    if (!saved.ui?.rsideMigrated) { state.ui.servers = true; state.ui.rsideMigrated = true; }
    // Chats used to live in the home folder (Claude Code never keeps trust there): move the entry to its own folder.
    for (const p of state.projects) {
      if (!p.chat || !samePath(p.path, os.homedir())) continue;
      try { fs.mkdirSync(chatDir(), { recursive: true }); p.path = chatDir(); } catch { continue; /* stays at home */ }
      if (Array.isArray(state.ui.expanded)) state.ui.expanded.push(p.path); // shown open, like before
    }
  } catch {
    /* first run or unreadable file: keep defaults */
    firstRun = !fs.existsSync(stateFile()) && !legacyStateFile();
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

/**
 * The saved tabs that can be reopened: the project is still listed and on disk, and a Claude tab's transcript still exists
 * (it is resumed with --resume). Shell tabs start fresh. One bad entry only drops that entry.
 */
function restorableTabs() {
  const list = [];
  const at = new Map(); // saved index -> index in list
  let active = -1;
  (Array.isArray(state.tabs) ? state.tabs : []).forEach((t, i) => {
    try {
      const proj = state.projects.find((p) => samePath(p.path, t.project));
      if (!proj || !isDir(proj.path)) return;
      if (t.kind === 'claude') {
        if (!UUID_RE.test(t.sessionId) || !fs.existsSync(path.join(projectDir(proj.path), `${t.sessionId}.jsonl`))) return;
        list.push({ project: proj.path, kind: 'claude', sessionId: t.sessionId });
      } else if (t.kind === 'shell') {
        list.push({ project: proj.path, kind: 'shell', sessionId: null });
      } else return;
      at.set(i, list.length - 1);
      if (i === state.activeTab) active = list.length - 1;
    } catch { /* skip this one */ }
  });
  return { tabs: list, active, splits: remapSplits(state.splits, at) };
}

function saveTabs(payload) {
  const list = Array.isArray(payload?.tabs) ? payload.tabs : [];
  state.tabs = list.slice(0, 50)
    .filter((t) => typeof t?.project === 'string' && (t.kind === 'shell' || (t.kind === 'claude' && UUID_RE.test(t.sessionId))))
    .map((t) => ({ project: t.project, kind: t.kind, sessionId: t.kind === 'claude' ? t.sessionId : null }));
  state.activeTab = Number.isInteger(payload?.active) ? payload.active : -1;
  const ratio = (v) => (typeof v === 'number' && v > 0.05 && v < 0.95 ? v : 0.5);
  const used = new Set();
  state.splits = (Array.isArray(payload?.splits) ? payload.splits : []).slice(0, 12).map((g) => {
    const members = (Array.isArray(g?.tabs) ? g.tabs : [])
      .filter((i) => Number.isInteger(i) && i >= 0 && i < state.tabs.length && !used.has(i)).slice(0, 4);
    members.forEach((i) => used.add(i)); // a tab is in at most one group
    return { tabs: members, cx: ratio(g.cx), ry: ratio(g.ry), v: g.v === true };
  }).filter((g) => g.tabs.length >= 2);
  saveState();
}

const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};
const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

/**
 * "No project" chats run in their own folder, not in home: Claude Code never saves trust for the home folder, so every
 * chat there asked again. Claude tabs started in it get `--add-dir <home>` (createSession) for Desktop/Downloads chores.
 */
const defaultChatDir = () => path.join(os.homedir(), 'Claude Chats');
const chatDir = () => (typeof state.chatDir === 'string' && state.chatDir) || defaultChatDir();
/** For the settings page: where chats run, and whether that is the default or the home folder (trust asked every time). */
const chatInfo = () => ({ dir: chatDir(), isDefault: !state.chatDir, isHome: samePath(chatDir(), os.homedir()) });

/** Settings: run chats in `dir` (null = the default folder). Moves the Chats entry if there is one; old chats stay on disk. */
function setChatDir(dir) {
  const target = dir || defaultChatDir();
  if (state.projects.some((x) => !x.chat && samePath(x.path, target))) {
    return { error: 'That folder is already a project in the sidebar.' };
  }
  const cur = state.projects.find((x) => x.chat);
  if (cur && [...sessions.values()].some((s) => samePath(s.cwd, cur.path))) {
    return { error: 'Close the open chats to change the folder.' }; // their tabs belong to the current folder
  }
  if (!dir) {
    try { fs.mkdirSync(target, { recursive: true }); } catch (err) { return { error: `Could not create ${target}: ${err.message}` }; }
  } else if (!isDir(target)) {
    return { error: `Folder not found: ${target}` };
  }
  state.chatDir = dir && !samePath(dir, defaultChatDir()) ? path.resolve(dir) : null;
  const entry = state.projects.find((x) => x.chat);
  if (entry) entry.path = chatDir();
  saveState();
  return { projects: state.projects, chat: chatInfo() };
}

/**
 * The project entry for chats, flagged `chat`, always first. Created on first use (and its folder with it).
 * If that folder is already a real project it stays one, and chats just open there. Returns the projects and the path to open.
 */
function chatProject() {
  const dir = chatDir();
  try { fs.mkdirSync(dir, { recursive: true }); } catch (err) {
    return { error: `The chat folder isn't available: ${dir}\n${err.message}` }; // e.g. a drive that is gone; settings can change it
  }
  if (!state.projects.some((x) => samePath(x.path, dir))) {
    state.projects = state.projects.filter((x) => !x.chat); // one Chats entry (an older one may sit at home)
    state.projects.unshift({ path: dir, name: 'Chats', chat: true });
    saveState();
  }
  return { projects: state.projects, path: state.projects.find((x) => samePath(x.path, dir)).path };
}

/** Is `cwd` the chat folder of the Chats entry? */
const isChatDir = (cwd) => state.projects.some((x) => x.chat && samePath(x.path, cwd));

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

// Windows: node-pty's kill() closes the console and also TerminateProcess-es every process attached to it. In
// its first seconds Claude is too busy to beat that, so its fullscreen boot canary stays in ~/.claude.json and the
// next launch falls back to the classic renderer (two strikes turn fullscreen off for that version). For Claude
// tabs, close only the console (Claude exits on the close event) and end what is left after 5 s.
function endSession(s) {
  const agent = s.pty._agent;
  if (IS_MAC || s.kind !== 'claude' || typeof agent?._getConsoleProcessList !== 'function') {
    try { s.pty.kill(); } catch { /* already gone */ }
    return;
  }
  const list = agent._getConsoleProcessList.call(agent).catch(() => []);
  agent._getConsoleProcessList = () => Promise.resolve([]);
  try { s.pty.kill(); } catch { /* already gone */ }
  setTimeout(() => list.then((pids) => {
    for (const pid of pids) {
      try { process.kill(pid); } catch { /* exited */ }
    }
  }), 5000).unref();
}

function createSession({ id, cwd, kind, args, resumeId, fork, cols, rows }) {
  if (sessions.has(id)) return { ok: false, error: 'Session already exists' };
  if (!isDir(cwd)) return { ok: false, error: `Folder not found: ${cwd}` };
  // Only a bare UUID may reach the command line as a session id.
  if (resumeId != null && !(typeof resumeId === 'string' && UUID_RE.test(resumeId))) {
    return { ok: false, error: 'Invalid session id' };
  }

  const env = { ...process.env, COLORTERM: 'truecolor', TERM_PROGRAM: 'Stanza' };
  for (const k of STRIP_ENV) delete env[k];
  delete env.NO_COLOR; // an inherited NO_COLOR makes claude and shells print everything uncolored
  if (env.FORCE_COLOR === '0') delete env.FORCE_COLOR;

  let file;
  let argv;
  if (kind === 'claude') {
    const extra = resumeId ? ['--resume', resumeId, ...(fork === true ? ['--fork-session'] : [])]
      : (args || []).filter((a) => ALLOWED_CLAUDE_ARGS.has(a));
    if (isChatDir(cwd)) extra.push('--add-dir', os.homedir()); // chats may tidy the Desktop, Downloads...
    if (IS_MAC) {
      // Found on the login shell's PATH (shellEnvReady); the tab ends when claude exits, like cmd /c.
      file = 'claude';
      argv = extra;
    } else {
      // cmd resolves both claude.cmd (npm) and claude.exe (native installer).
      file = 'cmd.exe';
      argv = ['/d', '/c', 'claude', ...extra];
    }
  } else if (IS_MAC) {
    file = process.env.SHELL || '/bin/zsh';
    argv = ['-l'];
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
  return out == null ? null : parseGitStatus(out);
}

// ---------------------------------------------------------------- ports ----

const DEV_PROCESSES = new Set([
  'node.exe', 'bun.exe', 'deno.exe', 'python.exe', 'pythonw.exe', 'py.exe', 'ruby.exe',
  'java.exe', 'javaw.exe', 'php.exe', 'php-cgi.exe', 'dotnet.exe', 'go.exe', 'cargo.exe',
  'uvicorn.exe', 'gunicorn.exe', 'hugo.exe', 'caddy.exe',
]);

/** The process table (WMI), plus the listeners only when netstat failed (Get-NetTCPConnection is slow too). */
const portScript = (withConns) => `
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
${withConns ? '$c = Get-NetTCPConnection -State Listen | Select-Object LocalAddress, LocalPort, OwningProcess' : '$c = @()'}
$p = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, CommandLine, @{ n = 'T'; e = { ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() } }
@{ c = @($c); p = @($p) } | ConvertTo-Json -Compress -Depth 4
`;

let portScan = null;

// The process table from the last PowerShell scan, reused while no new listener appears. A cold powershell.exe + WMI
// costs about a second of CPU; netstat costs ~30 ms. `keys` holds the "pid:port" listeners seen without a gap since that
// scan: one that stops and comes back counts as new, so a recycled pid gets a fresh scan instead of the old process's
// name and owner (only a pid exiting and being reused on the same port between two netstat runs slips through).
const PROC_TTL = 60000;
let procScan = null; // { at, p, keys: Set }

async function psScan(withConns) {
  const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', portScript(withConns)], { timeout: 20000 });
  if (!out) return null;
  try { return JSON.parse(out); } catch { return null; }
}

/** Listeners and processes as { c: [{ LocalAddress, LocalPort, OwningProcess }], p: [{ ProcessId, ParentProcessId, Name, CommandLine, T }] }. */
async function winScan() {
  const out = await run('netstat.exe', ['-ano']);
  const c = out ? parseNetstat(out) : [];
  if (!c.length) { // netstat failed or changed its format: the old full scan
    procScan = null;
    const data = await psScan(true);
    return data ? { ok: true, data } : { ok: false, error: 'Could not read listening ports' };
  }
  const keys = new Set(c.map((x) => `${x.OwningProcess}:${x.LocalPort}`));
  const fresh = procScan && Date.now() - procScan.at < PROC_TTL && [...keys].every((k) => procScan.keys.has(k));
  if (fresh) {
    procScan.keys = keys; // drop listeners that went away
  } else {
    const data = await psScan(false);
    if (!data) { procScan = null; return { ok: false, error: 'Could not read processes' }; }
    procScan = { at: Date.now(), p: data.p || [], keys };
  }
  return { ok: true, data: { c, p: procScan.p } };
}

function macScan() {
  const exec = (file, args) => new Promise((resolve) => {
    execFile(file, args, { timeout: 20000, maxBuffer: 32 * 1024 * 1024 }, (err, stdout) => resolve({ err, stdout: stdout || '' }));
  });
  return Promise.all([
    exec('/usr/sbin/lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-F', 'pcn', '+c', '0']),
    exec('/bin/ps', ['-axww', '-o', 'pid=,ppid=,etime=,args=']),
  ]).then(([l, p]) => {
    // lsof exits with 1 when nothing is listening; that is an empty list, not a failure.
    if ((l.err && l.err.code !== 1) || p.err) return { ok: false, error: 'Could not read listening ports' };
    const { conns, names } = parseLsof(l.stdout);
    return { ok: true, data: { c: conns, p: parsePs(p.stdout, names, Date.now()) } };
  });
}

async function scanPorts() {
  const scan = await (IS_MAC ? macScan() : winScan());
  if (!scan.ok) return scan;
  const data = scan.data;

  const procs = new Map();
  for (const p of data.p || []) procs.set(p.ProcessId, p);

  const sessionByPid = new Map();
  // ConPTY reports pid 0 until it has connected, so read it now rather than at spawn time.
  for (const [id, s] of sessions) {
    if (s.pty.pid) sessionByPid.set(s.pty.pid, { id, cwd: s.cwd, kind: s.kind });
  }

  // Not the Chats entry: it may be set to the home folder, which nearly every command line would match.
  const projectsByLength = state.projects.filter((p) => !p.chat).sort((a, b) => b.path.length - a.path.length);

  const ownerOf = (pid, cmd) => {
    // 1. Started from one of our terminals (walk up the parent chain).
    let cur = pid;
    for (let i = 0; i < 40 && cur; i++) {
      const s = sessionByPid.get(cur);
      if (s) return { type: 'session', sessionId: s.id, projectPath: s.cwd, kind: s.kind };
      const p = procs.get(cur);
      cur = p && parentPid(procs, p);
    }
    // 2. Its executable or a script argument points inside a known project folder (not just a --flag= value).
    const lower = withoutFlagValues(cmd);
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
      dev: !!owner || DEV_PROCESSES.has(IS_MAC ? macDevName(name) : name.toLowerCase()),
    });
  }

  const servers = [...byKey.values()].sort((a, b) => a.port - b.port);
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

const projectDir = (cwd) => path.join(PROJECTS_DIR, path.resolve(cwd).replace(/[^a-zA-Z0-9]/g, '-'));

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
      last: t.last || Math.round(st.mtimeMs), // last message time: the sidebar's sort and "ago" (mtime is bumped by resume/exit)
      birth: Math.round(st.birthtimeMs),
      model: t.model,
      ctx: usageTokens(u),
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
  return rows.filter(Boolean).sort((a, b) => b.last - a.last).slice(0, 200);
}

/**
 * First run: the folders of the most recently used Claude Code projects, newest first. Folder names in ~/.claude/projects
 * are lossy, so the path comes from the newest transcript's `cwd`. Home and the chat folder are chats, not projects; temp
 * folders are scratch.
 */
async function recentProjects(n = 3) {
  let dirs;
  try {
    dirs = (await fs.promises.readdir(PROJECTS_DIR, { withFileTypes: true })).filter((d) => d.isDirectory());
  } catch {
    return [];
  }
  const dated = await Promise.all(dirs.map(async (d) => {
    const dir = path.join(PROJECTS_DIR, d.name);
    try { return { dir, at: (await fs.promises.stat(dir)).mtimeMs }; } catch { return null; } // a new session bumps it
  }));
  const skip = [os.homedir(), chatDir(), defaultChatDir()];
  const out = [];
  for (const { dir } of dated.filter(Boolean).sort((a, b) => b.at - a.at).slice(0, 30)) {
    if (out.length >= n) break;
    try {
      const files = await Promise.all((await fs.promises.readdir(dir))
        .filter((f) => f.endsWith('.jsonl') && UUID_RE.test(f.slice(0, -6)))
        .map(async (f) => ({ file: path.join(dir, f), st: await fs.promises.stat(path.join(dir, f)) })));
      const newest = files.sort((a, b) => b.st.mtimeMs - a.st.mtimeMs)[0];
      if (!newest) continue;
      const cwd = transcriptCwd(await readRange(newest.file, 0, Math.min(newest.st.size, HEAD_BYTES)));
      if (!cwd || !isDir(cwd) || [...skip, ...out].some((x) => samePath(x, cwd))) continue;
      if (path.resolve(cwd).toLowerCase().startsWith(path.join(os.tmpdir(), path.sep).toLowerCase())) continue; // scratch folders
      out.push(path.resolve(cwd));
    } catch { /* skip this folder */ }
  }
  return out;
}

// Model, effort and subagents of one session, for the bar under the terminal. Effort is only in the transcript as
// /effort and /model output, so it falls back to the defaults in ~/.claude/settings.json. Subagents live in
// <session>/subagents/agent-*.jsonl with an agent-*.meta.json (type, description) next to each.
const SETTINGS_FILE = path.join(os.homedir(), '.claude', 'settings.json');
const AGENT_STALE_MS = 10 * 60 * 1000; // an unfinished agent silent this long was cut off (session closed)

async function readJson(file) {
  try {
    return JSON.parse((await fs.promises.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
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

// A run's model is the one its replies carry, never the parent session's: big lines (screenshots, the prompt_snapshot
// appended at the end) can push every reply out of the tail, so the wide tail is read next and the last model seen is
// kept. `requested` is the Agent call's `model` from .meta.json ("haiku"), shown until the first reply.
const agentCache = new Map(); // file -> { sig, agent }
async function readAgent(dir, name) {
  const file = path.join(dir, name);
  const st = await fs.promises.stat(file);
  const sig = `${st.mtimeMs}:${st.size}`;
  const hit = agentCache.get(file);
  if (hit?.sig === sig) return hit.agent;
  const meta = (await readJson(file.replace(/\.jsonl$/, '.meta.json'))) || {};
  let tail = await readTail(file, st.size, TAIL_BYTES);
  let done = agentDone(tail);
  let model = lastModel(tail);
  if ((done == null || !model) && st.size > TAIL_BYTES) {
    tail = await readTail(file, st.size, WIDE_TAIL_BYTES);
    done = agentDone(tail);
    model = lastModel(tail);
  }
  const requested = oneLine(meta.model);
  const agent = {
    id: name.slice(6, -6),
    type: oneLine(meta.agentType) || 'agent',
    model: model || hit?.agent.model || null,
    requested: requested && requested !== 'inherit' ? requested : null,
    description: oneLine(meta.description),
    done: done === true,
    ctx: usageTokens(parseTail(tail).usage) || hit?.agent.ctx || 0, // each subagent has its own context window
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
  model = withLongContext(model, settings?.model) || settings?.model || null;
  // A bare alias from settings ("sonnet") has no version: use the one model of that family known in modelSettings.
  const alias = model && /^([a-z]+)(\[1m\])?$/i.exec(model);
  if (alias) {
    const ids = Object.keys(settings?.modelSettings || {}).filter((k) => k.startsWith(`claude-${alias[1].toLowerCase()}-`));
    if (ids.length === 1) model = ids[0] + (alias[2] || '');
  }
  effort = effort || defaultEffort(settings, model);
  const now = Date.now();
  agents = agents.filter(Boolean)
    .map((a) => ({ ...a, running: !a.done && now - a.mtime < AGENT_STALE_MS }))
    .sort((a, b) => b.start - a.start);
  return { model, effort, agents };
}

// Right sidebar data. MCP health comes from `claude mcp list` (the transcript does not store it): it health-checks every
// configured server (spawning every stdio one), so it is slow (seconds), cached per folder and never run twice at once.
// MCP config rarely changes mid-session, so the cache lives 5 minutes. Without a project (home screen) it runs in the home
// folder: user-level servers and claude.ai connectors. `force` skips the cache (refreshLogin).
const MCP_TTL_MS = 5 * 60 * 1000;
const mcpCache = new Map(); // cwd -> { at, value } | { pending }

function mcpList(cwd, force = false) {
  if (cwd == null) cwd = os.homedir();
  if (typeof cwd !== 'string' || !fs.existsSync(cwd)) return Promise.resolve({ ok: false, servers: [] });
  const hit = mcpCache.get(cwd);
  if (hit?.pending) return hit.pending;
  if (!force && hit && Date.now() - hit.at < MCP_TTL_MS) return Promise.resolve(hit.value);
  const [file, args] = IS_MAC ? ['claude', ['mcp', 'list']] : ['cmd.exe', ['/d', '/c', 'claude', 'mcp', 'list']];
  const pending = shellEnvReady.then(() => new Promise((resolve) => {
    const env = { ...process.env }; // after shellEnvReady, so macOS gets the login shell's PATH
    for (const k of STRIP_ENV) delete env[k];
    execFile(file, args,
      { cwd, env, windowsHide: true, timeout: 60000, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => resolve(err && !stdout ? { ok: false, servers: [] } : { ok: true, servers: parseMcpList(stdout) }));
  })).then((value) => {
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
    let names;
    try { names = (await fs.promises.readdir(dir)).filter((n) => n.endsWith('.md')); } catch { continue; }
    for (const n of names) {
      try {
        const { name, model } = parseAgentFile(await fs.promises.readFile(path.join(dir, n), 'utf8'), n);
        out.set(name, { name, model: oneLine(model) || 'inherit' }); // project agents override user ones
      } catch { /* unreadable file */ }
    }
  }
  return [...out.values()];
}

/**
 * What a subagent is told: the system prompt of its definition file (the body after the frontmatter), and the prompt each
 * run of this type in the session was given (first line of its transcript). Both are capped, they can be long.
 */
const PROMPT_CAP = 20000;
async function agentPrompts(cwd, sessionId, name) {
  const out = { definition: null, runs: [] };
  if (typeof name !== 'string') return out;
  if (typeof cwd !== 'string') cwd = null; // home screen: user-level definitions only, no runs
  let defModel = null; // the definition's `model:`; a "[1m]" there (or, for inherit, the parent's) marks a 1M run of a 200k-by-default model
  const dirs = [cwd && path.join(cwd, '.claude', 'agents'), path.join(os.homedir(), '.claude', 'agents')].filter(Boolean); // project wins
  for (const dir of dirs) {
    let names;
    try { names = (await fs.promises.readdir(dir)).filter((n) => n.endsWith('.md')); } catch { continue; }
    for (const n of names) {
      try {
        const def = parseAgentFile(await fs.promises.readFile(path.join(dir, n), 'utf8'), n);
        if (def.name !== name) continue;
        out.definition = def.body.slice(0, PROMPT_CAP);
        defModel = def.model;
        break;
      } catch { /* unreadable file */ }
    }
    if (out.definition != null) break;
  }
  if (cwd && typeof sessionId === 'string' && UUID_RE.test(sessionId)) {
    const dir = path.join(projectDir(cwd), sessionId, 'subagents');
    let configured = defModel;
    if (!configured || configured === 'inherit') {
      const parent = await readModelEffort(path.join(projectDir(cwd), `${sessionId}.jsonl`)).catch(() => ({}));
      const set = (await readJson(SETTINGS_FILE))?.model;
      configured = withLongContext(parent.model, set) || set || null;
    }
    try {
      const names = (await fs.promises.readdir(dir)).filter((n) => /^agent-.+\.jsonl$/.test(n));
      for (const n of names) {
        try {
          const file = path.join(dir, n);
          const meta = (await readJson(file.replace(/\.jsonl$/, '.meta.json'))) || {};
          if ((meta.agentType || 'agent') !== name) continue;
          const first = (await readRange(file, 0, 512 * 1024)).split('\n')[0];
          const c = JSON.parse(first).message?.content;
          const prompt = typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x.text || '').join('\n') : '';
          const a = await readAgent(dir, n);
          out.runs.push({ id: a.id, description: a.description, prompt: prompt.trim().slice(0, PROMPT_CAP), start: a.start, ctx: a.ctx,
            model: withLongContext(withLongContext(a.model, a.requested), configured) || a.requested });
        } catch { /* partial first line or unreadable */ }
      }
    } catch { /* no subagents */ }
    out.runs.sort((a, b) => b.start - a.start);
  }
  return out;
}

// Images in a session (right sidebar): lib/images.js keeps an index of where each image's line sits in the transcript;
// thumbnails and full images are decoded from that byte range on demand.
const THUMB_KEEP = 100; // thumbnails cached across all sessions (LRU)
const THUMB_W = 320;
const thumbCache = new Map(); // `${file}|${id}` -> data URL or null, oldest first

const sessionFile = (cwd, sessionId) => (typeof cwd === 'string' && typeof sessionId === 'string' && UUID_RE.test(sessionId)
  ? path.join(projectDir(cwd), `${sessionId}.jsonl`) : null);
async function imagesList(cwd, sessionId) {
  const file = sessionFile(cwd, sessionId);
  try {
    const st = file && (await scanImages(file));
    if (!st) return { items: [] };
    const exists = (f) => (f ? fs.promises.stat(f).then(() => true, () => false) : false);
    return { items: await Promise.all(st.items.slice().reverse().map(async ({ id, kind, label, file: f }) => ({ id, kind, label, file: f, exists: await exists(f) }))) };
  } catch {
    return { items: [] };
  }
}

async function findImage(cwd, sessionId, id) {
  const file = sessionFile(cwd, sessionId);
  const st = file && (await scanImages(file));
  const it = st?.items.find((i) => i.id === id);
  return it ? { file, it } : null;
}

/** The image's { media_type, data }, re-read from its line's byte range. */
async function imageSource(file, it) {
  const b = JSON.parse(await readRange(file, it.off, it.len)).message.content[it.block];
  const src = (it.sub >= 0 ? b.content[it.sub] : b).source;
  return /^image\/[a-z0-9.+-]+$/i.test(src.media_type) ? src : null;
}

async function imageThumb(cwd, sessionId, id) {
  const f = await findImage(cwd, sessionId, id).catch(() => null);
  if (!f) return null;
  const key = `${f.file}|${id}`;
  if (thumbCache.has(key)) {
    const v = thumbCache.get(key);
    thumbCache.delete(key);
    thumbCache.set(key, v);
    return v;
  }
  let url = null; // GIF/WebP: nativeImage can't decode them, the tile stays a placeholder
  try {
    const src = await imageSource(f.file, f.it);
    const img = src && nativeImage.createFromBuffer(Buffer.from(src.data, 'base64'));
    if (img && !img.isEmpty()) {
      const { width, height } = img.getSize(); // shrink by the longer side, so a tall full-page screenshot gets small too
      const small = Math.max(width, height) <= THUMB_W ? img
        : img.resize({ ...(width >= height ? { width: THUMB_W } : { height: THUMB_W }), quality: 'good' });
      const px = small.toBitmap(); // BGRA: keep PNG when any pixel is transparent, JPEG would turn it black
      let alpha = false;
      for (let i = 3; i < px.length; i += 4) if (px[i] < 255) { alpha = true; break; }
      url = alpha ? small.toDataURL() : `data:image/jpeg;base64,${small.toJPEG(80).toString('base64')}`;
    }
  } catch { /* unreadable or changed line */ }
  thumbCache.set(key, url);
  if (thumbCache.size > THUMB_KEEP) thumbCache.delete(thumbCache.keys().next().value);
  return url;
}

async function imageFull(cwd, sessionId, id) {
  try {
    const f = await findImage(cwd, sessionId, id);
    const src = f && (await imageSource(f.file, f.it));
    return src ? `data:${src.media_type};base64,${src.data}` : null;
  } catch {
    return null;
  }
}

async function revealImage(cwd, sessionId, id) {
  const f = await findImage(cwd, sessionId, id).catch(() => null);
  if (f?.it.file && (await fs.promises.stat(f.it.file).then(() => true, () => false))) shell.showItemInFolder(path.normalize(f.it.file));
}

// Plan limits (session, weekly, per-model weekly) come from the same endpoint Claude Code's /usage reads, using the
// OAuth token Claude Code keeps in ~/.claude/.credentials.json. The token only goes to api.anthropic.com.
// Claude Code refreshes the token while it runs; we never write the credentials file.
const CREDENTIALS_FILE = path.join(os.homedir(), '.claude', '.credentials.json');
let limitsCache = { at: 0, value: null };
let limitsFetch = null;

/**
 * On macOS Claude Code keeps the same JSON in the login Keychain instead of the file. Read only. A failed read (no item,
 * or the user denied/ignored the access dialog) is not retried for 10 minutes, so the dialog can't keep coming back.
 */
const KEYCHAIN_RETRY_MS = 10 * 60 * 1000;
let keychainFailedAt = 0;
function keychainOauth() {
  if (Date.now() - keychainFailedAt < KEYCHAIN_RETRY_MS) return Promise.resolve(null);
  return new Promise((resolve) => {
    execFile('/usr/bin/security', ['find-generic-password', '-s', 'Claude Code-credentials', '-w'], { timeout: 5000 }, (err, stdout) => {
      let oauth = null;
      try { oauth = err ? null : JSON.parse(stdout).claudeAiOauth; } catch { /* not JSON */ }
      if (!oauth?.accessToken) keychainFailedAt = Date.now();
      resolve(oauth);
    });
  });
}

const expired = (oauth) => !!oauth?.expiresAt && oauth.expiresAt < Date.now();

async function readOauth() {
  let oauth;
  try {
    oauth = JSON.parse((await fs.promises.readFile(CREDENTIALS_FILE, 'utf8')).replace(/^\uFEFF/, '')).claudeAiOauth;
  } catch { /* handled by the caller */ }
  // macOS: the Keychain is the live copy; a leftover file may hold a token that is no longer refreshed.
  if (IS_MAC && (!oauth?.accessToken || expired(oauth))) oauth = (await keychainOauth()) || oauth;
  return oauth;
}

/**
 * The access token lasts hours and only Claude Code refreshes it, so with no session running it expires. `claude mcp list`
 * refreshes it (tested on v2.1.296; `claude auth status` does not) and its result fills the home screen's MCP list anyway.
 * At most once per 10 minutes, so a broken login doesn't spawn claude on every poll.
 */
const LOGIN_RETRY_MS = 10 * 60 * 1000;
let loginRefreshAt = 0;
async function refreshLogin() {
  if (Date.now() - loginRefreshAt < LOGIN_RETRY_MS) return false;
  loginRefreshAt = Date.now();
  await mcpList(null, true);
  return true;
}

async function fetchLimits() {
  let oauth = await readOauth();
  if (expired(oauth) && (await refreshLogin())) oauth = await readOauth();
  if (!oauth?.accessToken) return { ok: false, error: 'Not signed in. Run claude and log in.' };
  if (expired(oauth)) return { ok: false, error: 'Login expired. Start a Claude session to refresh it.' };
  try {
    let res = await usageRequest(oauth);
    // Revoked before its expiry (a login elsewhere): same refresh, once.
    if (res.status === 401 && (await refreshLogin())) {
      const fresh = await readOauth();
      if (fresh?.accessToken && fresh.accessToken !== oauth.accessToken) res = await usageRequest(fresh);
    }
    if (!res.ok) {
      const ra = Number(res.headers.get('retry-after'));
      const retryAfter = Math.min(15 * 60, Math.max(30, ra > 0 ? ra : res.status === 429 ? 300 : 60));
      const error = res.status === 429
        ? `Usage rate limited, retrying in ${Math.ceil(retryAfter / 60)} min`
        : `Usage request failed (${res.status})`;
      return { ok: false, status: res.status, error, retryAfter };
    }
    const j = await res.json();
    const limits = (j.limits || []).map((l) => ({
      kind: l.kind,
      label: l.kind === 'session' ? 'Session' : l.kind === 'weekly_all' ? 'Weekly' : l.scope?.model?.display_name || 'Weekly (model)',
      percent: Math.round(l.percent),
      resetsAt: Date.parse(l.resets_at) || null,
    }));
    return { ok: true, limits, fetchedAt: Date.now() };
  } catch {
    return { ok: false, error: 'Could not reach Anthropic (offline?)', retryAfter: 30 };
  }
}

function usageRequest(oauth) {
  return fetch('https://api.anthropic.com/api/oauth/usage', {
    headers: { Authorization: `Bearer ${oauth.accessToken}`, 'anthropic-beta': 'oauth-2025-04-20' },
    signal: AbortSignal.timeout(8000),
  });
}

// Cached for 2 min; overlapping calls share one request. A failure (429 above all) blocks new requests for its
// Retry-After, otherwise our own retries keep the rate limit from ever clearing. Meanwhile the last good numbers are
// served (stale) instead of an error.
let limitsGood = null;
let limitsBlockedUntil = 0;
function getLimits() {
  const now = Date.now();
  if (limitsCache.value?.ok && now - limitsCache.at < 120000) return Promise.resolve(limitsCache.value);
  if (now < limitsBlockedUntil) return Promise.resolve(limitsGood ? { ...limitsGood, stale: true } : limitsCache.value);
  if (!limitsFetch) {
    limitsFetch = fetchLimits().then((v) => {
      if (v.ok) { limitsGood = v; limitsBlockedUntil = 0; limitsCache = { at: Date.now(), value: v }; return v; }
      if (v.retryAfter) limitsBlockedUntil = Date.now() + v.retryAfter * 1000;
      limitsCache = { at: Date.now(), value: v };
      return limitsGood ? { ...limitsGood, stale: true } : v;
    }).finally(() => { limitsFetch = null; });
  }
  return limitsFetch;
}

// ---------------------------------------------------------------- update ----
// The app is installed by cloning the repo; there is no auto-update. The footer's Update button (shown when the
// branch's upstream has new commits) pulls, runs npm install if dependencies changed, and restarts. A packaged build
// is locked while it runs, so it hands over to scripts/update.* and quits (startExternalUpdate).

/** stdout and stderr of a command, never rejects. */
function runFull(file, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, timeout: 120000, maxBuffer: 8 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: String(stdout || '').trim(), err: String(stderr || err?.message || '').trim() });
    });
  });
}

// Never let git open a credential prompt or window from the background check.
const gitEnv = () => ({ ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' });

/** The checkout the app runs from: the app folder (npm start), or the repo above dist/ for a packaged build. */
let repoDirCache;
function repoDir() {
  if (repoDirCache !== undefined) return repoDirCache;
  repoDirCache = null;
  let dir = app.isPackaged ? path.dirname(process.execPath) : app.getAppPath();
  for (let i = 0; i < 8; i++) {
    try {
      if (fs.existsSync(path.join(dir, '.git')) && JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name === 'stanza') {
        repoDirCache = dir;
        break;
      }
    } catch { /* no package.json here */ }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return repoDirCache;
}

let updateCheck = null;
function checkUpdate() { // overlapping calls share one fetch
  if (updateCheck) return updateCheck;
  updateCheck = (async () => {
    const dir = repoDir();
    if (!dir) return { available: false, error: "This copy isn't a git clone, so it can't check for updates." };
    const env = gitEnv();
    const fetched = await runFull('git', ['-C', dir, 'fetch', '--quiet'], { env, timeout: 30000 });
    if (!fetched.ok) return { available: false, error: (fetched.err || fetched.out || 'git fetch failed').trim().split('\n')[0].slice(0, 160) };
    const behind = parseInt((await runFull('git', ['-C', dir, 'rev-list', '--count', 'HEAD..@{u}'], { env })).out, 10) || 0;
    // What's new, for the popup: the newest few commit subjects.
    const log = behind ? (await runFull('git', ['-C', dir, 'log', '--format=%s', '-n', '5', 'HEAD..@{u}'], { env })).out : '';
    return { available: behind > 0, behind, packaged: app.isPackaged, subjects: log ? log.split('\n').map((s) => s.trim().slice(0, 120)).filter(Boolean) : [] };
  })().finally(() => { updateCheck = null; });
  return updateCheck;
}

/**
 * A built copy is locked while it runs, so scripts/update.ps1 (update.sh on macOS) does the work after we quit: it waits
 * for the app to close, pulls, runs npm install if needed, rebuilds and reopens the app. Windows shows its console for
 * progress and errors; macOS writes a log that opens in TextEdit on failure. The script runs from a temp copy because
 * git pull may rewrite it.
 */
async function startExternalUpdate(dir) {
  try {
    const name = IS_MAC ? 'update.sh' : 'update.ps1';
    const tmp = path.join(os.tmpdir(), `stanza-${name}`);
    fs.copyFileSync(path.join(dir, 'scripts', name), tmp);
    let child;
    if (IS_MAC) {
      await shellEnvReady; // git and npm from the login shell's PATH
      const bundle = path.resolve(process.execPath, '..', '..', '..'); // .../Stanza.app/Contents/MacOS/Stanza
      const log = path.join(app.getPath('userData'), 'update.log');
      child = spawn('/bin/bash', [tmp, dir, String(process.pid), bundle, log], { detached: true, stdio: 'ignore', env: process.env });
    } else {
      // Through `start`, which gives PowerShell its own visible console. Spawned directly with detached (no console),
      // PowerShell 5.1 exits at once. /s strips only the outer quotes, so the quoted paths survive (no quotes in Windows paths).
      const cmdline = `/d /s /c "start "Updating Stanza" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tmp}"`
        + ` -Repo "${dir}" -AppPid ${process.pid} -Exe "${process.execPath}""`;
      // cwd outside dist\: the app's own cwd (win-unpacked, from the shortcuts) would be inherited and block electron-builder's rmdir.
      child = spawn('cmd.exe', [cmdline], { detached: true, stdio: 'ignore', windowsVerbatimArguments: true, cwd: os.tmpdir() });
    }
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    child.unref();
  } catch (err) {
    return { ok: false, error: `Could not start the updater: ${err.message}\nClose the app and run git pull, then ${IS_MAC ? 'npm run package:mac' : 'npm run package'} in ${dir}.` };
  }
  forceClose = true;
  app.quit(); // before-quit ends the sessions; the script reopens the app when it is done
  return { ok: true };
}

async function applyUpdate() {
  const dir = repoDir();
  if (!dir) return { ok: false, error: 'This copy is not inside a git checkout of Stanza, so it cannot update itself.' };
  if (app.isPackaged) return startExternalUpdate(dir);
  await shellEnvReady; // macOS: npm on the login shell's PATH
  const env = gitEnv();
  // npm install rewrites the lockfile; a dirty one would make the pull abort. It is generated, so drop local changes
  // (from HEAD, so a staged copy goes too).
  await runFull('git', ['-C', dir, 'checkout', 'HEAD', '--', 'package-lock.json'], { env });
  const pull = await runFull('git', ['-C', dir, 'pull', '--ff-only'], { env, timeout: 60000 });
  if (!pull.ok) return { ok: false, error: pull.err || 'git pull failed.' };
  // Always, not only when package(-lock).json changed: an npm install that failed in an earlier update would never be
  // retried (HEAD has moved on). With nothing to change it touches no files, so the running Electron is no obstacle.
  const [file, args] = IS_MAC ? ['npm', ['install']] : ['cmd.exe', ['/d', '/c', 'npm', 'install']];
  const npm = await runFull(file, args, { cwd: dir, timeout: 600000 });
  if (!npm.ok) {
    const tail = npm.err.split('\n').slice(-4).join('\n');
    return { ok: false, error: `Pulled the update, but npm install failed. Close the app and run npm install in ${dir}.\n${tail}` };
  }
  forceClose = true;
  app.relaunch();
  app.quit(); // before-quit ends the sessions
  return { ok: true };
}

// --------------------------------------------------------------- window ----

let mainWindow = null;
let forceClose = false;

/** Saved bounds, or none when no display shows enough of them (the monitor they were on was unplugged). */
function visibleBounds(b) {
  if (!b || !Number.isFinite(b.x) || !Number.isFinite(b.y)) return b;
  try {
    const wa = screen.getDisplayMatching(b).workArea;
    const w = Math.min(b.x + b.width, wa.x + wa.width) - Math.max(b.x, wa.x);
    const h = Math.min(b.y + b.height, wa.y + wa.height) - Math.max(b.y, wa.y);
    if (w >= 100 && h >= 40) return b;
    return { width: Math.min(b.width, wa.width), height: Math.min(b.height, wa.height) }; // no x/y: centred on the primary display
  } catch {
    return b;
  }
}

// Appearance (settings page). The renderer's CSS follows prefers-color-scheme, which nativeTheme.themeSource drives,
// so 'system' needs no code of its own. These literals paint before CSS loads: keep them equal to --background
// (and --muted-foreground for the window buttons) of each theme (DESIGN.md sync point).
const THEMES = ['dark', 'light', 'system'];
const ACCENTS = ['blue', 'violet', 'teal', 'rose'];
const CHROME = { dark: { bg: '#0a0a0a', symbol: '#a1a1a1' }, light: { bg: '#ffffff', symbol: '#525252' } };
const chrome = () => CHROME[nativeTheme.shouldUseDarkColors ? 'dark' : 'light'];

function applyTheme() {
  if (!THEMES.includes(state.ui.theme)) state.ui.theme = 'dark';
  if (!ACCENTS.includes(state.ui.accent)) state.ui.accent = 'blue';
  if (nativeTheme.themeSource !== state.ui.theme) nativeTheme.themeSource = state.ui.theme;
  applyChrome();
}

/** Window background and (Windows) the title bar buttons' colors for the resolved theme. */
function applyChrome() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const c = chrome();
  try {
    mainWindow.setBackgroundColor(c.bg);
    if (!IS_MAC) mainWindow.setTitleBarOverlay({ color: c.bg, symbolColor: c.symbol, height: 39 });
  } catch { /* older Electron or no overlay: cosmetic only */ }
}

function createWindow() {
  const b = visibleBounds(state.bounds);
  mainWindow = new BrowserWindow({
    width: b?.width ?? 1440,
    height: b?.height ?? 900,
    x: b?.x,
    y: b?.y,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: chrome().bg, // = --background (DESIGN.md sync point)
    title: 'Stanza',
    icon: ICON,
    titleBarStyle: 'hidden',
    ...(IS_MAC
      ? { trafficLightPosition: { x: 14, y: 13 } } // centred in the 40 px top row; #brand leaves room (body.mac in styles.css)
      : { titleBarOverlay: { color: chrome().bg, symbolColor: chrome().symbol, height: 39 } }), // sits on the top bar (--background), 1 px short so the bar's border-bottom (row 40) runs under it to the edge
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
    const devtools = input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')
      || (IS_MAC && input.meta && input.alt && input.code === 'KeyI');
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

// A background session needs input or finished (the renderer decides when). Clicking brings the window to the front on
// that tab. (Toast-XML launch arguments + Notification.handleActivation, for clicks in Notification Center after the
// toast is gone, delivered no clicks at all in testing, so this sticks to the plain click event.)
const liveNotes = new Set(); // shown notifications stay referenced: a garbage-collected one loses its click handler

/** Show, un-minimize and focus the window, then switch to the tab (if it still exists). */
function showFromNotification(tabId) {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  if (IS_MAC) {
    app.focus({ steal: true });
  } else {
    // Windows may refuse focus() to a background window and flash the taskbar instead; topmost for a moment wins.
    win.setAlwaysOnTop(true);
    win.focus();
    win.setAlwaysOnTop(false);
  }
  win.focus();
  if (tabId) send('notify:click', tabId);
}

function notify(msg) {
  try {
    if (!Notification.isSupported()) return;
    const title = String(msg?.title || '').slice(0, 120);
    const body = String(msg?.body || '').slice(0, 240);
    const tabId = typeof msg?.tabId === 'string' ? msg.tabId : '';
    const n = new Notification({ title, body });
    const drop = () => liveNotes.delete(n);
    liveNotes.add(n);
    n.on('click', () => { drop(); showFromNotification(tabId); });
    n.on('close', drop);
    n.on('failed', (_e, err) => { drop(); console.error('Notification failed:', err); });
    n.show();
  } catch (err) {
    console.error('Notification failed:', err); // e.g. macOS permission denied: never break the app over it
  }
}

/** Code.exe: the per-user or system install, else next to the `code.cmd` shim on PATH (it lives in <install>\bin). */
function findVsCode() {
  const dirs = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code'),
    path.join(process.env.ProgramFiles || '', 'Microsoft VS Code'),
    ...(process.env.PATH || '').split(';').filter((d) => d && fs.existsSync(path.join(d, 'code.cmd'))).map((d) => path.dirname(d)),
  ];
  return dirs.map((d) => path.join(d, 'Code.exe')).find((f) => fs.existsSync(f)) || null;
}

/** A NUL byte in the first 8 KB = binary (image, video, PDF, Office...), the same test git uses. */
function isBinaryFile(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(8192);
    return buf.subarray(0, fs.readSync(fd, buf, 0, buf.length, 0)).includes(0);
  } catch {
    return false;
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch { /* already closed */ }
  }
}

/**
 * Open a text file in VS Code at a line (`code -g file:line:col`); binary files (photos, videos, PDFs...) and text files
 * without VS Code go to the default app. Windows: Code.exe takes the same arguments as the code.cmd shim. macOS: the
 * `code` CLI from the login shell's PATH, else `open -a` (no line), else open.
 */
async function openFileAt(file, line, col) {
  try {
    if (typeof file !== 'string' || !fs.statSync(file).isFile()) return { ok: false, error: 'File not found' };
  } catch {
    return { ok: false, error: 'File not found' };
  }
  if (isBinaryFile(file)) {
    const err = await shell.openPath(file);
    return err ? { ok: false, error: err } : { ok: true };
  }
  const n = (v) => (Number.isInteger(v) && v > 0 ? v : null);
  const target = [file, n(line), n(line) && n(col)].filter(Boolean).join(':');
  const start = (exe, args) => new Promise((resolve) => {
    // No windowsHide (see shell:openInCode): VS Code's first window would start hidden.
    const child = spawn(exe, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('spawn', () => { child.unref(); resolve(true); });
  });
  if (IS_MAC) {
    await shellEnvReady;
    const ok = await new Promise((resolve) => execFile('code', ['-g', target], (err) => resolve(!err)));
    if (ok) return { ok: true };
    const opened = await new Promise((resolve) => execFile('/usr/bin/open', ['-a', 'Visual Studio Code', file], (err) => resolve(!err)));
    if (opened) return { ok: true };
  } else {
    const exe = findVsCode();
    if (exe && (await start(exe, ['-g', target]))) return { ok: true };
  }
  const err = await shell.openPath(file);
  return err ? { ok: false, error: err } : { ok: true };
}

// A folder passed on the command line: `stanza.exe C:\some\project`.
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

  app.whenReady().then(async () => {
    loadState();
    if (firstRun) { // a new user starts with their recent Claude Code projects (and so their sessions), the newest open
      const recent = await recentProjects().catch(() => []);
      recent.forEach(addProject);
      if (recent.length) { state.ui.expanded = [recent[0]]; saveState(); }
    }
    registerIpc();
    if (!IS_MAC) registerToastIdentity();
    // macOS: Electron's default menu binds Cmd+W, Cmd+R and Cmd+=/- (our shortcuts). Keep Quit/Hide and the Edit roles,
    // which give Cmd+C/V/A to the terminal and to inputs. Windows keeps its default menu (hidden with the title bar).
    if (IS_MAC) Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }]));
    applyTheme(); // before the window, so its first paint and the page's prefers-color-scheme are right
    nativeTheme.on('updated', applyChrome); // 'system' follows the OS switching light/dark
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
  for (const s of sessions.values()) endSession(s);
});

// ------------------------------------------------------------------ ipc ----

function registerIpc() {
  ipcMain.handle('state:get', () => ({ projects: state.projects, ui: state.ui, restore: restorableTabs(), chat: chatInfo() }));
  ipcMain.on('tabs:set', (_e, payload) => saveTabs(payload));

  ipcMain.handle('projects:add', async () => {
    const r = await dialog.showOpenDialog(mainWindow, {
      title: 'Add a project folder',
      properties: ['openDirectory', 'multiSelect'],
    });
    const added = r.canceled ? [] : r.filePaths.map(addProject).filter(Boolean);
    return { projects: state.projects, added };
  });

  ipcMain.handle('projects:chat', () => chatProject());
  ipcMain.handle('chat:pickDir', async () => {
    const r = await dialog.showOpenDialog(mainWindow, { title: 'Folder for chats', defaultPath: chatDir(), properties: ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : setChatDir(r.filePaths[0]);
  });
  ipcMain.handle('chat:resetDir', () => setChatDir(null));

  ipcMain.handle('projects:reorder', (_e, paths) => {
    if (!Array.isArray(paths)) return state.projects;
    const rank = (p) => { const i = paths.findIndex((x) => typeof x === 'string' && samePath(x, p.path)); return i < 0 ? Infinity : i; };
    state.projects = state.projects.map((p, i) => [p, i]).sort((a, b) => !!b[0].chat - !!a[0].chat || rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([p]) => p);
    saveState();
    return state.projects;
  });

  ipcMain.handle('projects:remove', (_e, p) => {
    state.projects = state.projects.filter((x) => !samePath(x.path, p));
    saveState();
    return state.projects;
  });

  ipcMain.handle('ui:set', (_e, patch) => {
    for (const k of Object.keys(defaults.ui)) {
      if (k !== 'expanded' && k !== 'collapsed' && k !== 'keys' && typeof patch?.[k] === typeof defaults.ui[k]) state.ui[k] = patch[k];
    }
    if (patch?.keys && typeof patch.keys === 'object' && !Array.isArray(patch.keys)) {
      const keys = {};
      for (const [id, list] of Object.entries(patch.keys).slice(0, 50)) {
        if (/^[A-Za-z]{1,40}$/.test(id) && Array.isArray(list)) {
          keys[id] = list.filter((c) => typeof c === 'string' && c.length <= 60).slice(0, 8);
        }
      }
      state.ui.keys = keys;
    }
    if (Array.isArray(patch?.collapsed)) {
      state.ui.collapsed = patch.collapsed.filter((k) => typeof k === 'string').slice(0, 20);
    }
    if (Array.isArray(patch?.expanded)) {
      state.ui.expanded = patch.expanded.filter((p) => typeof p === 'string').slice(0, 200);
    }
    state.ui.fontSize = Math.min(24, Math.max(10, Math.round(state.ui.fontSize) || 14));
    if (patch?.theme || patch?.accent) applyTheme();
    saveState();
  });

  ipcMain.handle('pty:create', (_e, opts) => (IS_MAC ? shellEnvReady.then(() => createSession(opts)) : createSession(opts)));
  ipcMain.on('pty:write', (_e, id, data) => sessions.get(id)?.pty.write(data));
  ipcMain.on('pty:resize', (_e, id, cols, rows) => {
    try { sessions.get(id)?.pty.resize(Math.max(cols, 2), Math.max(rows, 2)); } catch { /* exited */ }
  });
  ipcMain.on('pty:kill', (_e, id) => {
    const s = sessions.get(id);
    if (s) endSession(s);
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
  ipcMain.handle('agents:prompt', (_e, cwd, sessionId, name) => agentPrompts(cwd, sessionId, name));
  ipcMain.handle('images:list', (_e, cwd, sessionId) => imagesList(cwd, sessionId));
  ipcMain.handle('images:thumb', (_e, cwd, sessionId, id) => imageThumb(cwd, sessionId, id));
  ipcMain.handle('images:full', (_e, cwd, sessionId, id) => imageFull(cwd, sessionId, id));
  ipcMain.handle('images:reveal', (_e, cwd, sessionId, id) => revealImage(cwd, sessionId, id));
  ipcMain.handle('usage:get', () => getLimits());
  ipcMain.handle('update:check', () => checkUpdate());
  ipcMain.handle('update:apply', () => applyUpdate());

  ipcMain.handle('ports:list', () => listPorts());

  ipcMain.handle('shell:openExternal', (_e, url) => {
    if (/^https?:\/\//i.test(url)) return shell.openExternal(url);
  });
  ipcMain.handle('shell:showInFolder', (_e, p) => {
    if (isDir(p)) return shell.openPath(p);
  });

  ipcMain.handle('shell:openInCode', (_e, p) => {
    if (!isDir(p)) return { ok: false, error: 'Folder not found' };
    if (IS_MAC) {
      return new Promise((resolve) => {
        execFile('/usr/bin/open', ['-a', 'Visual Studio Code', p], (err) => resolve(err ? { ok: false, error: 'Could not start VS Code' } : { ok: true }));
      });
    }
    const exe = findVsCode();
    if (!exe) return { ok: false, error: 'VS Code not found' };
    return new Promise((resolve) => {
      // No windowsHide: it puts SW_HIDE in STARTUPINFO, and Windows applies that to VS Code's first window,
      // so a cold start ran with no visible window at all.
      const child = spawn(exe, [p], { detached: true, stdio: 'ignore' });
      child.on('error', () => resolve({ ok: false, error: 'Could not start VS Code' }));
      child.on('spawn', () => { child.unref(); resolve({ ok: true }); });
    });
  });

  // File links in the terminal: which of these candidate paths (absolute, or relative to the tab's folder) are files.
  ipcMain.handle('files:resolve', (_e, cwd, list) => {
    if (typeof cwd !== 'string' || !Array.isArray(list)) return [];
    return list.slice(0, 50).map((f) => {
      if (typeof f !== 'string' || !f || f.length > 1000) return null;
      try {
        const abs = path.resolve(cwd, f);
        return fs.statSync(abs).isFile() ? abs : null;
      } catch {
        return null;
      }
    });
  });
  ipcMain.handle('shell:openFile', (_e, file, line, col) => openFileAt(file, line, col));

  ipcMain.handle('clipboard:read', () => clipboard.readText());
  ipcMain.on('clipboard:write', (_e, text) => clipboard.writeText(String(text)));

  ipcMain.on('app:quit', () => {
    forceClose = true;
    mainWindow?.close();
  });

  ipcMain.on('notify', (_e, msg) => notify(msg));

  ipcMain.on('win:flash', () => {
    if (!mainWindow || mainWindow.isFocused()) return;
    mainWindow.flashFrame(true);
    mainWindow.once('focus', () => mainWindow.flashFrame(false));
  });
}

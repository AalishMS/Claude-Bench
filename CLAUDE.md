# Claude Bench

Windows desktop wrapper around the real `claude` CLI. Electron + xterm.js + ConPTY (`@lydell/node-pty`).
Each tab is a genuine Claude Code session, so never re-implement CLI features (slash commands, permissions,
model switching). The app only adds what the terminal lacks: a project sidebar, tabs, live git status per
project, and a running-servers panel.

Personal tool for one user on Windows 11. No macOS/Linux support, no auto-update, no telemetry.

## Commands

```
npm start            # run from source (fastest loop)
npm run package      # build dist\win-unpacked\Claude Bench.exe (fails if that exe is running)
npm run shortcut     # Desktop + Start menu shortcuts -> packaged exe
npm run icon         # regenerate assets/icon.png + icon.ico (pure Node, no deps)
```

There is no test suite and no linter. Verify changes by running the app (see "Testing").

## Principles: minimal and fast

- **Keep it small.** No bundler, no framework, no TypeScript, no CSS preprocessor. Plain CommonJS in main/preload
  and a plain browser script in the renderer. xterm is loaded from `node_modules` with `<script>` tags.
  Add a dependency only when the alternative is clearly worse.
- **Fast to start, cheap to run.** No work while the window is hidden (`document.hidden` pauses polling).
  Terminal output is coalesced (6 ms) before IPC. Git/port polling skip overlapping runs. Only re-render DOM
  when data actually changed (`lastSidebarKey`, `JSON.stringify` diffs).
- **Terminal first.** The terminal gets the space and the focus. Chrome around it stays quiet.
- **Don't fight Claude Code.** Our shortcuts avoid keys it uses (`Ctrl+B/T/W/J`...). They are `Ctrl+Shift+T/W/B/S`,
  `Ctrl+Tab`, `Alt+1..9`.
- Prefer the smallest change that works. No speculative settings screens, plugin systems or abstractions.

## Design rules

The UI must not look like a generic AI-generated app. Current direction: **minimal dark developer workspace, nearly
monochrome, compact controls, breathing room.** Hierarchy comes from size, weight and brightness, not color.

- Palette: `--bg-0 #090909` terminal/top bar, `--bg-1 #050505` sidebars/status bar, `--bg-2 #111111` input surface,
  hover and panels, `--bg-3 #1a1a1a` active row, `--border #222222`, text `#eaeaea`, secondary `--dim #808080`.
  The one accent is `--accent #2850a5` (royal blue, `--accent-hi` for hover): primary buttons, active-row bar,
  focus rings, active tab line. Nothing else gets the accent.
- Color otherwise only carries meaning: green = running, yellow = uncommitted changes / background activity, red =
  conflicts and destructive actions. Don't add decorative color.
- **Shapes**: rounded rectangular panels (`--r-panel` 10 px, dialogs 12 px), pill-shaped buttons (`--r-pill`: toolbar
  chips, primary buttons, search, dialog buttons), thin outline icons, faint dividers. **No gradients, glows, tinted
  cards or visible shadows** (except modals/popovers). No badges. Lists are flat rows, active row = `--bg-3` + 2 px
  accent left bar.
- UI font is Segoe UI Variable (clean sans): small labels, medium-weight (500) project names, one large heading
  (welcome h1).
- Git info is plain text (`main  2 changed`), not chips.
- Row actions are small icon buttons on the same line as the title, shown on hover/active, with tooltips.
  Nothing should wrap or shift layout on hover.
- Icons are inline Feather-style SVG paths in `ICONS` (renderer.js). Logo is a light tile with a dark `>_`
  (`LOGO_SVG` in renderer.js and `scripts/make-icon.js` must stay in sync).
- **Terminal typography** (`TERM_FONT` in renderer.js): Cascadia Mono, light body weight (300), bold 700, line
  height 1.4, slight letter spacing. Claude Code emits the **ANSI 16-color palette** (measured from the xterm buffer:
  default fg = body, `white` = secondary/meta text and rules, `white`+dim = diff context, `brightWhite` on
  `brightBlack` bg = the user's message bar, `brightBlue` = inline code, `brightGreen` = bullets and diff +,
  `brightRed` = diff -, bold = headings/strong, italic = emphasis/quotes, H1 = bold+italic+underline). So
  `XTERM_THEME` is the real lever: keep `white` mid-grey (hierarchy) and `brightBlack` dark (quiet message bar;
  `minimumContrastRatio: 3` keeps PowerShell's brightBlack flags readable). Per-line font size is impossible in a
  terminal grid. Never try to re-parse its output into "blocks". Size is `Ctrl +` / `Ctrl -` / `Ctrl 0` (10-24,
  saved in `ui.fontSize`).
- All design tokens are CSS variables at the top of `src/styles.css`. Change tokens, not scattered values.
  The xterm theme (`XTERM_THEME` in renderer.js) and `titleBarOverlay` / `backgroundColor` in main.js
  must match `--bg-0` (`#090909`).

## Architecture

```
src/main.js      window, ptys, git status, port scan, persistence, IPC handlers
src/preload.js   window.api bridge (contextIsolation on, sandbox on, no nodeIntegration)
src/renderer.js  all UI: tabs, sidebar, servers panel, status bar, dialogs, polling
src/index.html   shell + CSP (script-src 'self'); src/styles.css
scripts/         make-icon.js, create-shortcut.ps1
```

- **State** lives in `%APPDATA%\claude-bench\state.json` (projects, ui flags, window bounds). Written
  synchronously via tmp file + rename. The app used to be "Claude Terminal": if no state exists yet, the loader
  reads `%APPDATA%\claude-terminal\state.json` once (`legacyStateFile`).
- **Sessions**: `cmd.exe /d /c claude [--continue|--resume]` for Claude tabs (resolves `claude.cmd` and
  `claude.exe`), `powershell.exe -NoLogo` for shell tabs. Exit shows a Restart / Close overlay.
  Claude args are allow-listed in main.js.
- **Git**: `git status --porcelain=v2 --branch` with `GIT_OPTIONAL_LOCKS=0`, polled every 4 s from the renderer.
- **Servers panel**: one PowerShell call (`Get-NetTCPConnection` + `Get-CimInstance Win32_Process`) every 6 s.
  A listener belongs to a tab if a session's pty pid is an ancestor; otherwise it is matched to a project if
  its command line contains the project path outside `--flag=` values (Antigravity's `agy.exe --add-dir=<project>` is no server).
  Rows are one line (icon, short name, port); details are in the tooltip. Default view hides non-dev processes ("Show all" reveals them).
  The same process list is walked from each session's pty pid for MCP servers (Claude tabs only: command line contains
  "mcp", not under a bash/PowerShell tool shell; topmost of the chain) and browsers (chrome/msedge/... without `--type=`).
  A new session-owned port, MCP server or browser opens the panel (`revealNewOwned`); since Claude starts its local MCP
  servers at launch, every new Claude tab opens it once.
  Kill is restricted to PIDs from the last scan and uses `taskkill /T /F`.
- **Sessions and usage**: read-only from `~/.claude/projects/<cwd, non-alphanumerics -> "-">/<uuid>.jsonl`. The sidebar lists a
  project's sessions (title = last `ai-title`, else first prompt) under it; clicking one focuses its tab or opens
  `claude --resume <uuid>` (main accepts only a bare UUID as `resumeId`). Lists read just the file tail and cache by
  mtime+size. The footer tiles show plan limits (session / weekly / per-model % and reset times, from `api.anthropic.com/api/oauth/usage`
  using the token in `~/.claude/.credentials.json`, cached 60 s in main, never written), context fill of the active tab's
  session, and tab state. Fresh and `--continue` tabs are matched to their transcript heuristically (`assignSessions`).
  Until a tab's transcript is listed (after the first reply) it shows as an italic "New session" placeholder row.
- **Info bar** (under Claude terminals, `session:info`): model = last reply's model or `/model` output in the transcript tail,
  effort = `/effort` / `/model` output, else `modelSettings[<id>].effortLevel` in `~/.claude/settings.json`. Subagents come from
  `<session>/subagents/agent-*.jsonl` + `.meta.json`; finished = tail has a `SubagentHandback` call or ends in a text-only reply.
- **Scrollbar**: our own `.vbar` replaces xterm's. Normal buffer = real position. Claude's `"tui": "fullscreen"` uses the
  alternate screen (no scrollback), so there the strip forwards synthetic wheel events to `.xterm-screen` (Claude has mouse
  tracking on) and the thumb rests in the middle.
- Renderer builds DOM with the `h()` helper. User/process text always goes in as text nodes. `html:` is only for
  static icon SVG.

## Gotchas (learned the hard way)

- **`pty.pid` is 0 right after spawn** on ConPTY. Read `s.pty.pid` lazily at scan time; never cache it.
- **Strip session markers from the child env** (`STRIP_ENV` in main.js: `CLAUDECODE`, `CLAUDE_CODE_*` session
  vars). If the app is started from inside a Claude Code session, nested `claude` otherwise misbehaves
  ("transcript saving is off"). Don't strip user config like `ANTHROPIC_*` or `CLAUDE_CODE_USE_*`.
- `document.hidden` is true for an occluded window, so polling pauses; `visibilitychange` and `focus` resume it.
- `state.json` may carry a BOM (PowerShell `Set-Content -Encoding utf8`); the loader strips it.
- Dev run passes the app folder as an argv entry (`electron .`); `pathFromArgv` skips it. A real folder arg
  (`Claude Bench.exe C:\proj`) adds a project and opens a session.
- `electron-builder` needs `electron` in `devDependencies` and `@lydell/**` in `asarUnpack` (native pty).
  Electron's own install script is gated by npm `allow-scripts`; if `node_modules\electron\dist` is missing run
  `node node_modules\electron\install.js`.
- The packaged exe is locked while the app runs, so close it before `npm run package`.
- **Never kill processes by matching the app name in the path**: "Claude Bench" matches the user's real
  packaged `Claude Bench.exe`, and "Claude Terminal" matches this source folder.
  Match `node_modules\electron\dist` to stop only dev instances.
- **Context tile**: the window size is not in the transcript, so the Context tile assumes 200k (1M once a session exceeds it).
  Plan-limit percentages are not on disk; they come from the undocumented usage endpoint (may change).
- A hidden window (`document.hidden`) skips all polling, so when driving a test instance over CDP, override `document.hidden`
  and call `pollSessions()` yourself. Start the test instance with PowerShell `Start-Process`; a plain bash `&` dies with the tool call.
- Windows paths and quoting: PowerShell mangles inline JS with quotes. Put test scripts in files.

## Testing (no framework; drive the real app)

Launch a throwaway instance so real settings stay untouched, with a debug port:

```
node_modules\electron\dist\electron.exe --remote-debugging-port=9333 --user-data-dir=<scratch>\profile .
```

Then use the Chrome DevTools Protocol (Node 22+ has a built-in `WebSocket`) to evaluate JS in the page and call
`Page.captureScreenshot`. Renderer functions are globals (`openSession`, `pollPorts`, `tabs`, `projects`...), so
scripts can open sessions, write to ptys (`api.ptyWrite`), and read xterm buffers. Seed projects by writing
`state.json` in the profile dir (no BOM issues now, but keep it plain). Look at screenshots for any UI change.

## Ideas not built yet

Restore open tabs on relaunch, drag-to-reorder tabs, per-project quick commands, "Open in Claude Bench"
Explorer context menu, notifications when a background session needs input, auto-detect git worktrees.
Only build these when asked.

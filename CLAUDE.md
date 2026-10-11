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
- **Don't fight Claude Code.** Our shortcuts mostly avoid keys it uses (`Ctrl+B/W/J`...); `Ctrl+T` (new session) and `Ctrl+S` (sidebar) are deliberate exceptions. They are `Ctrl+T`, `Ctrl+S`, `Ctrl+Shift+W/S` (close tab, servers),
  `Ctrl+Tab`, `Alt+1..9`.
- Prefer the smallest change that works. No speculative settings screens, plugin systems or abstractions.

## Design rules

The UI follows **shadcn/ui** (dark theme, neutral base) with a few deliberate tweaks. **`DESIGN.md` is the source of
truth: read it before any UI change** and update it in the same change when a rule moves. shadcn is copied as CSS
tokens and component recipes, never installed (no React/Tailwind/Radix).

- Tokens use shadcn names (`--background #0a0a0a`, `--sidebar #030303` = the darker left frame, `--foreground`, `--muted`, `--accent` = neutral hover surface,
  `--border`, `--input`, `--ring`, `--sidebar`...) as CSS variables at the top of `src/styles.css`. Change tokens,
  not scattered values.
- **`--primary` (royal blue `#2850a5`) is the single accent variable.** Hover and ring tints derive from it with
  `color-mix()`, so a future accent setting only sets `--primary`. Never hard-code the blue anywhere else.
- Color otherwise only carries meaning (`--success` running, `--warning` dirty/busy, `--destructive`). No badges,
  gradients or decorative color. Git info is plain text.
- Buttons are `.btn` + `primary|outline|ghost|destructive` + `sm|icon` (rounded-md, no pills). There is no tab
  strip: sidebar session rows are the tabs. Sidebar rows are flat 32 px rounded rows with no borders or boxes.
- Terminal typography and the ANSI palette rules are in DESIGN.md section 5. `XTERM_THEME.background` reads
  `--background`; `titleBarOverlay` / `backgroundColor` in main.js are literals that must match it (`#0a0a0a`).

## Architecture

```
src/main.js      window, ptys, git status, port scan, persistence, IPC handlers
src/preload.js   window.api bridge (contextIsolation on, sandbox on, no nodeIntegration)
src/renderer.js  all UI: tabs (as sidebar rows), sidebar, servers panel, status bar, dialogs, polling
src/index.html   shell + CSP (script-src 'self'); src/styles.css (tokens on :root, see DESIGN.md)
DESIGN.md        design system (shadcn/ui + tweaks): tokens, component recipes, terminal palette rules
scripts/         make-icon.js, create-shortcut.ps1
```

- **State** lives in `%APPDATA%\claude-bench\state.json` (projects, ui flags incl. sidebar widths, window bounds). Written
  synchronously via tmp file + rename. The app used to be "Claude Terminal": if no state exists yet, the loader
  reads `%APPDATA%\claude-terminal\state.json` once (`legacyStateFile`).
- **Sessions**: `cmd.exe /d /c claude [--continue|--resume]` for Claude tabs (resolves `claude.cmd` and
  `claude.exe`), `powershell.exe -NoLogo` for shell tabs. Exit shows a Restart / Close overlay.
  Claude args are allow-listed in main.js.
- **Git**: `git status --porcelain=v2 --branch` with `GIT_OPTIONAL_LOCKS=0`, polled every 4 s from the renderer.
- **Right sidebar** (`#rside`, toggled by the top-bar button or `Ctrl+Shift+S`, saved as `ui.servers`; `renderRside`): the active tab's
  **Context** (`x / yk` + %, same numbers as the footer tile), then collapsible sections (`ui.collapsed`): **MCPs**, **Subagents**, **Running**.
  - MCPs: only connected ones are listed; the rest are behind a "Show N more" row (`mcpMore`, not persisted). `claude mcp list` run in the project folder (main `mcpList`, `cmd.exe /c claude mcp list`, cached 30 s, never overlapping;
    it health-checks every server, so it takes seconds). Output lines `name: target - ✔ Connected | ! Needs authentication | ...` map to
    connected (success) / failed + needs_client_registration (destructive) / needs_auth (warning) / disabled + unknown (muted).
  - Subagents: definitions from `~/.claude/agents/*.md` and `<project>/.claude/agents/*.md` (frontmatter `name`, `model`; `inherit` shows the
    session model) merged with this session's runs from `session:info` (`running` = working dot, finished = check, else idle). A run's
    real model (last `"model"` in its transcript tail) beats the definition's.
  - Running: dev listeners only, from one PowerShell call (`Get-NetTCPConnection` + `Get-CimInstance Win32_Process`) every 6 s. A listener
    belongs to a tab if a session's pty pid is an ancestor; otherwise it is matched to a project if its command line contains the project path
    outside `--flag=` values (Antigravity's `agy.exe --add-dir=<project>` is no server). Rows are status dot, short name, port; clicking a row
    copies `http://localhost:<port>` (rows without a port, or emulators, do nothing). No kill, no "Show all". The scan still walks
    session children for MCP/browser processes (`procs`), which the UI no longer shows.
- **Sessions and usage**: read-only from `~/.claude/projects/<cwd, non-alphanumerics -> "-">/<uuid>.jsonl`. The sidebar lists a
  project's sessions (title = last `ai-title`, else first prompt) under it; clicking one focuses its tab or opens
  `claude --resume <uuid>` (main accepts only a bare UUID as `resumeId`). Lists read just the file tail and cache by
  mtime+size. The sidebar footer row shows plan limits (session / weekly / per-model % and reset times, from `api.anthropic.com/api/oauth/usage`
  using the token in `~/.claude/.credentials.json`, cached 60 s in main, never written), context fill of the active tab's
  session, and tab state. Fresh and `--continue` tabs are matched to their transcript heuristically (`assignSessions`).
  Until a tab's transcript is listed (after the first reply) it shows as an italic "New session" placeholder row;
  PowerShell tabs get a "PowerShell" row. Every open tab has a row (there is no tab strip).
- **Session info** (right side of the status bar for Claude tabs, `session:info`): model = last reply's model or `/model` output in the transcript tail,
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

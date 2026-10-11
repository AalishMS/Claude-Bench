# Claude Bench

Desktop wrapper around the real `claude` CLI (Windows first, macOS best effort). Electron + xterm.js + `@lydell/node-pty`
(ConPTY on Windows).
Each tab is a genuine Claude Code session, so never re-implement CLI features (slash commands, permissions,
model switching). The app only adds what the terminal lacks: a project sidebar, tabs, live git status per
project, and a running-servers panel.

Personal tool for one user on Windows 11, also run on macOS by a friend (never tested here). No Linux, no telemetry,
no auto-update (only a manual Update button for git clones, see "Update").

**Every change must work on both Windows and macOS.** Any new feature or fix that touches processes, paths, shells,
keys, window chrome or fonts needs a Mac path too: a small `IS_MAC` branch next to the Windows code (which stays as it
is), fail-soft so a Mac-only failure never breaks Windows or crashes the app. Shortcuts go through `mod(e)` and their
text through `kbd()`; user-facing "PowerShell" / "Explorer" through `SHELL_LABEL` / `FILES_APP`. Update the macOS
notes below and the README's macOS section in the same change, and tell the user what to test on a Mac.

## Commands

```
npm start            # run from source (fastest loop)
npm run package      # build dist\win-unpacked\Claude Bench.exe (fails if that exe is running)
npm run package:mac  # macOS only: dist/mac-*/Claude Bench.app (unsigned)
npm run shortcut     # Desktop + Start menu shortcuts -> packaged exe
```

The logo master is `assets/icon-source.png` (1024 px, transparent outside the rounded tile); `assets/icon.png` (512 px), the multi-size `assets/icon.ico` and the macOS `assets/icon-mac.png` (tile at 824 px on a 1024 transparent canvas, Apple's grid) are derived from it. There is no `npm run icon` generator.

There is no test suite and no linter. Verify changes by running the app (see "Testing").

## Principles: minimal and fast

- **Keep it small.** No bundler, no framework, no TypeScript, no CSS preprocessor. Plain CommonJS in main/preload
  and a plain browser script in the renderer. xterm is loaded from `node_modules` with `<script>` tags.
  Add a dependency only when the alternative is clearly worse.
- **Fast to start, cheap to run.** No work while the window is hidden (`document.hidden` pauses polling).
  Terminal output is coalesced (6 ms) before IPC. Git/port polling skip overlapping runs. Only re-render DOM
  when data actually changed (`lastSidebarKey`, `JSON.stringify` diffs).
- **Terminal first.** The terminal gets the space and the focus. Chrome around it stays quiet.
- **Don't fight Claude Code.** Our shortcuts mostly avoid keys it uses (`Ctrl+B/W/J`...); `Ctrl+T` (new session), `Ctrl+S` (sidebar) and `Ctrl+W` (close session; costs Claude's delete-word) are deliberate exceptions. The defaults are `Ctrl+T`, `Ctrl+S`, `Ctrl+W` (also `Ctrl+Shift+W`), `Ctrl+Shift+S` (servers),
  `Ctrl+Tab`, `Alt+1..9`, `Ctrl+,` (settings), and for split view `Ctrl+\` (new session beside), `Ctrl+Alt+\` (new session below), `Ctrl+Shift+\` (unsplit),
  `Alt+arrows` (move pane focus) and `Ctrl+Alt+arrows` (move the divider). The two arrow shortcuts only act while split; otherwise the keys reach the terminal.
  On macOS the same shortcuts use Cmd (`⌘1..9` / `⌘arrows` for `Alt+1..9` / `Alt+arrows`), so Ctrl stays entirely Claude's; `Ctrl+Tab` stays.
  All of them are editable on the settings page (see "Shortcuts"); never add a hard-coded app shortcut, add a `SHORTCUTS` entry.
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
scripts/         create-shortcut.ps1, update.ps1 / update.sh (rebuild a packaged copy, see "Update")
```

- **State** lives in `%APPDATA%\claude-bench\state.json`, on macOS in Electron's userData under `~/Library/Application Support` (projects, ui flags incl. sidebar widths and shortcut overrides, window bounds). Written
  synchronously via tmp file + rename. The app used to be "Claude Terminal": if no state exists yet, the loader
  reads `%APPDATA%\claude-terminal\state.json` once (`legacyStateFile`).
- **Restore tabs**: `state.tabs` (`{ project, kind, sessionId }` in tab order) + `state.activeTab`, sent by the renderer's
  `saveTabs` (key-diffed; called from `activate`, `closeTab`, `assignSessions`, `toFront`), never on a timer. Claude tabs
  without a transcript yet are not saved. At launch `state:get` returns `restore` = `restorableTabs()` (drops entries whose
  project is gone or whose `<uuid>.jsonl` is missing, one try/catch per entry); `restoreTabs` creates all tabs, starts the
  active one first, then the rest 400 ms apart (Claude tabs via `--resume <uuid>`, shells fresh). Split view is not saved.
- **Sessions**: `cmd.exe /d /c claude [--continue|--resume]` for Claude tabs (resolves `claude.cmd` and
  `claude.exe`), `powershell.exe -NoLogo` for shell tabs. Exit shows a Restart / Close overlay.
  Claude args are allow-listed in main.js.
- **macOS** (`IS_MAC` in main.js, `IS_MAC`/`mod(e)`/`kbd()` in renderer.js; `api.platform` from preload). Windows code
  stays as is; Mac branches sit next to it and fail soft.
  - Sessions: `claude` is spawned directly, shell tabs run `$SHELL -l`. Both (and `claude mcp list`) wait for
    `shellEnvReady`: the login shell's PATH, since Finder launches get a bare PATH. Capped at 5 s because rc files can
    block (stdin closed, own process group, SIGKILLed on timeout); common folders (Homebrew, `~/.local/bin`) are appended.
  - Port scan: `lsof -F pcn` + `ps -o pid,ppid,etime,args` mapped to the Windows scan's shape (`macScan`; `T` from
    `etime`), so ownership logic and the `parentPid` guard are shared. `macDevName` maps `python3.12` -> `python.exe`
    for `DEV_PROCESSES`.
  - Usage token: Keychain item `Claude Code-credentials` (`security find-generic-password -w`) when the file token is
    missing or expired; a failed read is not retried for 10 minutes (no repeated access dialogs).
  - Window: traffic lights via `trafficLightPosition` (no `titleBarOverlay`); `body.mac` moves the padding to `#brand`.
    Windows uses `assets/icon.ico` for the window and taskbar; macOS uses `assets/icon-mac.png` (padded to Apple's 824/1024 grid so the Dock icon matches its neighbours).
    A minimal app menu (appMenu + editMenu) replaces Electron's default, whose Cmd+W/R/= would clash; the Edit roles
    give Cmd+C/V/A to xterm and inputs. VS Code opens via `open -a "Visual Studio Code"`.
  - Restored tabs: no Mac branch needed (same transcript paths; `samePath` lowercases, which is fine for the default
    case-insensitive APFS). Claude tabs still wait for `shellEnvReady` like any new tab.
  - Notifications: plain Electron `Notification` (no registry step). An unsigned app may show as "Electron" from
    `npm start`; if the user denied permission nothing shows and `notify` swallows any error.
  - Packaged update: `/bin/bash update.sh` detached with the login shell's PATH (after `shellEnvReady`); waits on the
    pid with `kill -0` (20 s, then `kill -9` on that pid only); reopens the bundle (`execPath` three levels up) with `open`. No visible window, so the log is it.
  - Shortcuts: the `SHORTCUTS` defaults use `M` = Cmd and `JUMP` = Cmd (Windows: Ctrl / Alt); `comboText` draws ⌃⌥⇧⌘,
    and the recorder reads `e.code`, so Option's special characters don't matter. `Cmd+Alt+arrows` resizes panes.
  - Terminal: `macOptionIsMeta` (Claude's Option shortcuts), `rightClickSelectsWord: false` (right-click pastes);
    the custom Ctrl+C/V handler is skipped. Labels say "Shell" / "Finder"; tooltips go through `kbd()` (⌘ ⇧ ⌥).
- **Git**: `git status --porcelain=v2 --branch` with `GIT_OPTIONAL_LOCKS=0`, polled every 4 s from the renderer.
- **Update** (people install by cloning): `repoDir()` = the app folder for `npm start`, or the repo above `dist/` for a
  packaged build (walks up to a `.git` + `package.json` named `claude-bench`; a `.app` copied elsewhere finds none).
  `checkUpdate` runs `git fetch` + `rev-list --count HEAD..@{u}` 10 s after start and every 30 min (and on demand via the refresh icon next to the app name, `#check-slot` / `checkNow`, which
  reports "up to date" or git's error, `error` in the result, in `#update-pop`; skipped while
  hidden; `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never` so no credential prompt). If behind, `renderUpdate` shows the
  button in `#update-slot`, and `renderUpdatePop` opens `#update-pop` under it (the newest 5 subjects from
  `git log --format=%s HEAD..@{u}`; Later / Update…, the latter runs `runUpdate`). Dismissing records the `behind` count
  (`updateSeen`, runtime only), so it returns only when more commits arrive or after a restart. Source runs: confirm (lists working tabs), then `applyUpdate` = `git pull --ff-only`,
  `npm install` only if `package.json`/`package-lock.json` changed, `app.relaunch()` + quit. Any failure (local edits,
  diverged branch, npm) shows git's/npm's message and keeps the app running. Packaged builds can't rebuild while running
  (the exe is locked), so `startExternalUpdate` copies `scripts/update.ps1` (`update.sh` on macOS) to the temp folder
  (git pull may rewrite it), starts it detached and quits. The script waits for the app's pid and any process of the same
  exe path to end (20 s, then it force-ends them: a copy that closed its window but never exited keeps the exe locked and
  holds the single-instance lock, so a reopen would quit at once; seen in real use, cause not reproduced; also done
  before the reopen on failure), `git pull --ff-only`, `npm install` if `package(-lock).json` changed, `npm run package[:mac]`, then
  reopens the exe/.app (tabs restore). Windows: a visible console; on failure it shows the error, waits for Enter and
  reopens the old build. macOS: output in `<userData>/update.log`, opened in TextEdit on failure. Test it against a scratch
  clone (junction its `node_modules`), never the real `dist\`.
- **Shortcuts** (`SHORTCUTS` in renderer.js): each action has an id, a label, default combos and `run`. Combos name physical
  keys (`KeyboardEvent.code`, canonical modifier order Ctrl, Alt, Shift, Cmd: `"Ctrl+Shift+KeyT"`), so Shift/Option never
  change the key; `Digits` (1..9) and `Arrows` are patterns whose action gets the number / direction. `runShortcut` (the one
  capture-phase keydown handler) prefers exact combos over patterns; a `run` returning `false` lets the key through. `ui.keys`
  stores only actions that differ from the defaults (main sanitizes it). Tooltips and hints read the live bindings through
  `tip()` / `keyText()`; `keysChanged()` redraws them.
- **Settings page** (`#settings` over `#main`, gear at the left of the sidebar footer or `Ctrl+,`; `toggleSettings` /
  `renderSettings`): for now only Shortcuts. Clicking a chip (or +) records the next combo with Ctrl/Alt/Cmd (or an F key);
  a combo another action uses is moved over (`keysNote` says so). Esc cancels recording, then closes the page; activating
  any tab closes it too.
- **Split view** (runtime only, not saved): `splits` = a list of groups `{ ids, cx, ry, v, color }` (newest first, a tab in at
  most one; `groupOf(id)`, `curSplit()` = the active tab's group). The group on screen shows 2-4 tabs as a grid in `#terminals`
  (2 = A|B, 3 = A|(B over C), 4 = 2x2; `v` = stacked, started by "New session below": 2 = A over B, 3 = A over (B|C), which
  `paneCell` / `cellRect` get by transposing) with draggable dividers. `focusPane(dir)` picks the nearest pane that way,
  `nudgeSplit(dir)` moves a divider by 5 %. The sidebar shows each group in a `.split-group` box (`splitGroup`): inside
  their project's list where the first member sits in tab order, or at the top of `#projects` when they come from different
  projects (rows then show the project name). With several groups each box has its color (`.g0`..`.g4` = `--primary`,
  `--group-1..4`, the lowest free index at creation); a lone group is always `.g0`. Its header shows it, its × `unsplit(g)`. `activeId` is the focused pane, so status bar, right sidebar and
  polling keep following one tab. `visibleIds()` = the active tab's group, else just the active tab (focusing a member of another group
  switches the terminal area to that group). `addToSplit` adds to the visible group or starts a new one with the active tab;
  a tab moving in leaves its old group, and a group of one is dropped. Entry: top-bar button / `Ctrl+\` (`splitHere`, new session beside),
  Ctrl+click a sidebar row (`besideRow`), or drag a sidebar row onto the terminal area or the home screen: `#dropzone` (shown only while
  dragging, `rowDrag` / `wireDropZone`) previews the pane in the resulting layout (`cellRect`; the slot whose pane centre is nearest
  the pointer wins) and the drop places it (`addToSplit(id, at)`). A session already on screen is opened again beside itself (`cloneBeside`: the same
  Claude session resumed in a second pane, or another shell). On the home screen a drop just opens it. `renderSidebar` is paused while dragging. `autoRside` hides the right sidebar while a split pane is under 100 cols and
  restores it at 106+ (predicted from the current cols), without touching `ui.servers`; opening it by hand in a split sets
  `rsideForced` until the split's membership changes. `fitActive` fits every visible pane.
- **Tab order** = order of the `tabs` Map, newest first (Ctrl+Tab, Alt+1..9, saved order). `createTab` puts a new tab
  first (`toFront`, which rebuilds the Map and calls `saveTabs`; `restoreTabs` passes `append` to keep the saved order), and
  `addToSplit` moves the whole group to the front, so a split is on top and unsplitting moves no row. Each project's list
  shows its open tabs first in that order (`tabRow`; a session open twice gets a row per tab), then its other sessions by
  mtime. No drag-to-reorder. Labels ("Project 2", "PowerShell 2") number by `seq` (creation order), not by position, so they
  don't renumber when a tab opens.
- **Closing**: `Ctrl+W`, the top-bar `×` (`#close-tab`) and each pane header's `×` all call `closeTab`. It only asks "End this session?" when
  Claude is working in the tab (`isWorking`) or a dev server started from it is listening (`ports`, owner = this tab); idle tabs close silently.
- **Notifications** (`trackTab` / `notifyTab` in renderer.js, `notify` in main.js): "<project>: Needs input" or
  "<project>: Done", body = the tab's title, only when the window is unfocused or the tab is not the active one. Clicking
  (`showFromNotification`) restores/shows the window and brings it to the front (Windows: a moment of `setAlwaysOnTop`,
  since a plain `focus()` from the background may only flash the taskbar; macOS: `app.focus({ steal: true })`), then
  activates the tab (`notify:click`). Clicks in Notification Center after the toast has gone are not handled: toast XML
  with a launch argument + `Notification.handleActivation` + a `CustomActivator` delivered no clicks at all in testing. `trackTab` runs every 1.5 s even while hidden. A run = a
  stretch of `isWorking`; it is Done after 4 s idle if it lasted 10 s+. Needs input = idle title (`✳`) + an
  `Esc to cancel` footer in the bottom 3 non-empty lines (permission prompt, AskUserQuestion, trust dialog), once per
  dialog; a bell / OSC 9 / OSC 777 also counts unless that idle stretch was already announced. Each notification consumes
  the run, so one event gives one notification. No mute setting (the OS has per-app notification settings).
  Windows: `registerToastIdentity` writes `HKCU\Software\Classes\AppUserModelId\com.local.claudebench` (DisplayName,
  IconUri = a copy of the icon in userData) at every launch, otherwise toasts say "Electron" under `npm start`.
  Windows caches the name at an ID's first toast: if one fired before the key existed, delete
  `HKCU\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings\com.local.claudebench` to reset it.
- **Right sidebar** (`#rside`, toggled by the top-bar button or `Ctrl+Shift+S`, saved as `ui.servers`; `renderRside`): the active tab's
  **Context** (`x / yk` + %, same numbers as the footer tile), then collapsible sections (`ui.collapsed`): **MCPs**, **Subagents**, **Running**.
  - MCPs: only connected ones are listed; the rest are behind a "Show N more" row (`mcpMore`, not persisted). `claude mcp list` run in the project folder (main `mcpList`, `cmd.exe /c claude mcp list`, cached 30 s, never overlapping;
    it health-checks every server, so it takes seconds). Output lines `name: target - ✔ Connected | ! Needs authentication | ...` map to
    connected (success) / failed + needs_client_registration (destructive) / needs_auth (warning) / disabled + unknown (muted).
  - Subagents: definitions from `~/.claude/agents/*.md` and `<project>/.claude/agents/*.md` (frontmatter `name`, `model`; `inherit` shows the
    session model) merged with this session's runs from `session:info` (`running` = working dot, finished = check, else idle). A run's
    real model (last `"model"` in its transcript tail) beats the definition's. Clicking a row opens `agentDialog` (read-only popup in
    `#modal`, Esc / backdrop / × close): the definition's prompt (`agents:prompt`, body after the frontmatter) and the prompt each run of
    that type was given (first line of its `agent-*.jsonl`), each with its own Context bar (a subagent has a separate window; last reply's usage in its transcript, same assumed 200k/1M rule). `assignSessions` also re-points a running tab at a newer unclaimed
    transcript (`/clear` and `/resume` start a new session file in the same tab), otherwise the sidebar reads the old session's `subagents/`.
  - Running: dev listeners only, from one PowerShell call (`Get-NetTCPConnection` + `Get-CimInstance Win32_Process`) every 6 s. A listener
    belongs to a tab if a session's pty pid is an ancestor; otherwise it is matched to a project if its command line contains the project path
    outside `--flag=` values (Antigravity's `agy.exe --add-dir=<project>` is no server). Rows are status dot, short name, port; clicking a row
    copies `http://localhost:<port>` (rows without a port, or emulators, do nothing). No kill, no "Show all". The scan still walks
    session children for MCP/browser processes (`procs`), which the UI no longer shows.
- **Sessions and usage**: read-only from `~/.claude/projects/<cwd, non-alphanumerics -> "-">/<uuid>.jsonl`. The sidebar lists a
  project's sessions (title = last `ai-title`, else first prompt) under it; clicking one focuses its tab or opens
  `claude --resume <uuid>` (main accepts only a bare UUID as `resumeId`). Lists read just the file tail and cache by
  mtime+size. The sidebar footer row shows plan limits (session / weekly / per-model % and reset times, from `api.anthropic.com/api/oauth/usage`
  using the token in `~/.claude/.credentials.json`, cached 2 min in main, never written; a failure blocks requests for its `Retry-After` (429 default 5 min, max 15) and the last good numbers are served as `stale`, because retrying a 429 keeps the limit from clearing), context fill of the active tab's
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

- **Resize a terminal once, and only when its size changes** (`fitTab`). The renderer rounds the cell height, so the fit
  addon's row count can be one too many; `fit.fit()` followed by `rows - 1` resized every tab twice per switch, and each
  pty resize makes Claude repaint its screen (the Ctrl+Tab jitter). `fitTab` computes the final size from
  `proposeDimensions()` and calls `term.resize` at most once.
- **`pty.pid` is 0 right after spawn** on ConPTY. Read `s.pty.pid` lazily at scan time; never cache it.
- **Windows never clears `ParentProcessId`**: when a parent exits, its pid can be reused by an unrelated process, which then looks like
  the child's ancestor (Discord showed up as a dev server of a session this way). The port scan carries each process's creation time
  (`T`) and `parentPid` in main.js ignores a "parent" created after its child. Any new ancestor walk must use it.
- **Strip session markers from the child env** (`STRIP_ENV` in main.js: `CLAUDECODE`, `CLAUDE_CODE_*` session
  vars). If the app is started from inside a Claude Code session, nested `claude` otherwise misbehaves
  ("transcript saving is off"). Don't strip user config like `ANTHROPIC_*` or `CLAUDE_CODE_USE_*`.
- `document.hidden` is true for an occluded window, so polling pauses; `visibilitychange` and `focus` resume it.
- **A detached PowerShell dies at once**: Node's `detached: true` on Windows means no console, and powershell.exe 5.1
  exits without one. Start it through `cmd /d /s /c "start "title" powershell.exe ..."` (`windowsVerbatimArguments`),
  as `startExternalUpdate` does; it gets its own console and outlives the app.
- **The updater must not run with its cwd inside `dist\win-unpacked`**: the shortcuts start the exe there, a child inherits
  that working directory, and Windows won't delete a folder that is some process's cwd, so electron-builder failed with
  `EBUSY ... rmdir dist\win-unpacked` and the old build reopened (the app then says "up to date", since `checkUpdate`
  compares the checkout, not the build). `startExternalUpdate` spawns with `cwd: os.tmpdir()` and `update.ps1` calls
  `[IO.Directory]::SetCurrentDirectory($env:TEMP)` (`Set-Location` only moves PowerShell's own location, not the process's).
  `update.ps1` is copied to temp *before* `git pull`, so a fix to it only applies from the update after it lands.
  macOS is not affected (cwd doesn't block deletion there).
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
- **Claude sends no bell by default.** With its default notification channel it emits neither BEL nor OSC 9 in our
  terminal (tested on v2.1.296), and a pending tool call is not in the transcript until it has run. That's why "needs
  input" reads the screen footer. If Claude's dialog footers change wording, update `awaitingInput`.
- **Context tile**: the window size is not in the transcript, so `contextWindow(model, used)` in renderer.js derives it from the model id or display name: 1M for current models (Opus/Sonnet 4.6+, Haiku 5+, Fable, Mythos, anything unrecognised) or a `[1m]` model, 200k for Claude 3, Haiku 4.x and Opus/Sonnet up to 4.5 (1M once a session exceeds it). The main tab, the footer tile and each subagent run in the agent popup all use it, each with its own model. Update it when a new model family ships with a different window.
  Plan-limit percentages are not on disk; they come from the undocumented usage endpoint (may change).
- A hidden window (`document.hidden`) skips all polling, so when driving a test instance over CDP, override `document.hidden`
  and call `pollSessions()` yourself. Start the test instance with PowerShell `Start-Process`; a plain bash `&` dies with the tool call.
- Windows paths and quoting: PowerShell mangles inline JS with quotes. Put test scripts in files.
- macOS can't be tested here: keep Mac branches plain and fail-soft, and run `node --check` plus a parser test on sample
  `lsof`/`ps` output. On Mac, node-pty's `spawn-helper` may lose its execute bit after install (`posix_spawnp failed`).

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

Per-project quick commands, "Open in Claude Bench"
Explorer context menu, auto-detect git worktrees.
Only build these when asked.

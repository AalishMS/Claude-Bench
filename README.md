# Claude Bench

A desktop wrapper around the real `claude` CLI (Electron + xterm.js + node-pty, ConPTY on Windows). Each tab is a
genuine Claude Code session, so slash commands, permissions and speed are unchanged. Windows first; macOS is best effort.

- **Projects sidebar**: pin folders, one click opens a Claude session there. Buttons for a new session,
  `claude --continue`, and a shell tab (PowerShell on Windows, your login shell on macOS).
- **Git per project**: branch, clean/changed count, ahead/behind. Refreshes every 4 s.
- **Servers panel** (`Ctrl+Shift+S`): listening TCP ports, grouped by project. Servers started from a tab are
  matched by process ancestry. Hover a row to open it in the browser or stop it.
- **Tabs come back**: open tabs are reopened on the next launch (Claude tabs resume their session with
  `claude --resume`, shell tabs start fresh). A Claude tab is remembered once it has its first reply.
- **Newest first**: open sessions sit at the top of their project's list, the newest on top; `Alt+1` is the newest tab.
  The order is kept across restarts.
- **Split groups**: you can have several splits at once. Each shows as a box in the sidebar (its own color when there
  are several); clicking one of its sessions brings that split back on screen. Splits come back after a restart too.
- **File links**: paths Claude prints (`src/main.js:123`, `C:\code\app\x.ts:4:2`) open with Ctrl+click (⌘-click on macOS, like web links) when the file exists
  in the project, and open in VS Code at that line (else in the default app).
- **Fork a session**: right-click a session in the sidebar for "Fork session" (`claude --resume <id> --fork-session`), a
  copy under a new id to try another approach. Opening a session that is already on screen beside itself forks it too.
- **Resume after exit**: when a Claude tab exits, the overlay offers Resume (the same session) or New session.
- **Projects**: drag a project row to reorder the list (or "Move to top" in its `…` menu). Two folders with the same
  name show their parent folder (`app (clients)`), also in tab labels and notifications.
- **Running servers**: click a row to copy `http://localhost:<port>`, Shift+click to open it in the browser.
- **Notifications**: a Claude session in the background (or any session while the window is unfocused) notifies
  "Needs input" when it shows a permission prompt or a question, and "Done" when a task of 10 s or more finishes.
  Click it to jump to that tab. Mute them in the OS notification settings.
- **Tab indicators**: yellow = producing output in the background, orange = bell / session ended.

## Run

```
npm install
npm start                # run from source
npm run package          # build dist\win-unpacked\Claude Bench.exe
npm run shortcut         # Desktop + Start menu shortcuts (uses the packaged exe if present)
```

`Claude Bench.exe C:\some\folder` adds that folder as a project and opens a session in it.

### macOS (best effort, not tested by the author)

Needs the `claude` CLI installed and logged in, and git (Xcode Command Line Tools: `xcode-select --install`).

```
npm install
npm start                # run from source
npm run package:mac      # build dist/mac-*/Claude Bench.app (unsigned, for your own machine)
```

- Shortcuts use `⌘` where the table below says `Ctrl` (`⌘1`..`9` and `⌘`+arrows instead of `Alt+1`..`9` and
  `Alt`+arrows, `⌘⌥`+arrows to resize panes, `⌘⌥\` for a split below, `⌘,` for settings, `⌘⌥I` for DevTools). `Ctrl+Tab` stays. `Ctrl` itself is left to Claude Code (`Ctrl+C` interrupts, `Ctrl+V` pastes
  images). Copy/paste is `⌘C` / `⌘V` or right-click. Option acts as Meta, so Claude's `Option+P`/`Option+T` work.
- Claude and shell tabs use the PATH of your login shell (`$SHELL -l`), so the app finds `claude` and `node` even when
  started from Finder. A shell startup file that blocks delays the first tab by at most 5 s.
- Open tabs are restored on relaunch as on Windows; restored Claude tabs wait for the login shell's PATH like new ones.
- File links open with the `code` command if it is on your login shell's PATH (VS Code: "Shell Command: Install 'code'
  command in PATH"), at the line; otherwise VS Code opens the file without the line, or the default app.
- Notifications use macOS Notification Center; allow them for the app (or Electron, under `npm start`) when asked.
- The macOS app icon uses `assets/icon-mac.png` (the tile padded to Apple's 824/1024 grid); Windows uses the multi-size ICO for its window and taskbar.
- Plan limits in the footer read Claude Code's token from the Keychain; macOS may ask once for access.
- If electron is missing after `npm install`: `node node_modules/electron/install.js`.
- If tabs fail with `posix_spawnp failed`: `chmod +x node_modules/@lydell/node-pty-darwin-*/spawn-helper`.
- If macOS says the built app is damaged: `codesign --force --deep -s - "dist/mac-arm64/Claude Bench.app"`.

## Updating

When the repo you cloned has new commits, a download icon appears at the top of the sidebar, next to "Claude Bench",
and a popup under it lists what's new with **Later** and **Update…** buttons. It comes back when more commits arrive.

- **Running with `npm start`:** click it. The app pulls the update, runs `npm install` if dependencies changed, and
  restarts (open sessions end; it asks first if Claude is working). If you edited files locally and they clash with the
  update, it stops and shows git's message.
- **Running a built copy (`.exe` / `.app`):** it can't rebuild itself while open, so Update closes it and hands over to
  `scripts/update.ps1` (`update.sh` on macOS): it pulls, runs `npm install` if needed, rebuilds with `npm run package`
  (`package:mac`), and reopens the app with your tabs. If the app hasn't fully exited after 20 seconds, the script
  ends it (only that copy). On Windows a console window shows the progress; on macOS, if
  something fails, the log opens in TextEdit. Doing it by hand: close the app, `git pull`, then `npm run package`.

Your projects and settings are stored outside the repo, so updating keeps them.

## Shortcuts

| Keys | Action |
| --- | --- |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | next / previous tab |
| `Alt+1`..`9` | jump to tab |
| `Ctrl+T` (or `Ctrl+Shift+T`) / `Ctrl+W` | new session in current project / close session (asks only if Claude is working or a dev server is running) |
| `Ctrl+\` / `Ctrl+Alt+\` / `Ctrl+Shift+\` | split: new session beside / below / back to one terminal (or drag a sidebar session onto the terminal) |
| `Alt+arrows` / `Ctrl+Alt+arrows` | split: focus the pane in that direction / move the divider (only while split) |
| `Ctrl+S` (or `Ctrl+Shift+B`) / `Ctrl+Shift+S` | toggle sidebar / servers panel |
| `Ctrl+,` | settings |
| `Ctrl+C` (with selection), `Ctrl+V`, right-click | copy / paste |

All app shortcuts (everything above except copy/paste) can be changed on the settings page: the gear at the bottom of
the sidebar. The defaults avoid keys Claude Code uses itself (`Ctrl+B`, `Ctrl+J`, ...), except `Ctrl+T`, `Ctrl+S` and `Ctrl+W`.
Drop files onto a terminal to paste their paths. `F12` opens DevTools.

## Layout

- `src/main.js`: window, ptys, git status, port scan (PowerShell; `lsof` + `ps` on macOS), persistence in
  `state.json` under Electron's user data folder (`%APPDATA%\claude-bench`; `~/Library/Application Support/...` on macOS)
- `src/preload.js`: the small `window.api` bridge (context isolation is on)
- `src/renderer.js`, `index.html`, `styles.css`: the UI
- `scripts/`: shortcut creator and packaged update helpers
- `assets/`: C3 logo master (`icon-source.png`, 1024 px), app PNG (512 px), Windows ICO (16–256 px) and the padded macOS PNG (`icon-mac.png`); all have transparent corners; replace these together. There is no `npm run icon` generator.

# Claude Bench

A desktop wrapper around the real `claude` CLI (Electron + xterm.js + node-pty, ConPTY on Windows). Each tab is a
genuine Claude Code session, so slash commands, permissions and speed are unchanged. Windows first; macOS is best effort.

- **Projects sidebar**: pin folders, one click opens a Claude session there. Buttons for a new session,
  `claude --continue`, and a shell tab (PowerShell on Windows, your login shell on macOS).
- **Git per project**: branch, clean/changed count, ahead/behind. Refreshes every 4 s.
- **Servers panel** (`Ctrl+Shift+S`): listening TCP ports, grouped by project. Servers started from a tab are
  matched by process ancestry. Hover a row to open it in the browser or stop it.
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

- Shortcuts use `⌘` where the table below says `Ctrl` (`⌘1`..`9` instead of `Alt+1`..`9`, `⌘⌥←/→` for panes,
  `⌘⌥I` for DevTools). `Ctrl+Tab` stays. `Ctrl` itself is left to Claude Code (`Ctrl+C` interrupts, `Ctrl+V` pastes
  images). Copy/paste is `⌘C` / `⌘V` or right-click. Option acts as Meta, so Claude's `Option+P`/`Option+T` work.
- Claude and shell tabs use the PATH of your login shell (`$SHELL -l`), so the app finds `claude` and `node` even when
  started from Finder. A shell startup file that blocks delays the first tab by at most 5 s.
- Plan limits in the footer read Claude Code's token from the Keychain; macOS may ask once for access.
- If electron is missing after `npm install`: `node node_modules/electron/install.js`.
- If tabs fail with `posix_spawnp failed`: `chmod +x node_modules/@lydell/node-pty-darwin-*/spawn-helper`.
- If macOS says the built app is damaged: `codesign --force --deep -s - "dist/mac-arm64/Claude Bench.app"`.

## Shortcuts

| Keys | Action |
| --- | --- |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | next / previous tab |
| `Alt+1`..`9` | jump to tab |
| `Ctrl+T` (or `Ctrl+Shift+T`) / `Ctrl+W` | new session in current project / close session (asks only if Claude is working or a dev server is running) |
| `Ctrl+\` / `Ctrl+Shift+\` | split: new session beside / back to one terminal (or drag a sidebar session onto the terminal) |
| `Ctrl+S` (or `Ctrl+Shift+B`) / `Ctrl+Shift+S` | toggle sidebar / servers panel |
| `Ctrl+C` (with selection), `Ctrl+V`, right-click | copy / paste |

These deliberately avoid keys Claude Code uses itself (`Ctrl+B`, `Ctrl+J`, ...), except `Ctrl+T`, `Ctrl+S` and `Ctrl+W`.
Drop files onto a terminal to paste their paths. `F12` opens DevTools.

## Layout

- `src/main.js`: window, ptys, git status, port scan (PowerShell; `lsof` + `ps` on macOS), persistence in
  `state.json` under Electron's user data folder (`%APPDATA%\claude-bench`; `~/Library/Application Support/...` on macOS)
- `src/preload.js`: the small `window.api` bridge (context isolation is on)
- `src/renderer.js`, `index.html`, `styles.css`: the UI
- `scripts/`: icon generator and shortcut creator

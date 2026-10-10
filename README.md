# Claude Terminal

A desktop wrapper around the real `claude` CLI (Electron + xterm.js + ConPTY). Each tab is a genuine
Claude Code session, so slash commands, permissions and speed are unchanged.

- **Projects sidebar**: pin folders, one click opens a Claude session there. Buttons for a new session,
  `claude --continue`, and a PowerShell tab.
- **Git per project**: branch, clean/changed count, ahead/behind. Refreshes every 4 s.
- **Servers panel** (`Ctrl+Shift+S`): listening TCP ports, grouped by project. Servers started from a tab are
  matched by process ancestry. Hover a row to open it in the browser or stop it.
- **Tab indicators**: yellow = producing output in the background, orange = bell / session ended.

## Run

```
npm install
npm start                # run from source
npm run package          # build dist\win-unpacked\Claude Terminal.exe
npm run shortcut         # Desktop + Start menu shortcuts (uses the packaged exe if present)
```

`Claude Terminal.exe C:\some\folder` adds that folder as a project and opens a session in it.

## Shortcuts

| Keys | Action |
| --- | --- |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | next / previous tab |
| `Alt+1`..`9` | jump to tab |
| `Ctrl+Shift+T` / `Ctrl+Shift+W` | new session in current project / close tab |
| `Ctrl+Shift+B` / `Ctrl+Shift+S` | toggle sidebar / servers panel |
| `Ctrl+C` (with selection), `Ctrl+V`, right-click | copy / paste |

These deliberately avoid keys Claude Code uses itself (`Ctrl+B`, `Ctrl+T`, `Ctrl+W`, ...).
Drop files onto a terminal to paste their paths. `F12` opens DevTools.

## Layout

- `src/main.js`: window, ptys, git status, port scan (PowerShell), persistence in `%APPDATA%\claude-terminal\state.json`
- `src/preload.js`: the small `window.api` bridge (context isolation is on)
- `src/renderer.js`, `index.html`, `styles.css`: the UI
- `scripts/`: icon generator and shortcut creator

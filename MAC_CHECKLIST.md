# macOS test checklist

Claude Bench is built and tested on Windows. The macOS code has never run on a real Mac, so this list covers
everything that needs checking there. Tick what works. For anything that fails, note what you did and any error text.

## Setup

- [ ] The `claude` CLI is installed and logged in (`claude` works in Terminal).
- [ ] `git` works. If it doesn't, run `xcode-select --install`.
- [ ] Clone and install:
  ```
  git clone https://github.com/AalishMS/Claude-Bench.git
  cd Claude-Bench
  npm install
  ```
- [ ] If `node_modules/electron/dist` is missing after `npm install`, run `node node_modules/electron/install.js`.
- [ ] `npm start` opens the app. Add a project folder with the folder-plus button at the bottom of the sidebar.

## Basics

- [ ] The window buttons (red/yellow/green) sit neatly at the top left and don't overlap the logo, with the sidebar
      shown and hidden (⌘S).
- [ ] A Claude tab starts. If it fails with `posix_spawnp failed`, run
      `chmod +x node_modules/@lydell/node-pty-darwin-*/spawn-helper` and try again.
- [ ] A shell tab (terminal button in the top bar) opens your usual shell and prompt. Its sidebar row says "Shell".
- [ ] The project shows its git branch and changed-file count.
- [ ] Start a dev server from a tab (for example `npx vite`). It appears under **Running** in the right sidebar
      (⌘⇧S), and clicking the row copies its URL.
- [ ] The right sidebar lists MCP servers.
- [ ] The sidebar footer shows plan usage percentages. macOS may ask once for Keychain access. If you deny it, the
      dialog must not come back for 10 minutes.
- [ ] The VS Code button opens the project in VS Code, and the folder button opens it in Finder.

## Keys

- [ ] ⌘T new session, ⌘W close, ⌘S sidebar, ⌘⇧S right sidebar
- [ ] ⌘\ split, ⌘⇧\ unsplit, ⌘⌥← / ⌘⌥→ move between panes
- [ ] ⌘1–9 jump to a tab, Ctrl+Tab next tab
- [ ] ⌘= / ⌘- / ⌘0 font size
- [ ] ⌘C / ⌘V copy and paste in the terminal and in the search box
- [ ] Right-click in a terminal pastes (and doesn't copy a word instead)
- [ ] Ctrl+C interrupts Claude, and Ctrl+V pastes an image into Claude
- [ ] Option+P opens Claude's model picker
- [ ] ⌘-click a session in the sidebar opens it beside the current one
- [ ] ⌘⌥I opens DevTools
- [ ] ⌘Q quits, and asks first only if Claude is working

## Restored tabs

- [ ] Open a few tabs across projects: at least one Claude tab you've sent a message in, one Claude tab you haven't
      written in yet, and a shell tab. Quit (⌘Q) and start the app again.
- [ ] The tabs come back in the same order, and the tab that was active is active again.
- [ ] Restored Claude tabs show their earlier conversation (they resume with `claude --resume`). The Claude tab with no
      message yet is not restored. The shell tab comes back as a fresh shell.
- [ ] The first tab appears right away and the others follow over a second or two. The app doesn't stall at startup.
- [ ] In the built `.app` opened from Finder, restored Claude tabs start too (they need your shell's PATH).

## Notifications

- [ ] The first time a notification fires, macOS asks whether to allow notifications (for "Electron" when running
      `npm start`). Allow it.
- [ ] In a background Claude tab (switch to another tab), ask Claude for something that needs permission (in manual
      mode: ⇧Tab until the footer says "manual mode", then ask it to run a shell command). Exactly one notification
      "<project>: Needs input" appears, with the session title as its text.
- [ ] Ask a background Claude tab for a task that takes more than 10 seconds (for example "run sleep 15 in the shell,
      then say finished"). Exactly one "<project>: Done" notification appears when it finishes, and no second one a
      minute later.
- [ ] A quick reply (under 10 seconds) in a background tab gives no notification.
- [ ] With the app in the foreground on that same tab, nothing is shown. With another app in front, notifications
      appear even for the active tab.
- [ ] Clicking a notification brings Claude Bench to the front, focused, on that tab: with another app in front, and
      with the window minimized (⌘M).
- [ ] Deny notifications in System Settings → Notifications, then repeat a "Done" case: nothing shows and the app
      keeps working normally.

## Reorder tabs

- [ ] Open tabs sit at the top of their project's list in the sidebar.
- [ ] Drag an open tab's row up or down within its project: a thin blue line shows where it will land, and dropping
      moves it. ⌘1–9 and Ctrl+Tab follow the new order.
- [ ] Dragging onto a row of a different project, or onto a session that isn't open, shows no line and changes nothing.
- [ ] Dragging a row onto the terminal area still opens it in a split pane.
- [ ] Quit and restart: the new order is kept.

## Opened from Finder

Apps opened from Finder don't get your shell's PATH, so this checks the fix for that.

- [ ] `npm run package:mac`, then open `dist/mac-*/Claude Bench.app` from Finder.
- [ ] If macOS says the app is damaged, run `codesign --force --deep -s - "dist/mac-arm64/Claude Bench.app"`.
- [ ] Claude tabs and the MCP list work in the built app.
- [ ] If your `~/.zshrc` is slow or asks a question at startup, the first tab still opens within about 5 seconds.

## Update button

Needs a new commit on `main` to show up.

- [ ] In the copy you run with `npm start`, a download icon appears next to "Claude Bench" at the top of the sidebar
      within 30 minutes, or right away after restarting the app.
- [ ] Clicking it and confirming pulls the update and restarts the app.
- [ ] In the built `.app`, clicking it shows a dialog that copies the update command instead.

## Updating later

- Running with `npm start`: use the Update button, or run `git pull` then `npm install`.
- Running the built app: close it, run `git pull` then `npm run package:mac`, and open the new `.app`.
- Projects and settings are stored outside the repo, so updating keeps them.

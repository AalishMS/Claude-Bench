#!/bin/bash
# Installs Claude Bench (macOS): clones the repo, builds the app and links it into ~/Applications. Running it again
# updates that copy. Meant to be piped from the web:
#
#   curl -fsSL https://raw.githubusercontent.com/AalishMS/Claude-Bench/main/scripts/install.sh | bash
#
# Installs to ~/.claude-bench, or to $CLAUDE_BENCH_DIR if set. The .app stays inside the clone (the Update button
# finds the repo by walking up from it), so ~/Applications only gets a link. Everything is in main(), called on the
# last line, so a download cut short runs nothing.

set -e

main() {
  REPO_URL=https://github.com/AalishMS/Claude-Bench.git
  DIR="${CLAUDE_BENCH_DIR:-$HOME/.claude-bench}"

  fail() { printf '\n\033[31m%s\033[0m\n' "$1" >&2; exit 1; }
  step() { printf '\n\033[36m> %s\033[0m\n' "$1"; }

  [ "$(uname)" = Darwin ] || fail "This installer is for macOS. On Windows use install.ps1 (see the README)."
  # Without the command line tools /usr/bin/git is a stub that fails (and offers to install them).
  git --version >/dev/null 2>&1 || fail "git is not installed. Run: xcode-select --install, then run this again."
  command -v node >/dev/null && command -v npm >/dev/null \
    || fail "Node.js is not installed. Install it (brew install node, or nodejs.org), then run this again."
  MAJOR=$(node -v | sed -E 's/^v([0-9]+).*/\1/')
  [ "$MAJOR" -ge 20 ] || fail "Node.js $(node -v) is too old; Claude Bench needs 20 or newer."
  command -v claude >/dev/null \
    || printf '\033[33mNote: the claude CLI was not found. Install it and log in before opening a session: https://claude.com/claude-code\033[0m\n'

  # The app can't be rebuilt while it runs. Matched on this install's path, never on the name.
  pgrep -f "$DIR/dist/" >/dev/null && fail "Claude Bench is running from this install. Quit it and run this again."

  if [ -d "$DIR/.git" ]; then
    cd "$DIR"
    # Same as update.sh: a dirty lockfile (npm rewrites it) makes the pull abort.
    git checkout HEAD -- package-lock.json 2>/dev/null || true
    step "git pull --ff-only   ($DIR)"
    git pull --ff-only || fail "git pull failed (see above)."
  elif [ -e "$DIR" ] && [ -n "$(ls -A "$DIR")" ]; then
    fail "$DIR already exists and is not a Claude Bench clone. Move it away, or set CLAUDE_BENCH_DIR to another folder."
  else
    step "git clone $REPO_URL \"$DIR\""
    git clone "$REPO_URL" "$DIR" || fail "git clone failed (see above)."
    cd "$DIR"
  fi

  step "npm install"
  npm install || fail "npm install failed (see above). Fix it, then run this again."
  # npm's allow-scripts gate can skip Electron's own download.
  [ -d node_modules/electron/dist ] || node node_modules/electron/install.js
  # node-pty's helper can lose its execute bit on install (tabs then fail with posix_spawnp failed).
  chmod +x node_modules/@lydell/node-pty-darwin-*/spawn-helper 2>/dev/null || true

  step "npm run package:mac"
  npm run package:mac || fail "The build failed (see above). Run this again to retry."

  APP=""
  for a in "$DIR"/dist/mac*/"Claude Bench.app"; do [ -d "$a" ] && APP="$a" && break; done
  [ -n "$APP" ] || fail "The build finished but Claude Bench.app was not found under $DIR/dist."

  LINK="$HOME/Applications/Claude Bench.app"
  if [ -e "$LINK" ] && [ ! -L "$LINK" ]; then
    printf '\033[33m%s is a real app, not a link to this install; left it alone.\033[0m\n' "$LINK"
  else
    mkdir -p "$HOME/Applications" && ln -sfn "$APP" "$LINK" \
      || printf '\033[33mCould not link the app into ~/Applications; open it from %s\033[0m\n' "$APP"
  fi

  printf '\n\033[32mClaude Bench is installed in %s\033[0m\n' "$DIR"
  echo "Open it from ~/Applications (drag it to the Dock to keep it). It updates itself from the Update button; running this command again does the same."
  echo "To uninstall, delete that folder and ~/Applications/Claude Bench.app."
  open "$APP"
}

main

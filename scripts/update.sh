#!/bin/bash
# Updates a built copy of Claude Bench (macOS). Started by the app's Update button, which then quits, because the
# app can't be rebuilt while it runs. Runs from a temp copy, since git pull may rewrite this file. Output goes to a log,
# which opens in TextEdit if something fails.
#
#   update.sh <checkout> <app pid> <path to Claude Bench.app> <log file>

REPO="$1"; APP_PID="$2"; APP="$3"; LOG="$4"
exec >"$LOG" 2>&1

finish() {
  if [ -n "$1" ]; then echo; echo "$1"; open -t "$LOG"; fi
  [ -d "$APP" ] && open "$APP"
  exit $([ -n "$1" ] && echo 1 || echo 0)
}

echo "Waiting for Claude Bench to close..."
for _ in $(seq 1 120); do kill -0 "$APP_PID" 2>/dev/null || break; sleep 0.5; done
kill -0 "$APP_PID" 2>/dev/null && finish "Claude Bench is still running. Close it, then run git pull and npm run package:mac in the repo folder."

cd "$REPO" || finish "Repo folder not found: $REPO"
before=$(git rev-parse HEAD)

echo "> git pull --ff-only"
git pull --ff-only || finish "git pull failed (see above). Nothing was changed; reopening the app."

if git diff --name-only "$before" HEAD | grep -qE '^package(-lock)?\.json$'; then
  echo "> npm install"
  npm install || finish "npm install failed (see above). Run it in the repo folder, then npm run package:mac."
fi

echo "> npm run package:mac"
npm run package:mac || finish "The build failed (see above). Run npm run package:mac in the repo folder to retry."

echo "Updated."
finish ""

'use strict';
// One-time hand-off from the app's old name, Claude Bench. The Update button of an old build runs its own copy of
// update.ps1 / update.sh (taken before the pull), which runs `npm run package` from the new package.json and then
// reopens the old exe/.app path, which this build no longer makes. So `npm run package[:mac]` runs this around
// electron-builder: `before` notes an old build in dist/, `after` removes it (so nothing reopens the old app), points
// the old shortcuts / ~/Applications link at the new build and opens it. Fail-soft: a failure only prints a warning.
// Remove once no Claude Bench builds are left.
//
//   node scripts/rename-handoff.js before|after

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const IS_MAC = process.platform === 'darwin';
const dist = path.join(__dirname, '..', 'dist');
const marker = path.join(dist, '.claude-bench-handoff'); // survives a failed build, so the retry still hands off

/** Built bundles named `<name>.app` under dist/mac* (mac, mac-arm64, mac-universal...). */
function bundles(name) {
  try {
    return fs.readdirSync(dist).filter((d) => d.startsWith('mac'))
      .map((d) => path.join(dist, d, `${name}.app`)).filter((p) => fs.existsSync(p));
  } catch { return []; }
}
const oldExe = path.join(dist, 'win-unpacked', 'Claude Bench.exe');
const oldBuilds = () => (IS_MAC ? bundles('Claude Bench') : [oldExe].filter((p) => fs.existsSync(p)));

function win() {
  fs.rmSync(oldExe, { force: true }); // electron-builder clears win-unpacked, but the old updater must not find one
  const exe = path.join(dist, 'win-unpacked', 'Stanza.exe');
  if (!fs.existsSync(exe)) return;
  // Only shortcuts that start this clone's old exe: a scratch clone must not take over the real ones.
  const ps = "$s = New-Object -ComObject WScript.Shell; foreach ($d in @([Environment]::GetFolderPath('Desktop'), " +
    "[Environment]::GetFolderPath('Programs'))) { $p = Join-Path $d 'Claude Bench.lnk'; " +
    'if (Test-Path $p) { Write-Output $s.CreateShortcut($p).TargetPath } }';
  const targets = execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8', windowsHide: true })
    .split(/\r?\n/).filter(Boolean);
  if (targets.some((t) => path.resolve(t).toLowerCase() === oldExe.toLowerCase())) {
    execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'create-shortcut.ps1')],
      { stdio: 'inherit' });
  }
  if (oldRunning()) return;
  // Not from inside dist\win-unpacked: a process's cwd there blocks the next rebuild (see update.ps1).
  spawn(exe, [], { cwd: os.homedir(), detached: true, stdio: 'ignore' }).unref();
}

/**
 * A Claude Bench still open anywhere (a manual build in another clone): opening Stanza next to it would resume the same
 * sessions in two processes. The Update button's run never hits this, since its updater waits for the app to exit.
 */
function oldRunning() {
  try {
    if (IS_MAC) { execFileSync('pgrep', ['-x', 'Claude Bench']); return true; } // exits 1 (throws) when none
    return execFileSync('tasklist.exe', ['/FI', 'IMAGENAME eq Claude Bench.exe', '/NH'], { encoding: 'utf8', windowsHide: true })
      .toLowerCase().includes('claude bench.exe');
  } catch { return false; }
}

function mac() {
  for (const b of bundles('Claude Bench')) fs.rmSync(b, { recursive: true, force: true });
  const app = bundles('Stanza')[0];
  if (!app) return;
  // install.sh's link, if it points into this clone; a real app at either path is left alone.
  const apps = path.join(os.homedir(), 'Applications');
  const oldLink = path.join(apps, 'Claude Bench.app');
  let ours = false;
  try { ours = fs.lstatSync(oldLink).isSymbolicLink() && path.resolve(apps, fs.readlinkSync(oldLink)).startsWith(dist + path.sep); } catch { /* no link */ }
  if (ours) {
    fs.unlinkSync(oldLink);
    try { fs.symlinkSync(app, path.join(apps, 'Stanza.app')); } catch { /* already there */ }
  }
  if (!oldRunning()) spawn('open', [app], { detached: true, stdio: 'ignore' }).unref();
}

if (process.argv[2] === 'before') {
  if (oldBuilds().length) fs.writeFileSync(marker, '');
} else if (fs.existsSync(marker)) {
  try {
    if (IS_MAC) mac(); else win();
    console.log('Moved from Claude Bench to Stanza.');
  } catch (e) {
    console.warn(`Moving from Claude Bench to Stanza: ${e.message}`);
  }
  fs.rmSync(marker, { force: true });
}

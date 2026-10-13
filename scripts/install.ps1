# Installs Claude Bench (Windows): clones the repo, builds the app and adds Desktop and Start menu shortcuts. Running
# it again updates that copy. Meant to be piped from the web:
#
#   irm https://raw.githubusercontent.com/AalishMS/Claude-Bench/main/scripts/install.ps1 | iex
#
# Installs to %LOCALAPPDATA%\Programs\claude-bench, or to $env:CLAUDE_BENCH_DIR if set. It runs inside the caller's
# PowerShell (iex), so everything sits in a script block: no variables leak, and a failure never closes the window.

& {
    $repoUrl = 'https://github.com/AalishMS/Claude-Bench.git'
    $dir = if ($env:CLAUDE_BENCH_DIR) { $env:CLAUDE_BENCH_DIR } else { Join-Path $env:LOCALAPPDATA 'Programs\claude-bench' }
    $dir = [IO.Path]::GetFullPath($dir)
    $exe = Join-Path $dir 'dist\win-unpacked\Claude Bench.exe'
    $oldCwd = [IO.Directory]::GetCurrentDirectory()

    function Step([string]$text) { Write-Host "`n> $text" -ForegroundColor Cyan }
    function Has([string]$cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

    Push-Location
    try {
        # npm.cmd, not npm: the npm.ps1 shim fails under the default execution policy.
        if (-not (Has git)) { throw 'git is not installed. Install it (winget install Git.Git), open a new PowerShell window and run this again.' }
        if (-not (Has node) -or -not (Has npm.cmd)) { throw 'Node.js is not installed. Install it (winget install OpenJS.NodeJS.LTS), open a new PowerShell window and run this again.' }
        $major = [int]((node -v) -replace '^v(\d+).*', '$1')
        if ($major -lt 20) { throw "Node.js $(node -v) is too old; Claude Bench needs 20 or newer (winget upgrade OpenJS.NodeJS.LTS)." }
        if (-not (Has claude)) { Write-Host 'Note: the claude CLI was not found. Install it and log in before opening a session: https://claude.com/claude-code' -ForegroundColor Yellow }

        # The exe can't be rebuilt while it runs. Matched on this install's path, never on the name.
        $exeDir = (Split-Path -Parent $exe) + '\'
        if (Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($exeDir, [StringComparison]::OrdinalIgnoreCase) }) {
            throw 'Claude Bench is running from this install. Close it and run this again.'
        }

        if (Test-Path (Join-Path $dir '.git')) {
            Set-Location -LiteralPath $dir
            # Same as update.ps1: a dirty lockfile (npm rewrites it) makes the pull abort.
            git checkout HEAD -- package-lock.json 2>$null
            Step "git pull --ff-only   ($dir)"
            git pull --ff-only
            if ($LASTEXITCODE) { throw 'git pull failed (see above).' }
        } elseif ((Test-Path $dir) -and (Get-ChildItem -Force -LiteralPath $dir | Select-Object -First 1)) {
            throw "$dir already exists and is not a Claude Bench clone. Move it away, or set CLAUDE_BENCH_DIR to another folder."
        } else {
            Step "git clone $repoUrl `"$dir`""
            git clone $repoUrl $dir
            if ($LASTEXITCODE) { throw 'git clone failed (see above).' }
            Set-Location -LiteralPath $dir
        }
        [IO.Directory]::SetCurrentDirectory($dir)

        Step 'npm install'
        npm.cmd install
        if ($LASTEXITCODE) { throw "npm install failed (see above). Fix it, then run this again." }
        # npm's allow-scripts gate can skip Electron's own download.
        if (-not (Test-Path 'node_modules\electron\dist')) { node node_modules\electron\install.js }

        Step 'npm run package'
        npm.cmd run package
        if ($LASTEXITCODE) {
            Write-Host "`nBuild failed; retrying once..." -ForegroundColor Yellow
            Start-Sleep -Seconds 3
            npm.cmd run package
        }
        if ($LASTEXITCODE) { throw 'The build failed (see above). Run this again to retry.' }

        Step 'npm run shortcut'
        npm.cmd run shortcut
        if ($LASTEXITCODE) { Write-Host 'Shortcuts could not be created; the app is still installed.' -ForegroundColor Yellow }

        Write-Host "`nClaude Bench is installed in $dir" -ForegroundColor Green
        Write-Host 'Open it from the Desktop or Start menu. It updates itself from the Update button; running this command again does the same.'
        Write-Host 'To uninstall, delete that folder and the two "Claude Bench" shortcuts.'
        # Not started inside dist\win-unpacked: a process's cwd there blocks the next rebuild (see update.ps1).
        Start-Process -FilePath $exe -WorkingDirectory $env:USERPROFILE
    } catch {
        Write-Host "`n$($_.Exception.Message)" -ForegroundColor Red
    } finally {
        Pop-Location
        [IO.Directory]::SetCurrentDirectory($oldCwd)
    }
}

# Installs Stanza (Windows): clones the repo, builds the app and adds Desktop and Start menu shortcuts. Running
# it again updates that copy. Meant to be piped from the web:
#
#   irm https://raw.githubusercontent.com/AalishMS/Stanza/main/scripts/install.ps1 | iex
#
# Installs to %LOCALAPPDATA%\Programs\stanza, or to $env:STANZA_DIR if set. It runs inside the caller's
# PowerShell (iex), so everything sits in a script block: no variables leak, and a failure never closes the window.

& {
    $repoUrl = 'https://github.com/AalishMS/Stanza.git'
    $dir = if ($env:STANZA_DIR) { $env:STANZA_DIR } else { Join-Path $env:LOCALAPPDATA 'Programs\stanza' }
    # An install from when the app was called Claude Bench is updated in place rather than cloned a second time.
    $oldDir = Join-Path $env:LOCALAPPDATA 'Programs\claude-bench'
    if (-not $env:STANZA_DIR -and -not (Test-Path $dir) -and (Test-Path (Join-Path $oldDir '.git'))) { $dir = $oldDir }
    $dir = [IO.Path]::GetFullPath($dir)
    $exe = Join-Path $dir 'dist\win-unpacked\Stanza.exe'
    $oldCwd = [IO.Directory]::GetCurrentDirectory()

    function Step([string]$text) { Write-Host "`n> $text" -ForegroundColor Cyan }
    function Has([string]$cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

    Push-Location
    try {
        # npm.cmd, not npm: the npm.ps1 shim fails under the default execution policy.
        if (-not (Has git)) { throw 'git is not installed. Install it (winget install Git.Git), open a new PowerShell window and run this again.' }
        if (-not (Has node) -or -not (Has npm.cmd)) { throw 'Node.js is not installed. Install it (winget install OpenJS.NodeJS.LTS), open a new PowerShell window and run this again.' }
        $major = [int]((node -v) -replace '^v(\d+).*', '$1')
        if ($major -lt 20) { throw "Node.js $(node -v) is too old; Stanza needs 20 or newer (winget upgrade OpenJS.NodeJS.LTS)." }
        if (-not (Has claude)) { Write-Host 'Note: the claude CLI was not found. Install it and log in before opening a session: https://claude.com/claude-code' -ForegroundColor Yellow }

        # The exe can't be rebuilt while it runs. Matched on this install's path, never on the name.
        $exeDir = (Split-Path -Parent $exe) + '\'
        if (Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($exeDir, [StringComparison]::OrdinalIgnoreCase) }) {
            throw 'Stanza is running from this install. Close it and run this again.'
        }

        if (Test-Path (Join-Path $dir '.git')) {
            Set-Location -LiteralPath $dir
            # Same as update.ps1: a dirty lockfile (npm rewrites it) makes the pull abort.
            git checkout HEAD -- package-lock.json 2>$null
            Step "git pull --ff-only   ($dir)"
            git pull --ff-only
            if ($LASTEXITCODE) { throw 'git pull failed (see above).' }
        } elseif ((Test-Path $dir) -and (Get-ChildItem -Force -LiteralPath $dir | Select-Object -First 1)) {
            throw "$dir already exists and is not a Stanza clone. Move it away, or set STANZA_DIR to another folder."
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

        Write-Host "`nStanza is installed in $dir" -ForegroundColor Green
        Write-Host 'Open it from the Desktop or Start menu. It updates itself from the Update button; running this command again does the same.'
        Write-Host 'To uninstall, delete that folder and the two "Stanza" shortcuts.'
        # Not started inside dist\win-unpacked: a process's cwd there blocks the next rebuild (see update.ps1).
        Start-Process -FilePath $exe -WorkingDirectory $env:USERPROFILE
    } catch {
        Write-Host "`n$($_.Exception.Message)" -ForegroundColor Red
    } finally {
        Pop-Location
        [IO.Directory]::SetCurrentDirectory($oldCwd)
    }
}

# Updates a built copy of Claude Bench (Windows). Started by the app's Update button, which then quits, because the
# exe can't be rebuilt while it runs. Runs from a temp copy, since git pull may rewrite this file.
#
#   update.ps1 -Repo <checkout> -AppPid <pid> -Exe <path to Claude Bench.exe>

param([string]$Repo, [int]$AppPid, [string]$Exe)

$Host.UI.RawUI.WindowTitle = 'Updating Claude Bench'

# This process inherits the app's working directory (the shortcuts start the exe inside dist\win-unpacked), and a
# working directory keeps the folder from being deleted: electron-builder then fails with EBUSY on rmdir.
# Set-Location only moves PowerShell's own location, so move the real one.
[IO.Directory]::SetCurrentDirectory($env:TEMP)

# The app's own process and any process of this exact exe (its helpers keep it locked a moment longer). Matched on the
# full path of the build being replaced, never on the name, so other copies and dev instances are left alone.
function AppProcs {
    $dir = (Split-Path -Parent $Exe) + '\'
    @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Id -eq $AppPid -or ($_.Path -and $_.Path.StartsWith($dir, [StringComparison]::OrdinalIgnoreCase)) })
}

function WaitGone([int]$seconds) {
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((AppProcs).Count -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
    -not (AppProcs).Count
}

# A copy that closed its window but never exited holds the single-instance lock, so a reopened exe would quit at once.
function EndLeftover {
    if (WaitGone 20) { return $true }
    Write-Host 'Claude Bench did not exit; ending it...' -ForegroundColor Yellow
    AppProcs | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
    WaitGone 10
}

function Finish([string]$err) {
    if ($err) {
        Write-Host "`n$err" -ForegroundColor Red
        Read-Host 'Press Enter to close this window'
    }
    if ((Test-Path $Exe) -and (EndLeftover)) { Start-Process -FilePath $Exe }
    exit $(if ($err) { 1 } else { 0 })
}

Write-Host 'Waiting for Claude Bench to close...'
if (-not (EndLeftover)) { Finish 'Claude Bench is still running. Close it, then run "git pull" and "npm run package" in the repo folder.' }

Set-Location -LiteralPath $Repo
$before = git rev-parse HEAD

Write-Host "`n> git pull --ff-only" -ForegroundColor Cyan
git pull --ff-only
if ($LASTEXITCODE) { Finish 'git pull failed (see above). Nothing was changed; reopening the app.' }

if (git diff --name-only $before HEAD | Where-Object { $_ -match '^package(-lock)?\.json$' }) {
    Write-Host "`n> npm install" -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE) { Finish 'npm install failed (see above). Run it in the repo folder, then "npm run package".' }
}

Write-Host "`n> npm run package" -ForegroundColor Cyan
npm run package
if ($LASTEXITCODE) {
    Write-Host "`nBuild failed; retrying once..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    npm run package
}
if ($LASTEXITCODE) { Finish 'The build failed (see above). The source was updated but not rebuilt, so the app will keep running the old build and say it is up to date. Run "npm run package" in the repo folder to retry.' }

Write-Host "`nUpdated. Starting Claude Bench..." -ForegroundColor Green
Finish $null

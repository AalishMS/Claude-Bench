# Updates a built copy of Claude Bench (Windows). Started by the app's Update button, which then quits, because the
# exe can't be rebuilt while it runs. Runs from a temp copy, since git pull may rewrite this file.
#
#   update.ps1 -Repo <checkout> -AppPid <pid> -Exe <path to Claude Bench.exe>

param([string]$Repo, [int]$AppPid, [string]$Exe)

$Host.UI.RawUI.WindowTitle = 'Updating Claude Bench'

function Finish([string]$err) {
    if ($err) {
        Write-Host "`n$err" -ForegroundColor Red
        Read-Host 'Press Enter to close this window'
    }
    if (Test-Path $Exe) { Start-Process -FilePath $Exe }
    exit $(if ($err) { 1 } else { 0 })
}

Write-Host 'Waiting for Claude Bench to close...'
# The app's own process, then any helper process of the same exe (they keep it locked a moment longer).
$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline) {
    $busy = (Get-Process -Id $AppPid -ErrorAction SilentlyContinue) -or (Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $Exe })
    if (-not $busy) { break }
    Start-Sleep -Milliseconds 500
}
if ($busy) { Finish 'Claude Bench is still running. Close it, then run "git pull" and "npm run package" in the repo folder.' }

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
if ($LASTEXITCODE) { Finish 'The build failed (see above). Run "npm run package" in the repo folder to retry.' }

Write-Host "`nUpdated. Starting Claude Bench..." -ForegroundColor Green
Finish $null

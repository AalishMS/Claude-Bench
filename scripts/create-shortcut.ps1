# Creates "Stanza" shortcuts on the Desktop and in the Start menu.
# Prefers the packaged app (dist\win-unpacked\Stanza.exe, built by `npm run package`)
# and falls back to launching the source folder through Electron.
#
#   npm run shortcut

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$icon = Join-Path $root 'assets\icon.ico'
$packaged = Join-Path $root 'dist\win-unpacked\Stanza.exe'
$electron = Join-Path $root 'node_modules\electron\dist\electron.exe'

if (Test-Path $packaged) {
    $target = $packaged
    $arguments = ''
    $workdir = Split-Path $packaged
} elseif (Test-Path $electron) {
    $target = $electron
    $arguments = '"' + $root + '"'
    $workdir = $root
    Write-Warning "Packaged app not found - shortcut will run from source. Run 'npm run package' for a standalone exe."
} else {
    throw "Neither the packaged app nor Electron was found. Run 'npm install' first."
}

$shell = New-Object -ComObject WScript.Shell
$places = @{
    Desktop     = [Environment]::GetFolderPath('Desktop')
    'Start menu' = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
}
foreach ($name in $places.Keys) {
    # The app used to be called "Claude Bench" and "Claude Terminal"; drop those shortcuts so they don't point at a missing exe.
    foreach ($oldName in 'Claude Bench.lnk', 'Claude Terminal.lnk') {
        $old = Join-Path $places[$name] $oldName
        if (Test-Path $old) { Remove-Item $old; Write-Host "Removed old $name shortcut ($oldName)" }
    }

    $lnk = $shell.CreateShortcut((Join-Path $places[$name] 'Stanza.lnk'))
    $lnk.TargetPath = $target
    $lnk.Arguments = $arguments
    $lnk.WorkingDirectory = $workdir
    $lnk.IconLocation = "$icon,0"
    $lnk.Description = 'Claude Code in a window: projects, tabs, git and servers'
    $lnk.Save()
    Write-Host "Created $name shortcut -> $target"
}

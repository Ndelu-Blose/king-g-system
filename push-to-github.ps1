# Push King-G to https://github.com/MandisaBiyela/King-G-System.git
# Run: Right-click -> Run with PowerShell, or in PowerShell: .\push-to-github.ps1

$ErrorActionPreference = "Stop"
$repo = "https://github.com/MandisaBiyela/King-G-System.git"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Find git.exe
$gitPaths = @(
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files (x86)\Git\cmd\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe",
    "C:\Program Files\Microsoft SQL Server Management Studio 22\Release\Common7\IDE\CommonExtensions\Microsoft\TeamFoundation\Team Explorer\Git\cmd\git.exe"
)
$git = $null
foreach ($p in $gitPaths) {
    if (Test-Path $p) {
        $git = $p
        break
    }
}
if (-not $git) {
    Write-Host "Git not found. Please install Git for Windows from https://git-scm.com/download/win" -ForegroundColor Red
    Write-Host "Then run this script again, or run the commands in 'Git Bash'." -ForegroundColor Yellow
    exit 1
}

function Run-Git { & $git @args }

if (-not (Test-Path .git)) {
    Write-Host "Initializing repository..."
    Run-Git init
    Run-Git add .
    Run-Git commit -m "Initial commit: King-G POS and shift management"
} else {
    Run-Git add .
    Run-Git status
    Run-Git commit -m "King-G: back buttons, shift for cashiers, shift history, deliveries" 2>$null
    if ($LASTEXITCODE -ne 0) { Write-Host "(No changes to commit or already committed)" -ForegroundColor Gray }
}

Run-Git remote remove origin 2>$null
Run-Git remote add origin $repo
Run-Git branch -M main
Run-Git push -u origin main

Write-Host "Done. Pushed to $repo" -ForegroundColor Green

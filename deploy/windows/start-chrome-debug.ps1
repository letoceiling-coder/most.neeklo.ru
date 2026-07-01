# Launches Chrome with CDP on port 9222 using a dedicated Most profile.
# If CDP is already running, exits silently (no second window — important for autostart).
param(
    [int]$Port = 9222,
    [string]$ProfileDir = "$env:LOCALAPPDATA\Most\chrome-profile",
    [string]$ChromePath = "",
    [switch]$Stealth
)

function Test-Cdp {
    param([int]$P)
    try {
        Invoke-RestMethod -Uri "http://127.0.0.1:$P/json/version" -TimeoutSec 2 | Out-Null
        return $true
    } catch {
        return $false
    }
}

if (Test-Cdp -P $Port) {
    if (-not $Stealth) {
        Write-Host "Chrome CDP already running on port $Port — skipping start." -ForegroundColor Green
    }
    exit 0
}

if (-not $ChromePath) {
    $candidates = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    )
    $ChromePath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if (-not $ChromePath) {
    Write-Error "Chrome not found. Pass -ChromePath 'C:\path\to\chrome.exe'."
    exit 1
}

New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null

$args = @(
    "--remote-debugging-port=$Port",
    "--user-data-dir=`"$ProfileDir`"",
    "--no-first-run",
    "--no-default-browser-check",
    "--restore-last-session",
    "--disable-infobars",
    "--noerrdialogs",
    "--disable-session-crashed-bubble"
)

if ($Stealth) {
    $args += @("--start-minimized", "--window-position=-2400,-2400")
}

if (-not $Stealth) {
    Write-Host "Starting Chrome (CDP $Port), profile: $ProfileDir" -ForegroundColor Cyan
    Write-Host "Log into messengers in this window once. Sessions persist in the profile." -ForegroundColor Yellow
}

Start-Process -FilePath $ChromePath -ArgumentList $args -WindowStyle $(if ($Stealth) { 'Minimized' } else { 'Normal' })

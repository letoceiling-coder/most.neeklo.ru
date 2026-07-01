# Stops Most agent autostart and related processes on Windows.
param(
    [string]$TaskName = "MostAgent",
    [string]$ProjectRoot = "C:\projects\most.neeklo.ru"
)

$ErrorActionPreference = "SilentlyContinue"

Write-Host "Removing scheduled task '$TaskName'..." -ForegroundColor Cyan
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false

Write-Host "Stopping node processes running Most agent..." -ForegroundColor Cyan
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like '*packages\agent\dist\index.js*' -or $_.CommandLine -like '*packages/agent/dist/index.js*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

Write-Host "Stopping Chrome with Most profile (CDP :9222)..." -ForegroundColor Cyan
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
    Where-Object { $_.CommandLine -like '*Most\chrome-profile*' -or $_.CommandLine -like '*remote-debugging-port=9222*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

Write-Host ""
Write-Host "Done. Autostart disabled, processes stopped." -ForegroundColor Green
Write-Host "To fully remove data, delete manually:" -ForegroundColor Yellow
Write-Host "  $env:LOCALAPPDATA\Most"
Write-Host "  $ProjectRoot (project folder)"
Write-Host ""
Write-Host "In the dashboard: delete PC under 'PC and accounts' if needed."

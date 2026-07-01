# Builds (if needed) and runs the Most PC agent with auto-restart on crash.
param(
    [string]$ProjectRoot = "C:\projects\most.neeklo.ru",
    [string]$NodeExe = "",
    [switch]$Silent
)

$logDir = Join-Path $env:LOCALAPPDATA "Most\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "agent.log"

function Write-AgentLog {
    param([string]$Message, [string]$Color = "White")
    $line = "[$(Get-Date -Format o)] $Message"
    Add-Content -Path $logFile -Value $line -Encoding UTF8
    if (-not $Silent) {
        Write-Host $line -ForegroundColor $Color
    }
}

if (-not $NodeExe) {
    $NodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
}
if (-not $NodeExe) {
    Write-AgentLog "ERROR: node not found in PATH. Pass -NodeExe." "Red"
    exit 1
}

Set-Location $ProjectRoot

$entry = Join-Path $ProjectRoot "packages\agent\dist\index.js"
if (-not (Test-Path $entry)) {
    Write-AgentLog "Building agent..." "Cyan"
    npm run build:shared 2>&1 | Out-File -FilePath $logFile -Append -Encoding UTF8
    npm run build:agent 2>&1 | Out-File -FilePath $logFile -Append -Encoding UTF8
}

while ($true) {
    Write-AgentLog "Starting Most agent" "Green"
    if ($Silent) {
        & $NodeExe $entry 2>&1 | ForEach-Object { Add-Content -Path $logFile -Value $_ -Encoding UTF8 }
    } else {
        & $NodeExe $entry
    }
    Write-AgentLog "Agent exited, restarting in 5s..." "Red"
    Start-Sleep -Seconds 5
}

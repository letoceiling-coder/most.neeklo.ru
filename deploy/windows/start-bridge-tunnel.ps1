# OPTIONAL fallback control channel. The agent normally reaches the VPS via an
# outbound WSS (wss://most.neeklo.ru/agent) which needs no tunnel. Use this
# reverse SSH tunnel only if you want the VPS to reach a service ON the PC
# (e.g. local debug API). Adapted from parser-COMP.
param(
    [string]$ServerUser = "root",
    [string]$ServerHost = "most.neeklo.ru",
    [int]$RemotePort = 8765,
    [int]$LocalPort = 3031
)

Write-Host "Reverse tunnel: server 127.0.0.1:$RemotePort -> PC 127.0.0.1:$LocalPort" -ForegroundColor Cyan
while ($true) {
    ssh -N `
        -o ServerAliveInterval=30 `
        -o ServerAliveCountMax=3 `
        -o ExitOnForwardFailure=yes `
        -R "127.0.0.1:${RemotePort}:127.0.0.1:${LocalPort}" `
        "$ServerUser@$ServerHost"
    Write-Host "[$(Get-Date -Format o)] Tunnel closed, reconnecting in 5s..." -ForegroundColor Red
    Start-Sleep -Seconds 5
}

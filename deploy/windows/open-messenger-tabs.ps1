# Opens messenger tabs in the Most Chrome (CDP). Skips URLs already open.
param(
    [int]$Port = 9222,
    [string]$ProjectRoot = "C:\projects\most.neeklo.ru",
    [switch]$Stealth
)

$urls = @(
    'https://web.telegram.org/a/',
    'https://web.max.ru/',
    'https://vk.com/im',
    'https://www.avito.ru/profile/messenger',
    'https://www.instagram.com/direct/inbox/',
    'https://web.whatsapp.com/'
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

function Get-OpenUrls {
    param([int]$P)
    try {
        $targets = Invoke-RestMethod -Uri "http://127.0.0.1:$P/json/list" -TimeoutSec 5
        return @($targets | ForEach-Object { $_.url })
    } catch {
        return @()
    }
}

if (-not (Test-Cdp -P $Port)) {
    if (-not $Stealth) {
        Write-Host "Chrome CDP not on port $Port — starting debug Chrome..." -ForegroundColor Cyan
    }
    $start = Join-Path $ProjectRoot 'deploy\windows\start-chrome-debug.ps1'
    if ($Stealth) { & $start -Port $Port -Stealth } else { & $start -Port $Port }
    for ($i = 0; $i -lt 25; $i++) {
        Start-Sleep -Seconds 1
        if (Test-Cdp -P $Port) { break }
    }
    if (-not (Test-Cdp -P $Port)) {
        Write-Error "Chrome CDP did not start on port $Port"
        exit 1
    }
}

$open = Get-OpenUrls -P $Port

foreach ($url in $urls) {
    $already = $open | Where-Object { $_ -like "$url*" }
    if ($already) {
        if (-not $Stealth) { Write-Host "  = $url (already open)" -ForegroundColor DarkGray }
        continue
    }
    $encoded = [uri]::EscapeDataString($url)
    try {
        Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/new?$encoded" -Method Put | Out-Null
        if (-not $Stealth) { Write-Host "  + $url" -ForegroundColor Green }
    } catch {
        if (-not $Stealth) { Write-Warning "Failed to open $url — $_" }
    }
    Start-Sleep -Milliseconds 400
}

if (-not $Stealth) {
    Write-Host ""
    Write-Host "Authorize each messenger once (QR / login). Sessions persist in the Most profile." -ForegroundColor Yellow
}

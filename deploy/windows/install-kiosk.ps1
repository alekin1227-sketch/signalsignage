param(
  [Parameter(Mandatory=$true)][string]$PlayerUrl,
  [string]$BrowserPath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
)
$ErrorActionPreference = "Stop"
if (-not (Test-Path $BrowserPath)) { throw "Microsoft Edge não encontrado em $BrowserPath" }
$startup = [Environment]::GetFolderPath("Startup")
$launcher = Join-Path $startup "CorporateSignagePlayer.cmd"
$content = '@echo off' + "`r`n" + 'timeout /t 8 /nobreak >nul' + "`r`n" + '"' + $BrowserPath + '" --kiosk "' + $PlayerUrl + '" --edge-kiosk-type=fullscreen --autoplay-policy=no-user-gesture-required --no-first-run --disable-session-crashed-bubble'
Set-Content -Path $launcher -Value $content -Encoding ASCII
Write-Host "Player configurado. Reinicie o Mini PC para testar: $launcher"

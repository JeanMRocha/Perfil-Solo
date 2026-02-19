param(
  [int]$Port = 5173
)

$ErrorActionPreference = "SilentlyContinue"
$projectDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$projectToken = Split-Path -Leaf $projectDir
$watchdogScript = "keep-dev-server.ps1"

$watchdogs = Get-CimInstance Win32_Process |
  Where-Object {
    ($_.Name -eq "pwsh.exe" -or $_.Name -eq "powershell.exe") -and
    $_.CommandLine -like "*$watchdogScript*"
  }

foreach ($proc in $watchdogs) {
  Stop-Process -Id $proc.ProcessId -Force
}

$devNodes = Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -eq "node.exe" -and
    $_.CommandLine -like "*vite*" -and
    $_.CommandLine -like "*$projectToken*" -and
    $_.CommandLine -like "*--port $Port*"
  }

foreach ($proc in $devNodes) {
  Stop-Process -Id $proc.ProcessId -Force
}

$portListeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
foreach ($listener in $portListeners) {
  Stop-Process -Id $listener.OwningProcess -Force
}

Write-Output "Watchdog e dev server encerrados (porta $Port)."

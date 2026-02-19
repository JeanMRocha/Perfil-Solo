param(
  [string]$BindHost = "127.0.0.1",
  [int]$Port = 5173,
  [int]$CheckIntervalSeconds = 5
)

$ErrorActionPreference = "Stop"
$projectDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$projectToken = Split-Path -Leaf $projectDir
$scriptName = Split-Path -Leaf $PSCommandPath
$agentDir = Join-Path $projectDir ".agent"
$logFile = Join-Path $agentDir "dev-watchdog.log"
$lastStart = [datetime]::MinValue

if (-not (Test-Path $agentDir)) {
  New-Item -ItemType Directory -Path $agentDir | Out-Null
}

function Write-Log {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -Path $logFile -Value $line
  Write-Host $line
}

function Get-OtherWatchdogs {
  $escaped = [Regex]::Escape($scriptName)
  Get-CimInstance Win32_Process |
    Where-Object {
      ($_.Name -eq "pwsh.exe" -or $_.Name -eq "powershell.exe") -and
      $_.ProcessId -ne $PID -and
      $_.CommandLine -match $escaped
    }
}

function Is-PortListening {
  $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalAddress -eq $BindHost -or $_.LocalAddress -eq "0.0.0.0" -or $_.LocalAddress -eq "::" }
  return [bool]$listeners
}

function Get-DevServerProcesses {
  Get-CimInstance Win32_Process |
    Where-Object {
      $_.Name -eq "node.exe" -and
      $_.CommandLine -like "*vite*" -and
      $_.CommandLine -like "*$projectToken*" -and
      $_.CommandLine -like "*--port $Port*"
    }
}

if (Get-OtherWatchdogs) {
  Write-Log "Outro watchdog ja esta rodando. Encerrando esta instancia."
  exit 0
}

Write-Log "Watchdog iniciado para ${BindHost}:$Port em $projectDir"

while ($true) {
  try {
    $isListening = Is-PortListening
    $devProcesses = @(Get-DevServerProcesses)
    $secondsSinceStart = ((Get-Date) - $lastStart).TotalSeconds

    if (-not $isListening -and $devProcesses.Count -eq 0 -and $secondsSinceStart -ge 10) {
      Write-Log "Servidor offline. Iniciando: yarn dev --host $BindHost --port $Port"
      Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "yarn dev --host $BindHost --port $Port" -WorkingDirectory $projectDir -WindowStyle Minimized | Out-Null
      $lastStart = Get-Date
    }
  } catch {
    Write-Log ("Erro no watchdog: " + $_.Exception.Message)
  }

  Start-Sleep -Seconds $CheckIntervalSeconds
}

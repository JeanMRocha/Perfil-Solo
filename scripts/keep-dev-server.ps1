param(
  [string]$BindHost = "127.0.0.1",
  [int]$Port = 5173,
  [int]$CheckIntervalSeconds = 5
)

$ErrorActionPreference = "Stop"
$projectDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$projectToken = Split-Path -Leaf $projectDir
$agentDir = Join-Path $projectDir ".agent"
$logFile = Join-Path $agentDir "dev-watchdog.log"
$fixLogFile = Join-Path $agentDir "dev-watchdog-fixes.log"
$serverOutLog = Join-Path $agentDir "dev-server.stdout.log"
$serverErrLog = Join-Path $agentDir "dev-server.stderr.log"
$installLogFile = Join-Path $agentDir "dev-watchdog-install.log"
$lastStart = [datetime]::MinValue
$startupGraceSeconds = 8
$restartCooldownSeconds = 10
$script:lastInstallAttempt = [datetime]::MinValue
$lastErrorSignature = ""

if (-not (Test-Path $agentDir)) {
  New-Item -ItemType Directory -Path $agentDir | Out-Null
}

function Write-Log {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -Path $logFile -Value $line
  Write-Host $line
}

function Write-FixLog {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -Path $fixLogFile -Value $line
  Write-Log "[auto-fix] $Message"
}

function Ensure-LogFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    New-Item -ItemType File -Path $Path | Out-Null
  }
}

function Truncate-IfTooLarge {
  param(
    [string]$Path,
    [int]$MaxMB = 8
  )
  if (-not (Test-Path $Path)) {
    return
  }
  $maxBytes = $MaxMB * 1MB
  $currentSize = (Get-Item $Path).Length
  if ($currentSize -gt $maxBytes) {
    Clear-Content -Path $Path
    Add-Content -Path $Path -Value ("[{0}] Arquivo truncado por limite de {1}MB" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $MaxMB)
  }
}

function Get-OtherWatchdogs {
  $escapedPath = [Regex]::Escape($PSCommandPath)
  $watchdogRegex = "(?i)-File\s+`"?$escapedPath`"?"
  Get-CimInstance Win32_Process |
    Where-Object {
      ($_.Name -eq "pwsh.exe" -or $_.Name -eq "powershell.exe") -and
      $_.ProcessId -ne $PID -and
      $_.CommandLine -and
      $_.CommandLine -notmatch "(?i)\s-Command\s" -and
      $_.CommandLine -match $watchdogRegex -and
      $_.CommandLine -like "*$projectToken*"
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
      $_.CommandLine -and
      $_.CommandLine -like "*vite*" -and
      $_.CommandLine -like "*$projectToken*" -and
      $_.CommandLine -like "*--port $Port*"
    }
}

function Get-PortListeners {
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
}

function Start-DevServer {
  Ensure-LogFile -Path $serverOutLog
  Ensure-LogFile -Path $serverErrLog
  Truncate-IfTooLarge -Path $serverOutLog
  Truncate-IfTooLarge -Path $serverErrLog
  $command = "npm run dev -- --host $BindHost --port $Port 1>> `"$serverOutLog`" 2>> `"$serverErrLog`""
  Write-Log "Servidor offline. Iniciando: npm run dev -- --host $BindHost --port $Port"
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $command -WorkingDirectory $projectDir -WindowStyle Minimized | Out-Null
}

function Read-ServerErrorSnippet {
  if (-not (Test-Path $serverErrLog)) {
    return ""
  }
  return ((Get-Content -Path $serverErrLog -Tail 120) -join "`n").Trim()
}

function Stop-PortListenersForFix {
  $listeners = @(Get-PortListeners)
  if ($listeners.Count -eq 0) {
    return $false
  }

  $stoppedAny = $false
  $processIds = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $processIds) {
    if (-not $processId) {
      continue
    }
    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
      Write-FixLog "Processo $processId encerrado para liberar porta $Port."
      $stoppedAny = $true
    } catch {
      Write-FixLog ("Falha ao encerrar processo {0} na porta {1}: {2}" -f $processId, $Port, $_.Exception.Message)
    }
  }

  return $stoppedAny
}

function Run-NpmInstallForFix {
  $minutesSinceLast = ((Get-Date) - $script:lastInstallAttempt).TotalMinutes
  if ($minutesSinceLast -lt 10) {
    Write-FixLog "npm install em cooldown (${minutesSinceLast:N1}min desde a ultima tentativa)."
    return $false
  }

  $script:lastInstallAttempt = Get-Date
  Ensure-LogFile -Path $installLogFile
  Truncate-IfTooLarge -Path $installLogFile
  Write-FixLog "Executando auto-correcao: npm install"

  $installCmd = "npm install >> `"$installLogFile`" 2>&1"
  $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $installCmd -WorkingDirectory $projectDir -WindowStyle Minimized -PassThru -Wait
  if ($proc.ExitCode -eq 0) {
    Write-FixLog "npm install concluido com sucesso."
    return $true
  }

  Write-FixLog "npm install falhou com exit code $($proc.ExitCode)."
  return $false
}

function Try-AutoFix {
  param([string]$ErrorText)

  if ([string]::IsNullOrWhiteSpace($ErrorText)) {
    return $false
  }

  $preview = (($ErrorText -split "`r?`n") | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Last 3) -join " | "
  if ($preview) {
    Write-FixLog "Erro detectado: $preview"
  }

  if ($ErrorText -match "EADDRINUSE|already in use|EACCES.*5173") {
    if (Stop-PortListenersForFix) {
      Write-FixLog "Correcao aplicada para conflito de porta."
      return $true
    }
  }

  if ($ErrorText -match "Cannot find module|ERR_MODULE_NOT_FOUND|vite is not recognized|npm ERR! code ENOENT|MODULE_NOT_FOUND") {
    if (Run-NpmInstallForFix) {
      Write-FixLog "Correcao aplicada para dependencias ausentes."
      return $true
    }
  }

  if ($ErrorText -match "configured to use npm") {
    Write-FixLog "Projeto exige npm. Watchdog ja usa npm; nenhuma acao extra necessaria."
  }

  return $false
}

Ensure-LogFile -Path $logFile
Ensure-LogFile -Path $fixLogFile

if (Get-OtherWatchdogs) {
  Write-Log "Outro watchdog ja esta rodando. Encerrando esta instancia."
  exit 0
}

Write-Log "Watchdog iniciado para ${BindHost}:$Port em $projectDir"
Write-Log "Logs: watchdog=$logFile | fixes=$fixLogFile | stdout=$serverOutLog | stderr=$serverErrLog"

while ($true) {
  try {
    $isListening = Is-PortListening
    $devProcesses = @(Get-DevServerProcesses)
    $secondsSinceStart = if ($lastStart -eq [datetime]::MinValue) { [double]::PositiveInfinity } else { ((Get-Date) - $lastStart).TotalSeconds }

    if ($isListening -and $devProcesses.Count -eq 0 -and $secondsSinceStart -ge $startupGraceSeconds) {
      Write-Log "Porta $Port ativa sem processo Vite deste projeto. Tentando liberar porta."
      if (Stop-PortListenersForFix) {
        $isListening = Is-PortListening
        $lastStart = [datetime]::MinValue
      }
    }

    if (-not $isListening -and $devProcesses.Count -eq 0) {
      if ($lastStart -ne [datetime]::MinValue -and $secondsSinceStart -ge $startupGraceSeconds) {
        $errorSnippet = Read-ServerErrorSnippet
        $errorSignature = $errorSnippet.Trim()
        if ($errorSignature -and $errorSignature -ne $lastErrorSignature) {
          Write-Log "Falha detectada na inicializacao. Executando auto-debug."
          $appliedFix = Try-AutoFix -ErrorText $errorSnippet
          $lastErrorSignature = $errorSignature
          if ($appliedFix) {
            $lastStart = [datetime]::MinValue
          }
        }
      }

      if ($secondsSinceStart -ge $restartCooldownSeconds) {
        Start-DevServer
        $lastStart = Get-Date
      }
    } else {
      $lastErrorSignature = ""
    }
  } catch {
    Write-Log ("Erro no watchdog: " + $_.Exception.Message)
  }

  Start-Sleep -Seconds $CheckIntervalSeconds
}

# portal-watchdog.ps1 - keeps the AD Identity Portal running (production mode).
# Loops forever; starts the server whenever port 3000 is not listening.
# Logs are written OUTSIDE the project dir so they never disturb the app.

$ErrorActionPreference = 'SilentlyContinue'

$projectDir = 'C:\Users\opc\Documents\ad-identity-portal-full\ad-identity-portal-full'
$nodeExe    = 'C:\Program Files\nodejs\node.exe'
$nextBin    = 'node_modules\next\dist\bin\next'
$logDir     = 'C:\ProgramData\ADIdentityPortal\logs'
$logFile    = Join-Path $logDir 'portal-watchdog.log'
$stdoutFile = Join-Path $logDir 'portal-stdout.log'
$stderrFile = Join-Path $logDir 'portal-stderr.log'

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Log([string]$msg) {
    $line = "{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
    try { $line | Out-File -FilePath $logFile -Append -Encoding UTF8 } catch {}
}

Log 'Watchdog started.'

while ($true) {
    $listening = $null
    try {
        $listening = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction Stop
    } catch {}

    if ($null -eq $listening -or $listening.Count -eq 0) {
        Log 'Portal is down. Starting server...'
        try {
            Start-Process -FilePath $nodeExe `
                -ArgumentList $nextBin, 'start', '-p', '3000', '-H', '0.0.0.0' `
                -WorkingDirectory $projectDir `
                -WindowStyle Hidden `
                -RedirectStandardOutput $stdoutFile `
                -RedirectStandardError $stderrFile
            Log 'Server start command issued.'
        } catch {
            Log ("Failed to start server: " + $_.Exception.Message)
        }
        Start-Sleep -Seconds 5
    }

    Start-Sleep -Seconds 10
}

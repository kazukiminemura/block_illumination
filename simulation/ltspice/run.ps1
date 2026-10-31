param([string]$LTspice = "$env:LOCALAPPDATA\Programs\ADI\LTspice\LTspice.exe")
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $LTspice)) { throw "LTspice executable not found: $LTspice" }
Push-Location $PSScriptRoot
try {
    node build.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Circuit generation failed' }
    $circuit = Join-Path $PSScriptRoot 'row_handoff.cir'
    $started = Get-Date
    $process = Start-Process -FilePath $LTspice -ArgumentList '-b', '-ascii', ('"' + $circuit + '"') -WindowStyle Hidden -PassThru
    if (-not $process.WaitForExit(60000)) { throw 'LTspice is still running after 60 seconds; inspect process before re-running' }
    if ($process.ExitCode -ne 0) { throw "LTspice failed, exit code $($process.ExitCode); see row_handoff.log" }
    $log = Get-Item -LiteralPath (Join-Path $PSScriptRoot 'row_handoff.log')
    if ($log.LastWriteTime -lt $started) { throw 'No fresh LTspice log was produced; refusing to reuse old results' }
    node verify.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Measurement verification failed' }
} finally { Pop-Location }

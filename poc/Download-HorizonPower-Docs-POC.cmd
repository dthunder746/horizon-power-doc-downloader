@echo off
setlocal
title Horizon Power Doc Downloader - POC smoke test
echo.
echo ===================================================
echo  Horizon Power Doc Downloader - POC smoke test
echo ===================================================
echo.
echo   [PASS] Step 1: Script launched (survived double-click / SmartScreen / AV)
set "HP_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '  [PASS] Step 2: PowerShell ran with -ExecutionPolicy Bypass' -ForegroundColor Green; try { $mk='#PS'+'CODE#'; $self=Get-Content -Raw -LiteralPath '%~f0'; Invoke-Expression $self.Substring($self.IndexOf($mk)+$mk.Length) } catch { Write-Host ('  [FAIL] Could not run embedded script (possible Constrained Language Mode / AppLocker): ' + $_.Exception.Message) -ForegroundColor Red }"
echo.
echo Done. Please screenshot this whole window and send it back.
echo.
pause
exit /b
#PSCODE#
# ---------------------------------------------------------------------------
# Embedded PowerShell smoke test (steps 3-6). Reaching here means steps 1 and 2
# already passed: the .cmd launched and PowerShell executed under -ExecutionPolicy
# Bypass without Constrained Language Mode blocking Invoke-Expression.
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$ok = 2      # steps 1 and 2 already passed
$fail = 0
function Pass($n, $m) { Write-Host ("  [PASS] Step {0}: {1}" -f $n, $m) -ForegroundColor Green; $script:ok++ }
function Fail($n, $m) { Write-Host ("  [FAIL] Step {0}: {1}" -f $n, $m) -ForegroundColor Red; $script:fail++ }

# An empty User-Agent is blocked by Cloudflare (HTTP 403); any real UA returns 200.
$UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) HorizonPowerDocDownloader-POC'
$manifestUrl = 'https://raw.githubusercontent.com/dthunder746/horizon-power-doc-downloader/main/poc/manifest.json'

# Step 3: fetch the manifest from raw.githubusercontent.com (proxy / firewall check)
$manifestRaw = $null
try {
    $manifestRaw = (Invoke-WebRequest -Uri $manifestUrl -UseBasicParsing -UserAgent $UA).Content
    Pass 3 ("Fetched manifest from raw.githubusercontent.com ({0} bytes)" -f $manifestRaw.Length)
} catch {
    Fail 3 ("Could not fetch manifest (proxy/firewall/SSL-inspection?): {0}" -f $_.Exception.Message)
}

# Step 4: parse the JSON
$manifest = $null
$doc = $null
if ($manifestRaw) {
    try {
        $manifest = $manifestRaw | ConvertFrom-Json
        $doc = $manifest.tabs[0].tables[0].documents[0]
        Pass 4 ("Parsed JSON (document_count={0}, first file: {1})" -f $manifest.document_count, $doc.filename)
    } catch {
        Fail 4 ("ConvertFrom-Json failed: {0}" -f $_.Exception.Message)
    }
}

# Step 5: download one small PDF into a subfolder next to this script (atomic write)
$target = $null
if ($doc) {
    try {
        $baseDir = $env:HP_DIR
        if (-not $baseDir) { $baseDir = (Get-Location).Path }
        $tab = $manifest.tabs[0]
        $table = $tab.tables[0]
        $outDir = Join-Path (Join-Path (Join-Path $baseDir 'Horizon Power Documents') $tab.folder) $table.folder
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null
        $target = Join-Path $outDir $doc.filename
        $tmp = "$target.part"
        if (Test-Path $tmp) { Remove-Item $tmp -Force }
        Invoke-WebRequest -Uri $doc.url -UseBasicParsing -UserAgent $UA -OutFile $tmp
        if (Test-Path $target) { Remove-Item $target -Force }
        Rename-Item -Path $tmp -NewName $doc.filename
        Pass 5 "Downloaded PDF from horizonpower.com.au/globalassets (atomic temp + rename)"
    } catch {
        Fail 5 ("Download failed: {0}" -f $_.Exception.Message)
    }
}

# Step 6: confirm the file is on disk and non-trivial
if ($target -and (Test-Path $target)) {
    $size = (Get-Item $target).Length
    if ($size -gt 1024) {
        Pass 6 ("File written to disk: {0} ({1:N0} bytes)" -f $target, $size)
    } else {
        Fail 6 ("File exists but is suspiciously small ({0} bytes)" -f $size)
    }
} else {
    Fail 6 "No file written to disk"
}

Write-Host ''
Write-Host '===================================================' -ForegroundColor Cyan
if ($fail -eq 0) {
    Write-Host (" RESULT: ALL {0} STEPS PASSED - architecture proven" -f $ok) -ForegroundColor Green
} else {
    Write-Host (" RESULT: {0} passed, {1} FAILED (see [FAIL] lines above)" -f $ok, $fail) -ForegroundColor Red
}
Write-Host '===================================================' -ForegroundColor Cyan

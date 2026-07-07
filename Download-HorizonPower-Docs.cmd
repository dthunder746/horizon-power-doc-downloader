@echo off
setlocal
title Horizon Power Doc Downloader
set "HP_VERSION=1.0.0"
set "HP_DIR=%~dp0"
echo.
echo ===================================================
echo  Horizon Power Doc Downloader
echo ===================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$mk='#PS'+'CODE#'; $self=Get-Content -Raw -LiteralPath '%~f0'; Invoke-Expression $self.Substring($self.IndexOf($mk)+$mk.Length)"
echo.
pause
exit /b
#PSCODE#
# ---------------------------------------------------------------------------
# Embedded PowerShell tail for the Horizon Power Doc Downloader.
# Reaching here means the .cmd launched and PowerShell ran under
# -ExecutionPolicy Bypass. This half fetches the manifest live from GitHub and
# downloads every selected document. It never modifies the .cmd itself.
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

# An empty User-Agent is 403'd by Cloudflare on the file assets; always send one.
$UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) HorizonPowerDocDownloader'
$repoRaw     = 'https://raw.githubusercontent.com/dthunder746/horizon-power-doc-downloader/main'
$manifestUrl = "$repoRaw/manifest.json"
$versionUrl  = "$repoRaw/version.txt"
$downloadUrl = "$repoRaw/Download-HorizonPower-Docs.cmd"

# --- Embedded update-check logic --------------------------------------------
# Copied verbatim from src/Update-Check.ps1. Do not edit here without editing
# there; tests/cmd-sync.test.mjs fails on drift.
# >>> BEGIN EMBEDDED UPDATE-CHECK >>>
function Test-UpdateAvailable {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [string] $Local,
        [string] $Remote
    )

    $localVer = $null
    $remoteVer = $null
    # Best-effort: if either side is missing or unparseable, report "no update"
    # rather than throwing. The version check must never break a download run.
    if (-not [version]::TryParse(($Local  -as [string]).Trim(), [ref] $localVer))  { return $false }
    if (-not [version]::TryParse(($Remote -as [string]).Trim(), [ref] $remoteVer)) { return $false }

    return ($remoteVer -gt $localVer)
}

function Get-UpdateNotice {
    [CmdletBinding()]
    param(
        [string]      $Local,
        [scriptblock] $FetchRemote,
        [string]      $DownloadUrl
    )

    # Best-effort: a failed fetch (offline, proxy, SSL inspection) must never
    # surface an error or block the download run. Silence beats noise here.
    $remote = $null
    try { $remote = & $FetchRemote } catch { return $null }

    if (-not (Test-UpdateAvailable -Local $Local -Remote $remote)) { return $null }

    $remoteTrim = ($remote -as [string]).Trim()
    return "A newer version ($remoteTrim) is available. Download it here:`n  $DownloadUrl"
}
# <<< END EMBEDDED UPDATE-CHECK <<<

# Notify-only update check. Best-effort: any failure stays silent and never
# blocks the download run below.
try {
    $notice = Get-UpdateNotice -Local $env:HP_VERSION -DownloadUrl $downloadUrl -FetchRemote {
        (Invoke-WebRequest -Uri $versionUrl -UseBasicParsing -UserAgent $UA -TimeoutSec 15).Content
    }
    if ($notice) {
        Write-Host ''
        Write-Host $notice -ForegroundColor Yellow
        Write-Host ''
    }
} catch {}

# --- Fetch the manifest (retry once, then a clear error) --------------------
function Get-ManifestRaw($url, $ua) {
    $lastErr = $null
    for ($attempt = 1; $attempt -le 2; $attempt++) {
        try {
            return (Invoke-WebRequest -Uri $url -UseBasicParsing -UserAgent $ua -TimeoutSec 30).Content
        } catch {
            $lastErr = $_
            if ($attempt -lt 2) { Start-Sleep -Seconds 2 }
        }
    }
    throw $lastErr
}

$manifest = $null
try {
    $manifestRaw = Get-ManifestRaw $manifestUrl $UA
    $manifest = $manifestRaw | ConvertFrom-Json
} catch {
    Write-Host ''
    Write-Host ("The download manifest is unreachable: {0}" -f $_.Exception.Message) -ForegroundColor Red
    Write-Host ''
    Write-Host 'Check your internet connection or corporate proxy, then run this again.'
    exit 1
}

$tabs = @($manifest.tabs)
if ($tabs.Count -eq 0) {
    Write-Host 'The manifest contains no sections to download.' -ForegroundColor Yellow
    exit 0
}

# --- Tab menu: pick one section or press Enter for all ----------------------
Write-Host 'Which section do you want to download?'
Write-Host ''
for ($i = 0; $i -lt $tabs.Count; $i++) {
    Write-Host ("  {0}. {1}" -f ($i + 1), $tabs[$i].name)
}
Write-Host ''
$choice = Read-Host 'Enter a number, or press Enter for ALL'

$selected = $tabs
if (-not [string]::IsNullOrWhiteSpace($choice)) {
    $n = 0
    if ([int]::TryParse($choice.Trim(), [ref] $n) -and $n -ge 1 -and $n -le $tabs.Count) {
        $selected = @($tabs[$n - 1])
    } else {
        Write-Host 'Not a valid choice; downloading ALL sections.' -ForegroundColor Yellow
    }
}

# --- Download loop ----------------------------------------------------------
# Files land next to this .cmd, not under Desktop/Documents (OneDrive-redirected
# on corporate machines). Atomic write: temp .part then rename, overwriting any
# existing file in place. Per-document retry once, then log and continue.
$baseDir = $env:HP_DIR
if (-not $baseDir) { $baseDir = (Get-Location).Path }
$root       = Join-Path $baseDir 'Horizon Power Documents'
$errorsPath = Join-Path $baseDir 'download-errors.txt'
$downloaded = 0
$shortcuts  = 0
$failed     = 0
$errors     = New-Object System.Collections.Generic.List[string]

foreach ($tab in $selected) {
    Write-Host ''
    Write-Host ("=== {0} ===" -f $tab.name) -ForegroundColor Cyan
    foreach ($table in @($tab.tables)) {
        $outDir = Join-Path (Join-Path $root $tab.folder) $table.folder
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null
        foreach ($doc in @($table.documents)) {
            $target = Join-Path $outDir $doc.filename
            if ($doc.type -eq 'shortcut') {
                # A non-HP reference: save a clickable Windows Internet Shortcut
                # (.url) in place of downloading. The browser opens the target.
                try {
                    Set-Content -LiteralPath $target -Value @('[InternetShortcut]', ('URL=' + $doc.url)) -Encoding ASCII
                    $shortcuts++
                    Write-Host ("  [URL] {0}" -f $doc.filename) -ForegroundColor Green
                } catch {
                    $failed++
                    $errors.Add(("{0}\{1} | {2} | {3}" -f $table.folder, $doc.filename, $doc.url, $_.Exception.Message))
                    Write-Host ("  [ERR] {0}" -f $doc.filename) -ForegroundColor Red
                }
                continue
            }
            $tmp    = "$target.part"
            $ok     = $false
            $lastMsg = ''
            for ($attempt = 1; $attempt -le 2 -and -not $ok; $attempt++) {
                try {
                    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
                    Invoke-WebRequest -Uri $doc.url -UseBasicParsing -UserAgent $UA -OutFile $tmp -TimeoutSec 120
                    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force }
                    Rename-Item -LiteralPath $tmp -NewName $doc.filename
                    $ok = $true
                } catch {
                    $lastMsg = $_.Exception.Message
                }
            }
            if (-not $ok -and (Test-Path -LiteralPath $tmp)) {
                Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
            }
            if ($ok) {
                $downloaded++
                Write-Host ("  [OK]  {0}" -f $doc.filename) -ForegroundColor Green
            } else {
                $failed++
                $errors.Add(("{0}\{1} | {2} | {3}" -f $table.folder, $doc.filename, $doc.url, $lastMsg))
                Write-Host ("  [ERR] {0}" -f $doc.filename) -ForegroundColor Red
            }
        }
    }
}

if ($errors.Count -gt 0) {
    Set-Content -LiteralPath $errorsPath -Value $errors -Encoding UTF8
} elseif (Test-Path -LiteralPath $errorsPath) {
    Remove-Item -LiteralPath $errorsPath -Force -ErrorAction SilentlyContinue
}

# --- Summary ----------------------------------------------------------------
Write-Host ''
Write-Host '===================================================' -ForegroundColor Cyan
Write-Host (" Downloaded: {0}   Shortcuts: {1}   Failed: {2}" -f $downloaded, $shortcuts, $failed)
if ($failed -gt 0) {
    Write-Host (" See {0} for the {1} failed item(s)." -f $errorsPath, $failed) -ForegroundColor Yellow
}
Write-Host (" Files are in: {0}" -f $root)
Write-Host '===================================================' -ForegroundColor Cyan

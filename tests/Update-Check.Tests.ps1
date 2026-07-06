#requires -Version 7
# Hand-rolled test harness for the update-notify logic (no Pester dependency).
# Run: pwsh -NoProfile -File tests/Update-Check.Tests.ps1
# Exits non-zero if any assertion fails.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here '..' 'src' 'Update-Check.ps1')

$script:pass = 0
$script:fail = 0

function Assert-Equal($expected, $actual, $because) {
    if ($expected -eq $actual) {
        $script:pass++
        Write-Host ("  [PASS] {0}" -f $because) -ForegroundColor Green
    } else {
        $script:fail++
        Write-Host ("  [FAIL] {0} -- expected <{1}> got <{2}>" -f $because, $expected, $actual) -ForegroundColor Red
    }
}

function Assert-Contains($haystack, $needle, $because) {
    if (($haystack -as [string]).Contains($needle)) {
        $script:pass++
        Write-Host ("  [PASS] {0}" -f $because) -ForegroundColor Green
    } else {
        $script:fail++
        Write-Host ("  [FAIL] {0} -- <{1}> not found in <{2}>" -f $because, $needle, $haystack) -ForegroundColor Red
    }
}

# --- Behaviour: remote newer than local means an update is available -----------
Assert-Equal $true (Test-UpdateAvailable -Local '1.3.0' -Remote '1.4.0') `
    'remote newer than local -> update available'

# --- Behaviour: equal versions means no update --------------------------------
Assert-Equal $false (Test-UpdateAvailable -Local '1.3.0' -Remote '1.3.0') `
    'remote equal to local -> no update'

# --- Behaviour: remote older than local means no update (never downgrade) ------
Assert-Equal $false (Test-UpdateAvailable -Local '1.4.0' -Remote '1.3.0') `
    'remote older than local -> no update'

# --- Behaviour: segments compared numerically, not lexically ------------------
# String compare would rank "1.9.0" above "1.10.0"; numeric must not.
Assert-Equal $true (Test-UpdateAvailable -Local '1.9.0' -Remote '1.10.0') `
    'remote 1.10.0 newer than local 1.9.0 (numeric, not string, compare)'

# --- Behaviour: unparseable remote is silent (best-effort, never throws) -------
# version.txt is fetched over HTTP; a proxy/error page or truncation can yield
# garbage. The check must degrade to "no update", never crash the download run.
Assert-Equal $false (Test-UpdateAvailable -Local '1.3.0' -Remote 'not-a-version') `
    'garbage remote -> no update, no throw'
Assert-Equal $false (Test-UpdateAvailable -Local '1.3.0' -Remote '') `
    'empty remote -> no update, no throw'

# --- Behaviour: trailing newline/whitespace from the HTTP fetch is tolerated ---
Assert-Equal $true (Test-UpdateAvailable -Local '1.3.0' -Remote "1.4.0`r`n") `
    'remote with trailing CRLF -> parsed, update available'

# --- Get-UpdateNotice: orchestrates fetch + decide + message ------------------
$dl = 'https://raw.githubusercontent.com/dthunder746/horizon-power-doc-downloader/main/Download-HorizonPower-Docs.cmd'

# Behaviour: newer remote -> a notice naming the new version and the link
$notice = Get-UpdateNotice -Local '1.3.0' -DownloadUrl $dl -FetchRemote { '1.4.0' }
Assert-Contains $notice '1.4.0' 'notice names the new version'
Assert-Contains $notice $dl    'notice includes the download link'

# Behaviour: fetch failure (offline/proxy/SSL) is silent -> no notice, no throw
Assert-Equal $null (Get-UpdateNotice -Local '1.3.0' -DownloadUrl $dl -FetchRemote { throw 'proxy blocked' }) `
    'fetch failure -> no notice, no throw (best-effort)'

# Behaviour: no update available (equal/older) -> no notice
Assert-Equal $null (Get-UpdateNotice -Local '1.4.0' -DownloadUrl $dl -FetchRemote { '1.4.0' }) `
    'up to date -> no notice'
Assert-Equal $null (Get-UpdateNotice -Local '1.4.0' -DownloadUrl $dl -FetchRemote { '1.3.0' }) `
    'remote older -> no notice'

# Behaviour: garbage remote -> no notice (delegates to Test-UpdateAvailable)
Assert-Equal $null (Get-UpdateNotice -Local '1.3.0' -DownloadUrl $dl -FetchRemote { '<html>403</html>' }) `
    'garbage remote -> no notice'

Write-Host ''
Write-Host ("{0} passed, {1} failed" -f $script:pass, $script:fail) -ForegroundColor Cyan
if ($script:fail -gt 0) { exit 1 }

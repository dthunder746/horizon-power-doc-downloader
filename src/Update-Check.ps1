#requires -Version 5
# Update-notify logic for the Horizon Power Doc Downloader.
#
# Source of truth. The shipped .cmd embeds a copy of Test-UpdateAvailable; a
# sync-check test guards the embedded copy against drift.
#
# Notify-only by design: the tool never modifies itself. It fetches version.txt
# from GitHub raw and, if a newer version exists, prints a notice with a link.
# The check is best-effort and must never block the actual downloads.

# Everything between the BEGIN/END markers below is copied verbatim into the
# shipping .cmd's PowerShell tail (ADR 0002: no dot-sourcing src/ at run time).
# A Node drift test (tests/cmd-sync.test.mjs) normalizes whitespace and asserts
# the two copies are identical, so editing one but not the other goes red.
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

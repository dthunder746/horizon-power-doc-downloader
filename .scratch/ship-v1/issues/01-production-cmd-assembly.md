# 01 — Production `.cmd` assembly

Status: ready-for-agent

Evolve `poc/Download-HorizonPower-Docs-POC.cmd` into the shipping `.cmd`. This is the keystone: the one self-contained file an end user runs. See PRD.md for purpose and non-goals; ADR 0002 for the update-check design.

## Scope

- Rename the file off the `-POC` name to its shipping name; move out of `poc/` to where the raw link will point (decide the final path and record it in the README).
- Preserve the proven launch profile: batch + PowerShell polyglot, exact CRLF bytes (`.gitattributes` `*.cmd -text` must stay), the `#PSCODE#` marker extraction. Do not regress the clean SmartScreen/AV behavior verified on real corporate hardware.
- Embed `set "HP_VERSION=x.y.z"` in the batch half.
- Embed a copy of `Test-UpdateAvailable` / `Get-UpdateNotice` from `src/Update-Check.ps1` into the PowerShell tail, wrapped in a stable delimiter/marker so a test can extract the body reliably. Call it early with a real `Invoke-WebRequest` fetch of `version.txt` from GitHub raw. Notify-only, best-effort, silent on any failure, never blocks downloads.
- Wire the manifest-driven download across all tabs/tables/documents (the POC downloads one).
  - Tab-level menu: list the tabs, user picks one or presses Enter for all.
  - Download into `Horizon Power Documents\[tab]\[table]\` next to the script (not Desktop/Documents, which are OneDrive-redirected on corporate machines).
  - Atomic write: temp `.part` then rename. **Overwrite the target in place** on re-download; never append version suffixes.
  - Per-document retry once on failure, then log to `download-errors.txt` and continue.
  - Final summary; `pause` at the end.
  - Always send an explicit non-empty `-UserAgent` on every request (empty UA is 403'd by Cloudflare on the file assets).
- Manifest fetch failure handling: retry once; if still failing, print **"The download manifest is unreachable: `<actual error>`"** with the real cause in readable form (e.g. `404 Not Found`, `The operation has timed out`, `The remote name could not be resolved`), then `pause` and exit without attempting downloads.

## Tests

- **Drift-detecting sync test:** read the embedded notify body out of the `.cmd` and the canonical body out of `src/Update-Check.ps1`, normalize whitespace, assert identical. Prevents the two copies silently drifting.
- **Version-consistency test:** assert `HP_VERSION` embedded in the `.cmd` equals the contents of `version.txt`. Prevents shipping a `.cmd` that would falsely nag a freshly-copied user.

## Verification

Do not claim done from unit tests alone. Actually run the `.cmd` on Windows: confirm the menu, the folder tree, a real download, the summary, and the update notice path (both up-to-date and newer-available). Confirm the manifest-unreachable message by simulating a failed fetch.

## Depends on

- Issue 02 (`version.txt`) and Issue 03 (full `manifest.json`) should exist for a real end-to-end run, though the `.cmd` can be built against the POC manifest first.

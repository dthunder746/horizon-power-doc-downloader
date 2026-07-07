# Update check is notify-only and embedded in the .cmd

The shipped artifact is a single standalone `.cmd` that end users copy and run. It must stay self-contained, so the update-check logic is **embedded** as a copy in the `.cmd`'s PowerShell tail rather than dot-sourced from `src/Update-Check.ps1` (which cannot be present at run time).

The check is **notify-only**: it fetches a `version.txt` from GitHub raw, compares versions, and prints a notice if a newer `.cmd` exists. It never modifies itself. Self-replacing a running `.cmd` is fragile and is exactly the heuristic that AV / AppLocker flags, which would jeopardise the clean SmartScreen/AV launch profile the POC proved on real corporate hardware. The check is best-effort: any fetch or parse failure stays silent and never blocks a download run.

Because a copy is embedded, two copies of the logic exist and can drift. `src/Update-Check.ps1` remains the unit-tested source of truth; a drift-detecting test normalizes whitespace and asserts the embedded body matches the canonical one, so an edit to one but not the other goes red. We chose this over generating the `.cmd` from a template, to avoid adding a build step that reassembles the delicate polyglot file (exact CRLF bytes, `#PSCODE#` marker).

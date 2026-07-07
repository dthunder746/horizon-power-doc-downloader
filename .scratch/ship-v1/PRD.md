# Ship v1: Horizon Power Doc Downloader

## Purpose

Let a coworker (external staff, same audience as the maintainer) on a locked-down corporate Windows laptop (no admin rights, no installs) bulk-download the public technical documents Horizon Power publishes across the 4 tabs of one web page, landing them in a tidy `Horizon Power Documents\[tab]\[table]\` folder tree next to the script.

Delivery is a single standalone `.cmd` fetched from a raw GitHub link. At run time it pulls `manifest.json` and `version.txt` from GitHub (the file assets are not Cloudflare-protected, only the HTML page is) and downloads each document directly. The maintainer periodically runs a Playwright scraper to regenerate the manifest, then commits and pushes.

Audience is small and internal. Robustness matters; polish does not.

## Distribution

Repo stays public (see ADR 0001). The `.cmd` lives on a shared drive; people copy it and take it with them. Updating the manifest or the `.cmd` via GitHub is core, because live-fetched manifests and the notify-only update check reach every copy.

## Scope (v1)

- Single self-contained `.cmd` (batch + PowerShell polyglot), the only file an end user handles.
- Tab-level menu: pick one tab or press Enter for all.
- Downloads into `Horizon Power Documents\[tab]\[table]\` next to the script; atomic temp + rename; overwrite in place on re-download.
- Per-document retry-once, `download-errors.txt`, final summary, `pause` at end.
- Manifest fetch failure (no internet, proxy/firewall, unreachable): retry once, then a clear "The download manifest is unreachable: <actual error>" message, then pause and exit without downloading.
- Notify-only update check (see ADR 0002): best-effort, silent on failure, never blocks a run.
- Maintainer-side Playwright scraper regenerating `manifest.json`.
- End-user-first README.

## Non-goals (v1)

- **No self-update.** Notify-only; the `.cmd` never modifies itself (protects the clean AV/SmartScreen launch profile proven on real hardware).
- **No per-document picking.** Granularity is tab-level only.
- **No incremental/skip-existing sync.** Every run re-downloads the chosen tab(s) fresh and **overwrites files in place** (no `(2)` version suffixes for re-downloads).
- **Windows-only end user.** The scraper runs on the maintainer's macOS; the shipped `.cmd` targets Windows only.
- **No authentication.** All content is public.

## Decisions on record

- ADR 0001 — repository stays public.
- ADR 0002 — update check is notify-only and embedded in the `.cmd`.
- `version.txt` / `HP_VERSION` track the **script**, not the documents. Bumped manually, both together, when a changed `.cmd` ships.

## Status of existing work

Pure-logic cores are built and green (commits `04f4a0f`, `982d9ef`, `76a3a54`, `df19837`): scraper name transforms, `buildManifest`, PowerShell notify logic. All local-only, not pushed. Remaining work is captured as the issues in this directory.

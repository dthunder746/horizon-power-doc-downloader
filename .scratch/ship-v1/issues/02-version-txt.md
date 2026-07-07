# 02 — `version.txt` at repo root

Status: ready-for-agent

Add a `version.txt` at the repo root, raw-served, containing just the current Downloader version (e.g. `1.0.0`). This is what a running `.cmd` compares itself against for the notify-only update check (ADR 0002).

## Scope

- Create `version.txt` with a single semantic-ish `x.y.z` line.
- Seed it to match the `HP_VERSION` embedded in the shipping `.cmd` (Issue 01). The version-consistency test in Issue 01 enforces they stay equal.

## Semantics (record in README maintainer section)

- `version.txt` / `HP_VERSION` track the **Downloader script**, not the documents. Manifest regenerations do **not** bump it, because live-fetched manifests already reach every user.
- Bump manually when a changed `.cmd` ships. Change `version.txt` and the `.cmd`'s `HP_VERSION` together (the guard test fails otherwise).

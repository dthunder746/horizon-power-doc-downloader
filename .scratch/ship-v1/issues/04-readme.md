# 04 — README

Status: ready-for-agent

End-user-first README. This is the durable, public home for how to use the tool. No dashes (or em dashes) as punctuation; rephrase with periods, commas, or parentheses. No screenshots. Text only.

## Scope

- **End-user section first and prominent:**
  - What the tool is (bulk-downloads Horizon Power's public technical documents).
  - How to get it: the raw GitHub link to the single `.cmd` (or copy it off the shared drive).
  - How to run it: double-click, pick a tab or press Enter for all.
  - What appears: a `Horizon Power Documents\[tab]\[table]\` folder next to the script.
  - The update notice: a one-line "newer version available" heads-up that never changes what downloads; grab the fresh `.cmd` when convenient.
  - What to do if it says the manifest is unreachable (check internet / corporate proxy, run again).
- **Maintainer section at the bottom:**
  - Regenerate the manifest: `node scraper/scrape.mjs`, review the dead-link report and counts, commit, push.
  - Version bump discipline: `version.txt` and the `.cmd`'s `HP_VERSION` track the script, not the docs; bump both together; the guard test enforces equality.
  - Repo stays public (ADR 0001); all content is public Horizon Power material.

## Depends on

- Issue 01 (final `.cmd` name/path) so the raw link in the README is correct.
